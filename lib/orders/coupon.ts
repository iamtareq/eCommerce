import type { Coupon } from "@/generated/prisma/client";
import { prisma, type TransactionClient } from "@/lib/db";
import { formatTakaBn } from "@/lib/money";
import type { CouponRule } from "@/lib/pricing";

export type CouponLookup = { ok: true; coupon: Coupon; rule: CouponRule } | { ok: false; message: string };

/** Shared with order creation, which re-checks both limits inside its transaction. */
export const COUPON_USED_UP = "কুপনটির ব্যবহারসীমা শেষ হয়ে গেছে।";
export const COUPON_PHONE_LIMIT = "এই মোবাইল নম্বর থেকে কুপনটি আর ব্যবহার করা যাবে না।";

/**
 * Finds a coupon and checks that it can be used right now. The minimum-order
 * rule is evaluated by the pricing engine because it depends on the cart.
 */
export async function lookupCoupon(
  code: string,
  phone: string | null,
  db: TransactionClient | typeof prisma = prisma,
  now: Date = new Date(),
): Promise<CouponLookup> {
  const coupon = await db.coupon.findUnique({ where: { code: code.toUpperCase() } });
  if (!coupon || !coupon.isActive) return { ok: false, message: "কুপন কোডটি সঠিক নয়।" };
  if (coupon.startsAt && coupon.startsAt > now) return { ok: false, message: "কুপনটি এখনো চালু হয়নি।" };
  if (coupon.endsAt && coupon.endsAt <= now) return { ok: false, message: "কুপনটির মেয়াদ শেষ হয়ে গেছে।" };
  if (coupon.usageLimit != null && coupon.usedCount >= coupon.usageLimit) {
    return { ok: false, message: COUPON_USED_UP };
  }
  if (phone && coupon.perPhoneLimit != null) {
    const used = await db.order.count({
      where: { couponId: coupon.id, mobileNumber: phone, orderStatus: { not: "CANCELLED" } },
    });
    if (used >= coupon.perPhoneLimit) return { ok: false, message: COUPON_PHONE_LIMIT };
  }
  return {
    ok: true,
    coupon,
    rule: {
      code: coupon.code,
      type: coupon.type,
      value: coupon.value,
      minOrderAmount: coupon.minOrderAmount,
      maxDiscountAmount: coupon.maxDiscountAmount,
    },
  };
}

/** Bangla explanation for a coupon the pricing engine did not apply. */
export function couponReasonMessage(reason: string | null): string | null {
  if (!reason) return null;
  if (reason.startsWith("min:")) {
    const min = Number(reason.slice(4));
    return `এই কুপনটি ব্যবহার করতে ন্যূনতম ${formatTakaBn(min)}-এর পণ্য অর্ডার করতে হবে।`;
  }
  return "কুপনটি এই অর্ডারে প্রযোজ্য নয়।";
}
