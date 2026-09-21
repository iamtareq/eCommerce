import { prisma } from "@/lib/db";

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
