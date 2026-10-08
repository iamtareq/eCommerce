"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

/**
 * Shopping cart kept in the visitor's browser (localStorage). It holds only
 * what is needed to display the cart; prices shown at checkout always come
 * from the server quote.
 */

export interface CartItem {
  variantId: string;
  productId: string;
  slug: string;
  name: string;
  variantName: string;
  image: string | null;
  /** Display-only price at the time of adding. */
  price: number;
  quantity: number;
  maxQuantity: number;
}

interface CartContextValue {
  items: CartItem[];
  ready: boolean;
  /** Units in the cart. */
  count: number;
  /**
   * The product of the page being viewed, once the visitor is clearly ordering
   * it. It is part of the order on screen but not yet a cart item, so the cart
   * badge counts it and opening the cart commits it. Never persisted.
   */
  pending: CartItem | null;
  /** What the pending line adds to the badge: 0 once that variant is in the cart. */
  pendingCount: number;
  setPending: (item: CartItem | null) => void;
  /** Move the pending line into the cart — call before leaving the page it belongs to. */
  commitPending: () => void;
  add: (item: Omit<CartItem, "quantity">, quantity?: number) => void;
  setQuantity: (variantId: string, quantity: number) => void;
  remove: (variantId: string) => void;
  has: (variantId: string) => boolean;
  clear: () => void;
}

const CartContext = createContext<CartContextValue | null>(null);
const STORAGE_KEY = "deenbox.cart.v1";
const MAX_LINES = 20;

function read(): CartItem[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (i): i is CartItem =>
          i && typeof i.variantId === "string" && typeof i.name === "string" && Number.isInteger(i.quantity) && i.quantity > 0,
      )
      .slice(0, MAX_LINES);
  } catch {
    return [];
  }
}

function write(items: CartItem[]) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {
    // Private mode / storage full — the cart still works for this page view.
  }
}

/** Two pending lines that are the same offer must not cause a re-render. */
function samePending(a: CartItem | null, b: CartItem | null): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return a.variantId === b.variantId && a.quantity === b.quantity && a.price === b.price;
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [ready, setReady] = useState(false);
  const [pending, setPendingState] = useState<CartItem | null>(null);

  useEffect(() => {
    // Hydrate after mount so server and first client render match.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setItems(read());
    setReady(true);
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) setItems(read());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const update = useCallback((fn: (prev: CartItem[]) => CartItem[]) => {
    setItems((prev) => {
      const next = fn(prev);
      write(next);
      return next;
    });
  }, []);

  // Stable, so the page that owns a pending line can register it from an effect.
  const setPending = useCallback((item: CartItem | null) => {
    setPendingState((prev) => (samePending(prev, item) ? prev : item));
  }, []);

  const value = useMemo<CartContextValue>(() => {
    const add: CartContextValue["add"] = (item, quantity = 1) =>
        update((prev) => {
          const existing = prev.find((i) => i.variantId === item.variantId);
          if (existing) {
            return prev.map((i) =>
              i.variantId === item.variantId
                ? { ...i, ...item, quantity: Math.min(item.maxQuantity || i.maxQuantity, i.quantity + quantity) }
                : i,
            );
          }
          if (prev.length >= MAX_LINES) return prev;
          return [...prev, { ...item, quantity: Math.max(1, Math.min(item.maxQuantity || quantity, quantity)) }];
        });

    const pendingInCart = !!pending && items.some((i) => i.variantId === pending.variantId);

    return {
      items,
      ready,
      count: items.reduce((s, i) => s + i.quantity, 0),
      pending,
      pendingCount: pending && !pendingInCart ? pending.quantity : 0,
      setPending,
      commitPending: () => {
        if (pending && !pendingInCart) {
          const { quantity, ...item } = pending;
          add(item, quantity);
        }
        setPendingState(null);
      },
      add,
      setQuantity: (variantId, quantity) =>
        update((prev) =>
          prev.map((i) => (i.variantId === variantId ? { ...i, quantity: Math.max(1, Math.min(quantity, i.maxQuantity || quantity)) } : i)),
        ),
      remove: (variantId) => update((prev) => prev.filter((i) => i.variantId !== variantId)),
      has: (variantId) => items.some((i) => i.variantId === variantId),
      clear: () => update(() => []),
    };
  }, [items, ready, update, pending, setPending]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used inside <CartProvider>");
  return ctx;
}
