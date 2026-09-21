import { notFound } from "next/navigation";
import { Badge, Notice, PageHeader } from "@/components/admin/ui";
import { requireOwner } from "@/lib/auth/guard";
import { toDhakaDateTimeLocal } from "@/lib/dates";
import { prisma } from "@/lib/db";
import { CouponForm, type CouponFormValue } from "../CouponForm";
import { couponStateBadges } from "../format";

export const metadata = { title: "Edit coupon" };

const str = (n: number | null | undefined) => (n == null ? "" : String(n));

export default async function EditCouponPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ saved?: string }>;
}) {
  await requireOwner();
  const { id } = await params;
  const { saved } = await searchParams;
  const coupon = await prisma.coupon.findUnique({
    where: { id },
    include: { _count: { select: { orders: true } } },
  });
  if (!coupon) notFound();

  const initial: CouponFormValue = {
    id: coupon.id,
    code: coupon.code,
    description: coupon.description ?? "",
    type: coupon.type,
    value: coupon.type === "FREE_DELIVERY" ? "" : String(coupon.value),
    minOrderAmount: str(coupon.minOrderAmount),
    maxDiscountAmount: coupon.type === "PERCENT" ? str(coupon.maxDiscountAmount) : "",
    startsAt: toDhakaDateTimeLocal(coupon.startsAt),
    endsAt: toDhakaDateTimeLocal(coupon.endsAt),
    usageLimit: str(coupon.usageLimit),
    perPhoneLimit: str(coupon.perPhoneLimit),
    isActive: coupon.isActive,
  };
  const orders = coupon._count.orders;
  const badges = couponStateBadges(coupon, new Date());

  return (
    <>
      <PageHeader
        title={coupon.code}
        description={orders ? `Used in ${orders} order${orders === 1 ? "" : "s"}` : "Not used in any order yet"}
        back={{ href: "/admin/coupons", label: "Coupons" }}
        actions={
          <div className="flex flex-wrap gap-1">
            {badges.map((b) => (
              <Badge key={b.label} tone={b.tone}>
                {b.label}
              </Badge>
            ))}
          </div>
        }
      />
      {saved && (
        <div className="mb-4">
          <Notice tone="success">Coupon created.</Notice>
        </div>
      )}
      <CouponForm initial={initial} usedCount={coupon.usedCount} orderCount={orders} />
    </>
  );
}
