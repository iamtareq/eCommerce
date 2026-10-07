import { itemLabel } from "@/config/order";
import type { OrderStatus } from "@/generated/prisma/enums";
import { prisma } from "@/lib/db";
import { normalizeBdPhone, toAsciiDigits } from "@/lib/phone";

/** Confirmation links stay valid for 60 days after the order is placed. */
const LINK_TTL_MS = 60 * 24 * 60 * 60 * 1000;

/** Loads an order for the customer's confirmation page by its unguessable token. */
export async function findOrderByPublicToken(token: string) {
  if (!/^[A-Za-z0-9_-]{20,64}$/.test(token)) return null;
  return prisma.order.findFirst({
    where: { publicToken: token, createdAt: { gte: new Date(Date.now() - LINK_TTL_MS) } },
    include: { items: { orderBy: { id: "asc" } } },
  });
}

/** "dbx-20261007-০০০২ " → "DBX-20261007-0002": the form customers might type or paste it in. */
export function normalizeOrderNumber(input: string): string {
  return toAsciiDigits(input).replace(/\s+/g, "").toUpperCase();
}

export interface TrackedOrder {
  orderNumber: string;
  status: OrderStatus;
  /** ISO time the order was placed. */
  placedAt: string;
  items: { label: string; quantity: number; total: number }[];
  giftWrapCharge: number;
  deliveryCharge: number;
  discount: number;
  totalAmount: number;
}

/**
 * An order's status for a customer who lost the link: both the order number and the phone
 * it was placed with must match. Same 60-day window as the link. Only what the order is and
 * where it stands comes back; no name, address, phone or link token, since an order number
 * can be guessed and a phone number is often known to others.
 */
export async function findOrderForTracking(orderNumber: string, phone: string): Promise<TrackedOrder | null> {
  const number = normalizeOrderNumber(orderNumber);
  const mobile = normalizeBdPhone(phone);
  if (!mobile || !/^[A-Z0-9-]{4,40}$/.test(number)) return null;
  const order = await prisma.order.findFirst({
    where: { orderNumber: number, mobileNumber: mobile, createdAt: { gte: new Date(Date.now() - LINK_TTL_MS) } },
    select: {
      orderNumber: true,
      orderStatus: true,
      createdAt: true,
      giftWrapCharge: true,
      deliveryCharge: true,
      discount: true,
      totalAmount: true,
      items: { orderBy: { id: "asc" }, select: { productName: true, variantName: true, quantity: true, lineSubtotal: true } },
    },
  });
  if (!order) return null;
  return {
    orderNumber: order.orderNumber,
    status: order.orderStatus,
    placedAt: order.createdAt.toISOString(),
    items: order.items.map((i) => ({ label: itemLabel(i.productName, i.variantName), quantity: i.quantity, total: i.lineSubtotal })),
    giftWrapCharge: order.giftWrapCharge,
    deliveryCharge: order.deliveryCharge,
    discount: order.discount,
    totalAmount: order.totalAmount,
  };
}
