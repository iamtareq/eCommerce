import { PageHeader } from "@/components/admin/ui";
import { requireOwner } from "@/lib/auth/guard";
import { CouponForm } from "../CouponForm";

export const metadata = { title: "New coupon" };

export default async function NewCouponPage() {
  await requireOwner();
  return (
    <>
      <PageHeader title="New coupon" back={{ href: "/admin/coupons", label: "Coupons" }} />
      <CouponForm />
    </>
  );
}
