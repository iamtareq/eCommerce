"use client";

import { useEffect, useState } from "react";
import { useCart } from "@/components/cart/CartProvider";
import { QuantityStepper } from "@/components/checkout/QuantityStepper";
import { Icon } from "@/components/ui/Icon";
import { btn } from "@/components/ui/styles";
import { DiscountBadge, Price } from "@/components/store/Price";
import { track } from "@/lib/analytics";
import { cn } from "@/lib/cn";
import { formatTakaBn } from "@/lib/money";
import { toBanglaDigits } from "@/lib/phone";
import { useProduct } from "./ProductContext";

function tierText(t: { minQuantity: number; type: "PERCENT" | "FIXED"; value: number }) {
  const amount = t.type === "PERCENT" ? `${toBanglaDigits(t.value)}%` : formatTakaBn(t.value);
  return `${toBanglaDigits(t.minQuantity)}টি বা তার বেশি নিলে ${amount} ছাড়`;
}

/** Hero purchase controls: price, variant picker, quantity, CTAs. */
export function PurchasePanel() {
  const { product, variant, quantity, setVariantId, setQuantity } = useProduct();
  const cart = useCart();
  const [added, setAdded] = useState(false);

  useEffect(() => {
    track({ name: "view_product", product: product.name, value: variant.price });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product.id]);

  useEffect(() => {
    if (!added) return;
    const t = setTimeout(() => setAdded(false), 2500);
    return () => clearTimeout(t);
  }, [added]);

  const soldOut = product.variants.every((v) => !v.inStock);

  function addToCart() {
    cart.add(
      {
        variantId: variant.id,
        productId: product.id,
        slug: product.slug,
        name: product.name,
        variantName: product.variants.length > 1 ? variant.name : "",
        image: product.image,
        price: variant.price,
        maxQuantity: variant.maxQuantity,
      },
      quantity,
    );
    track({ name: "add_to_cart", product: product.name, value: variant.price * quantity, quantity });
    setAdded(true);
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <Price price={variant.price} compareAtPrice={variant.compareAtPrice} size="lg" />
        <DiscountBadge price={variant.price} compareAtPrice={variant.compareAtPrice} />
      </div>

      {product.tiers.length > 0 && (
        <ul className="space-y-1.5">
          {product.tiers.map((t) => (
            <li key={t.minQuantity} className="flex items-center gap-2 text-[0.95rem] font-medium text-success-700">
              <Icon name="sparkles" className="size-4 shrink-0" />
              {tierText(t)}
            </li>
          ))}
        </ul>
      )}

      {product.variants.length > 1 && (
        <fieldset>
          <legend className="mb-2 text-[0.95rem] font-semibold text-ink-soft">
            {product.variantLabel}: <span className="font-normal text-muted">{variant.name}</span>
          </legend>
          <div className="flex flex-wrap gap-2">
            {product.variants.map((v) => (
              <label key={v.id} className={cn("cursor-pointer", !v.inStock && "cursor-not-allowed")}>
                <input
                  type="radio"
                  name="variant"
                  value={v.id}
                  className="peer sr-only"
                  checked={v.id === variant.id}
                  disabled={!v.inStock}
                  onChange={() => setVariantId(v.id)}
                />
                <span
                  className={cn(
                    "inline-flex min-h-11 items-center rounded-xl border border-line-strong bg-surface px-4 text-[0.95rem] font-medium text-ink-soft transition-colors peer-checked:border-pine-700 peer-checked:bg-pine-50 peer-checked:text-pine-900 peer-checked:ring-1 peer-checked:ring-pine-700 peer-focus-visible:ring-2 peer-focus-visible:ring-pine-600",
                    !v.inStock && "line-through opacity-50",
                  )}
                >
                  {v.name}
                </span>
              </label>
            ))}
          </div>
        </fieldset>
      )}

      {soldOut ? (
        <p className="rounded-xl border border-line bg-sand p-4 font-semibold text-ink-soft">দুঃখিত, এই পণ্যটির স্টক এই মুহূর্তে শেষ।</p>
      ) : (
        <>
          <div className="flex items-center gap-4">
            <span className="text-[0.95rem] font-semibold text-ink-soft">পরিমাণ</span>
            <QuantityStepper value={quantity} max={variant.maxQuantity} onChange={setQuantity} />
          </div>
          <div className="grid gap-3 sm:grid-cols-[1.4fr_1fr]">
            <a
              href="#order"
              onClick={() => track({ name: "hero_cta_click", location: "hero", product: product.name })}
              className={cn(btn.primary, btn.size.xl)}
            >
              অর্ডার করুন
              <Icon name="arrowDown" className="size-5" />
            </a>
            <button type="button" onClick={addToCart} className={cn(btn.outline, btn.size.xl)} aria-live="polite">
              {added ? (
                <>
                  <Icon name="check" className="size-5 text-success-700" /> কার্টে যোগ হয়েছে
                </>
              ) : (
                <>
                  <Icon name="bag" className="size-5" /> কার্টে রাখুন
                </>
              )}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
