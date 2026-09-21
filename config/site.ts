/**
 * Static brand configuration.
 *
 * Products, prices, discounts, delivery charges, FAQ and contact details are
 * managed from the admin panel (stored in the database). Only values that are
 * part of the code/brand itself live here.
 */
export const siteConfig = {
  name: "Deenbox",
  nameBn: "দ্বীনবক্স",
  tagline: "ইসলামিক গিফট বক্স ও হোম ডেকর",
  description:
    "Deenbox — ইসলামিক গিফট বক্স ও হোম ডেকর। পছন্দের পণ্য বেছে নিন, অর্ডার করুন সহজেই — আমরা ফোনে কনফার্ম করে ডেলিভারি দেব।",
  locale: "bn_BD",
  currency: "BDT",
  orderNumberPrefix: "DBX",
  timeZone: "Asia/Dhaka",
  defaultFacebookPageUrl: "https://www.facebook.com/profile.php?id=61582403091716",
} as const;

export function getSiteUrl(): string {
  const url = process.env.NEXT_PUBLIC_SITE_URL?.trim() || "http://localhost:3000";
  return url.replace(/\/+$/, "");
}

export function getFacebookPageUrl(): string {
  return process.env.NEXT_PUBLIC_FACEBOOK_PAGE_URL?.trim() || siteConfig.defaultFacebookPageUrl;
}
