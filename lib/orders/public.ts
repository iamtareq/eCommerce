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

/**
 * The confirmation-page token of an order, for a customer who lost the link: both the
 * order number and the phone it was placed with must match. Same 60-day window as the link.
 */
export async function findOrderTokenForTracking(orderNumber: string, phone: string): Promise<string | null> {
  const number = normalizeOrderNumber(orderNumber);
  const mobile = normalizeBdPhone(phone);
  if (!mobile || !/^[A-Z0-9-]{4,40}$/.test(number)) return null;
  const order = await prisma.order.findFirst({
    where: { orderNumber: number, mobileNumber: mobile, createdAt: { gte: new Date(Date.now() - LINK_TTL_MS) } },
    select: { publicToken: true },
  });
  return order?.publicToken ?? null;
}
