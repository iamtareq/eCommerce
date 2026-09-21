"use server";

import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/lib/admin/common";
import { requireOwner } from "@/lib/auth/guard";
import { isUniqueViolation, prisma } from "@/lib/db";
import { couponInputSchema, firstIssue, type CouponInput } from "./schema";

// Coupons are read fresh from the database at checkout, so no cache tags to update.
function refresh(id?: string) {
  revalidatePath("/admin/coupons");
  if (id) revalidatePath(`/admin/coupons/${id}`);
}

export async function saveCoupon(input: CouponInput): Promise<ActionResult<{ id: string; code: string }>> {
  await requireOwner();
  const parsed = couponInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  const { id, data } = parsed.data;

  try {
    if (id) {
      const updated = await prisma.coupon.updateMany({ where: { id }, data });
      if (updated.count === 0) return { ok: false, error: "Coupon not found. It may have been deleted." };
      refresh(id);
      return { ok: true, message: `Coupon ${data.code} saved`, data: { id, code: data.code } };
    }
    const created = await prisma.coupon.create({ data, select: { id: true } });
    refresh(created.id);
    return { ok: true, message: `Coupon ${data.code} created`, data: { id: created.id, code: data.code } };
  } catch (error) {
    if (isUniqueViolation(error)) return { ok: false, error: `Another coupon already uses the code ${data.code}. Choose a different code.` };
    console.error("[admin] saveCoupon failed", error);
    return { ok: false, error: "Could not save the coupon. Please try again." };
  }
}

/** Deletes an unused coupon; a coupon used by any order is deactivated instead (order history keeps the link). */
export async function deleteCoupon(id: string): Promise<ActionResult<{ deleted: boolean }>> {
  await requireOwner();
  if (typeof id !== "string" || !id) return { ok: false, error: "Coupon not found" };

  const coupon = await prisma.coupon.findUnique({
    where: { id },
    select: { code: true, _count: { select: { orders: true } } },
  });
  if (!coupon) return { ok: false, error: "Coupon not found. It may already have been deleted." };

  try {
    const orders = coupon._count.orders;
    if (orders > 0) {
      await prisma.coupon.update({ where: { id }, data: { isActive: false } });
      refresh(id);
      return {
        ok: true,
        message: `${coupon.code} was used in ${orders} order${orders === 1 ? "" : "s"}, so it was deactivated instead of deleted. Customers can no longer use it.`,
        data: { deleted: false },
      };
    }
    await prisma.coupon.delete({ where: { id } });
    refresh();
    return { ok: true, message: `Coupon ${coupon.code} deleted`, data: { deleted: true } };
  } catch (error) {
    console.error("[admin] deleteCoupon failed", error);
    return { ok: false, error: "Could not delete the coupon. Please try again." };
  }
}
