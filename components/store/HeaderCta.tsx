"use client";

import { usePathname } from "next/navigation";
import { btn } from "@/components/ui/styles";
import { track } from "@/lib/analytics";
import { cn } from "@/lib/cn";

/** Header "অর্ডার করুন": jumps to the order form on product pages, otherwise to the product list. */
export function HeaderCta() {
  const pathname = usePathname();
  const onProduct = /^\/products\/[^/]+/.test(pathname);
  const href = onProduct ? "#order" : pathname === "/" || pathname === "/products" ? "#products" : "/#products";
  // Hidden on phones: the hero and the sticky bottom bar carry the CTA there.
  return (
    <span className="hidden sm:block">
      <a href={href} onClick={() => track({ name: "hero_cta_click", location: "header" })} className={cn(btn.primary, btn.size.md)}>
        অর্ডার করুন
      </a>
    </span>
  );
}
