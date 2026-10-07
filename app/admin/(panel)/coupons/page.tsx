import Link from "next/link";
import { abtn, Badge, Card, EmptyState, Notice, PageHeader, table } from "@/components/admin/ui";
import { Icon } from "@/components/ui/Icon";
import { requireOwner } from "@/lib/auth/guard";
import { formatDateEn } from "@/lib/dates";
import { prisma } from "@/lib/db";
import { formatTaka } from "@/lib/money";
import { COUPON_TYPE_LABELS, couponStateBadges, couponValueLabel } from "./format";

export const metadata = { title: "Coupons" };

function validity(startsAt: Date | null, endsAt: Date | null): React.ReactNode {
  if (!startsAt && !endsAt) return <span className="text-muted">No time limit</span>;
  return (
    <span className="block text-xs leading-5 whitespace-nowrap">
      {startsAt && (
        <span className="block">
          <span className="text-muted">From</span> {formatDateEn(startsAt)}
        </span>
      )}
      {endsAt && (
        <span className="block">
          <span className="text-muted">Until</span> {formatDateEn(endsAt)}
        </span>
      )}
    </span>
  );
}

export default async function CouponsAdminPage({ searchParams }: { searchParams: Promise<{ deleted?: string }> }) {
  await requireOwner();
  const { deleted } = await searchParams;
  const coupons = await prisma.coupon.findMany({
    orderBy: [{ isActive: "desc" }, { createdAt: "desc" }],
  });
  const now = new Date();

  return (
    <>
      <PageHeader
        title="Coupons"
        description="Discount codes customers can enter at checkout. Times are Bangladesh time."
        actions={
          <Link href="/admin/coupons/new" className={`${abtn.primary} ${abtn.md}`}>
            <Icon name="plus" className="size-4" /> New coupon
          </Link>
        }
      />
      {deleted && (
        <div className="mb-4">
          <Notice tone="success">Coupon deleted.</Notice>
        </div>
      )}
      <Card padded={false}>
        {coupons.length === 0 ? (
          <EmptyState icon="tag" title="No coupons yet">
            <Link href="/admin/coupons/new" className="font-semibold text-pine-700 underline">
              Create your first coupon
            </Link>
          </EmptyState>
        ) : (
          <>
            <ul className={table.cards}>
              {coupons.map((c) => (
                <li key={c.id}>
                  <Link href={`/admin/coupons/${c.id}`} className={`${table.card} hover:bg-paper`}>
                    <span className="flex items-start justify-between gap-3">
                      <span className="font-mono font-semibold tracking-wide text-ink">{c.code}</span>
                      <span className="font-semibold whitespace-nowrap text-ink tabular-nums">{couponValueLabel(c.type, c.value)}</span>
                    </span>
                    {c.description && <span className="mt-0.5 line-clamp-2 block text-xs text-muted">{c.description}</span>}
                    <span className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted">
                      <span>{COUPON_TYPE_LABELS[c.type]}</span>
                      <span className="tabular-nums">
                        Used {c.usedCount} / {c.usageLimit ?? "∞"}
                        {c.perPhoneLimit != null && ` · ${c.perPhoneLimit} per phone`}
                      </span>
                      {c.type === "PERCENT" && c.maxDiscountAmount != null && <span>Max {formatTaka(c.maxDiscountAmount)}</span>}
                      {c.minOrderAmount != null && c.minOrderAmount > 0 && <span>Min. order {formatTaka(c.minOrderAmount)}</span>}
                    </span>
                    <span className="mt-1.5 block text-xs">{validity(c.startsAt, c.endsAt)}</span>
                    <span className="mt-2 flex flex-wrap gap-1">
                      {couponStateBadges(c, now).map((b) => (
                        <Badge key={b.label} tone={b.tone}>
                          {b.label}
                        </Badge>
                      ))}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
            <div className={table.desktopWrap}>
              <table className={table.table}>
                <thead>
                  <tr>
                    <th className={table.th}>Code</th>
                    <th className={table.th}>Type</th>
                    <th className={table.th}>Value</th>
                    <th className={`${table.th} text-right`}>Used</th>
                    <th className={table.th}>Valid</th>
                    <th className={table.th}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {coupons.map((c) => (
                    <tr key={c.id} className="hover:bg-paper">
                      <td className={table.td}>
                        <Link href={`/admin/coupons/${c.id}`} className="font-mono font-semibold tracking-wide text-ink hover:text-pine-800 hover:underline">
                          {c.code}
                        </Link>
                        {c.description && <span className="mt-0.5 line-clamp-2 block max-w-xs text-xs text-muted">{c.description}</span>}
                      </td>
                      <td className={`${table.td} whitespace-nowrap`}>{COUPON_TYPE_LABELS[c.type]}</td>
                      <td className={table.td}>
                        <span className="block font-semibold whitespace-nowrap text-ink tabular-nums">{couponValueLabel(c.type, c.value)}</span>
                        {c.type === "PERCENT" && c.maxDiscountAmount != null && (
                          <span className="block text-xs whitespace-nowrap text-muted">Max {formatTaka(c.maxDiscountAmount)}</span>
                        )}
                        {c.minOrderAmount != null && c.minOrderAmount > 0 && (
                          <span className="block text-xs whitespace-nowrap text-muted">Min. order {formatTaka(c.minOrderAmount)}</span>
                        )}
                      </td>
                      <td className={`${table.td} text-right whitespace-nowrap tabular-nums`}>
                        {c.usedCount}
                        <span className="text-muted"> / {c.usageLimit ?? "∞"}</span>
                        {c.perPhoneLimit != null && <span className="block text-xs text-muted">{c.perPhoneLimit} per phone</span>}
                      </td>
                      <td className={table.td}>{validity(c.startsAt, c.endsAt)}</td>
                      <td className={table.td}>
                        <div className="flex flex-wrap gap-1">
                          {couponStateBadges(c, now).map((b) => (
                            <Badge key={b.label} tone={b.tone}>
                              {b.label}
                            </Badge>
                          ))}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </Card>
    </>
  );
}
