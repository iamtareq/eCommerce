"use server";

import { revalidatePath, updateTag } from "next/cache";
import type { z } from "zod";
import type { ActionResult } from "@/lib/admin/common";
import { requireOwner } from "@/lib/auth/guard";
import { CATALOG_TAG, REVIEWS_TAG } from "@/lib/catalog";
import { isUniqueViolation, prisma } from "@/lib/db";
import { byVariantId } from "@/lib/orders/cart";
import { deleteImage } from "@/lib/storage";
import { productInputSchema, type ProductInput } from "@/lib/validation/product";

function refresh(slug?: string) {
  updateTag(CATALOG_TAG);
  updateTag(REVIEWS_TAG);
  revalidatePath("/admin/products");
  if (slug) revalidatePath(`/products/${slug}`);
}

const LABELS: Record<string, string> = {
  name: "Product name",
  slug: "URL slug",
  categoryId: "Category",
  sortOrder: "Sort order",
  headline: "Hero headline",
  shortDescription: "Short description",
  description: "Full description",
  variantLabel: "Variant label",
  maxPerOrder: "Max per order",
  seoTitle: "SEO title",
  seoDescription: "SEO / Facebook description",
  benefits: "Benefits",
  includedItems: "What's in the box",
  specifications: "Specifications",
  howToUse: "How to use",
  importantNotes: "Important information",
  faqs: "Product FAQ",
  images: "Images",
  variants: "Prices & variants",
  tiers: "Quantity discounts",
};

/** Label for one row of a list field, e.g. "Specification #2". */
const ITEM_LABELS: Record<string, string> = {
  benefits: "Benefit",
  includedItems: "What's in the box item",
  specifications: "Specification",
  howToUse: "How-to-use step",
  importantNotes: "Important note",
  faqs: "FAQ",
  images: "Image",
  variants: "Variant",
  tiers: "Discount tier",
};

const SUB_LABELS: Record<string, string> = {
  compareAtPrice: "previous price",
  sku: "SKU",
  alt: "alt text",
  "tiers.minQuantity": "min. quantity",
  "tiers.value": "discount",
};

/** "tiers.0.value" → "Discount tier #1 discount"; "maxPerOrder" → "Max per order". */
function describePath(path: readonly PropertyKey[]): string {
  const [field, index, sub] = path;
  const key = String(field ?? "");
  if (typeof index !== "number") return LABELS[key] ?? (key || "Product");
  const item = `${ITEM_LABELS[key] ?? key} #${index + 1}`;
  if (sub == null) return item;
  const subKey = String(sub);
  return `${item} ${SUB_LABELS[`${key}.${subKey}`] ?? SUB_LABELS[subKey] ?? subKey}`;
}

/** Plain-English messages for the built-in checks (custom schema messages still win). */
const friendlyErrors: z.core.$ZodErrorMap = (issue) => {
  if (issue.code === "too_small") {
    if (issue.origin === "string") return Number(issue.minimum) <= 1 ? "Required" : `Must be at least ${issue.minimum} characters`;
    if (issue.origin === "number" || issue.origin === "int") return `Must be at least ${issue.minimum}`;
  }
  if (issue.code === "too_big") {
    if (issue.origin === "string") return `Must be at most ${issue.maximum} characters`;
    if (issue.origin === "number" || issue.origin === "int") return `Must be at most ${issue.maximum}`;
    if (issue.origin === "array") return `At most ${issue.maximum} allowed`;
  }
  if (issue.code === "invalid_type" && (issue.expected === "number" || issue.expected === "int")) {
    return issue.input == null ? "Required" : "Must be a whole number";
  }
  return undefined;
};

/** A variant whose stock changed (orders, cancellations) after the edit form was loaded. */
export interface StockConflict {
  id: string;
  name: string;
  /** Stock in the database now (null = not tracked). */
  stock: number | null;
}

export type SaveProductResult = ActionResult<{ id: string }> | { ok: false; error: string; stockConflicts: StockConflict[] };

class StockConflictError extends Error {
  constructor(readonly conflicts: StockConflict[]) {
    super("STOCK_CONFLICT");
  }
}

export async function saveProduct(input: ProductInput): Promise<SaveProductResult> {
  await requireOwner();
  const parsed = productInputSchema.safeParse(input, { error: friendlyErrors });
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { ok: false, error: issue ? `${describePath(issue.path)}: ${issue.message}` : "Invalid product" };
  }
  const p = parsed.data;

  if (p.categoryId) {
    const exists = await prisma.category.findUnique({ where: { id: p.categoryId }, select: { id: true } });
    if (!exists) return { ok: false, error: "Selected category no longer exists" };
  }

  const fields = {
    name: p.name,
    slug: p.slug,
    categoryId: p.categoryId,
    status: p.status,
    isFeatured: p.isFeatured,
    sortOrder: p.sortOrder,
    headline: p.headline,
    shortDescription: p.shortDescription,
    description: p.description,
    variantLabel: p.variantLabel,
    maxPerOrder: p.maxPerOrder,
    seoTitle: p.seoTitle,
    seoDescription: p.seoDescription,
    benefits: p.benefits,
    includedItems: p.includedItems,
    specifications: p.specifications,
    howToUse: p.howToUse,
    importantNotes: p.importantNotes,
    faqs: p.faqs,
  };

  const removedImageKeys: string[] = [];
  try {
    const productId = await prisma.$transaction(async (tx) => {
      let id = p.id;
      if (id) {
        const existing = await tx.product.findUnique({ where: { id }, select: { id: true } });
        if (!existing) throw new Error("NOT_FOUND");
        await tx.product.update({ where: { id }, data: fields });
      } else {
        id = (await tx.product.create({ data: fields, select: { id: true } })).id;
      }

      // Images: keep order, update alt text, drop removed ones.
      const currentImages = await tx.productImage.findMany({ where: { productId: id } });
      const keepIds = new Set(p.images.map((i) => i.id).filter(Boolean));
      for (const img of currentImages) {
        if (!keepIds.has(img.id)) {
          await tx.productImage.delete({ where: { id: img.id } });
          removedImageKeys.push(img.storageKey);
        }
      }
      for (const [index, img] of p.images.entries()) {
        const current = img.id ? currentImages.find((c) => c.id === img.id) : undefined;
        if (current) {
          await tx.productImage.update({ where: { id: current.id }, data: { sortOrder: index, alt: img.alt || null } });
        } else {
          await tx.productImage.create({
            data: {
              productId: id,
              url: img.url,
              storageKey: img.key,
              width: img.width,
              height: img.height,
              alt: img.alt || null,
              sortOrder: index,
            },
          });
        }
      }

      // Variants: update, create, and remove (or deactivate if already ordered).
      // Rows are touched in id order — the same lock order orders use (lib/orders/cart.ts byVariantId) — so a save
      // racing an order for two variants of this product can never deadlock.
      const currentVariants = await tx.productVariant.findMany({
        where: { productId: id },
        include: { _count: { select: { orderItems: true } } },
        orderBy: { id: "asc" },
      });
      const keepVariantIds = new Set(p.variants.map((v) => v.id).filter(Boolean));
      for (const v of currentVariants) {
        if (keepVariantIds.has(v.id)) continue;
        if (v._count.orderItems > 0) await tx.productVariant.update({ where: { id: v.id }, data: { isActive: false, sortOrder: 9999 } });
        else await tx.productVariant.delete({ where: { id: v.id } });
      }
      const stockConflicts: StockConflict[] = [];
      const ordered = [...p.variants.entries()].sort(([, a], [, b]) => byVariantId({ variantId: a.id ?? null }, { variantId: b.id ?? null }));
      for (const [index, v] of ordered) {
        const data = {
          name: v.name,
          sku: v.sku,
          price: v.price,
          compareAtPrice: v.compareAtPrice && v.compareAtPrice > v.price ? v.compareAtPrice : null,
          isActive: v.isActive,
          sortOrder: index,
        };
        const current = v.id ? currentVariants.find((c) => c.id === v.id) : undefined;
        if (!current) {
          await tx.productVariant.create({ data: { ...data, stock: v.stock, productId: id } });
          continue;
        }
        await tx.productVariant.update({ where: { id: current.id }, data });
        // Orders and cancellations move stock while the form is open. Write it only when the owner
        // changed it, and only if the row still holds the value the form loaded (compare-and-set).
        if (v.stock === v.originalStock) continue;
        const { count } = await tx.productVariant.updateMany({ where: { id: current.id, stock: v.originalStock }, data: { stock: v.stock } });
        if (count === 0) {
          const now = await tx.productVariant.findUnique({ where: { id: current.id }, select: { stock: true } });
          stockConflicts.push({ id: current.id, name: v.name, stock: now?.stock ?? null });
        }
      }
      if (stockConflicts.length) throw new StockConflictError(stockConflicts);

      await tx.quantityDiscount.deleteMany({ where: { productId: id } });
      if (p.tiers.length) {
        await tx.quantityDiscount.createMany({
          data: p.tiers.map((t) => ({ productId: id!, minQuantity: t.minQuantity, type: t.type, value: t.value, isActive: t.isActive })),
        });
      }
      return id;
    });

    await Promise.all(removedImageKeys.map((k) => deleteImage(k)));
    refresh(p.slug);
    return { ok: true, message: "Product saved", data: { id: productId } };
  } catch (error) {
    if (error instanceof StockConflictError) {
      const now = error.conflicts.map((c) => `${c.name ? `"${c.name}" ` : ""}${c.stock ?? "not tracked"}`).join(", ");
      return {
        ok: false,
        error: `Stock changed while you were editing (new orders or cancellations). In stock now: ${now}. Check the stock and save again.`,
        stockConflicts: error.conflicts,
      };
    }
    if (error instanceof Error && error.message === "NOT_FOUND") return { ok: false, error: "Product not found" };
    if (isUniqueViolation(error)) return { ok: false, error: "That URL slug or a SKU is already used by another product" };
    console.error("[admin] saveProduct failed", error);
    return { ok: false, error: "Could not save the product. Please try again." };
  }
}

/**
 * Deletes a product that has never been ordered; otherwise archives it (order history keeps its data).
 * On delete its reviews are unpublished: they would otherwise turn into general reviews (productId → null)
 * shown on every product page.
 */
export async function deleteProduct(id: string): Promise<ActionResult> {
  await requireOwner();
  const product = await prisma.product.findUnique({
    where: { id },
    include: { images: true, _count: { select: { orderItems: true } } },
  });
  if (!product) return { ok: false, error: "Product not found" };

  if (product._count.orderItems > 0) {
    await prisma.product.update({ where: { id }, data: { status: "ARCHIVED", isFeatured: false } });
    refresh(product.slug);
    return { ok: true, message: "This product has orders, so it was archived instead of deleted." };
  }
  const [hidden] = await prisma.$transaction([
    prisma.review.updateMany({ where: { productId: id }, data: { isPublished: false } }),
    prisma.product.delete({ where: { id } }),
  ]);
  await Promise.all(product.images.map((i) => deleteImage(i.storageKey)));
  refresh(product.slug);
  return { ok: true, message: hidden.count ? `Product deleted. Its ${hidden.count} review(s) were unpublished (see Reviews).` : "Product deleted" };
}
