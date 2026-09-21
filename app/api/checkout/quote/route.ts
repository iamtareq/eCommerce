import { json } from "@/lib/api";
import { buildQuote, buildQuoteChecked } from "@/lib/orders/quote";
import { isRateLimited, LIMITS, rateLimit } from "@/lib/rate-limit";
import { getClientIp, readJsonBody } from "@/lib/request";
import { hashIp } from "@/lib/security";
import { quoteSchema } from "@/lib/validation/checkout";
import { MSG } from "@/lib/validation/messages";

export const dynamic = "force-dynamic";

/**
 * POST /api/checkout/quote — live order summary for the checkout form.
 * The browser sends only variant ids, quantities, location and coupon code;
 * every amount comes from the database.
 */
export async function POST(request: Request) {
  try {
    const ipHash = hashIp(getClientIp(request.headers));
    const limit = await rateLimit(`quote:ip:${ipHash}`, LIMITS.quotePerIp.limit, LIMITS.quotePerIp.windowMs);
    if (!limit.ok) return json({ ok: false, message: MSG.rateLimited }, 429);

    const parsed = quoteSchema.safeParse(await readJsonBody(request));
    if (!parsed.success) return json({ ok: false, message: MSG.emptyCart }, 400);

    // Coupon guessing protection: only rejected codes count (not a valid coupon
    // that misses its minimum order), and each code only once per window, so a
    // customer can keep changing quantities or location with any code entered.
    const code = parsed.data.couponCode;
    const couponKey = `coupon:ip:${ipHash}`;
    if (code && (await isRateLimited(couponKey, LIMITS.couponPerIp.limit))) {
      const quote = await buildQuote({ ...parsed.data, couponCode: undefined });
      quote.coupon = { code, applied: false, message: MSG.rateLimited };
      return json({ ok: true, quote });
    }

    const { quote, couponRejected } = await buildQuoteChecked(parsed.data);
    if (code && couponRejected) {
      const firstTry = await rateLimit(`${couponKey}:${code}`, 1, LIMITS.couponPerIp.windowMs);
      if (firstTry.ok) await rateLimit(couponKey, LIMITS.couponPerIp.limit, LIMITS.couponPerIp.windowMs);
    }
    return json({ ok: true, quote });
  } catch (error) {
    console.error("[quote] failed", error);
    return json({ ok: false, message: MSG.serverError }, 500);
  }
}
