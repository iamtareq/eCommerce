import { z } from "zod";
import { normalizeBdPhone } from "@/lib/phone";
import { OTHER_AREA_ID } from "@/lib/locations";
import { MSG } from "./messages";

export const MAX_CART_LINES = 20;
export const MAX_LINE_QUANTITY = 999;

// Control characters (except tab/newline) are stripped from all free text.
const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

/** Trims, strips control characters and collapses runs of spaces. */
export function cleanText(value: string, { multiline = false } = {}): string {
  const stripped = value.replace(CONTROL_CHARS, "");
  const collapsed = multiline
    ? stripped.replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n")
    : stripped.replace(/\s+/g, " ");
  return collapsed.trim();
}

const text = (max: number, opts: { multiline?: boolean } = {}) =>
  z
    .string({ error: MSG.required })
    .transform((v) => cleanText(v, opts))
    .pipe(z.string().min(1, { error: MSG.required }).max(max, { error: MSG.maxLength(max) }));

const optionalText = (max: number, opts: { multiline?: boolean } = {}) =>
  z
    .string()
    .optional()
    .transform((v) => (v == null ? undefined : cleanText(v, opts) || undefined))
    .pipe(z.string().max(max, { error: MSG.maxLength(max) }).optional());

const id = z.string({ error: MSG.required }).trim().min(1, { error: MSG.required }).max(80);

export const phoneSchema = z
  .string({ error: MSG.required })
  .trim()
  .min(1, { error: MSG.required })
  .transform((value, ctx) => {
    const normalized = normalizeBdPhone(value);
    if (!normalized) {
      ctx.addIssue({ code: "custom", message: MSG.phone });
      return z.NEVER;
    }
    return normalized;
  });

export const cartLineSchema = z.object({
  variantId: z.string().trim().min(1).max(80),
  quantity: z.number().int().min(1).max(MAX_LINE_QUANTITY),
});

export const cartLinesSchema = z
  .array(cartLineSchema)
  .min(1, { error: MSG.emptyCart })
  .max(MAX_CART_LINES, { error: MSG.tooManyLines });

export const couponCodeSchema = z
  .string()
  .optional()
  .transform((v) => (v ? v.replace(/\s+/g, "").toUpperCase() || undefined : undefined))
  .pipe(z.string().max(40).optional());

export const checkoutSchema = z
  .object({
    customerName: text(80).refine((v) => v.length >= 2, { error: MSG.nameShort }),
    mobileNumber: phoneSchema,
    divisionId: id,
    districtId: id,
    areaId: id,
    areaOther: optionalText(80),
    address: text(300, { multiline: true }).refine((v) => v.length >= 6, { error: MSG.addressShort }),
    customerNote: optionalText(500, { multiline: true }),
    giftMessage: optionalText(300, { multiline: true }),
    giftWrap: z.boolean().default(false),
    couponCode: couponCodeSchema,
    items: cartLinesSchema,
    idempotencyKey: z
      .string()
      .regex(/^[A-Za-z0-9_-]{16,80}$/),
  })
  .superRefine((value, ctx) => {
    if (value.areaId === OTHER_AREA_ID && !value.areaOther) {
      ctx.addIssue({ code: "custom", path: ["areaOther"], message: MSG.required });
    }
  });

export type CheckoutInput = z.input<typeof checkoutSchema>;
export type CheckoutData = z.output<typeof checkoutSchema>;

/** Schema for live price quotes; location and coupon are optional. */
export const quoteSchema = z.object({
  items: cartLinesSchema,
  districtId: z.string().trim().max(80).optional(),
  areaId: z.string().trim().max(80).optional(),
  couponCode: couponCodeSchema,
  giftWrap: z.boolean().optional(),
});

export type QuoteInput = z.input<typeof quoteSchema>;

/** Maps Zod issues to { field: firstMessage } for form display. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.length ? String(issue.path[0]) : "_form";
    if (!(key in out)) out[key] = issue.message;
  }
  return out;
}
