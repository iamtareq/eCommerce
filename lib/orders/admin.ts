import type { OrderStatus, SheetSyncStatus } from "@/generated/prisma/enums";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { dhakaDayRange, startOfDhakaDay } from "@/lib/dates";
import { markSheetStale } from "@/lib/google-sheets/sync";
import { normalizeBdPhone } from "@/lib/phone";
import type { AdminIdentity } from "@/lib/auth/session";
import { byVariantId } from "./cart";

export interface OrderFilters {
  q?: string;
  status?: OrderStatus;
  sync?: SheetSyncStatus;
  from?: string; // YYYY-MM-DD (Dhaka)
  to?: string; // YYYY-MM-DD (Dhaka), inclusive
  flagged?: boolean;
}

export const PAGE_SIZE = 25;

export function buildOrderWhere(filters: OrderFilters): Prisma.OrderWhereInput {
  const and: Prisma.OrderWhereInput[] = [];
  const q = filters.q?.trim();
  if (q) {
    const phone = normalizeBdPhone(q);
    const digits = q.replace(/\D/g, "");
    and.push({
      OR: [
        { orderNumber: { contains: q.toUpperCase() } },
        { customerName: { contains: q, mode: "insensitive" } },
        ...(phone ? [{ mobileNumber: phone }] : []),
        ...(digits.length >= 4 ? [{ mobileNumber: { contains: digits } }] : []),
      ],
    });
  }
  if (filters.status) and.push({ orderStatus: filters.status });
  if (filters.sync) and.push({ googleSheetSyncStatus: filters.sync });
  if (filters.flagged) and.push({ isFlagged: true });
  const from = filters.from ? dhakaDayRange(filters.from) : null;
  const to = filters.to ? dhakaDayRange(filters.to) : null;
  if (from || to) {
    and.push({ createdAt: { ...(from ? { gte: from.start } : {}), ...(to ? { lt: to.end } : {}) } });
  }
  return and.length ? { AND: and } : {};
}

export async function listOrders(filters: OrderFilters, page = 1) {
  const where = buildOrderWhere(filters);
  const safePage = Math.max(1, Math.floor(page) || 1);
  const [total, orders] = await Promise.all([
    prisma.order.count({ where }),
    prisma.order.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (safePage - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: { items: { select: { productName: true, variantName: true, quantity: true } } },
    }),
  ]);
  return { total, page: safePage, pageCount: Math.max(1, Math.ceil(total / PAGE_SIZE)), orders };
}

export async function dashboardStats() {
  const todayStart = startOfDhakaDay();
  const [byStatus, total, todayCount, todayRevenue, syncFailed, syncBehind] = await Promise.all([
    prisma.order.groupBy({ by: ["orderStatus"], _count: { _all: true } }),
    prisma.order.count(),
    prisma.order.count({ where: { createdAt: { gte: todayStart } } }),
    prisma.order.aggregate({
      where: { createdAt: { gte: todayStart }, orderStatus: { not: "CANCELLED" } },
      _sum: { totalAmount: true },
    }),
    prisma.order.count({ where: { googleSheetSyncStatus: "FAILED" } }),
    prisma.order.count({ where: { googleSheetSyncStatus: { in: ["PENDING", "SYNCING"] } } }),
  ]);
  const count = (s: OrderStatus) => byStatus.find((b) => b.orderStatus === s)?._count._all ?? 0;
  return {
    total,
    pending: count("PENDING"),
    onHold: count("ON_HOLD"),
    confirmed: count("CONFIRMED"),
    processing: count("PROCESSING"),
    shipped: count("SHIPPED"),
    delivered: count("DELIVERED"),
    cancelled: count("CANCELLED"),
    todayCount,
    todayRevenue: todayRevenue._sum.totalAmount ?? 0,
    syncFailed,
    syncBehind,
  };
}

export class OrderUpdateError extends Error {}

/**
 * Changes an order's status. Cancelling returns reserved stock and coupon
 * usage; un-cancelling reserves them again. Every change is logged and the
 * Google Sheet row is marked for update.
 *
 * `stockChanged` is true when variant stock was returned or taken again, so
 * the caller can refresh the storefront catalog.
 */
export async function updateOrderStatus(orderId: string, toStatus: OrderStatus, actor: AdminIdentity) {
  return prisma.$transaction(async (tx) => {
    // Lock the order first: a concurrent change waits here and then reads the
    // status this one committed, so stock and coupon usage move only once.
    const locked = await tx.$queryRaw<{ id: string }[]>`SELECT "id" FROM "Order" WHERE "id" = ${orderId} FOR UPDATE`;
    if (locked.length === 0) throw new OrderUpdateError("Order not found");
    const order = await tx.order.findUniqueOrThrow({ where: { id: orderId }, include: { items: true } });
    const fromStatus = order.orderStatus;
    if (fromStatus === toStatus) return { order, fromStatus, stockChanged: false };

    const cancelling = toStatus === "CANCELLED";
    const restoring = fromStatus === "CANCELLED";
    let stockChanged = false;

    // Variant rows in the same lock order as order creation (no deadlocks).
    for (const item of [...order.items].sort(byVariantId)) {
      if (!item.variantId) continue;
      if (cancelling) {
        // Only return units this line actually took (not lines placed while the
        // variant's stock was untracked).
        if (!item.stockReserved) continue;
        const res = await tx.productVariant.updateMany({
          where: { id: item.variantId, stock: { not: null } },
          data: { stock: { increment: item.quantity } },
        });
        if (res.count > 0) stockChanged = true;
        await tx.orderItem.update({ where: { id: item.id }, data: { stockReserved: false } });
      } else if (restoring) {
        if (item.stockReserved) continue;
        const variant = await tx.productVariant.findUnique({ where: { id: item.variantId }, select: { stock: true } });
        if (variant?.stock == null) continue;
        const res = await tx.productVariant.updateMany({
          where: { id: item.variantId, stock: { gte: item.quantity } },
          data: { stock: { decrement: item.quantity } },
        });
        if (res.count === 0) {
          throw new OrderUpdateError(`Not enough stock to restore "${item.productName}". Adjust stock first.`);
        }
        stockChanged = true;
        await tx.orderItem.update({ where: { id: item.id }, data: { stockReserved: true } });
      }
    }
    if (order.couponId && (cancelling || restoring)) {
      await tx.coupon.updateMany({
        where: { id: order.couponId, ...(cancelling ? { usedCount: { gt: 0 } } : {}) },
        data: { usedCount: cancelling ? { decrement: 1 } : { increment: 1 } },
      });
    }

    const updated = await tx.order.update({
      where: { id: orderId },
      data: {
        orderStatus: toStatus,
        events: {
          create: {
            type: "STATUS_CHANGED",
            fromStatus,
            toStatus,
            actorId: actor.id,
            actorName: actor.displayName,
          },
        },
      },
    });
    await markSheetStale(tx, orderId);
    return { order: updated, fromStatus, stockChanged };
  });
}

export async function updateAdminNote(orderId: string, note: string, actor: AdminIdentity) {
  const clean = note.trim().slice(0, 2000);
  return prisma.order.update({
    where: { id: orderId },
    data: {
      adminNote: clean || null,
      events: { create: { type: "NOTE_UPDATED", message: clean ? clean.slice(0, 300) : "(cleared)", actorId: actor.id, actorName: actor.displayName } },
    },
  });
}

export async function getOrderDetail(orderId: string) {
  return prisma.order.findUnique({
    where: { id: orderId },
    include: {
      items: { orderBy: { id: "asc" } },
      events: { orderBy: { createdAt: "desc" }, take: 50 },
    },
  });
}
