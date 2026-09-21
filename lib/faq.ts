import type { DeliveryConfig } from "@/lib/catalog";
import { formatTakaBn } from "@/lib/money";
import type { FaqItem } from "@/lib/validation/content";

/**
 * Fills FAQ placeholders from live data so answers never go stale:
 *   {deliveryCharges} → "ঢাকা সিটির ভেতরে: ৳৭০ · ঢাকা সিটির বাইরে: ৳১৩০"
 *   {deliveryTimes}   → per-zone delivery estimates
 * Items with an empty answer, or a placeholder without data, are dropped.
 */
export function resolveFaqs(items: FaqItem[], delivery: DeliveryConfig, freeDeliveryMinAmount: number | null): FaqItem[] {
  const zones = delivery.zones;
  const charges = zones.length
    ? zones.map((z) => `${z.name}: ${formatTakaBn(z.charge)}`).join("। ") +
      "।" +
      (freeDeliveryMinAmount ? ` ${formatTakaBn(freeDeliveryMinAmount)} বা তার বেশি মূল্যের অর্ডারে ডেলিভারি ফ্রি।` : "")
    : "";
  const timed = zones.filter((z) => z.estimatedDelivery);
  const times = timed.length ? timed.map((z) => `${z.name}: ${z.estimatedDelivery}`).join("। ") + "।" : "";

  const out: FaqItem[] = [];
  for (const item of items) {
    let answer = item.answer.trim();
    if (!answer) continue;
    if (answer.includes("{deliveryCharges}")) {
      if (!charges) continue;
      answer = answer.replaceAll("{deliveryCharges}", charges);
    }
    if (answer.includes("{deliveryTimes}")) {
      if (!times) continue;
      answer = answer.replaceAll("{deliveryTimes}", times);
    }
    out.push({ question: item.question, answer });
  }
  return out;
}
