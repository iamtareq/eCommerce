import { loadDeliveryConfig } from "@/lib/catalog";
import { resolveZone } from "@/lib/delivery";
import { calculatePricing, type DeliveryWaiver } from "@/lib/pricing";
import { getSettingsFresh } from "@/lib/settings";
import { loadCart, type LineIssue } from "./cart";
import { couponReasonMessage, lookupCoupon } from "./coupon";

export interface QuoteLine {
  variantId: string;
  productName: string;
  productSlug: string;
  variantName: string;
  image: { url: string; alt: string } | null;
  unitPrice: number;
  compareAtPrice: number | null;
  quantity: number;
  lineSubtotal: number;
  lineDiscount: number;
  maxQuantity: number;
}

export interface Quote {
  lines: QuoteLine[];
  issues: LineIssue[];
  itemCount: number;
  subtotal: number;
  quantityDiscount: number;
  couponDiscount: number;
  discount: number;
  deliveryCharge: number;
  baseDeliveryCharge: number;
  deliveryWaiver: DeliveryWaiver;
  /** What gift wrapping adds to this quote (0 unless chosen and offered). */
  giftWrapCharge: number;
  /** Gift wrapping's price, or null when the store does not offer it. */
  giftWrapPrice: number | null;
  zone: { name: string; estimatedDelivery: string | null } | null;
  total: number;
  coupon: { code: string; applied: boolean; message: string | null } | null;
  appliedTiers: { productName: string; minQuantity: number; amount: number }[];
  acceptingOrders: boolean;
  closedMessage: string | null;
}

export interface QuoteInput {
  items: { variantId: string; quantity: number }[];
  districtId?: string;
  areaId?: string;
  couponCode?: string;
  giftWrap?: boolean;
}

/**
 * Server-side price quote shown in the order summary. Uses the same engine and
 * the same fresh data as order creation, so the summary always matches the
 * amount the order will be saved with.
 */
export async function buildQuote(input: QuoteInput): Promise<Quote> {
  return (await buildQuoteChecked(input)).quote;
}

/**
 * Same as buildQuote, plus whether the coupon code itself was rejected
 * (unknown, inactive, expired, used up). A valid coupon that only misses its
 * minimum order is not a rejection. Used for coupon-guessing rate limits; not
 * part of the quote sent to the browser.
 */
export async function buildQuoteChecked(input: QuoteInput): Promise<{ quote: Quote; couponRejected: boolean }> {
  const settings = await getSettingsFresh();
  const [cart, delivery, couponLookup] = await Promise.all([
    loadCart(input.items, settings.defaultMaxPerOrder),
    loadDeliveryConfig(),
    input.couponCode ? lookupCoupon(input.couponCode, null) : Promise.resolve(null),
  ]);

  const zone = input.districtId
    ? resolveZone(delivery.zones, delivery.rules, input.districtId, input.areaId || null)
    : null;

  // Lines with blocking problems are left out of the totals but reported.
  const blocking = new Set(cart.issues.filter((i) => i.maxQuantity === 0).map((i) => i.variantId));
  const priceable = cart.lines.filter((l) => !blocking.has(l.variant.variantId));

  const pricing = calculatePricing({
    lines: priceable.map((l) => ({ variant: l.variant, quantity: l.quantity })),
    tiers: cart.tiers,
    coupon: couponLookup?.ok ? couponLookup.rule : null,
    deliveryCharge: zone?.charge ?? 0,
    freeDeliveryMinAmount: settings.freeDeliveryMinAmount,
    giftWrapCharge: input.giftWrap ? (settings.giftWrapPrice ?? 0) : 0,
  });

  const cartByVariant = new Map(cart.lines.map((l) => [l.variant.variantId, l]));

  let coupon: Quote["coupon"] = null;
  if (input.couponCode) {
    if (couponLookup && !couponLookup.ok) coupon = { code: input.couponCode, applied: false, message: couponLookup.message };
    else if (pricing.coupon) {
      coupon = {
        code: pricing.coupon.code,
        applied: pricing.coupon.applied,
        message: pricing.coupon.applied ? null : couponReasonMessage(pricing.coupon.reason),
      };
    }
  }

  const quote: Quote = {
    lines: pricing.lines.map((l) => ({
      variantId: l.variantId,
      productName: l.productName,
      productSlug: l.productSlug,
      variantName: l.variantName,
      image: cartByVariant.get(l.variantId)?.image ?? null,
      unitPrice: l.price,
      compareAtPrice: l.compareAtPrice,
      quantity: l.quantity,
      lineSubtotal: l.lineSubtotal,
      lineDiscount: l.lineDiscount,
      maxQuantity: cartByVariant.get(l.variantId)?.maxQuantity ?? l.quantity,
    })),
    issues: cart.issues,
    itemCount: pricing.itemCount,
    subtotal: pricing.subtotal,
    quantityDiscount: pricing.quantityDiscount,
    couponDiscount: pricing.couponDiscount,
    discount: pricing.discount,
    deliveryCharge: zone ? pricing.deliveryCharge : 0,
    baseDeliveryCharge: zone ? pricing.baseDeliveryCharge : 0,
    deliveryWaiver: zone ? pricing.deliveryWaiver : null,
    giftWrapCharge: pricing.giftWrapCharge,
    giftWrapPrice: settings.giftWrapPrice,
    zone: zone ? { name: zone.name, estimatedDelivery: zone.estimatedDelivery } : null,
    total: pricing.total,
    coupon,
    appliedTiers: pricing.appliedTiers.map((t) => ({ productName: t.productName, minQuantity: t.minQuantity, amount: t.amount })),
    acceptingOrders: settings.acceptingOrders,
    closedMessage: settings.acceptingOrders ? null : settings.closedMessage || null,
  };
  return { quote, couponRejected: !!couponLookup && !couponLookup.ok };
}
