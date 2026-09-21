"use client";

import { createContext, useContext, useMemo, useState } from "react";

export interface ClientVariant {
  id: string;
  name: string;
  price: number;
  compareAtPrice: number | null;
  inStock: boolean;
  maxQuantity: number;
}

export interface ClientProduct {
  id: string;
  slug: string;
  name: string;
  variantLabel: string;
  image: string | null;
  variants: ClientVariant[];
  tiers: { minQuantity: number; type: "PERCENT" | "FIXED"; value: number }[];
}

interface ProductContextValue {
  product: ClientProduct;
  variant: ClientVariant;
  quantity: number;
  setVariantId: (id: string) => void;
  setQuantity: (n: number) => void;
}

const Ctx = createContext<ProductContextValue | null>(null);

/** Shared selection (variant + quantity) for the hero, sticky bar and order form. */
export function ProductProvider({ product, children }: { product: ClientProduct; children: React.ReactNode }) {
  const initial = product.variants.find((v) => v.inStock) ?? product.variants[0]!;
  const [variantId, setVariantId] = useState(initial.id);
  const [rawQuantity, setRawQuantity] = useState(1);

  const variant = product.variants.find((v) => v.id === variantId) ?? initial;
  const quantity = Math.max(1, Math.min(rawQuantity, variant.maxQuantity || 1));

  const value = useMemo<ProductContextValue>(
    () => ({
      product,
      variant,
      quantity,
      setVariantId,
      setQuantity: (n) => setRawQuantity(Math.max(1, Math.floor(n) || 1)),
    }),
    [product, variant, quantity],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useProduct(): ProductContextValue {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useProduct must be used inside <ProductProvider>");
  return ctx;
}
