import { cn } from "@/lib/cn";
import { discountPercent, formatTakaBn } from "@/lib/money";
import { toBanglaDigits } from "@/lib/phone";

export function DiscountBadge({ price, compareAtPrice, className }: { price: number; compareAtPrice: number | null; className?: string }) {
  const pct = discountPercent(price, compareAtPrice);
  if (pct <= 0) return null;
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full bg-brass-600 px-2.5 py-0.5 text-[0.8rem] font-semibold text-white",
        className,
      )}
    >
      {toBanglaDigits(pct)}% ছাড়
    </span>
  );
}

export function Price({
  price,
  compareAtPrice,
  from = false,
  size = "md",
  className,
}: {
  price: number;
  compareAtPrice: number | null;
  from?: boolean;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const hasDiscount = compareAtPrice != null && compareAtPrice > price;
  return (
    <div className={cn("flex flex-wrap items-baseline gap-x-2.5 gap-y-1", className)}>
      <span
        className={cn(
          "font-bold text-pine-800",
          size === "lg" ? "text-[2rem] leading-none" : size === "md" ? "text-xl" : "text-lg",
        )}
      >
        {from && <span className="mr-1 text-[0.6em] font-semibold text-muted">শুরু</span>}
        {formatTakaBn(price)}
      </span>
      {hasDiscount && (
        <span className={cn("text-muted line-through decoration-danger-600/60", size === "lg" ? "text-lg" : "text-sm")}>
          <span className="sr-only">আগের দাম </span>
          {formatTakaBn(compareAtPrice)}
        </span>
      )}
    </div>
  );
}
