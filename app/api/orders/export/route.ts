import { NextResponse } from "next/server";
import { isOrderStatus, isSyncStatus, itemLabel, orderStatusLabel } from "@/config/order";
import { authorizeApi } from "@/lib/auth/guard";
import { toCsv } from "@/lib/csv";
import { dhakaDateKey, formatDhakaDateTime } from "@/lib/dates";
import { prisma } from "@/lib/db";
import { buildOrderWhere } from "@/lib/orders/admin";

export const dynamic = "force-dynamic";

const MAX_ROWS = 20_000;

const HEADER = [
  "Order Number",
  "Order Date",
  "Customer Name",
  "Mobile Number",
  "Division",
  "District",
  "Area / Thana",
  "Full Address",
  "Products",
  "Item Count",
  "Subtotal",
  "Quantity Discount",
  "Coupon Code",
  "Coupon Discount",
  "Total Discount",
  "Delivery Zone",
  "Delivery Charge",
  "Total Amount",
  "Order Status",
  "Customer Note",
  "Gift Wrap Charge",
  "Gift Message",
  "Admin Note",
  "Flagged",
  "Sheet Sync",
];

/** GET /api/orders/export?… — CSV of orders matching the current filters (admin). */
export async function GET(request: Request) {
  const auth = await authorizeApi(request);
  if (!auth.ok) return auth.response;

  const sp = new URL(request.url).searchParams;
  const status = sp.get("status") ?? "";
  const sync = sp.get("sync") ?? "";
  const date = (v: string | null) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : undefined);
  const where = buildOrderWhere({
    q: sp.get("q")?.slice(0, 100) ?? undefined,
    status: isOrderStatus(status) ? status : undefined,
    sync: isSyncStatus(sync) ? sync : undefined,
    from: date(sp.get("from")),
    to: date(sp.get("to")),
    flagged: sp.get("flagged") === "1",
  });

  const orders = await prisma.order.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: MAX_ROWS,
    include: { items: { orderBy: { id: "asc" } } },
  });

  const rows = orders.map((o) => [
    o.orderNumber,
    formatDhakaDateTime(o.createdAt),
    o.customerName,
    o.mobileNumber,
    o.division,
    o.district,
    o.area,
    o.address,
    o.items.map((i) => `${itemLabel(i.productName, i.variantName)} x${i.quantity} @${i.unitPrice}`).join("; "),
    o.itemCount,
    o.subtotal,
    o.quantityDiscount,
    o.couponCode ?? "",
    o.couponDiscount,
    o.discount,
    o.deliveryZoneName,
    o.deliveryCharge,
    o.totalAmount,
    orderStatusLabel(o.orderStatus),
    o.customerNote ?? "",
    o.giftWrapCharge,
    o.giftMessage ?? "",
    o.adminNote ?? "",
    o.isFlagged ? o.flagReason ?? "yes" : "",
    o.googleSheetSyncStatus,
  ]);

  return new NextResponse(toCsv(HEADER, rows), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="deenbox-orders-${dhakaDateKey()}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
