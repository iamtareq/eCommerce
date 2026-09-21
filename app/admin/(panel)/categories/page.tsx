import { requireOwner } from "@/lib/auth/guard";
import { prisma } from "@/lib/db";
import { CategoryManager, type CategoryRow } from "./CategoryManager";

export const metadata = { title: "Categories" };

export default async function CategoriesAdminPage() {
  await requireOwner();
  const rows = await prisma.category.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    include: { _count: { select: { products: true } } },
  });

  const categories: CategoryRow[] = rows.map((c) => ({
    id: c.id,
    name: c.name,
    slug: c.slug,
    description: c.description,
    sortOrder: c.sortOrder,
    isActive: c.isActive,
    productCount: c._count.products,
  }));

  return <CategoryManager categories={categories} />;
}
