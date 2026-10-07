import { z } from "zod";
import { itemLabel } from "@/config/order";
import { prisma } from "@/lib/db";
import { getLocationData } from "@/lib/locations.server";
import { loadCart } from "@/lib/orders/cart";
import { getSettingsFresh } from "@/lib/settings";
import { cartLinesSchema, phoneSchema } from "@/lib/validation/checkout";

/** Leads older than this are deleted: long enough to call back, short enough not to hoard numbers. */
export const LEAD_TTL_DAYS = 30;
const LEAD_TTL_MS = LEAD_TTL_DAYS * 24 * 60 * 60 * 1000;

export const leadSchema = z.object({
  customerName: z.string().trim().max(80).default(""),
  mobileNumber: phoneSchema,
  districtId: z.string().trim().max(80).optional(),
  items: cartLinesSchema,
});

export type LeadItem = { name: string; quantity: number };

/**
 * Saves (or refreshes) the unfinished checkout of a phone number. Product names and
 * prices come from the database, never from the browser. Returns false when there is
 * nothing worth saving (no product left in the cart) or the phone already ordered
 * since it was last saved.
 */
export async function saveLead(input: z.output<typeof leadSchema>, ipHash: string | null): Promise<boolean> {
  const settings = await getSettingsFresh();
  const cart = await loadCart(input.items, settings.defaultMaxPerOrder);
  if (cart.lines.length === 0) return false;

  // A phone that just ordered is not an unfinished checkout (e.g. a late save after submitting).
  const recentOrder = await prisma.order.findFirst({
    where: { mobileNumber: input.mobileNumber, createdAt: { gte: new Date(Date.now() - 10 * 60 * 1000) } },
    select: { id: true },
  });
  if (recentOrder) return false;

  const items: LeadItem[] = cart.lines.map((l) => ({ name: itemLabel(l.variant.productName, l.variant.variantName), quantity: l.quantity }));
  const subtotal = cart.lines.reduce((s, l) => s + l.variant.price * l.quantity, 0);
  const district = input.districtId ? (getLocationData().districts.find((d) => d.id === input.districtId)?.bn ?? null) : null;
  const data = { customerName: input.customerName, district, items, subtotal, ipHash };
  await prisma.checkoutLead.upsert({
    where: { mobileNumber: input.mobileNumber },
    create: { mobileNumber: input.mobileNumber, ...data },
    update: data,
  });
  return true;
}

/** A phone that placed an order no longer has an unfinished checkout. */
export async function clearLead(mobileNumber: string): Promise<void> {
  await prisma.checkoutLead.deleteMany({ where: { mobileNumber } });
}

/** Leads newest first, after deleting the expired ones. */
export async function listLeads() {
  await prisma.checkoutLead.deleteMany({ where: { updatedAt: { lt: new Date(Date.now() - LEAD_TTL_MS) } } });
  const rows = await prisma.checkoutLead.findMany({ orderBy: { updatedAt: "desc" }, take: 200 });
  return rows.map((r) => ({ ...r, items: (Array.isArray(r.items) ? r.items : []) as LeadItem[] }));
}

export async function countOpenLeads(): Promise<number> {
  return prisma.checkoutLead.count({
    where: { contactedAt: null, updatedAt: { gte: new Date(Date.now() - LEAD_TTL_MS) } },
  });
}
