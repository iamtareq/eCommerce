"use client";

import { useEffect, useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { btn } from "@/components/ui/styles";
import { track } from "@/lib/analytics";
import { cn } from "@/lib/cn";

/**
 * Mobile-only bottom bar on the home page. Appears once the hero scrolls away and
 * hides while the product list or the footer is on screen, so it never covers
 * the products it points to or the footer links.
 */
export function HomeStickyBar({ facebookUrl }: { facebookUrl: string }) {
  const [heroGone, setHeroGone] = useState(false);
  const [covered, setCovered] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const observers: IntersectionObserver[] = [];
    const hero = document.getElementById("home-hero");
    if (hero) {
      const o = new IntersectionObserver(([e]) => setHeroGone(!e!.isIntersecting), { rootMargin: "-80px 0px 0px 0px" });
      o.observe(hero);
      observers.push(o);
    }
    for (const el of [document.getElementById("products"), document.querySelector("footer")]) {
      if (!el) continue;
      const key = el.id || el.tagName;
      const o = new IntersectionObserver(([e]) => setCovered((c) => ({ ...c, [key]: e!.isIntersecting })), {
        rootMargin: "0px 0px -20% 0px",
      });
      o.observe(el);
      observers.push(o);
    }
    return () => observers.forEach((o) => o.disconnect());
  }, []);

  const show = heroGone && !Object.values(covered).some(Boolean);

  return (
    <div
      className={cn(
        "safe-bottom fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 px-4 pt-3 shadow-[0_-8px_24px_-12px_rgb(27_36_32/0.25)] backdrop-blur-md transition-transform duration-300 md:hidden",
        show ? "translate-y-0" : "pointer-events-none translate-y-full",
      )}
      aria-hidden={!show}
    >
      <div className="flex items-center gap-3">
        {facebookUrl && (
          <a
            href={facebookUrl}
            target="_blank"
            rel="noopener noreferrer"
            tabIndex={show ? 0 : -1}
            className={cn(btn.outline, btn.size.lg, "w-13 shrink-0 px-0")}
            aria-label="ফেসবুক পেজে মেসেজ দিন (নতুন ট্যাবে খুলবে)"
          >
            <Icon name="facebook" className="size-5.5 text-[#1877F2]" />
          </a>
        )}
        <a
          href="#products"
          tabIndex={show ? 0 : -1}
          onClick={() => track({ name: "hero_cta_click", location: "home_sticky_bar" })}
          className={cn(btn.primary, btn.size.lg, "flex-1")}
        >
          অর্ডার করুন
          <Icon name="arrowDown" className="size-5" />
        </a>
      </div>
    </div>
  );
}
