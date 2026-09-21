"use client";

import { Icon } from "@/components/ui/Icon";
import { toBanglaDigits } from "@/lib/phone";
import { cn } from "@/lib/cn";

export function QuantityStepper({
  value,
  max,
  onChange,
  label = "পরিমাণ",
  size = "md",
}: {
  value: number;
  max: number;
  onChange: (value: number) => void;
  label?: string;
  size?: "sm" | "md";
}) {
  const h = size === "sm" ? "h-9" : "h-11";
  const w = size === "sm" ? "w-9" : "w-11";
  return (
    <div className={cn("inline-flex items-center rounded-xl border border-line-strong bg-surface", h)} role="group" aria-label={label}>
      <button
        type="button"
        onClick={() => onChange(Math.max(1, value - 1))}
        disabled={value <= 1}
        className={cn("grid h-full place-items-center rounded-l-xl text-pine-800 hover:bg-pine-50 disabled:text-line-strong disabled:hover:bg-transparent", w)}
        aria-label="পরিমাণ কমান"
      >
        <Icon name="minus" className="size-4" strokeWidth={2.25} />
      </button>
      <output className="min-w-9 px-1 text-center text-base font-semibold tabular-nums" aria-live="polite">
        {toBanglaDigits(value)}
      </output>
      <button
        type="button"
        onClick={() => onChange(Math.min(max, value + 1))}
        disabled={value >= max}
        className={cn("grid h-full place-items-center rounded-r-xl text-pine-800 hover:bg-pine-50 disabled:text-line-strong disabled:hover:bg-transparent", w)}
        aria-label="পরিমাণ বাড়ান"
      >
        <Icon name="plus" className="size-4" strokeWidth={2.25} />
      </button>
    </div>
  );
}
