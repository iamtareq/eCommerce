"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { findOrderTokenForTracking } from "@/lib/orders/public";
import { normalizeBdPhone } from "@/lib/phone";
import { LIMITS, rateLimit } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/request";
import { hashIp } from "@/lib/security";

/** The typed values come back so a failed lookup keeps the form filled in. */
export type TrackState = { error: string; orderNumber: string; phone: string } | null;

export async function trackOrderAction(_prev: TrackState, formData: FormData): Promise<TrackState> {
  const orderNumber = String(formData.get("orderNumber") ?? "").slice(0, 40);
  const phone = String(formData.get("phone") ?? "").slice(0, 20);
  const echo = { orderNumber, phone };

  if (!orderNumber.trim()) return { error: "অর্ডার নম্বর লিখুন।", ...echo };
  if (!normalizeBdPhone(phone)) return { error: "সঠিক মোবাইল নম্বর লিখুন।", ...echo };

  const limit = await rateLimit(`track:ip:${hashIp(getClientIp(await headers()))}`, LIMITS.trackPerIp.limit, LIMITS.trackPerIp.windowMs);
  if (!limit.ok) return { error: "অনেকবার চেষ্টা করা হয়েছে। ১০ মিনিট পর আবার চেষ্টা করুন।", ...echo };

  const token = await findOrderTokenForTracking(orderNumber, phone);
  // One message for both a wrong number and a wrong phone, so neither can be checked alone.
  if (!token) {
    return { error: "এই অর্ডার নম্বর ও মোবাইল নম্বরে কোনো অর্ডার পাওয়া যায়নি। নম্বর দুটি আবার মিলিয়ে দেখুন।", ...echo };
  }
  redirect(`/order/${token}?view=status`);
}
