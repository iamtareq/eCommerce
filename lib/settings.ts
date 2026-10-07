import { unstable_cache } from "next/cache";
import { z } from "zod";
import { siteConfig } from "@/config/site";
import { prisma } from "@/lib/db";
import { normalizeBdPhone } from "@/lib/phone";
import { faqItemSchema } from "@/lib/validation/content";

export const SETTINGS_TAG = "settings";
const SETTINGS_KEY = "site";

const optionalUrl = z
  .string()
  .trim()
  .max(300)
  .refine((v) => v === "" || /^https:\/\/[^\s]+$/i.test(v), { error: "Must be an https:// URL" })
  .default("");

/**
 * WhatsApp number: "" (link hidden) or a Bangladeshi mobile number, stored in the local 01XXXXXXXXX form.
 * The store's wa.me link needs a valid mobile number, so anything else would silently hide it.
 */
const whatsappNumberSchema = z
  .string()
  .trim()
  .max(20)
  .refine((v) => v === "" || normalizeBdPhone(v) !== null, { error: "Enter a Bangladeshi mobile number, e.g. 01712345678" })
  .transform((v) => (v === "" ? "" : (normalizeBdPhone(v) ?? v)))
  .default("");

const whyChooseItemSchema = z.object({
  title: z.string().trim().min(1).max(80),
  description: z.string().trim().max(300).default(""),
});

/**
 * Admin-editable site settings. Every field has a default so the site works
 * before anything is configured. Defaults only state facts the business has
 * confirmed (orders are confirmed by phone; delivery inside and outside Dhaka).
 */
export const siteSettingsSchema = z.object({
  acceptingOrders: z.boolean().default(true),
  closedMessage: z.string().trim().max(300).default(""),
  announcement: z.string().trim().max(200).default(""),

  homeHeadline: z.string().trim().max(120).default("ঘর সাজান দ্বীনের সৌন্দর্যে"),
  homeSubheadline: z
    .string()
    .trim()
    .max(300)
    .default("ইসলামিক গিফট বক্স ও হোম ডেকর — প্রিয়জনকে উপহার দিন, ঘরকে সাজান রুচিশীলভাবে।"),

  contactPhone: z.string().trim().max(20).default(""),
  whatsappNumber: whatsappNumberSchema,
  messengerUrl: optionalUrl,
  facebookPageUrl: optionalUrl.default(siteConfig.defaultFacebookPageUrl),
  email: z
    .string()
    .trim()
    .max(120)
    .refine((v) => v === "" || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), { error: "Invalid email" })
    .default(""),
  businessAddress: z.string().trim().max(300).default(""),
  returnPolicy: z.string().trim().max(3000).default(""),

  /** Customers pay on delivery. Off until the owner confirms it: the store then says so (trust strip, product page, how to order). */
  cashOnDelivery: z.boolean().default(false),
  /** Orders whose product total (after discounts) reaches this amount get free delivery. Null = off. */
  freeDeliveryMinAmount: z.number().int().min(1).max(10_000_000).nullable().default(null),
  /** Price of gift wrapping, which customers can add at checkout. Null = not offered (the option is hidden). */
  giftWrapPrice: z.number().int().min(1).max(100_000).nullable().default(null),
  /** Max total quantity per product per order when the product has no own limit. */
  defaultMaxPerOrder: z.number().int().min(1).max(999).default(10),
  /** Stock at or below this counts as low: listed on the dashboard and alerted on Telegram. 0 = off. */
  lowStockThreshold: z.number().int().min(0).max(9999).default(5),
  /** Flag an order when the same phone ordered within this many hours. 0 = off. */
  duplicateWindowHours: z.number().int().min(0).max(720).default(24),

  whyChoose: z
    .array(whyChooseItemSchema)
    .max(12)
    .default([
      { title: "সহজ অর্ডার", description: "কয়েকটি তথ্য দিয়েই এক মিনিটে অর্ডার সম্পন্ন করুন।" },
      { title: "ফোনে কনফার্মেশন", description: "প্রতিটি অর্ডার আমাদের প্রতিনিধি ফোন করে কনফার্ম করেন।" },
      { title: "ঢাকার ভেতরে ও বাইরে ডেলিভারি", description: "ঢাকা সিটির ভেতরে ও বাইরে — দুই জায়গাতেই ডেলিভারি দেওয়া হয়।" },
      { title: "নিরাপদ অর্ডার প্রক্রিয়া", description: "আপনার তথ্য শুধু অর্ডার ডেলিভারির কাজে ব্যবহার করা হয়।" },
    ]),

  /**
   * FAQ. Placeholders in answers are filled at render time:
   *   {deliveryCharges} → list of zone charges, {deliveryTimes} → zone delivery times.
   * Items whose answer is empty (or whose placeholder has no data) are hidden.
   */
  faqs: z
    .array(faqItemSchema)
    .max(40)
    .default([
      {
        question: "কীভাবে অর্ডার করব?",
        answer:
          "পছন্দের পণ্যটি বেছে নিয়ে \"অর্ডার করুন\" বাটনে চাপুন। এরপর আপনার নাম, মোবাইল নম্বর ও ঠিকানা দিয়ে \"অর্ডার কনফার্ম করুন\" চাপুন।",
      },
      {
        question: "অর্ডার করার পর কীভাবে কনফার্মেশন পাব?",
        answer:
          "অর্ডার করার সাথে সাথেই আপনি একটি অর্ডার নম্বর পাবেন। এরপর আমাদের প্রতিনিধি আপনার দেওয়া মোবাইল নম্বরে ফোন করে অর্ডারটি কনফার্ম করবেন।",
      },
      { question: "ডেলিভারি চার্জ কত?", answer: "{deliveryCharges}" },
      { question: "ডেলিভারি কত দিনে হবে?", answer: "{deliveryTimes}" },
      { question: "ক্যাশ অন ডেলিভারি আছে কি?", answer: "" },
      { question: "পণ্য রিটার্ন/এক্সচেঞ্জ করা যাবে কি?", answer: "" },
      { question: "কোন কোন এলাকায় ডেলিভারি দেওয়া হয়?", answer: "" },
    ]),
});

export type SiteSettings = z.infer<typeof siteSettingsSchema>;

/** Parses stored settings; unknown or invalid fields fall back to defaults. */
export function parseSettings(value: unknown): SiteSettings {
  const obj = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const parsed = siteSettingsSchema.safeParse(obj);
  if (parsed.success) return parsed.data;
  // Keep every field that is individually valid.
  const defaults = siteSettingsSchema.parse({});
  const merged: Record<string, unknown> = { ...defaults };
  for (const key of Object.keys(siteSettingsSchema.shape) as (keyof SiteSettings)[]) {
    const field = siteSettingsSchema.shape[key].safeParse(obj[key]);
    if (field.success) merged[key] = field.data;
  }
  return merged as SiteSettings;
}

async function loadSettings(): Promise<SiteSettings> {
  const row = await prisma.setting.findUnique({ where: { key: SETTINGS_KEY } });
  return parseSettings(row?.value);
}

/** Cached site settings (invalidated with the "settings" tag on save). */
export const getSettings = unstable_cache(loadSettings, ["site-settings"], { tags: [SETTINGS_TAG] });

/** Uncached read — use inside order creation and admin forms. */
export const getSettingsFresh = loadSettings;

export async function saveSettings(settings: SiteSettings): Promise<void> {
  await prisma.setting.upsert({
    where: { key: SETTINGS_KEY },
    create: { key: SETTINGS_KEY, value: settings },
    update: { value: settings },
  });
}
