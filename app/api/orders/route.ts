import { revalidateTag } from "next/cache";
import { after } from "next/server";
import { z } from "zod";
import { isOrderStatus, isSyncStatus } from "@/config/order";
import { json, retryAfterSeconds } from "@/lib/api";
import { authorizeApi } from "@/lib/auth/guard";
import { CATALOG_TAG } from "@/lib/catalog";
import { prisma } from "@/lib/db";
import { syncOrderToSheet } from "@/lib/google-sheets/sync";
import { notifyLowStock, notifyNewOrder } from "@/lib/notify";
import { listOrders, type OrderFilters } from "@/lib/orders/admin";
import {
  createOrder,
  findOrderByIdempotencyKey,
  type CreatedOrderRef,
  type CreateOrderResult,
} from "@/lib/orders/create";
import { LIMITS, rateLimit } from "@/lib/rate-limit";
import { getClientIp, readJsonBody } from "@/lib/request";
import { hashIp } from "@/lib/security";
import { checkoutSchema, fieldErrors } from "@/lib/validation/checkout";
import { MSG } from "@/lib/validation/messages";

export const dynamic = "force-dynamic";

function orderPlaced(order: CreatedOrderRef, duplicate: boolean) {
  return json(
    {
      ok: true,
      duplicate,
      orderNumber: order.orderNumber,
      token: order.publicToken,
      total: order.totalAmount,
      itemCount: order.itemCount,
      message: MSG.success,
    },
    duplicate ? 200 : 201,
  );
}

/**
 * Takes back one hit counted by rateLimit(). Only the window that counted it
 * is touched: once that window has reset, the new one never included the hit.
 */
async function refundAttempt(key: string, resetAt: Date) {
  await prisma.rateLimit
    .updateMany({ where: { key, resetAt, count: { gt: 0 } }, data: { count: { decrement: 1 } } })
    .catch((e) => console.error("[orders] rate-limit refund failed", e));
}

/** POST /api/orders — customer places an order (public, rate limited). */
export async function POST(request: Request) {
  try {
    const ipHash = hashIp(getClientIp(request.headers));
    const ipLimit = await rateLimit(`order:ip:${ipHash}`, LIMITS.orderPerIp.limit, LIMITS.orderPerIp.windowMs);
    if (!ipLimit.ok) {
      return json({ ok: false, code: "RATE_LIMITED", message: MSG.rateLimited }, 429, {
        "Retry-After": retryAfterSeconds(ipLimit.resetAt),
      });
    }

    const body = await readJsonBody(request);
    if (body === undefined) return json({ ok: false, code: "INVALID", message: MSG.serverError, fieldErrors: {} }, 400);

    const parsed = checkoutSchema.safeParse(body);
    if (!parsed.success) {
      const errors = fieldErrors(parsed.error);
      const first = Object.values(errors)[0] ?? MSG.required;
      return json({ ok: false, code: "INVALID", message: first, fieldErrors: errors }, 400);
    }

    // A retry of an order that already exists (e.g. the response was lost on a
    // bad connection) gets the order back without spending the phone's quota.
    const existing = await findOrderByIdempotencyKey(parsed.data.idempotencyKey);
    if (existing) return orderPlaced(existing, true);

    const phoneKey = `order:phone:${parsed.data.mobileNumber}`;
    const phoneLimit = await rateLimit(phoneKey, LIMITS.orderPerPhone.limit, LIMITS.orderPerPhone.windowMs);
    if (!phoneLimit.ok) {
      return json({ ok: false, code: "RATE_LIMITED", message: MSG.rateLimited }, 429, {
        "Retry-After": retryAfterSeconds(phoneLimit.resetAt),
      });
    }

    // The phone limit bounds orders placed. An attempt that placed none (price
    // changed, stock ran out, coupon rejected, a retry of an existing order, an
    // error) gives its slot back, so a customer correcting the order is not
    // locked out. The IP limit above still counts every attempt.
    const expected = z.number().int().nonnegative().safeParse((body as { expectedTotal?: unknown }).expectedTotal);
    let result: CreateOrderResult;
    try {
      result = await createOrder(parsed.data, {
        ipHash,
        userAgent: request.headers.get("user-agent"),
        expectedTotal: expected.success ? expected.data : null,
        keyChecked: true, // looked up above; a same-key race is still caught inside
      });
    } catch (error) {
      await refundAttempt(phoneKey, phoneLimit.resetAt);
      throw error;
    }
    if (!result.ok || result.duplicate) await refundAttempt(phoneKey, phoneLimit.resetAt);

    if (!result.ok) {
      const status = result.code === "CLOSED" ? 503 : result.code === "INVALID" ? 400 : 409;
      return json(result, status);
    }

    if (!result.duplicate) {
      // Stock was taken: the cached storefront must not keep showing old stock.
      if (result.stockChanged) revalidateTag(CATALOG_TAG, { expire: 0 });
      const orderId = result.order.id;
      const stockChanged = result.stockChanged;
      after(async () => {
        await syncOrderToSheet(orderId).catch((e) => console.error("[orders] sheet sync error", e));
        await notifyNewOrder(orderId);
        if (stockChanged) await notifyLowStock(orderId);
      });
    }

    return orderPlaced(result.order, result.duplicate);
  } catch (error) {
    console.error("[orders] create failed", error);
    return json({ ok: false, code: "SERVER", message: MSG.serverError }, 500);
  }
}

const listQuery = z.object({
  // Cut, not rejected: a long pasted search must not fail the whole request.
  q: z.string().optional().transform((v) => v?.slice(0, 100)),
  status: z.string().optional().transform((v) => (v && isOrderStatus(v) ? v : undefined)),
  sync: z.string().optional().transform((v) => (v && isSyncStatus(v) ? v : undefined)),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().catch(undefined),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().catch(undefined),
  flagged: z.string().optional().transform((v) => v === "1" || v === "true"),
  page: z.coerce.number().int().min(1).max(100000).optional().catch(1),
});

/** GET /api/orders — admin order list with search and filters. */
export async function GET(request: Request) {
  const auth = await authorizeApi(request);
  if (!auth.ok) return auth.response;
  const params = Object.fromEntries(new URL(request.url).searchParams);
  const q = listQuery.parse(params);
  const filters: OrderFilters = { q: q.q, status: q.status, sync: q.sync, from: q.from, to: q.to, flagged: q.flagged };
  const data = await listOrders(filters, q.page ?? 1);
  return json({
    total: data.total,
    page: data.page,
    pageCount: data.pageCount,
    orders: data.orders.map((o) => ({
      id: o.id,
      orderNumber: o.orderNumber,
      customerName: o.customerName,
      mobileNumber: o.mobileNumber,
      items: o.items,
      itemCount: o.itemCount,
      totalAmount: o.totalAmount,
      orderStatus: o.orderStatus,
      googleSheetSyncStatus: o.googleSheetSyncStatus,
      isFlagged: o.isFlagged,
      createdAt: o.createdAt.toISOString(),
    })),
  });
}
