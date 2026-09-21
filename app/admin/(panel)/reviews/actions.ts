"use server";

import { revalidatePath, updateTag } from "next/cache";
import type { ActionResult } from "@/lib/admin/common";
import { requireOwner } from "@/lib/auth/guard";
import { REVIEWS_TAG } from "@/lib/catalog";
import { prisma } from "@/lib/db";
import { deleteImage } from "@/lib/storage";
import { firstIssue, reviewInputSchema, type ReviewInput } from "./schema";

function refresh() {
  updateTag(REVIEWS_TAG);
  revalidatePath("/admin/reviews");
}

export async function saveReview(input: ReviewInput): Promise<ActionResult<{ id: string }>> {
  await requireOwner();
  const parsed = reviewInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  const { id, image, productId, ...rest } = parsed.data;

  if (productId) {
    const exists = await prisma.product.findUnique({ where: { id: productId }, select: { id: true } });
    if (!exists) return { ok: false, error: "The selected product no longer exists" };
  }

  const data = { ...rest, productId, imageUrl: image?.url ?? null, imageKey: image?.key ?? null };

  try {
    if (id) {
      const existing = await prisma.review.findUnique({ where: { id }, select: { imageKey: true } });
      if (!existing) return { ok: false, error: "Review not found. It may have been deleted." };
      await prisma.review.update({ where: { id }, data });
      // The old screenshot was replaced or removed: delete its file now that the DB no longer points to it.
      if (existing.imageKey && existing.imageKey !== data.imageKey) await deleteImage(existing.imageKey);
      refresh();
      return { ok: true, message: `Review by ${data.customerName} saved`, data: { id } };
    }
    const created = await prisma.review.create({ data, select: { id: true } });
    refresh();
    return { ok: true, message: `Review by ${data.customerName} added`, data: { id: created.id } };
  } catch (error) {
    console.error("[admin] saveReview failed", error);
    return { ok: false, error: "Could not save the review. Please try again." };
  }
}

export async function deleteReview(id: string): Promise<ActionResult> {
  await requireOwner();
  if (typeof id !== "string" || !id) return { ok: false, error: "Review not found" };

  const review = await prisma.review.findUnique({ where: { id }, select: { imageKey: true, customerName: true } });
  if (!review) return { ok: false, error: "Review not found. It may already have been deleted." };

  try {
    await prisma.review.delete({ where: { id } });
  } catch (error) {
    console.error("[admin] deleteReview failed", error);
    return { ok: false, error: "Could not delete the review. Please try again." };
  }
  await deleteImage(review.imageKey);
  refresh();
  return { ok: true, message: `Review by ${review.customerName} deleted` };
}
