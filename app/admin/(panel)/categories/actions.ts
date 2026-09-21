"use server";

import { revalidatePath, updateTag } from "next/cache";
import type { ActionResult } from "@/lib/admin/common";
import { requireOwner } from "@/lib/auth/guard";
import { CATALOG_TAG } from "@/lib/catalog";
import { isUniqueViolation, prisma } from "@/lib/db";
import { categoryInputSchema, firstIssue, type CategoryInput } from "./schema";

function refresh() {
  updateTag(CATALOG_TAG);
  revalidatePath("/admin/categories");
  revalidatePath("/admin/products");
}

export async function saveCategory(input: CategoryInput): Promise<ActionResult<{ id: string }>> {
  await requireOwner();
  const parsed = categoryInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  const { id, ...data } = parsed.data;

  try {
    if (id) {
      const updated = await prisma.category.updateMany({ where: { id }, data });
      if (updated.count === 0) return { ok: false, error: "Category not found. It may have been deleted." };
      refresh();
      return { ok: true, message: `Category "${data.name}" saved`, data: { id } };
    }
    const created = await prisma.category.create({ data, select: { id: true } });
    refresh();
    return { ok: true, message: `Category "${data.name}" created`, data: { id: created.id } };
  } catch (error) {
    if (isUniqueViolation(error)) return { ok: false, error: `The URL slug "${data.slug}" is already used by another category. Choose a different one.` };
    console.error("[admin] saveCategory failed", error);
    return { ok: false, error: "Could not save the category. Please try again." };
  }
}

/** Deletes a category. Its products stay; their categoryId becomes null (onDelete: SetNull). */
export async function deleteCategory(id: string): Promise<ActionResult> {
  await requireOwner();
  if (typeof id !== "string" || !id) return { ok: false, error: "Category not found" };

  const category = await prisma.category.findUnique({
    where: { id },
    select: { name: true, _count: { select: { products: true } } },
  });
  if (!category) return { ok: false, error: "Category not found. It may already have been deleted." };

  try {
    await prisma.category.deleteMany({ where: { id } });
  } catch (error) {
    console.error("[admin] deleteCategory failed", error);
    return { ok: false, error: "Could not delete the category. Please try again." };
  }
  refresh();
  const n = category._count.products;
  return {
    ok: true,
    message: n
      ? `Category "${category.name}" deleted. ${n} product${n === 1 ? "" : "s"} now ${n === 1 ? "has" : "have"} no category.`
      : `Category "${category.name}" deleted.`,
  };
}
