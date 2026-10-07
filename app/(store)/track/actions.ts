"use server";

import { headers } from "next/headers";
import { findOrderForTracking, type TrackedOrder } from "@/lib/orders/public";
import { normalizeBdPhone } from "@/lib/phone";
import { LIMITS, rateLimit } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/request";
import { hashIp } from "@/lib/security";

/** The typed values come back so the form stays filled in; `order` is set when one was found. */
export type TrackState = { error: string | null; order: TrackedOrder | null; orderNumber: string; phone: string } | null;

export async function trackOrderAction(_prev: TrackState, formData: FormData): Promise<TrackState> {
  const orderNumber = String(formData.get("orderNumber") ?? "").slice(0, 40);
  const phone = String(formData.get("phone") ?? "").slice(0, 20);
  const fail = (error: string): TrackState => ({ error, order: null, orderNumber, phone });

  if (!orderNumber.trim()) return fail("অর্ডার নম্বর লিখুন।");
  const mobile = normalizeBdPhone(phone);
  if (!mobile) return fail("সঠিক মোবাইল নম্বর লিখুন।");

  const byIp = await rateLimit(`track:ip:${hashIp(getClientIp(await headers()))}`, LIMITS.trackPerIp.limit, LIMITS.trackPerIp.windowMs);
  if (!byIp.ok) return fail("অনেকবার চেষ্টা করা হয়েছে। ১০ মিনিট পর আবার চেষ্টা করুন।");
  const byPhone = await rateLimit(`track:phone:${mobile}`, LIMITS.trackPerPhone.limit, LIMITS.trackPerPhone.windowMs);
  if (!byPhone.ok) return fail("এই নম্বর দিয়ে অনেকবার খোঁজা হয়েছে। এক ঘণ্টা পর আবার চেষ্টা করুন, বা আমাদের ফেসবুক পেজে মেসেজ দিন।");

  const order = await findOrderForTracking(orderNumber, phone);
  // One message for both a wrong number and a wrong phone, so neither can be checked alone.
  if (!order) return fail("এই অর্ডার নম্বর ও মোবাইল নম্বরে কোনো অর্ডার পাওয়া যায়নি। নম্বর দুটি আবার মিলিয়ে দেখুন।");
  return { error: null, order, orderNumber, phone };
}
