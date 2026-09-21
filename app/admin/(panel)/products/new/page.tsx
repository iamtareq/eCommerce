import { emptyProduct, ProductForm } from "@/components/admin/ProductForm";
import { PageHeader } from "@/components/admin/ui";
import { requireOwner } from "@/lib/auth/guard";
import { prisma } from "@/lib/db";

export const metadata = { title: "New product" };

export default async function NewProductPage() {
  await requireOwner();
  const categories = await prisma.category.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }], select: { id: true, name: true } });
  return (
    <>
      <PageHeader title="New product" back={{ href: "/admin/products", label: "Products" }} />
      <ProductForm initial={emptyProduct} categories={categories} />
    </>
  );
}
