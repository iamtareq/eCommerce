import { z } from "zod";
import { parseDhakaDateTimeLocal } from "@/lib/dates";

export const COUPON_TYPES = ["PERCENT", "FIXED", "FREE_DELIVERY"] as const;
export type CouponTypeValue = (typeof COUPON_TYPES)[number];

export const COUPON_CODE_RE = /^[A-Z0-9_-]{3,40}$/;

const MAX_TAKA = 10_000_000;

const int = (label: string, min: number, max: number) =>
  z
    .number({ error: `${label} must be a number` })
    .int({ error: `${label} must be a whole number` })
    .min(min, { error: `${label} must be at least ${min}` })
    .max(max, { error: `${label} must be at most ${max}` });

/** `<input type="datetime-local">` value, "" = not set. */
const dateTimeLocal = z.string().trim().max(40).default("");

/**
 * Coupon form input. Dates are Bangladesh-time `datetime-local` strings.
 * Output is `{ id, data }` where `data` is ready for Prisma.
 */
export const couponInputSchema = z
  .object({
    id: z.string().max(40).optional(),
    code: z
      .string()
      .trim()
      .toUpperCase()
      .regex(COUPON_CODE_RE, { error: "Code must be 3–40 characters: letters A–Z, numbers, dash (-) or underscore (_). No spaces." }),
    description: z.string().trim().max(300, { error: "Description must be at most 300 characters" }).default(""),
    type: z.enum(COUPON_TYPES, { error: "Choose a coupon type" }),
    value: int("Discount value", 0, MAX_TAKA).nullable(),
    minOrderAmount: int("Minimum order amount", 0, MAX_TAKA).nullable(),
    maxDiscountAmount: int("Maximum discount", 1, MAX_TAKA).nullable(),
    startsAt: dateTimeLocal,
    endsAt: dateTimeLocal,
    usageLimit: int("Total usage limit", 1, 1_000_000).nullable(),
    perPhoneLimit: int("Uses per phone number", 1, 1000).nullable(),
    isActive: z.boolean(),
  })
  .superRefine((c, ctx) => {
    if (c.type === "PERCENT" && (c.value == null || c.value < 1 || c.value > 100)) {
      ctx.addIssue({ code: "custom", path: ["value"], message: "Percent discount must be between 1 and 100" });
    }
    if (c.type === "FIXED" && (c.value == null || c.value < 1)) {
      ctx.addIssue({ code: "custom", path: ["value"], message: "Taka discount must be at least ৳1" });
    }
    const starts = parseDhakaDateTimeLocal(c.startsAt);
    const ends = parseDhakaDateTimeLocal(c.endsAt);
    if (c.startsAt && !starts) ctx.addIssue({ code: "custom", path: ["startsAt"], message: "Start date/time is not valid" });
    if (c.endsAt && !ends) ctx.addIssue({ code: "custom", path: ["endsAt"], message: "End date/time is not valid" });
    if (starts && ends && ends.getTime() <= starts.getTime()) {
      ctx.addIssue({ code: "custom", path: ["endsAt"], message: "End date/time must be after the start date/time" });
    }
  })
  .transform((c) => ({
    id: c.id,
    data: {
      code: c.code,
      description: c.description || null,
      type: c.type,
      // FREE_DELIVERY ignores the value; max cap only applies to percent coupons.
      value: c.type === "FREE_DELIVERY" ? 0 : (c.value ?? 0),
      minOrderAmount: c.minOrderAmount || null,
      maxDiscountAmount: c.type === "PERCENT" ? c.maxDiscountAmount : null,
      startsAt: parseDhakaDateTimeLocal(c.startsAt),
      endsAt: parseDhakaDateTimeLocal(c.endsAt),
      usageLimit: c.usageLimit,
      perPhoneLimit: c.perPhoneLimit,
      isActive: c.isActive,
    },
  }));

export type CouponInput = z.input<typeof couponInputSchema>;

/** First validation message (all messages above already name their field). */
export function firstIssue(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Invalid input";
}
