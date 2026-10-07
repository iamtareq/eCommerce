import Link from "next/link";
import { itemLabel } from "@/config/order";
import type { OrderStatus, SheetSyncStatus } from "@/generated/prisma/enums";
import { formatDateEn } from "@/lib/dates";
import { formatTaka } from "@/lib/money";
import { OrderStatusBadge, SyncStatusBadge } from "./StatusBadges";
import { EmptyState, table } from "./ui";
import { Icon } from "@/components/ui/Icon";

export interface OrderRow {
  id: string;
  orderNumber: string;
  customerName: string;
  mobileNumber: string;
  items: { productName: string; variantName: string | null; quantity: number }[];
  itemCount: number;
  totalAmount: number;
  orderStatus: OrderStatus;
  googleSheetSyncStatus: SheetSyncStatus;
  isFlagged: boolean;
  createdAt: Date;
}

export function OrdersTable({ orders }: { orders: OrderRow[] }) {
  if (!orders.length) return <EmptyState icon="list" title="No orders found" />;
  const products = (o: OrderRow) => o.items.map((i) => `${itemLabel(i.productName, i.variantName)} ×${i.quantity}`).join(", ");
  return (
    <>
      <ul className={table.cards}>
        {orders.map((o) => (
          <li key={o.id}>
            <Link href={`/admin/orders/${o.id}`} className={`${table.card} hover:bg-paper`}>
              <span className="flex items-baseline justify-between gap-3">
                <span className="font-mono text-[0.83rem] font-semibold text-pine-800">{o.orderNumber}</span>
                <span className="font-semibold text-ink tabular-nums">{formatTaka(o.totalAmount)}</span>
              </span>
              <span className="mt-1 flex items-baseline justify-between gap-3 text-sm">
                <span className="min-w-0 truncate font-medium text-ink">{o.customerName}</span>
                <span className="shrink-0 font-mono text-xs text-muted">{o.mobileNumber}</span>
              </span>
              <span className="mt-1 line-clamp-2 text-sm text-ink-soft">{products(o)}</span>
              <span className="mt-2 flex flex-wrap items-center gap-1.5">
                <OrderStatusBadge status={o.orderStatus} />
                <SyncStatusBadge status={o.googleSheetSyncStatus} />
                {o.isFlagged && (
                  <span className="flex items-center gap-1 text-xs font-semibold text-orange-700">
                    <Icon name="flag" className="size-3.5" /> Check
                  </span>
                )}
                <span className="ml-auto text-xs whitespace-nowrap text-muted">{formatDateEn(o.createdAt)}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
      <div className={table.desktopWrap}>
        <table className={table.table}>
          <thead>
            <tr>
              <th className={table.th}>Order</th>
              <th className={table.th}>Customer</th>
              <th className={table.th}>Products</th>
              <th className={`${table.th} text-right`}>Qty</th>
              <th className={`${table.th} text-right`}>Total</th>
              <th className={table.th}>Status</th>
              <th className={table.th}>Sheet</th>
              <th className={table.th}>Date</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((o) => (
              <tr key={o.id} className="hover:bg-paper">
                <td className={table.td}>
                  <Link href={`/admin/orders/${o.id}`} className="font-mono text-[0.83rem] font-semibold text-pine-800 hover:underline">
                    {o.orderNumber}
                  </Link>
                  {o.isFlagged && (
                    <span className="mt-1 flex items-center gap-1 text-xs font-semibold text-orange-700" title="Possible duplicate — check before confirming">
                      <Icon name="flag" className="size-3.5" /> Check
                    </span>
                  )}
                </td>
                <td className={table.td}>
                  <span className="block font-medium text-ink">{o.customerName}</span>
                  <a href={`tel:${o.mobileNumber}`} className="font-mono text-xs text-muted hover:text-pine-800">
                    {o.mobileNumber}
                  </a>
                </td>
                <td className={`${table.td} max-w-64`}>
                  <span className="line-clamp-2 text-ink-soft">
                    {products(o)}
                  </span>
                </td>
                <td className={`${table.td} text-right tabular-nums`}>{o.itemCount}</td>
                <td className={`${table.td} text-right font-semibold tabular-nums`}>{formatTaka(o.totalAmount)}</td>
                <td className={table.td}>
                  <OrderStatusBadge status={o.orderStatus} />
                </td>
                <td className={table.td}>
                  <SyncStatusBadge status={o.googleSheetSyncStatus} />
                </td>
                <td className={`${table.td} text-xs whitespace-nowrap text-muted`}>{formatDateEn(o.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
