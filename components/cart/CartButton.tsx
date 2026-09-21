"use client";

import Link from "next/link";
import { Icon } from "@/components/ui/Icon";
import { toBanglaDigits } from "@/lib/phone";
import { useCart } from "./CartProvider";

export function CartButton() {
  const { count, ready } = useCart();
  const label = ready && count > 0 ? `কার্ট — ${toBanglaDigits(count)}টি পণ্য` : "কার্ট";
  return (
    <Link
      href="/checkout"
      className="relative grid size-11 place-items-center rounded-xl text-pine-900 transition-colors hover:bg-pine-50"
      aria-label={label}
    >
      <Icon name="bag" className="size-6" />
      {ready && count > 0 && (
        <span className="absolute -top-0.5 -right-0.5 grid min-w-5 place-items-center rounded-full bg-brass-600 px-1 text-[0.7rem] font-bold leading-5 text-white">
          {toBanglaDigits(count > 99 ? "99+" : count)}
        </span>
      )}
    </Link>
  );
}
