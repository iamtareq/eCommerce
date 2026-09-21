"use client";

import { useEffect, useState } from "react";
import { btn } from "@/components/ui/styles";
import { track } from "@/lib/analytics";
import { cn } from "@/lib/cn";
import { formatTakaBn } from "@/lib/money";
import { useProduct } from "./ProductContext";

/**
 * Mobile-only bottom bar with price and "অর্ডার করুন". Appears after the hero
 * scrolls away and hides while the order form is on screen, so it never
 * covers the form or the submit button.
 */
export function StickyOrderBar() {
  const { product, variant } = useProduct();
  const [heroGone, setHeroGone] = useState(false);
  const [orderVisible, setOrderVisible] = useState(false);

  useEffect(() => {
    const hero = document.getElementById("product-hero");
    const order = document.getElementById("order");
    const observers: IntersectionObserver[] = [];
    if (hero) {
      const o = new IntersectionObserver(([e]) => setHeroGone(!e!.isIntersecting), { rootMargin: "-80px 0px 0px 0px" });
      o.observe(hero);
      observers.push(o);
    }
    if (order) {
      const o = new IntersectionObserver(([e]) => setOrderVisible(e!.isIntersecting), { rootMargin: "0px 0px -15% 0px" });
      o.observe(order);
      observers.push(o);
    }
    return () => observers.forEach((o) => o.disconnect());
  }, []);

  const soldOut = product.variants.every((v) => !v.inStock);
  const show = heroGone && !orderVisible && !soldOut;

  return (
    <div
      className={cn(
        "safe-bottom fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 px-4 pt-3 shadow-[0_-8px_24px_-12px_rgb(27_36_32/0.25)] backdrop-blur-md transition-transform duration-300 md:hidden",
        show ? "translate-y-0" : "pointer-events-none translate-y-full",
      )}
      aria-hidden={!show}
    >
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-muted">{product.name}</p>
          <p className="text-lg leading-tight font-bold text-pine-800">{formatTakaBn(variant.price)}</p>
        </div>
        <a
          href="#order"
          tabIndex={show ? 0 : -1}
          onClick={() => track({ name: "hero_cta_click", location: "sticky_bar", product: product.name })}
          className={cn(btn.primary, btn.size.lg, "px-7")}
        >
          অর্ডার করুন
        </a>
      </div>
    </div>
  );
}
