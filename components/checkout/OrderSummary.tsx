"use client";

import { itemLabel } from "@/config/order";
import { cn } from "@/lib/cn";
import { formatTakaBn } from "@/lib/money";
import { toBanglaDigits } from "@/lib/phone";
import type { CheckoutLine, Quote } from "./types";

function Row({ label, value, tone, strong }: { label: React.ReactNode; value: React.ReactNode; tone?: "discount" | "muted"; strong?: boolean }) {
  return (
    <div className={cn("flex items-baseline justify-between gap-3", strong ? "text-lg font-bold text-ink" : "text-[0.97rem]")}>
      <dt className={cn(tone === "muted" ? "text-muted" : strong ? "" : "text-ink-soft")}>{label}</dt>
      <dd className={cn("text-right tabular-nums", tone === "discount" && "font-semibold text-success-700", strong && "text-pine-800")}>
        {value}
      </dd>
    </div>
  );
}

export function OrderSummary({ lines, quote, loading }: { lines: CheckoutLine[]; quote: Quote | null; loading: boolean }) {
  const byVariant = new Map(quote?.lines.map((l) => [l.variantId, l]) ?? []);
  return (
    <div className={cn("transition-opacity", loading && quote && "opacity-60")} aria-busy={loading}>
      <h3 className="font-sans text-lg font-semibold text-ink">অর্ডার সারাংশ</h3>
      <ul className="mt-4 space-y-3 border-b border-line pb-4">
        {lines.map((line) => {
          const q = byVariant.get(line.variantId);
          const unit = q?.unitPrice ?? line.price;
          return (
            <li key={line.variantId} className="flex items-start justify-between gap-3 text-[0.95rem]">
              <span className="min-w-0">
                <span className="block font-medium text-ink">{itemLabel(line.name, line.variantName)}</span>
                <span className="text-sm text-muted">
                  {formatTakaBn(unit)} × {toBanglaDigits(line.quantity)}
                </span>
              </span>
              <span className="shrink-0 font-semibold tabular-nums text-ink">{formatTakaBn(unit * line.quantity)}</span>
            </li>
          );
        })}
      </ul>
      <dl className="mt-4 space-y-2.5">
        <Row label="সাবটোটাল" value={quote ? formatTakaBn(quote.subtotal) : "—"} />
        {quote && quote.quantityDiscount > 0 && (
          <Row label="পরিমাণভিত্তিক ছাড়" value={`− ${formatTakaBn(quote.quantityDiscount)}`} tone="discount" />
        )}
        {quote && quote.couponDiscount > 0 && (
          <Row label={`কুপন ছাড় (${quote.coupon?.code})`} value={`− ${formatTakaBn(quote.couponDiscount)}`} tone="discount" />
        )}
        <Row
          label={
            <>
              ডেলিভারি চার্জ
              {quote?.zone && <span className="block text-sm text-muted">{quote.zone.name}</span>}
            </>
          }
          value={
            !quote || !quote.zone ? (
              <span className="text-sm text-muted">এলাকা নির্বাচন করুন</span>
            ) : quote.deliveryWaiver ? (
              <span>
                <span className="mr-1.5 text-sm text-muted line-through">{formatTakaBn(quote.baseDeliveryCharge)}</span>
                <span className="font-semibold text-success-700">ফ্রি</span>
              </span>
            ) : (
              formatTakaBn(quote.deliveryCharge)
            )
          }
        />
        {quote && quote.giftWrapCharge > 0 && <Row label="গিফট র‍্যাপ" value={formatTakaBn(quote.giftWrapCharge)} />}
        {quote && quote.discount > 0 && <Row label="মোট ছাড়" value={`− ${formatTakaBn(quote.discount)}`} tone="muted" />}
        <div className="border-t border-line pt-3">
          <Row
            label={
              <>
                সর্বমোট
                {quote && !quote.zone && <span className="block text-sm font-normal text-muted">ডেলিভারি চার্জ ছাড়া</span>}
              </>
            }
            value={quote ? formatTakaBn(quote.total) : "—"}
            strong
          />
          {quote?.zone?.estimatedDelivery && (
            <p className="mt-1.5 text-sm text-muted">আনুমানিক ডেলিভারি সময়: {quote.zone.estimatedDelivery}</p>
          )}
        </div>
      </dl>
    </div>
  );
}
