"use server";

import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/lib/admin/common";
import { requireAdmin } from "@/lib/auth/guard";
import { prisma } from "@/lib/db";

/** Marks an incomplete checkout as called (or clears that), recording who did it. */
export async function setLeadContacted(id: string, contacted: boolean): Promise<ActionResult> {
  const admin = await requireAdmin();
  if (typeof id !== "string" || !id) return { ok: false, error: "Not found" };
  const res = await prisma.checkoutLead.updateMany({
    where: { id },
    data: contacted ? { contactedAt: new Date(), contactedBy: admin.displayName } : { contactedAt: null, contactedBy: null },
  });
  revalidatePath("/admin/leads");
  return res.count ? { ok: true, message: contacted ? "Marked as contacted" : "Marked as not contacted" } : { ok: false, error: "It was already removed." };
}

/** Removes an incomplete checkout (spam, wrong number, or no longer needed). */
export async function deleteLead(id: string): Promise<ActionResult> {
  await requireAdmin();
  if (typeof id !== "string" || !id) return { ok: false, error: "Not found" };
  await prisma.checkoutLead.deleteMany({ where: { id } });
  revalidatePath("/admin/leads");
  return { ok: true, message: "Removed" };
}
