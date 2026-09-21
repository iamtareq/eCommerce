import { loadDeliveryConfig } from "@/lib/catalog";
import { prisma } from "@/lib/db";
import { resolveZone } from "@/lib/delivery";
import { resolveLocation } from "@/lib/locations";
import { getLocationData } from "@/lib/locations.server";
import { calculatePricing, type PricingResult } from "@/lib/pricing";
import { randomToken } from "@/lib/security";
import { getSettingsFresh } from "@/lib/settings";
import type { CheckoutData } from "@/lib/validation/checkout";
import { MSG } from "@/lib/validation/messages";
import { byVariantId, loadCart, type LineIssue } from "./cart";
import { COUPON_PHONE_LIMIT, COUPON_USED_UP, couponReasonMessage, lookupCoupon } from "./coupon";
import { nextOrderNumber } from "./order-number";

export interface CreatedOrderRef {
  id: string;
  orderNumber: string;
  publicToken: string;
  totalAmount: number;
  itemCount: number;
}

export type CreateOrderResult =
  /** stockChanged: this call took units from tracked stock (storefront stock is now stale). */
  | { ok: true; duplicate: boolean; stockChanged: boolean; order: CreatedOrderRef }
  | { ok: false; code: "CLOSED"; message: string }
  | { ok: false; code: "INVALID"; message: string; fieldErrors: Record<string, string> }
  | { ok: false; code: "CART"; message: string; issues: LineIssue[] }
  | { ok: false; code: "PRICE_CHANGED"; message: string; total: number };

class CartConflict extends Error {
  constructor(public issues: LineIssue[]) {
    super("cart conflict");
  }
}

/** A coupon limit was reached while the order was being saved; the message is shown to the customer. */
class CouponConflict extends Error {}

const refSelect = { id: true, orderNumber: true, publicToken: true, totalAmount: true, itemCount: true } as const;

/** The order already placed with this idempotency key, if any (a retried submit). */
export async function findOrderByIdempotencyKey(idempotencyKey: string): Promise<CreatedOrderRef | null> {
  return prisma.order.findUnique({ where: { idempotencyKey }, select: refSelect });
}

type OrderMeta = { ipHash?: string | null; userAgent?: string | null; expectedTotal?: number | null };

/**
 * Creates an order from validated checkout data. Prices, discounts and
 * delivery are recalculated here from the database — the browser only sends
 * product/variant ids and quantities.
 *
 * Idempotent: the same idempotency key always returns the same order.
 */
export async function createOrder(data: CheckoutData, meta: OrderMeta = {}): Promise<CreateOrderResult> {
  const existing = await findOrderByIdempotencyKey(data.idempotencyKey);
  if (existing) return { ok: true, duplicate: true, stockChanged: false, order: existing };

  let result: CreateOrderResult;
  try {
    result = await placeOrder(data, meta);
  } catch (error) {
    // e.g. a unique-key clash with a concurrent request using the same key.
    const winner = await findOrderByIdempotencyKey(data.idempotencyKey).catch(() => null);
    if (winner) return { ok: true, duplicate: true, stockChanged: false, order: winner };
    throw error;
  }
  if (!result.ok) {
    // A concurrent request with the same key may have placed this order while
    // this one ran. Its order stands, whatever made this attempt fail (often the
    // very stock or coupon use that order just took).
    const winner = await findOrderByIdempotencyKey(data.idempotencyKey).catch(() => null);
    if (winner) return { ok: true, duplicate: true, stockChanged: false, order: winner };
  }
  return result;
}

async function placeOrder(data: CheckoutData, meta: OrderMeta): Promise<CreateOrderResult> {
  const settings = await getSettingsFresh();
  if (!settings.acceptingOrders) {
    return { ok: false, code: "CLOSED", message: settings.closedMessage || MSG.ordersClosed };
  }

  const location = resolveLocation(getLocationData(), {
    divisionId: data.divisionId,
    districtId: data.districtId,
    areaId: data.areaId,
    areaOther: data.areaOther,
  });
  if (!location) {
    return { ok: false, code: "INVALID", message: MSG.invalidLocation, fieldErrors: { areaId: MSG.invalidLocation } };
  }

  const [cart, delivery] = await Promise.all([
    loadCart(data.items, settings.defaultMaxPerOrder),
    loadDeliveryConfig(),
  ]);
  if (cart.issues.length > 0) return { ok: false, code: "CART", message: MSG.cartChanged, issues: cart.issues };

  const zone = resolveZone(delivery.zones, delivery.rules, location.district.id, location.area?.id ?? null);
  if (!zone) throw new Error("No delivery zone configured");

  let couponId: string | null = null;
  let pricing: PricingResult;
  {
    let couponRule = null;
    if (data.couponCode) {
      const lookup = await lookupCoupon(data.couponCode, data.mobileNumber);
      if (!lookup.ok) {
        return { ok: false, code: "INVALID", message: lookup.message, fieldErrors: { couponCode: lookup.message } };
      }
      couponId = lookup.coupon.id;
      couponRule = lookup.rule;
    }
    pricing = calculatePricing({
      lines: cart.lines.map((l) => ({ variant: l.variant, quantity: l.quantity })),
      tiers: cart.tiers,
      coupon: couponRule,
      deliveryCharge: zone.charge,
      freeDeliveryMinAmount: settings.freeDeliveryMinAmount,
    });
    if (pricing.coupon && !pricing.coupon.applied) {
      const message = couponReasonMessage(pricing.coupon.reason) ?? MSG.cartChanged;
      return { ok: false, code: "INVALID", message, fieldErrors: { couponCode: message } };
    }
  }

  // The customer confirmed a specific total; never save a different amount silently.
  if (meta.expectedTotal != null && meta.expectedTotal !== pricing.total) {
    return {
      ok: false,
      code: "PRICE_CHANGED",
      message: MSG.priceChanged,
      total: pricing.total,
    };
  }

  const stockByVariant = new Map(cart.lines.map((l) => [l.variant.variantId, l.stock]));
  // Only lines of variants that track stock take units from it.
  const reserves = (variantId: string) => stockByVariant.get(variantId) != null;
  const stockChanged = pricing.lines.some((l) => reserves(l.variantId));

  try {
    const order = await prisma.$transaction(
      async (tx) => {
        // One order at a time per phone number, so the repeat-order flag and the
        // per-phone coupon limit below always see that phone's other orders.
        // Taken before any row lock, so it cannot be part of a deadlock.
        const phoneLockKey = `order:phone:${data.mobileNumber}`;
        await tx.$queryRaw`SELECT 1 AS "locked" FROM pg_advisory_xact_lock(hashtext(${phoneLockKey}))`;

        // Reserve stock atomically; fails if someone else bought the last units.
        // Rows are locked in a fixed order so two orders can't deadlock.
        const conflicts: LineIssue[] = [];
        for (const line of [...pricing.lines].sort(byVariantId)) {
          if (!reserves(line.variantId)) continue;
          const res = await tx.productVariant.updateMany({
            where: { id: line.variantId, stock: { gte: line.quantity } },
            data: { stock: { decrement: line.quantity } },
          });
          if (res.count === 0) {
            conflicts.push({
              variantId: line.variantId,
              code: "INSUFFICIENT_STOCK",
              message: "দুঃখিত, এই পণ্যটির পর্যাপ্ত স্টক নেই।",
              maxQuantity: 0,
            });
          }
        }
        if (conflicts.length) throw new CartConflict(conflicts);

        if (couponId) {
          const claimed = await tx.$queryRaw<{ perPhoneLimit: number | null }[]>`
            UPDATE "Coupon" SET "usedCount" = "usedCount" + 1, "updatedAt" = NOW()
            WHERE "id" = ${couponId} AND "isActive" = true
              AND ("usageLimit" IS NULL OR "usedCount" < "usageLimit")
            RETURNING "perPhoneLimit"`;
          if (claimed.length === 0) throw new CouponConflict(COUPON_USED_UP);
          // lookupCoupon counted this phone's uses before the transaction; count
          // again now that any concurrent order from the same phone has committed.
          const perPhoneLimit = claimed[0]!.perPhoneLimit;
          if (perPhoneLimit != null) {
            const used = await tx.order.count({
              where: { couponId, mobileNumber: data.mobileNumber, orderStatus: { not: "CANCELLED" } },
            });
            if (used >= perPhoneLimit) throw new CouponConflict(COUPON_PHONE_LIMIT);
          }
        }

        let isFlagged = false;
        let flagReason: string | null = null;
        if (settings.duplicateWindowHours > 0) {
          const since = new Date(Date.now() - settings.duplicateWindowHours * 60 * 60 * 1000);
          const recent = await tx.order.count({
            where: { mobileNumber: data.mobileNumber, createdAt: { gte: since }, orderStatus: { not: "CANCELLED" } },
          });
          if (recent > 0) {
            isFlagged = true;
            flagReason = `${recent} other order${recent > 1 ? "s" : ""} from this number in the last ${settings.duplicateWindowHours}h`;
          }
        }

        const orderNumber = await nextOrderNumber(tx);

        return tx.order.create({
          data: {
            orderNumber,
            publicToken: randomToken(24),
            idempotencyKey: data.idempotencyKey,
            customerName: data.customerName,
            mobileNumber: data.mobileNumber,
            division: location.division.bn,
            district: location.district.bn,
            area: location.areaName,
            divisionId: location.division.id,
            districtId: location.district.id,
            areaId: location.area?.id ?? null,
            address: data.address,
            customerNote: data.customerNote ?? null,
            itemCount: pricing.itemCount,
            subtotal: pricing.subtotal,
            quantityDiscount: pricing.quantityDiscount,
            couponDiscount: pricing.couponDiscount,
            discount: pricing.discount,
            deliveryCharge: pricing.deliveryCharge,
            deliveryZoneName: zone.name,
            totalAmount: pricing.total,
            couponId,
            couponCode: couponId ? (pricing.coupon?.code ?? null) : null,
            isFlagged,
            flagReason,
            ipHash: meta.ipHash ?? null,
            userAgent: meta.userAgent?.slice(0, 300) ?? null,
            items: {
              create: pricing.lines.map((l) => ({
                productId: l.productId,
                variantId: l.variantId,
                productName: l.productName,
                variantName: l.variantName,
                sku: l.sku,
                unitPrice: l.price,
                compareAtPrice: l.compareAtPrice,
                quantity: l.quantity,
                lineSubtotal: l.lineSubtotal,
                lineDiscount: l.lineDiscount,
                stockReserved: reserves(l.variantId),
              })),
            },
            events: { create: { type: "CREATED", toStatus: "PENDING", message: "Order placed by customer" } },
          },
          select: refSelect,
        });
      },
      { timeout: 15_000 },
    );
    return { ok: true, duplicate: false, stockChanged, order };
  } catch (error) {
    if (error instanceof CartConflict) return { ok: false, code: "CART", message: MSG.cartChanged, issues: error.issues };
    if (error instanceof CouponConflict) {
      return { ok: false, code: "INVALID", message: error.message, fieldErrors: { couponCode: error.message } };
    }
    throw error;
  }
}
