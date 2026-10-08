"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useCart, type CartItem } from "@/components/cart/CartProvider";
import { Icon } from "@/components/ui/Icon";
import { btn, field } from "@/components/ui/styles";
import { track } from "@/lib/analytics";
import { cn } from "@/lib/cn";
import { formatTakaBn } from "@/lib/money";
import { normalizeBdPhone, toBanglaDigits } from "@/lib/phone";
import { checkoutSchema, fieldErrors as toFieldErrors, type QuoteInput } from "@/lib/validation/checkout";
import { MSG } from "@/lib/validation/messages";
import { FieldError } from "./FieldError";
import { LocationFields, type LocationValue } from "./LocationFields";
import { OrderSummary } from "./OrderSummary";
import { QuantityStepper } from "./QuantityStepper";
import type { CheckoutLine, FeaturedProduct, Quote } from "./types";

function newKey(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
}

const FIELD_ORDER = ["items", "customerName", "mobileNumber", "divisionId", "districtId", "areaId", "areaOther", "address", "couponCode"];

const QUOTE_TIMEOUT_MS = 15_000;

/**
 * Where the half-filled form is kept while the visitor steps away to pick more
 * products. sessionStorage, not localStorage: the draft dies with the tab, so
 * personal details are not left behind on a shared device.
 */
const DRAFT_KEY = "deenbox.checkout.draft.v1";

interface Draft {
  customerName: string;
  mobileNumber: string;
  location: LocationValue;
  address: string;
  customerNote: string;
  giftMessage: string;
  giftWrap: boolean;
  appliedCoupon: string;
}

/**
 * Prices the given inputs on the server. Resolves to null when the request
 * fails, times out or is cancelled — the caller decides how to recover.
 */
async function fetchQuote(input: QuoteInput, signal?: AbortSignal): Promise<Quote | null> {
  if (signal?.aborted) return null;
  const controller = new AbortController();
  const cancel = () => controller.abort();
  signal?.addEventListener("abort", cancel);
  const timer = setTimeout(cancel, QUOTE_TIMEOUT_MS);
  try {
    const res = await fetch("/api/checkout/quote", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
      signal: controller.signal,
    });
    const data = (await res.json()) as { ok: boolean; quote?: Quote; message?: string };
    return data.ok && data.quote ? data.quote : null;
  } catch {
    return null; // network hiccup, timeout or aborted
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", cancel);
  }
}

/** The cart's view of a checkout line. */
function toCartItem(line: CheckoutLine): CartItem {
  return {
    variantId: line.variantId,
    productId: line.productId,
    slug: line.slug,
    name: line.name,
    variantName: line.variantName,
    image: line.image,
    price: line.price,
    quantity: line.quantity,
    maxQuantity: line.maxQuantity,
  };
}

function Card({ step, title, children }: { step: string; title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-card border border-line bg-surface p-4 shadow-soft sm:p-6">
      <h3 className="mb-4 flex items-center gap-2.5 font-sans text-lg font-semibold text-ink">
        <span className="grid size-7 place-items-center rounded-full bg-pine-700 text-sm font-bold text-white" aria-hidden="true">
          {step}
        </span>
        {title}
      </h3>
      {children}
    </section>
  );
}

export function Checkout({ featured }: { featured?: FeaturedProduct }) {
  const router = useRouter();
  const cart = useCart();

  const [featuredDismissed, setFeaturedDismissed] = useState(false);
  const [customerName, setCustomerName] = useState("");
  const [mobileNumber, setMobileNumber] = useState("");
  const [location, setLocation] = useState<LocationValue>({ divisionId: "", districtId: "", areaId: "", areaOther: "" });
  const [address, setAddress] = useState("");
  const [customerNote, setCustomerNote] = useState("");
  const [giftMessage, setGiftMessage] = useState("");
  const [giftWrap, setGiftWrap] = useState(false);
  const [couponOpen, setCouponOpen] = useState(false);
  const [couponInput, setCouponInput] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState("");

  const [errors, setErrors] = useState<Record<string, string | undefined>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [attempted, setAttempted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);
  const idempotencyKey = useRef<string>("");
  // The order the key was made for: an edited order needs a new key.
  const idempotencyFor = useRef("");
  const started = useRef(false);

  const [quote, setQuote] = useState<Quote | null>(null);
  const [quoteKey, setQuoteKey] = useState("");
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [quoteNonce, setQuoteNonce] = useState(0);
  // The inputs on screen now, for work that resumes after an await.
  const latestInputKey = useRef("");

  // ─── Draft: what was typed survives a trip to the product list and back.
  const [draftReady, setDraftReady] = useState(false);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(DRAFT_KEY);
      const d = raw ? (JSON.parse(raw) as Partial<Draft>) : null;
      if (d) {
        const str = (v: unknown) => (typeof v === "string" ? v.slice(0, 1000) : "");
        const coupon = str(d.appliedCoupon);
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setCustomerName(str(d.customerName));
        setMobileNumber(str(d.mobileNumber));
        setAddress(str(d.address));
        setCustomerNote(str(d.customerNote));
        setGiftMessage(str(d.giftMessage));
        setGiftWrap(d.giftWrap === true);
        setAppliedCoupon(coupon);
        setCouponInput(coupon);
        const loc = d.location;
        if (loc && typeof loc === "object") {
          setLocation({
            divisionId: str(loc.divisionId),
            districtId: str(loc.districtId),
            areaId: str(loc.areaId),
            areaOther: str(loc.areaOther),
          });
        }
      }
    } catch {
      // Private mode or a corrupt draft — start with an empty form.
    }
    setDraftReady(true);
  }, []);

  useEffect(() => {
    if (!draftReady) return; // never overwrite the draft before it is read
    const draft: Draft = { customerName, mobileNumber, location, address, customerNote, giftMessage, giftWrap, appliedCoupon };
    try {
      sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    } catch {
      // Storage unavailable or full — the form still works for this page view.
    }
  }, [draftReady, customerName, mobileNumber, location, address, customerNote, giftMessage, giftWrap, appliedCoupon]);

  // ─── Lines: the product being viewed (if not already in the cart) + cart items.
  const featuredVariant = featured?.variants.find((v) => v.id === featured.selectedVariantId);
  const featuredLine: CheckoutLine | null =
    featured && featuredVariant && !featuredDismissed && featuredVariant.inStock && !cart.has(featuredVariant.id)
      ? {
          variantId: featuredVariant.id,
          productId: featured.productId,
          slug: featured.slug,
          name: featured.name,
          variantName: featured.variants.length > 1 ? featuredVariant.name : "",
          image: featured.image,
          price: featuredVariant.price,
          quantity: Math.min(featured.quantity, featuredVariant.maxQuantity || 1),
          maxQuantity: featuredVariant.maxQuantity,
          featured: true,
        }
      : null;

  const lines: CheckoutLine[] = useMemo(
    () => [
      ...(featuredLine ? [featuredLine] : []),
      ...cart.items.map((i) => ({ ...i, featured: false })),
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [featuredLine?.variantId, featuredLine?.quantity, featuredLine?.price, cart.items],
  );

  // ─── The viewed product is part of the order but not of the cart, so the cart
  // badge would undercount it. Once the visitor is filling in the form for it,
  // register it: the badge counts it and opening the cart takes it along.
  const ordering = Boolean(customerName || mobileNumber || address || location.divisionId || customerNote || giftMessage || giftWrap);
  const setPending = cart.setPending;
  useEffect(() => {
    if (!featuredLine || !ordering) {
      setPending(null);
      return;
    }
    setPending(toCartItem(featuredLine));
    return () => setPending(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ordering, setPending, featuredLine?.variantId, featuredLine?.quantity, featuredLine?.price]);

  const items = useMemo(() => lines.map((l) => ({ variantId: l.variantId, quantity: l.quantity })), [lines]);
  const inputKey = JSON.stringify([items, location.districtId, location.areaId, appliedCoupon, giftWrap]);
  const quoteInput: QuoteInput = {
    items,
    districtId: location.districtId || undefined,
    areaId: location.areaId || undefined,
    couponCode: appliedCoupon || undefined,
    giftWrap,
  };

  // ─── Live quote from the server (debounced; stale responses discarded).
  useEffect(() => {
    latestInputKey.current = inputKey;
    if (!cart.ready) return;
    if (items.length === 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setQuote(null);
      setQuoteKey("");
      setQuoteLoading(false);
      return;
    }
    const controller = new AbortController();
    const key = inputKey;
    setQuoteLoading(true);
    const timer = setTimeout(async () => {
      const fresh = await fetchQuote(quoteInput, controller.signal);
      if (controller.signal.aborted) return; // superseded by newer inputs
      // A failed request keeps the previous quote; submitting re-prices inline.
      if (fresh) {
        setQuote(fresh);
        setQuoteKey(key);
      }
      setQuoteLoading(false);
    }, 250);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inputKey, cart.ready, quoteNonce]);

  const quoteLines = useMemo(() => new Map(quote?.lines.map((l) => [l.variantId, l]) ?? []), [quote]);
  const issues = useMemo(() => new Map(quote?.issues.map((i) => [i.variantId, i]) ?? []), [quote]);

  // ─── Field helpers
  const currentValues = useCallback(
    () => ({
      customerName,
      mobileNumber,
      divisionId: location.divisionId,
      districtId: location.districtId,
      areaId: location.areaId,
      areaOther: location.areaOther || undefined,
      address,
      customerNote: customerNote || undefined,
      giftMessage: giftMessage || undefined,
      giftWrap,
      couponCode: appliedCoupon || undefined,
      items,
      idempotencyKey: idempotencyKey.current || "x".repeat(16),
    }),
    [customerName, mobileNumber, location, address, customerNote, giftMessage, giftWrap, appliedCoupon, items],
  );

  // Unfinished checkout: once the phone is valid, save name, phone and cart (a moment after the
  // last change) so staff can call to help. The phone field's hint tells the customer.
  const leadSent = useRef("");
  useEffect(() => {
    const phone = normalizeBdPhone(mobileNumber);
    if (!phone || items.length === 0 || submittingRef.current) return;
    const body = JSON.stringify({
      customerName: customerName.trim().slice(0, 80),
      mobileNumber: phone,
      districtId: location.districtId || undefined,
      items,
    });
    if (body === leadSent.current) return;
    let retry: ReturnType<typeof setTimeout> | undefined;
    // Set once the inputs change: this effect's save is stale and must not be retried.
    let cancelled = false;
    const send = (attempt: number) => {
      if (cancelled || submittingRef.current) return;
      leadSent.current = body;
      fetch("/api/checkout/lead", { method: "POST", headers: { "Content-Type": "application/json" }, body, keepalive: true })
        .then((res) => res.ok)
        .catch(() => false)
        .then((ok) => {
          if (ok) return;
          // Failed (network, rate limit): forget it so the same values are sent again later, and try
          // once more after a pause in case the customer stops here. A newer change cancels the retry.
          if (leadSent.current === body) leadSent.current = "";
          if (!cancelled && attempt === 0) retry = setTimeout(() => send(1), 8000);
        });
    };
    const timer = setTimeout(() => send(0), 2500);
    return () => {
      cancelled = true;
      clearTimeout(timer);
      clearTimeout(retry);
    };
  }, [mobileNumber, customerName, location.districtId, items]);

  // After the first submit attempt, re-validate as the customer types.
  useEffect(() => {
    if (!attempted) return;
    const result = checkoutSchema.safeParse(currentValues());
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setErrors(result.success ? {} : toFieldErrors(result.error));
  }, [attempted, currentValues]);

  function onFormFocus() {
    if (started.current) return;
    started.current = true;
    track({ name: "order_form_started", value: quote?.total });
  }

  function updateLineQuantity(line: CheckoutLine, quantity: number) {
    if (line.featured) featured?.onQuantityChange(quantity);
    else cart.setQuantity(line.variantId, quantity);
  }

  /**
   * The product-page line is not in the cart yet, so navigating away would drop
   * it. Move it into the cart first, then go to the product list.
   */
  function addMoreProducts() {
    if (featuredLine) cart.add(toCartItem(featuredLine), featuredLine.quantity);
    router.push("/products");
  }

  function removeLine(line: CheckoutLine) {
    if (line.featured) setFeaturedDismissed(true);
    else cart.remove(line.variantId);
  }

  function focusFirstError(errs: Record<string, string | undefined>) {
    const first = FIELD_ORDER.find((k) => errs[k]);
    const idMap: Record<string, string> = {
      customerName: "customerName",
      mobileNumber: "mobileNumber",
      divisionId: "division",
      districtId: "district",
      areaId: "area",
      areaOther: "areaOther",
      address: "address",
      couponCode: "couponCode",
    };
    const el = first ? document.getElementById(idMap[first] ?? "") : null;
    el?.focus();
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submittingRef.current) return; // double-click guard
    setAttempted(true);
    setFormError(null);

    if (lines.length === 0) {
      setFormError(MSG.emptyCart);
      return;
    }

    const parsed = checkoutSchema.safeParse(currentValues());
    if (!parsed.success) {
      const errs = toFieldErrors(parsed.error);
      setErrors(errs);
      setFormError(errs.items ?? "অনুগ্রহ করে লাল চিহ্নিত তথ্যগুলো ঠিক করুন।");
      focusFirstError(errs);
      return;
    }

    submittingRef.current = true;
    setSubmitting(true);
    const stop = (message: string) => {
      setFormError(message);
      submittingRef.current = false;
      setSubmitting(false);
    };

    // The order carries the total the customer confirmed; the server refuses a
    // different amount. If the shown quote is not for exactly these inputs
    // (still loading, or its request failed), price them now, and show a changed
    // total for another confirmation instead of ordering it unseen.
    let priced = quote && quoteKey === inputKey && !quoteLoading ? quote : null;
    if (!priced) {
      const fresh = await fetchQuote(quoteInput);
      if (!fresh) return stop(MSG.serverError);
      // The customer edited the order meanwhile: the debounced quote owns the
      // summary now, and the click-time values must not be ordered.
      if (latestInputKey.current !== inputKey) return stop(MSG.priceChanged);
      setQuote(fresh);
      setQuoteKey(inputKey);
      priced = fresh;
    }
    if (priced.issues.some((i) => i.maxQuantity === 0)) return stop(MSG.cartChanged);
    if (appliedCoupon && priced.coupon && !priced.coupon.applied) {
      // The server would refuse it, and each refused attempt counts toward the per-phone order limit.
      stop(MSG.couponNotApplied);
      requestAnimationFrame(() => document.getElementById("couponCode")?.focus());
      return;
    }
    if (priced.total !== quote?.total) return stop(MSG.priceChanged);

    const expectedTotal = priced.total;
    track({ name: "order_form_submitted", value: expectedTotal, itemCount: parsed.data.items.reduce((s, i) => s + i.quantity, 0) });

    // A retry of the same order keeps its key, so an order already placed (its
    // response lost) comes back instead of being placed twice. A changed order
    // gets a new key; the old one would return the earlier order and drop the edits.
    const values = currentValues();
    const fingerprint = JSON.stringify({ ...values, idempotencyKey: "" });
    if (!idempotencyKey.current || idempotencyFor.current !== fingerprint) {
      idempotencyKey.current = newKey();
      idempotencyFor.current = fingerprint;
    }

    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...values, idempotencyKey: idempotencyKey.current, expectedTotal }),
      });
      const data = (await res.json().catch(() => null)) as
        | { ok: true; orderNumber: string; token: string; total: number; itemCount: number }
        | { ok: false; code: string; message: string; fieldErrors?: Record<string, string> }
        | null;

      if (data && data.ok) {
        track({ name: "order_success", orderNumber: data.orderNumber, value: data.total, itemCount: data.itemCount });
        try {
          sessionStorage.removeItem(DRAFT_KEY);
          sessionStorage.setItem(`deenbox.tracked.${data.orderNumber}`, "1");
        } catch {}
        cart.clear();
        router.push(`/order/${data.token}`);
        return; // keep the button disabled while navigating
      }

      if (data && !data.ok) {
        if (data.fieldErrors && Object.keys(data.fieldErrors).length) {
          setErrors(data.fieldErrors);
          focusFirstError(data.fieldErrors);
        }
        setFormError(data.message || MSG.serverError);
        if (data.code === "CART" || data.code === "PRICE_CHANGED") {
          // The shown quote is out of date: re-quote now, and if that request
          // fails, the next submit re-prices inline instead of reusing it.
          setQuoteKey("");
          setQuoteNonce((n) => n + 1);
        }
      } else {
        setFormError(MSG.serverError);
      }
    } catch {
      setFormError(MSG.serverError);
    }
    submittingRef.current = false;
    setSubmitting(false);
  }

  // ─── Render
  if (cart.ready && lines.length === 0) {
    return (
      <div className="rounded-card border border-dashed border-line-strong bg-surface p-8 text-center">
        <Icon name="bag" className="mx-auto size-10 text-pine-700" />
        <p className="mt-3 text-lg font-semibold">আপনার কার্টে কোনো পণ্য নেই</p>
        <p className="mt-1 text-muted">পছন্দের পণ্য বেছে নিয়ে অর্ডার করুন।</p>
        <div className="mt-5 flex flex-wrap justify-center gap-3">
          {featured && featuredDismissed && (
            <button type="button" onClick={() => setFeaturedDismissed(false)} className={cn(btn.primary, btn.size.md)}>
              {featured.name} যোগ করুন
            </button>
          )}
          <Link href="/products" className={cn(featured && featuredDismissed ? btn.outline : btn.primary, btn.size.md)}>
            সকল পণ্য দেখুন
          </Link>
        </div>
      </div>
    );
  }

  const couponState = quote?.coupon;

  return (
    <form onSubmit={onSubmit} onFocus={onFormFocus} noValidate className="grid grid-cols-[minmax(0,1fr)] items-start gap-5 lg:grid-cols-[minmax(0,1fr)_380px] lg:gap-8">
      <div className="space-y-5">
        <Card step="১" title="পণ্য নির্বাচন">
          <ul className="divide-y divide-line">
            {lines.map((line) => {
              const q = quoteLines.get(line.variantId);
              const issue = issues.get(line.variantId);
              const max = Math.max(1, issue?.maxQuantity || q?.maxQuantity || line.maxQuantity || 1);
              const unit = q?.unitPrice ?? line.price;
              return (
                <li key={line.variantId} className="py-4 first:pt-0 last:pb-0">
                  <div className="flex gap-3.5">
                    <div className="relative size-18 shrink-0 overflow-hidden rounded-xl border border-line bg-sand">
                      {line.image ? (
                        <Image src={line.image} alt="" fill sizes="72px" className="object-cover" />
                      ) : (
                        <span className="bg-girih grid h-full place-items-center bg-pine-50 text-pine-700">
                          <Icon name="gift" className="size-6" />
                        </span>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-semibold leading-snug text-ink">{line.name}</p>
                          {line.variantName && !line.featured && <p className="text-sm text-muted">{line.variantName}</p>}
                          <p className="mt-0.5 text-sm text-muted">একক মূল্য: {formatTakaBn(unit)}</p>
                        </div>
                        {(lines.length > 1 || !line.featured) && (
                          <button
                            type="button"
                            onClick={() => removeLine(line)}
                            className="-mt-1 -mr-1 grid size-9 shrink-0 place-items-center rounded-lg text-muted hover:bg-danger-50 hover:text-danger-700"
                            aria-label={`${line.name} অর্ডার থেকে বাদ দিন`}
                          >
                            <Icon name="trash" className="size-[1.1rem]" />
                          </button>
                        )}
                      </div>

                      {line.featured && featured && featured.variants.length > 1 && (
                        <fieldset className="mt-3">
                          <legend className="mb-1.5 text-sm font-semibold text-ink-soft">{featured.variantLabel}</legend>
                          <div className="flex flex-wrap gap-2">
                            {featured.variants.map((v) => (
                              <label key={v.id} className={cn("cursor-pointer", !v.inStock && "cursor-not-allowed opacity-50")}>
                                <input
                                  type="radio"
                                  name="featured-variant"
                                  className="peer sr-only"
                                  checked={v.id === featured.selectedVariantId}
                                  disabled={!v.inStock}
                                  onChange={() => featured.onVariantChange(v.id)}
                                />
                                <span className="inline-flex min-h-10 items-center rounded-lg border border-line-strong bg-surface px-3 text-sm font-medium text-ink-soft peer-checked:border-pine-700 peer-checked:bg-pine-50 peer-checked:text-pine-900 peer-focus-visible:ring-2 peer-focus-visible:ring-pine-600">
                                  {v.name}
                                  {!v.inStock && " (স্টক শেষ)"}
                                </span>
                              </label>
                            ))}
                          </div>
                        </fieldset>
                      )}

                      <div className="mt-3 flex items-center justify-between gap-3">
                        <QuantityStepper
                          size="sm"
                          value={line.quantity}
                          max={max}
                          onChange={(n) => updateLineQuantity(line, n)}
                          label={`${line.name} — পরিমাণ`}
                        />
                        <span className="font-semibold tabular-nums text-pine-800">{formatTakaBn(unit * line.quantity)}</span>
                      </div>
                      {issue && (
                        <p className="mt-2 flex items-start gap-1.5 text-sm font-medium text-danger-700" role="alert">
                          <Icon name="alert" className="mt-0.5 size-4 shrink-0" />
                          {issue.message}
                        </p>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
          {quote && quote.appliedTiers.length > 0 && (
            <p className="mt-4 flex items-center gap-2 rounded-xl bg-success-50 px-3 py-2 text-sm font-medium text-success-700">
              <Icon name="sparkles" className="size-4 shrink-0" />
              {quote.appliedTiers.map((t) => `${t.productName}: ${formatTakaBn(t.amount)} ছাড় পেয়েছেন`).join("। ")}
            </p>
          )}
          <button
            type="button"
            onClick={addMoreProducts}
            className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-pine-700 hover:text-pine-900"
          >
            <Icon name="plus" className="size-4" /> আরও পণ্য যোগ করুন
          </button>
        </Card>

        <Card step="২" title="আপনার তথ্য">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="customerName" className={field.label}>
                আপনার নাম <span className="text-danger-600">*</span>
              </label>
              <input
                id="customerName"
                name="name"
                className={field.input}
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                autoComplete="name"
                maxLength={80}
                placeholder="যেমন: আব্দুল্লাহ আল মামুন"
                aria-invalid={!!errors.customerName}
                aria-describedby={errors.customerName ? "customerName-error" : undefined}
              />
              <FieldError id="customerName-error" message={errors.customerName} />
            </div>
            <div>
              <label htmlFor="mobileNumber" className={field.label}>
                মোবাইল নম্বর <span className="text-danger-600">*</span>
              </label>
              <input
                id="mobileNumber"
                name="tel"
                type="tel"
                inputMode="tel"
                className={field.input}
                value={mobileNumber}
                onChange={(e) => setMobileNumber(e.target.value)}
                autoComplete="tel"
                maxLength={20}
                placeholder="01XXXXXXXXX"
                aria-invalid={!!errors.mobileNumber}
                aria-describedby={errors.mobileNumber ? "mobileNumber-error" : "mobileNumber-hint"}
              />
              {errors.mobileNumber ? (
                <FieldError id="mobileNumber-error" message={errors.mobileNumber} />
              ) : (
                <p id="mobileNumber-hint" className={field.hint}>
                  এই নম্বরে ফোন করে অর্ডার কনফার্ম করা হবে। অর্ডার শেষ করতে না পারলে সাহায্যের জন্যও আমরা এই নম্বরে যোগাযোগ করতে পারি।
                </p>
              )}
            </div>
          </div>
        </Card>

        <Card step="৩" title="ডেলিভারি ঠিকানা">
          <LocationFields value={location} onChange={setLocation} errors={errors} />
          <div className="mt-4">
            <label htmlFor="address" className={field.label}>
              সম্পূর্ণ ঠিকানা <span className="text-danger-600">*</span>
            </label>
            <textarea
              id="address"
              name="address"
              className={field.textarea}
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              autoComplete="street-address"
              maxLength={300}
              rows={3}
              placeholder="বাড়ি নম্বর, রোড, এলাকা / গ্রাম, পোস্ট অফিস"
              aria-invalid={!!errors.address}
              aria-describedby={errors.address ? "address-error" : undefined}
            />
            <FieldError id="address-error" message={errors.address} />
          </div>
          <div className="mt-4">
            <label htmlFor="customerNote" className={field.label}>
              অতিরিক্ত নির্দেশনা <span className="font-normal text-muted">(ঐচ্ছিক)</span>
            </label>
            <textarea
              id="customerNote"
              name="note"
              className={cn(field.textarea, "min-h-20")}
              value={customerNote}
              onChange={(e) => setCustomerNote(e.target.value)}
              maxLength={500}
              rows={2}
              placeholder="যেমন: বিকেলে ফোন করবেন"
            />
          </div>
          <fieldset className="mt-4 rounded-xl border border-brass-300/70 bg-brass-50/60 p-4">
            <legend className="sr-only">উপহার</legend>
            <p className="flex items-center gap-2 font-semibold text-ink">
              <Icon name="gift" className="size-5 text-brass-700" />
              উপহার হিসেবে পাঠাচ্ছেন? <span className="font-normal text-muted">(ঐচ্ছিক)</span>
            </p>
            {quote?.giftWrapPrice != null && (
              <label className="mt-3 flex cursor-pointer items-start gap-3 rounded-xl border border-line bg-surface p-3">
                <input
                  type="checkbox"
                  name="giftWrap"
                  checked={giftWrap}
                  onChange={(e) => setGiftWrap(e.target.checked)}
                  className="mt-1 size-5 shrink-0 accent-pine-700"
                />
                <span>
                  <span className="block font-semibold text-ink">
                    গিফট র‍্যাপ করে দিন <span className="font-bold text-pine-800">+{formatTakaBn(quote.giftWrapPrice)}</span>
                  </span>
                  <span className="block text-sm text-muted">উপহারের মতো সুন্দর করে মুড়িয়ে পাঠানো হবে</span>
                </span>
              </label>
            )}
            <label htmlFor="giftMessage" className={cn(field.label, "mt-3")}>
              উপহার বার্তা
            </label>
            <textarea
              id="giftMessage"
              name="giftMessage"
              className={cn(field.textarea, "min-h-20")}
              value={giftMessage}
              onChange={(e) => setGiftMessage(e.target.value)}
              maxLength={300}
              rows={2}
              placeholder="যেমন: প্রিয় আম্মু, ঈদ মোবারক! — তোমার রাফি"
            />
            <p className={field.hint}>যিনি উপহার পাবেন, তাঁর জন্য আপনার শুভেচ্ছা বার্তা</p>
          </fieldset>
        </Card>
      </div>

      <aside className="space-y-4 lg:sticky lg:top-24">
        <div className="rounded-card border border-line bg-surface p-4 shadow-soft sm:p-6">
          <OrderSummary lines={lines} quote={quote} loading={quoteLoading} />

          <div className="mt-5 border-t border-line pt-4">
            {!couponOpen && !appliedCoupon ? (
              <button
                type="button"
                onClick={() => setCouponOpen(true)}
                className="-my-2.5 inline-flex items-center gap-1.5 py-2.5 text-sm font-semibold text-pine-700 hover:text-pine-900"
              >
                <Icon name="tag" className="size-4" /> কুপন কোড আছে?
              </button>
            ) : appliedCoupon && couponState?.applied ? (
              <div className="flex items-center justify-between gap-2 rounded-xl bg-success-50 px-3 py-2.5 text-sm">
                <span className="font-semibold text-success-700">
                  <Icon name="checkCircle" className="mr-1 inline size-4" /> কুপন {appliedCoupon} প্রয়োগ হয়েছে
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setAppliedCoupon("");
                    setCouponInput("");
                  }}
                  className="font-semibold text-muted hover:text-danger-700"
                >
                  বাতিল
                </button>
              </div>
            ) : (
              <div>
                <div className="mb-1.5 flex items-center justify-between gap-2">
                  <label htmlFor="couponCode" className="block text-sm font-semibold text-ink-soft">
                    কুপন কোড
                  </label>
                  {/* A code that did not apply is still sent with the order, so it must be removable. */}
                  {appliedCoupon && (
                    <button
                      type="button"
                      onClick={() => {
                        setAppliedCoupon("");
                        setCouponInput("");
                        setCouponOpen(false);
                        setErrors((e) => ({ ...e, couponCode: undefined }));
                      }}
                      className="text-sm font-semibold text-muted hover:text-danger-700"
                      aria-label="কুপন বাতিল করুন"
                    >
                      বাতিল
                    </button>
                  )}
                </div>
                <div className="flex gap-2">
                  <input
                    id="couponCode"
                    className={cn(field.input, "h-11 uppercase")}
                    value={couponInput}
                    onChange={(e) => setCouponInput(e.target.value)}
                    maxLength={40}
                    autoComplete="off"
                    aria-invalid={!!(errors.couponCode || (appliedCoupon && couponState && !couponState.applied))}
                    aria-describedby="coupon-status"
                  />
                  <button
                    type="button"
                    className={cn(btn.outline, btn.size.md, "shrink-0")}
                    onClick={() => setAppliedCoupon(couponInput.replace(/\s+/g, "").toUpperCase())}
                    disabled={!couponInput.trim()}
                  >
                    প্রয়োগ করুন
                  </button>
                </div>
                <div id="coupon-status" aria-live="polite">
                  {appliedCoupon && couponState && !couponState.applied && couponState.message && (
                    <FieldError id="coupon-msg" message={couponState.message} />
                  )}
                  {errors.couponCode && !(appliedCoupon && couponState && !couponState.applied) && (
                    <FieldError id="coupon-err" message={errors.couponCode} />
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {quote && !quote.acceptingOrders && (
          <p className="rounded-xl border border-brass-300 bg-brass-50 p-3 text-sm font-medium text-brass-800" role="status">
            {quote.closedMessage || MSG.ordersClosed}
          </p>
        )}

        {formError && (
          <div className="flex items-start gap-2 rounded-xl border border-danger-600/30 bg-danger-50 p-3 text-[0.95rem] font-medium text-danger-700" role="alert">
            <Icon name="alert" className="mt-0.5 size-5 shrink-0" />
            <span>{formError}</span>
          </div>
        )}

        {/* Waits while the price updates, so the total shown is the one confirmed. */}
        <button
          type="submit"
          disabled={submitting || !cart.ready || quoteLoading || (quote ? !quote.acceptingOrders : false)}
          className={cn(btn.primary, btn.size.xl, "w-full text-lg")}
        >
          {submitting ? (
            <>
              <span className="size-5 animate-spin rounded-full border-2 border-white/40 border-t-white" aria-hidden="true" />
              অর্ডার পাঠানো হচ্ছে…
            </>
          ) : (
            <>
              অর্ডার কনফার্ম করুন
              {quote && quote.zone && <span className="font-bold opacity-90">· {formatTakaBn(quote.total)}</span>}
            </>
          )}
        </button>
        <p className="flex items-start gap-2 text-sm leading-6 text-muted">
          <Icon name="phone" className="mt-1 size-4 shrink-0 text-pine-700" />
          অর্ডার করার পর আমাদের প্রতিনিধি {mobileNumber ? "আপনার দেওয়া নম্বরে" : "আপনাকে"} ফোন করে অর্ডারটি কনফার্ম করবেন।
        </p>
        {lines.length > 0 && (
          <p className="text-center text-sm text-muted">
            মোট {toBanglaDigits(lines.reduce((s, l) => s + l.quantity, 0))}টি পণ্য
          </p>
        )}
      </aside>
    </form>
  );
}
