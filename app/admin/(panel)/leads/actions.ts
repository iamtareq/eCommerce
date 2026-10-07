"use server";

import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/lib/admin/common";
import { requireAdmin } from "@/lib/auth/guard";
import { prisma } from "@/lib/db";

/** Marks an incomplete checkout as called (or clears that), recording who did it. */
export async function setLeadContacted(id: string, contacted: boolean): Promise<ActionResult> {
  const admin = await requireAdmin();
  if (typeof id !== "string" || !id) return { ok: false, error: "Not found" };
  // Raw SQL so Prisma does not bump updatedAt: it marks the customer's last save, which the
  // reopen and expiry windows count from, and a staff action is not customer activity.
  const count = contacted
    ? // The time is sent from here so it is stored in UTC like Prisma's own writes, whatever the database's time zone.
      await prisma.$executeRaw`UPDATE "CheckoutLead" SET "contactedAt" = ${new Date()}, "contactedBy" = ${admin.displayName} WHERE "id" = ${id}`
    : await prisma.$executeRaw`UPDATE "CheckoutLead" SET "contactedAt" = NULL, "contactedBy" = NULL WHERE "id" = ${id}`;
  revalidatePath("/admin/leads");
  return count ? { ok: true, message: contacted ? "Marked as contacted" : "Marked as not contacted" } : { ok: false, error: "It was already removed." };
}

/** Removes an incomplete checkout (spam, wrong number, or no longer needed). */
export async function deleteLead(id: string): Promise<ActionResult> {
  await requireAdmin();
  if (typeof id !== "string" || !id) return { ok: false, error: "Not found" };
  await prisma.checkoutLead.deleteMany({ where: { id } });
  revalidatePath("/admin/leads");
  return { ok: true, message: "Removed" };
}
