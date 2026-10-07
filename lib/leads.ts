import { z } from "zod";
import { itemLabel } from "@/config/order";
import { isUniqueViolation, prisma } from "@/lib/db";
import { getLocationData } from "@/lib/locations.server";
import { loadCart } from "@/lib/orders/cart";
import { rateLimit } from "@/lib/rate-limit";
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
 * Numbers one IP may add, or take over from another IP, per day: room for a shared
 * mobile-network IP and for customers whose IP changes, not for filling or rewriting the call list.
 */
const NUMBERS_PER_IP_PER_DAY = 20;
const HOUR_MS = 60 * 60 * 1000;
/** Orders this recent mean the phone finished its checkout. */
const RECENT_ORDER_MS = 10 * 60 * 1000;

/** The same products and quantities in any order give the same key. */
function cartKey(items: LeadItem[]): string {
  return items
    .map((i) => `${i.name}×${i.quantity}`)
    .sort()
    .join("|");
}

function orderedRecently(mobileNumber: string) {
  return prisma.order.findFirst({
    where: { mobileNumber, createdAt: { gte: new Date(Date.now() - RECENT_ORDER_MS) } },
    select: { id: true },
  });
}

/**
 * Saves (or refreshes) the unfinished checkout of a phone number. Product names and
 * prices come from the database, never from the browser. Returns false when nothing
 * was saved: no product left in the cart, the phone already ordered, or this IP has
 * added or taken over too many numbers today.
 *
 * Anyone can type any number, so an entry is not locked to the IP that saved it (that
 * shut out customers whose IP changed, and let whoever typed a number first keep it).
 * Instead, adding a number or changing one last saved from another IP uses up the IP's
 * daily allowance, which bounds how many entries one visitor can create or rewrite.
 */
export async function saveLead(input: z.output<typeof leadSchema>, ipHash: string | null): Promise<boolean> {
  const settings = await getSettingsFresh();
  const cart = await loadCart(input.items, settings.defaultMaxPerOrder);
  if (cart.lines.length === 0) return false;
  // A phone that just ordered is not an unfinished checkout (e.g. a late save after submitting).
  if (await orderedRecently(input.mobileNumber)) return false;

  const items: LeadItem[] = cart.lines.map((l) => ({ name: itemLabel(l.variant.productName, l.variant.variantName), quantity: l.quantity }));
  const subtotal = cart.lines.reduce((s, l) => s + l.variant.price * l.quantity, 0);
  const district = input.districtId ? (getLocationData().districts.find((d) => d.id === input.districtId)?.bn ?? null) : null;
  const data = { customerName: input.customerName, district, items, subtotal, ipHash };

  const existing = await prisma.checkoutLead.findUnique({ where: { mobileNumber: input.mobileNumber } });
  if (ipHash && (!existing || existing.ipHash !== ipHash)) {
    const limit = await rateLimit(`lead:numbers:ip:${ipHash}`, NUMBERS_PER_IP_PER_DAY, 24 * HOUR_MS);
    if (!limit.ok) return false;
  }

  if (existing) {
    // A different cart, or a return after an hour, is new activity: open it again for a call.
    const before = Array.isArray(existing.items) ? (existing.items as LeadItem[]) : [];
    const reopen = cartKey(before) !== cartKey(items) || Date.now() - existing.updatedAt.getTime() > HOUR_MS;
    // updateMany: an order's clearLead may have removed it meanwhile, which is fine.
    await prisma.checkoutLead.updateMany({
      where: { id: existing.id },
      data: { ...data, ...(reopen ? { contactedAt: null, contactedBy: null } : {}) },
    });
  } else {
    try {
      await prisma.checkoutLead.create({ data: { mobileNumber: input.mobileNumber, ...data } });
    } catch (error) {
      // Another save for this number created it first; that one stands.
      if (isUniqueViolation(error)) return false;
      throw error;
    }
  }

  // The order may have been placed while this save ran (its clearLead found nothing to
  // delete yet). Checking again after writing closes that gap: either the order's clearLead
  // runs after this write, or the order is already visible here.
  if (await orderedRecently(input.mobileNumber)) {
    await clearLead(input.mobileNumber);
    return false;
  }
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
