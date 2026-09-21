/**
 * DEMO data for local testing only — never run this on the live store.
 *
 * Creates clearly-labelled demo products (names start with "[ডেমো]", slugs
 * start with "demo-") with generated placeholder images that say "DEMO IMAGE",
 * plus a demo coupon DEMO10. Remove everything with `npm run db:demo:remove`.
 *
 * Run: npm run db:seed:demo
 */
import "dotenv/config";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { prisma } from "../lib/db";

const UPLOAD_DIR = path.resolve(process.cwd(), process.env.UPLOAD_DIR?.trim() || "./storage/uploads");

async function placeholder(name: string, hue: string, label: string) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="1200" viewBox="0 0 1200 1200">
    <rect width="1200" height="1200" fill="${hue}"/>
    <g fill="none" stroke="#dcc393" stroke-opacity="0.35" stroke-width="3">
      <rect x="400" y="400" width="400" height="400"/>
      <rect x="400" y="400" width="400" height="400" transform="rotate(45 600 600)"/>
    </g>
    <text x="600" y="590" text-anchor="middle" font-family="Arial, sans-serif" font-size="92" font-weight="700" fill="#ffffff">DEMO IMAGE</text>
    <text x="600" y="680" text-anchor="middle" font-family="Arial, sans-serif" font-size="44" fill="#f5ecd9">${label}</text>
    <text x="600" y="1110" text-anchor="middle" font-family="Arial, sans-serif" font-size="36" fill="#f5ecd9" fill-opacity="0.8">Replace with a real product photo</text>
  </svg>`;
  const data = await sharp(Buffer.from(svg)).webp({ quality: 80 }).toBuffer();
  const rel = `products/demo/${name}.webp`;
  await mkdir(path.join(UPLOAD_DIR, "products/demo"), { recursive: true });
  await writeFile(path.join(UPLOAD_DIR, rel), data);
  // Served by app/media/[...path]; "demo" is a valid path segment.
  return { url: `/media/${rel}`, storageKey: `local:${rel}`, width: 1200, height: 1200 };
}

async function main() {
  if (process.env.NODE_ENV === "production") throw new Error("Refusing to seed demo data in production.");
  if (await prisma.product.findFirst({ where: { slug: { startsWith: "demo-" } } })) {
    console.log("Demo data already present — nothing to do.");
    return;
  }

  const giftCat = await prisma.category.upsert({
    where: { slug: "demo-gift-box" },
    create: { name: "[ডেমো] গিফট বক্স", slug: "demo-gift-box", sortOrder: 0 },
    update: {},
  });
  const decorCat = await prisma.category.upsert({
    where: { slug: "demo-home-decor" },
    create: { name: "[ডেমো] হোম ডেকর", slug: "demo-home-decor", sortOrder: 1 },
    update: {},
  });

  const frameImgs = [await placeholder("frame1", "#0e4536", "Wall frame · 1"), await placeholder("frame2", "#135a46", "Wall frame · 2"), await placeholder("frame3", "#654a1e", "Wall frame · 3")];
  const boxImgs = [await placeholder("box1", "#654a1e", "Gift box · 1"), await placeholder("box2", "#0a3529", "Gift box · 2")];

  await prisma.product.create({
    data: {
      slug: "demo-wall-frame",
      name: "[ডেমো] ক্যালিগ্রাফি ওয়াল ফ্রেম",
      headline: "এটি একটি ডেমো পণ্য — আসল পণ্যের তথ্য দিয়ে বদলে নিন",
      shortDescription: "টেস্ট করার জন্য তৈরি নমুনা পণ্য। দাম, ছবি ও বিবরণ কাল্পনিক।",
      description: "এই পণ্যটি শুধু ওয়েবসাইট পরীক্ষা করার জন্য তৈরি।\n\nলাইভ করার আগে এটি মুছে ফেলুন এবং Admin → Products থেকে আসল পণ্য যোগ করুন।",
      variantLabel: "সাইজ",
      status: "ACTIVE",
      isFeatured: true,
      categoryId: decorCat.id,
      benefits: [
        { title: "নমুনা সুবিধা ১", description: "আসল পণ্যের সুবিধা এখানে লিখুন।" },
        { title: "নমুনা সুবিধা ২", description: "শুধু সত্য তথ্য লিখুন।" },
        { title: "নমুনা সুবিধা ৩", description: "" },
      ],
      includedItems: ["১টি নমুনা ফ্রেম", "নমুনা প্যাকেজিং"],
      specifications: [
        { label: "মাপ", value: "নমুনা" },
        { label: "উপাদান", value: "নমুনা" },
      ],
      howToUse: ["নমুনা ধাপ ১", "নমুনা ধাপ ২"],
      importantNotes: ["এটি একটি ডেমো পণ্য।"],
      images: { create: frameImgs.map((img, i) => ({ ...img, alt: `ডেমো ছবি ${i + 1}`, sortOrder: i })) },
      variants: {
        create: [
          { name: "ছোট (নমুনা)", price: 990, compareAtPrice: 1290, stock: 25, sortOrder: 0, sku: "DEMO-FRAME-S" },
          { name: "বড় (নমুনা)", price: 1490, compareAtPrice: 1890, stock: 3, sortOrder: 1, sku: "DEMO-FRAME-L" },
        ],
      },
      quantityDiscounts: { create: [{ minQuantity: 2, type: "PERCENT", value: 5 }] },
    },
  });

  await prisma.product.create({
    data: {
      slug: "demo-gift-box",
      name: "[ডেমো] ইসলামিক গিফট বক্স",
      headline: "এটি একটি ডেমো পণ্য — আসল পণ্যের তথ্য দিয়ে বদলে নিন",
      shortDescription: "টেস্ট করার জন্য তৈরি নমুনা গিফট বক্স।",
      status: "ACTIVE",
      categoryId: giftCat.id,
      includedItems: ["নমুনা আইটেম ১", "নমুনা আইটেম ২"],
      images: { create: boxImgs.map((img, i) => ({ ...img, alt: `ডেমো গিফট বক্স ছবি ${i + 1}`, sortOrder: i })) },
      variants: { create: [{ name: "", price: 1250, stock: null, sortOrder: 0, sku: "DEMO-BOX" }] },
    },
  });

  await prisma.coupon.upsert({
    where: { code: "DEMO10" },
    create: { code: "DEMO10", description: "Demo coupon — 10% off (max ৳200)", type: "PERCENT", value: 10, maxDiscountAmount: 200 },
    update: {},
  });

  console.log("Demo data created: 2 products (slugs demo-wall-frame, demo-gift-box) and coupon DEMO10.");
  console.log("Remove it before going live: npm run db:demo:remove");
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
