import { unstable_cache } from "next/cache";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import {
  benefitSchema,
  faqItemSchema,
  parseList,
  specificationSchema,
  textListSchema,
} from "@/lib/validation/content";
import { z } from "zod";

/** Cache tags — admin mutations call updateTag() with these. */
export const CATALOG_TAG = "catalog";
export const REVIEWS_TAG = "reviews";
export const DELIVERY_TAG = "delivery";

export interface ImageInfo {
  url: string;
  alt: string;
  width: number;
  height: number;
}

export interface ProductCard {
  id: string;
  slug: string;
  name: string;
  shortDescription: string | null;
  categoryName: string | null;
  categorySlug: string | null;
  image: ImageInfo | null;
  /** Lowest active variant price. */
  price: number;
  compareAtPrice: number | null;
  priceVaries: boolean;
  inStock: boolean;
  isFeatured: boolean;
}

export interface VariantInfo {
  id: string;
  name: string;
  price: number;
  compareAtPrice: number | null;
  inStock: boolean;
  /** Max quantity a customer can pick (stock and per-order limit). */
  maxQuantity: number;
}

export interface TierInfo {
  minQuantity: number;
  type: "PERCENT" | "FIXED";
  value: number;
}

export interface ProductDetail {
  id: string;
  slug: string;
  name: string;
  headline: string | null;
  shortDescription: string | null;
  description: string | null;
  variantLabel: string;
  category: { name: string; slug: string } | null;
  images: ImageInfo[];
  variants: VariantInfo[];
  tiers: TierInfo[];
  maxPerOrder: number;
  benefits: z.infer<typeof benefitSchema>[];
  includedItems: string[];
  specifications: z.infer<typeof specificationSchema>[];
  howToUse: string[];
  importantNotes: string[];
  faqs: z.infer<typeof faqItemSchema>[];
  seoTitle: string | null;
  seoDescription: string | null;
  updatedAt: string;
}

const cardInclude = {
  category: { select: { name: true, slug: true, isActive: true } },
  images: { orderBy: { sortOrder: "asc" }, take: 1 },
  variants: { where: { isActive: true }, orderBy: [{ price: "asc" }, { sortOrder: "asc" }] },
} satisfies Prisma.ProductInclude;

type CardRow = Prisma.ProductGetPayload<{ include: typeof cardInclude }>;

function toCard(p: CardRow): ProductCard | null {
  const cheapest = p.variants[0];
  if (!cheapest) return null;
  const img = p.images[0];
  return {
    id: p.id,
    slug: p.slug,
    name: p.name,
    shortDescription: p.shortDescription,
    categoryName: p.category?.isActive ? p.category.name : null,
    categorySlug: p.category?.isActive ? p.category.slug : null,
    image: img ? { url: img.url, alt: img.alt || p.name, width: img.width, height: img.height } : null,
    price: cheapest.price,
    compareAtPrice: cheapest.compareAtPrice && cheapest.compareAtPrice > cheapest.price ? cheapest.compareAtPrice : null,
    priceVaries: p.variants.some((v) => v.price !== cheapest.price),
    inStock: p.variants.some((v) => v.stock == null || v.stock > 0),
    isFeatured: p.isFeatured,
  };
}

async function loadProductCards(): Promise<ProductCard[]> {
  const rows = await prisma.product.findMany({
    where: { status: "ACTIVE" },
    include: cardInclude,
    orderBy: [{ isFeatured: "desc" }, { sortOrder: "asc" }, { createdAt: "desc" }],
  });
  return rows.map(toCard).filter((c): c is ProductCard => c !== null);
}

// Stock shown on the storefront is invalidated by order/cancel routes and admin saves; the 5-minute
// revalidate is only a safety net for any stock change that bypasses them.
const CATALOG_REVALIDATE_SECONDS = 300;

/** All active products that have at least one active variant. */
export const getProductCards = unstable_cache(loadProductCards, ["product-cards"], { tags: [CATALOG_TAG], revalidate: CATALOG_REVALIDATE_SECONDS });

async function loadCategories() {
  const rows = await prisma.category.findMany({
    where: { isActive: true, products: { some: { status: "ACTIVE" } } },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: { id: true, name: true, slug: true, description: true },
  });
  return rows;
}

export const getCategories = unstable_cache(loadCategories, ["categories"], { tags: [CATALOG_TAG] });

async function loadProduct(slug: string): Promise<ProductDetail | null> {
  const [p, settings] = await Promise.all([
    prisma.product.findFirst({
      where: { slug, status: "ACTIVE" },
      include: {
        category: { select: { name: true, slug: true, isActive: true } },
        images: { orderBy: { sortOrder: "asc" } },
        variants: { where: { isActive: true }, orderBy: [{ sortOrder: "asc" }, { price: "asc" }] },
        quantityDiscounts: { where: { isActive: true }, orderBy: { minQuantity: "asc" } },
      },
    }),
    getSettings(),
  ]);
  if (!p || p.variants.length === 0) return null;
  const maxPerOrder = p.maxPerOrder ?? settings.defaultMaxPerOrder;
  return {
    id: p.id,
    slug: p.slug,
    name: p.name,
    headline: p.headline,
    shortDescription: p.shortDescription,
    description: p.description,
    variantLabel: p.variantLabel,
    category: p.category?.isActive ? { name: p.category.name, slug: p.category.slug } : null,
    images: p.images.map((i) => ({ url: i.url, alt: i.alt || p.name, width: i.width, height: i.height })),
    variants: p.variants.map((v) => {
      const inStock = v.stock == null || v.stock > 0;
      return {
        id: v.id,
        name: v.name,
        price: v.price,
        compareAtPrice: v.compareAtPrice && v.compareAtPrice > v.price ? v.compareAtPrice : null,
        inStock,
        maxQuantity: inStock ? Math.max(1, Math.min(maxPerOrder, v.stock ?? maxPerOrder)) : 0,
      };
    }),
    tiers: p.quantityDiscounts.filter((t) => t.value > 0).map((t) => ({ minQuantity: t.minQuantity, type: t.type, value: t.value })),
    maxPerOrder,
    benefits: parseList(benefitSchema, p.benefits),
    includedItems: parseList(textListSchema.element, p.includedItems),
    specifications: parseList(specificationSchema, p.specifications),
    howToUse: parseList(textListSchema.element, p.howToUse),
    importantNotes: parseList(textListSchema.element, p.importantNotes),
    faqs: parseList(faqItemSchema, p.faqs),
    seoTitle: p.seoTitle,
    seoDescription: p.seoDescription,
    updatedAt: p.updatedAt.toISOString(),
  };
}

export const getProduct = unstable_cache(loadProduct, ["product-detail"], { tags: [CATALOG_TAG], revalidate: CATALOG_REVALIDATE_SECONDS });

export interface ReviewInfo {
  id: string;
  customerName: string;
  location: string | null;
  rating: number;
  text: string;
  imageUrl: string | null;
  productName: string | null;
}

async function loadReviews(productId: string | null): Promise<ReviewInfo[]> {
  const rows = await prisma.review.findMany({
    where: {
      isPublished: true,
      ...(productId ? { OR: [{ productId }, { productId: null }] } : {}),
    },
    include: { product: { select: { name: true } } },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
    take: 24,
  });
  // Product-specific reviews first on product pages.
  const sorted = productId
    ? [...rows.filter((r) => r.productId === productId), ...rows.filter((r) => r.productId !== productId)]
    : rows;
  return sorted.slice(0, 12).map((r) => ({
    id: r.id,
    customerName: r.customerName,
    location: r.location,
    rating: Math.min(5, Math.max(1, r.rating)),
    text: r.text,
    imageUrl: r.imageUrl,
    productName: r.product?.name ?? null,
  }));
}

export const getReviews = unstable_cache(loadReviews, ["reviews"], { tags: [REVIEWS_TAG] });

export interface DeliveryConfig {
  zones: { id: string; name: string; charge: number; isDefault: boolean; estimatedDelivery: string | null }[];
  rules: { zoneId: string; districtId: string; areaId: string }[];
}

export async function loadDeliveryConfig(): Promise<DeliveryConfig> {
  const zones = await prisma.deliveryZone.findMany({
    orderBy: [{ sortOrder: "asc" }, { charge: "asc" }],
    include: { areas: { select: { zoneId: true, districtId: true, areaId: true } } },
  });
  return {
    zones: zones.map((z) => ({
      id: z.id,
      name: z.name,
      charge: z.charge,
      isDefault: z.isDefault,
      estimatedDelivery: z.estimatedDelivery,
    })),
    rules: zones.flatMap((z) => z.areas),
  };
}

export const getDeliveryConfig = unstable_cache(loadDeliveryConfig, ["delivery-config"], { tags: [DELIVERY_TAG] });
