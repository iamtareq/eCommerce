/**
 * Pure order-pricing engine. The server runs this against fresh database data
 * for every quote and every order; the browser never supplies prices.
 *
 *   subtotal          = Σ unitPrice × quantity
 *   quantityDiscount  = per-product "buy N+" tier discounts
 *   couponDiscount    = coupon applied to (subtotal − quantityDiscount)
 *   deliveryCharge    = zone charge, waived by a free-delivery coupon or threshold
 *   total             = subtotal − quantityDiscount − couponDiscount + deliveryCharge
 */

export type DiscountKind = "PERCENT" | "FIXED";
export type CouponKind = "PERCENT" | "FIXED" | "FREE_DELIVERY";

export interface PricedVariant {
  variantId: string;
  productId: string;
  productName: string;
  productSlug: string;
  variantName: string;
  sku: string | null;
  price: number;
  compareAtPrice: number | null;
}

export interface QuantityTier {
  productId: string;
  minQuantity: number;
  type: DiscountKind;
  value: number;
}

export interface CouponRule {
  code: string;
  type: CouponKind;
  value: number;
  minOrderAmount: number | null;
  maxDiscountAmount: number | null;
}

export interface PricingInput {
  lines: { variant: PricedVariant; quantity: number }[];
  tiers: QuantityTier[];
  coupon: CouponRule | null;
  deliveryCharge: number;
  freeDeliveryMinAmount: number | null;
}

export interface PricedLine extends PricedVariant {
  quantity: number;
  lineSubtotal: number;
  lineDiscount: number;
}

export type DeliveryWaiver = "coupon" | "threshold" | null;

export interface PricingResult {
  lines: PricedLine[];
  itemCount: number;
  subtotal: number;
  quantityDiscount: number;
  couponDiscount: number;
  discount: number;
  deliveryCharge: number;
  /** Zone charge before any waiver. */
  baseDeliveryCharge: number;
  deliveryWaiver: DeliveryWaiver;
  total: number;
  coupon: { code: string; applied: boolean; reason: string | null } | null;
  /** Human-readable Bangla notes for applied product tiers. */
  appliedTiers: { productId: string; productName: string; minQuantity: number; amount: number }[];
}

function tierAmount(tier: QuantityTier, groupSubtotal: number): number {
  const raw = tier.type === "PERCENT" ? Math.round((groupSubtotal * tier.value) / 100) : tier.value;
  return Math.max(0, Math.min(raw, groupSubtotal));
}

/**
 * Splits `amount` across `weights` proportionally, using largest remainders so
 * the parts are whole numbers that sum exactly to `amount`.
 */
export function allocate(amount: number, weights: number[]): number[] {
  const total = weights.reduce((a, b) => a + b, 0);
  if (amount <= 0 || total <= 0) return weights.map(() => 0);
  const exact = weights.map((w) => (amount * w) / total);
  const floors = exact.map(Math.floor);
  let remainder = amount - floors.reduce((a, b) => a + b, 0);
  const order = exact
    .map((v, i) => ({ i, frac: v - Math.floor(v) }))
    .sort((a, b) => b.frac - a.frac || a.i - b.i);
  for (const { i } of order) {
    if (remainder <= 0) break;
    floors[i]! += 1;
    remainder -= 1;
  }
  return floors;
}

export function calculatePricing(input: PricingInput): PricingResult {
  const lines: PricedLine[] = input.lines.map(({ variant, quantity }) => ({
    ...variant,
    quantity,
    lineSubtotal: variant.price * quantity,
    lineDiscount: 0,
  }));

  const itemCount = lines.reduce((s, l) => s + l.quantity, 0);
  const subtotal = lines.reduce((s, l) => s + l.lineSubtotal, 0);

  // Quantity tiers are evaluated per product, across all of its variants.
  const appliedTiers: PricingResult["appliedTiers"] = [];
  const productIds = [...new Set(lines.map((l) => l.productId))];
  let quantityDiscount = 0;
  for (const productId of productIds) {
    const group = lines.filter((l) => l.productId === productId);
    const qty = group.reduce((s, l) => s + l.quantity, 0);
    const groupSubtotal = group.reduce((s, l) => s + l.lineSubtotal, 0);
    const tier = input.tiers
      .filter((t) => t.productId === productId && t.minQuantity <= qty && t.value > 0)
      .sort((a, b) => b.minQuantity - a.minQuantity)[0];
    if (!tier) continue;
    const amount = tierAmount(tier, groupSubtotal);
    if (amount <= 0) continue;
    const parts = allocate(
      amount,
      group.map((l) => l.lineSubtotal),
    );
    group.forEach((l, i) => (l.lineDiscount = parts[i] ?? 0));
    quantityDiscount += amount;
    appliedTiers.push({ productId, productName: group[0]!.productName, minQuantity: tier.minQuantity, amount });
  }

  const afterQuantity = subtotal - quantityDiscount;

  let couponDiscount = 0;
  let deliveryWaiver: DeliveryWaiver = null;
  let coupon: PricingResult["coupon"] = null;
  if (input.coupon) {
    const c = input.coupon;
    if (c.minOrderAmount != null && afterQuantity < c.minOrderAmount) {
      coupon = { code: c.code, applied: false, reason: `min:${c.minOrderAmount}` };
    } else if (c.type === "FREE_DELIVERY") {
      deliveryWaiver = "coupon";
      coupon = { code: c.code, applied: true, reason: null };
    } else {
      let amount = c.type === "PERCENT" ? Math.round((afterQuantity * c.value) / 100) : c.value;
      if (c.type === "PERCENT" && c.maxDiscountAmount != null) amount = Math.min(amount, c.maxDiscountAmount);
      couponDiscount = Math.max(0, Math.min(amount, afterQuantity));
      coupon = { code: c.code, applied: true, reason: null };
    }
  }

  const productsTotal = afterQuantity - couponDiscount;
  if (
    deliveryWaiver === null &&
    input.freeDeliveryMinAmount != null &&
    input.freeDeliveryMinAmount > 0 &&
    productsTotal >= input.freeDeliveryMinAmount
  ) {
    deliveryWaiver = "threshold";
  }

  const deliveryCharge = deliveryWaiver ? 0 : Math.max(0, input.deliveryCharge);
  const discount = quantityDiscount + couponDiscount;

  return {
    lines,
    itemCount,
    subtotal,
    quantityDiscount,
    couponDiscount,
    discount,
    deliveryCharge,
    baseDeliveryCharge: Math.max(0, input.deliveryCharge),
    deliveryWaiver,
    total: subtotal - discount + deliveryCharge,
    coupon,
    appliedTiers,
  };
}
