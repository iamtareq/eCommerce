import type { Tone } from "@/config/order";
import { formatTaka } from "@/lib/money";
import type { CouponTypeValue } from "./schema";

export const COUPON_TYPE_LABELS: Record<CouponTypeValue, string> = {
  PERCENT: "Percent off",
  FIXED: "Taka off",
  FREE_DELIVERY: "Free delivery",
};

/** "10%" / "৳100" / "Free delivery". */
export function couponValueLabel(type: CouponTypeValue, value: number): string {
  if (type === "PERCENT") return `${value}%`;
  if (type === "FIXED") return formatTaka(value);
  return "Free delivery";
}

interface CouponStateInput {
  isActive: boolean;
  startsAt: Date | null;
  endsAt: Date | null;
  usageLimit: number | null;
  usedCount: number;
}

/**
 * Badges describing whether the coupon works right now, e.g. ["Active"],
 * ["Expired"] or ["Inactive", "Scheduled"].
 */
export function couponStateBadges(c: CouponStateInput, now: Date): { label: string; tone: Tone }[] {
  const badges: { label: string; tone: Tone }[] = [];
  if (!c.isActive) badges.push({ label: "Inactive", tone: "gray" });
  if (c.endsAt && c.endsAt.getTime() <= now.getTime()) badges.push({ label: "Expired", tone: "red" });
  else if (c.startsAt && c.startsAt.getTime() > now.getTime()) badges.push({ label: "Scheduled", tone: "blue" });
  if (c.usageLimit != null && c.usedCount >= c.usageLimit) badges.push({ label: "Used up", tone: "amber" });
  if (badges.length === 0) badges.push({ label: "Active", tone: "green" });
  return badges;
}
