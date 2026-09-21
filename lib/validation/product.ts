import { z } from "zod";
import { nullableText, SLUG_RE } from "@/lib/admin/common";
import { benefitSchema, faqItemSchema, specificationSchema } from "./content";

const money = z.number().int().min(0).max(10_000_000);

export const productImageInputSchema = z.object({
  id: z.string().max(40).optional(),
  url: z
    .string()
    .max(500)
    .refine((u) => u.startsWith("/media/") || u.startsWith("https://res.cloudinary.com/"), { error: "Invalid image URL" }),
  key: z.string().max(300).regex(/^(local|cloudinary):/, { error: "Invalid image key" }),
  width: z.number().int().min(1).max(20000),
  height: z.number().int().min(1).max(20000),
  alt: z.string().trim().max(200).default(""),
});

export const variantInputSchema = z
  .object({
    id: z.string().max(40).optional(),
    name: z.string().trim().max(80).default(""),
    sku: nullableText(60),
    price: z.number().int().min(0, { error: "Enter a price" }).max(10_000_000),
    compareAtPrice: money.nullable(),
    stock: z.number().int().min(0).max(1_000_000).nullable(),
    /**
     * Stock the edit form loaded (existing variants). Stock is only written when it differs from this,
     * and only if the database still holds it, so orders placed meanwhile are never undone.
     */
    originalStock: z.number().int().nullable().default(null),
    isActive: z.boolean().default(true),
  })
  .refine((v) => v.compareAtPrice == null || v.compareAtPrice === 0 || v.compareAtPrice > v.price, {
    error: "Previous price must be higher than the price",
    path: ["compareAtPrice"],
  });

export const tierInputSchema = z
  .object({
    minQuantity: z.number().int().min(2, { error: "Must be 2 or more" }).max(999, { error: "Must be 999 or less" }),
    type: z.enum(["PERCENT", "FIXED"]),
    value: z.number().int().min(1, { error: "Enter a discount amount" }).max(10_000_000),
    isActive: z.boolean().default(true),
  })
  .refine((t) => t.type !== "PERCENT" || t.value <= 100, { error: "Percent must be 1–100", path: ["value"] });

export const productInputSchema = z
  .object({
    id: z.string().max(40).optional(),
    name: z.string().trim().min(1, { error: "Required" }).max(120),
    slug: z.string().trim().toLowerCase().regex(SLUG_RE, { error: "Use lowercase letters, numbers and dashes" }).max(80),
    categoryId: z.string().max(40).nullable(),
    status: z.enum(["DRAFT", "ACTIVE", "ARCHIVED"]),
    isFeatured: z.boolean(),
    sortOrder: z.number().int().min(-10000).max(10000),
    headline: nullableText(160),
    shortDescription: nullableText(400),
    description: nullableText(8000),
    variantLabel: z.string().trim().min(1).max(40),
    maxPerOrder: z
      .number()
      .int()
      .min(1, { error: "Must be at least 1 (leave it empty to use the site default)" })
      .max(999, { error: "Must be 999 or less" })
      .nullable(),
    seoTitle: nullableText(120),
    seoDescription: nullableText(300),
    benefits: z.array(benefitSchema).max(12),
    includedItems: z.array(z.string().trim().min(1).max(300)).max(30),
    specifications: z.array(specificationSchema).max(30),
    howToUse: z.array(z.string().trim().min(1).max(300)).max(20),
    importantNotes: z.array(z.string().trim().min(1).max(300)).max(20),
    faqs: z.array(faqItemSchema).max(20),
    images: z.array(productImageInputSchema).max(20),
    variants: z.array(variantInputSchema).min(1, { error: "Add at least one price/variant" }).max(50),
    tiers: z.array(tierInputSchema).max(10),
  })
  .superRefine((p, ctx) => {
    if (p.variants.length > 1 && p.variants.some((v) => !v.name)) {
      ctx.addIssue({ code: "custom", path: ["variants"], message: "Every variant needs a name when there is more than one" });
    }
    const names = p.variants.map((v) => v.name.toLowerCase());
    if (new Set(names).size !== names.length) {
      ctx.addIssue({ code: "custom", path: ["variants"], message: "Variant names must be unique" });
    }
    const skus = p.variants.map((v) => v.sku).filter(Boolean);
    if (new Set(skus).size !== skus.length) {
      ctx.addIssue({ code: "custom", path: ["variants"], message: "SKUs must be unique" });
    }
    const mins = p.tiers.map((t) => t.minQuantity);
    if (new Set(mins).size !== mins.length) {
      ctx.addIssue({ code: "custom", path: ["tiers"], message: "Each discount tier needs a different minimum quantity" });
    }
    if (p.status === "ACTIVE" && !p.variants.some((v) => v.isActive)) {
      ctx.addIssue({ code: "custom", path: ["variants"], message: "An active product needs at least one active variant" });
    }
    if (p.status === "ACTIVE" && p.variants.some((v) => v.isActive && v.price <= 0)) {
      ctx.addIssue({ code: "custom", path: ["variants"], message: "Active variants need a price above ৳0" });
    }
  });

export type ProductInput = z.input<typeof productInputSchema>;
export type ProductData = z.output<typeof productInputSchema>;
