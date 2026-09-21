import { toBanglaDigits } from "./phone";

const enNumber = new Intl.NumberFormat("en-IN");

/** ৳1,250 — admin and exports. Uses the South Asian grouping (1,00,000). */
export function formatTaka(amount: number): string {
  return `৳${enNumber.format(amount)}`;
}

/** ৳১,২৫০ — customer-facing storefront. */
export function formatTakaBn(amount: number): string {
  return `৳${toBanglaDigits(enNumber.format(amount))}`;
}

/** Percentage saved between a previous and current price, rounded down. */
export function discountPercent(price: number, compareAtPrice: number | null | undefined): number {
  if (!compareAtPrice || compareAtPrice <= price) return 0;
  return Math.floor(((compareAtPrice - price) / compareAtPrice) * 100);
}
