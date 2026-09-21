import { notFound } from "next/navigation";
import { AdminNoteEditor, StatusChanger, SyncRetryButton } from "@/components/admin/OrderActions";
import { OrderStatusBadge, SyncStatusBadge } from "@/components/admin/StatusBadges";
import { abtn, Card, Notice, PageHeader, table } from "@/components/admin/ui";
import { Icon } from "@/components/ui/Icon";
import { itemLabel, orderStatusLabel } from "@/config/order";
import { requireAdmin } from "@/lib/auth/guard";
import { whatsappUrl } from "@/lib/contact";
import { formatDateEn } from "@/lib/dates";
import { formatTaka } from "@/lib/money";
import { getOrderDetail } from "@/lib/orders/admin";

export const metadata = { title: "Order" };

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-semibold tracking-wide text-muted uppercase">{label}</dt>
      <dd className="mt-0.5 text-[0.95rem] text-ink">{children}</dd>
    </div>
  );
}

function Money({ label, value, strong, negative }: { label: string; value: number; strong?: boolean; negative?: boolean }) {
  return (
    <div className={`flex justify-between gap-3 ${strong ? "border-t border-line pt-2 text-base font-bold" : "text-sm"}`}>
      <dt className={strong ? "text-ink" : "text-ink-soft"}>{label}</dt>
      <dd className={`tabular-nums ${negative && value > 0 ? "text-emerald-700" : ""}`}>
        {negative && value > 0 ? "− " : ""}
        {formatTaka(value)}
      </dd>
    </div>
  );
}

export default async function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const order = await getOrderDetail(id);
  if (!order) notFound();

  const wa = whatsappUrl(order.mobileNumber, `আসসালামু আলাইকুম, Deenbox থেকে বলছি। আপনার অর্ডার ${order.orderNumber} কনফার্ম করার জন্য যোগাযোগ করছি।`);
  const fullAddress = `${order.address}, ${order.area}, ${order.district}, ${order.division}`;

  return (
    <>
      <PageHeader
        back={{ href: "/admin/orders", label: "All orders" }}
        title={order.orderNumber}
        description={`Placed ${formatDateEn(order.createdAt)} · Updated ${formatDateEn(order.updatedAt)}`}
        actions={
          <>
            <a href={`tel:${order.mobileNumber}`} className={`${abtn.primary} ${abtn.md}`}>
              <Icon name="phone" className="size-4" /> Call customer
            </a>
            {wa && (
              <a href={wa} target="_blank" rel="noopener noreferrer" className={`${abtn.secondary} ${abtn.md}`}>
                <Icon name="whatsapp" className="size-4 text-emerald-600" /> WhatsApp
              </a>
            )}
          </>
        }
      />

      {order.isFlagged && (
        <div className="mb-4">
          <Notice tone="warning">
            <strong>Check before confirming:</strong> {order.flagReason}.
          </Notice>
        </div>
      )}

      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-4">
          <Card title="Customer & delivery">
            <dl className="grid gap-4 sm:grid-cols-2">
              <Field label="Customer name">{order.customerName}</Field>
              <Field label="Mobile number">
                <a href={`tel:${order.mobileNumber}`} className="font-mono font-semibold text-pine-800 hover:underline">
                  {order.mobileNumber}
                </a>
              </Field>
              <Field label="Division">{order.division}</Field>
              <Field label="District">{order.district}</Field>
              <Field label="Area / Thana">{order.area}</Field>
              <Field label="Delivery zone">
                {order.deliveryZoneName} ({formatTaka(order.deliveryCharge)})
              </Field>
              <div className="sm:col-span-2">
                <Field label="Full address">
                  <span className="whitespace-pre-line">{order.address}</span>
                </Field>
                <p className="mt-1 text-xs text-muted">Courier format: {fullAddress}</p>
              </div>
              {order.customerNote && (
                <div className="sm:col-span-2">
                  <Field label="Customer note">
                    <span className="block rounded-lg bg-brass-50 px-3 py-2 whitespace-pre-line">{order.customerNote}</span>
                  </Field>
                </div>
              )}
            </dl>
          </Card>

          <Card title={`Items (${order.itemCount})`} padded={false}>
            <div className={table.wrap}>
              <table className={table.table}>
                <thead>
                  <tr>
                    <th className={table.th}>Product</th>
                    <th className={table.th}>SKU</th>
                    <th className={`${table.th} text-right`}>Unit price</th>
                    <th className={`${table.th} text-right`}>Qty</th>
                    <th className={`${table.th} text-right`}>Discount</th>
                    <th className={`${table.th} text-right`}>Line total</th>
                  </tr>
                </thead>
                <tbody>
                  {order.items.map((i) => (
                    <tr key={i.id}>
                      <td className={`${table.td} font-medium`}>{itemLabel(i.productName, i.variantName)}</td>
                      <td className={`${table.td} font-mono text-xs text-muted`}>{i.sku ?? "—"}</td>
                      <td className={`${table.td} text-right tabular-nums`}>
                        {formatTaka(i.unitPrice)}
                        {i.compareAtPrice && <span className="block text-xs text-muted line-through">{formatTaka(i.compareAtPrice)}</span>}
                      </td>
                      <td className={`${table.td} text-right tabular-nums`}>{i.quantity}</td>
                      <td className={`${table.td} text-right tabular-nums`}>{i.lineDiscount ? `− ${formatTaka(i.lineDiscount)}` : "—"}</td>
                      <td className={`${table.td} text-right font-semibold tabular-nums`}>{formatTaka(i.lineSubtotal - i.lineDiscount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <dl className="ml-auto max-w-sm space-y-1.5 p-4 sm:p-5">
              <Money label="Subtotal" value={order.subtotal} />
              <Money label="Quantity discount" value={order.quantityDiscount} negative />
              <Money label={`Coupon${order.couponCode ? ` (${order.couponCode})` : ""}`} value={order.couponDiscount} negative />
              <Money label="Delivery charge" value={order.deliveryCharge} />
              <Money label="Total" value={order.totalAmount} strong />
            </dl>
          </Card>

          <Card title="History">
            <ol className="space-y-3">
              {order.events.map((e) => (
                <li key={e.id} className="flex gap-3 text-sm">
                  <span className="mt-1.5 size-2 shrink-0 rounded-full bg-pine-600" aria-hidden="true" />
                  <div>
                    <p className="text-ink">
                      {e.type === "STATUS_CHANGED" && e.fromStatus && e.toStatus
                        ? `Status: ${orderStatusLabel(e.fromStatus)} → ${orderStatusLabel(e.toStatus)}`
                        : e.type === "NOTE_UPDATED"
                          ? `Note updated: ${e.message}`
                          : e.message ?? e.type}
                    </p>
                    <p className="text-xs text-muted">
                      {formatDateEn(e.createdAt)}
                      {e.actorName ? ` · ${e.actorName}` : ""}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </Card>
        </div>

        <div className="space-y-4">
          <Card title="Order status">
            <div className="mb-3">
              <OrderStatusBadge status={order.orderStatus} />
            </div>
            <StatusChanger orderId={order.id} status={order.orderStatus} />
          </Card>

          <Card title="Internal note">
            <AdminNoteEditor orderId={order.id} note={order.adminNote ?? ""} />
          </Card>

          <Card title="Google Sheet">
            <dl className="space-y-3">
              <Field label="Sync status">
                <SyncStatusBadge status={order.googleSheetSyncStatus} />
              </Field>
              <Field label="Row">{order.googleSheetRowReference ?? "—"}</Field>
              <Field label="Last synced">{order.googleSheetLastSyncAt ? formatDateEn(order.googleSheetLastSyncAt) : "Never"}</Field>
              <Field label="Attempts">{order.googleSheetSyncAttempts}</Field>
              {order.googleSheetSyncError && (
                <Field label="Last error">
                  <span className="block rounded-lg bg-red-50 px-3 py-2 font-mono text-xs break-words text-red-900">{order.googleSheetSyncError}</span>
                </Field>
              )}
            </dl>
            <div className="mt-4">
              <SyncRetryButton orderId={order.id} synced={order.googleSheetSyncStatus === "SYNCED"} />
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}
