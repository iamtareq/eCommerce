import { notFound } from "next/navigation";
import { ProductForm, type ProductFormValue } from "@/components/admin/ProductForm";
import { PageHeader } from "@/components/admin/ui";
import { requireOwner } from "@/lib/auth/guard";
import { prisma } from "@/lib/db";
import { benefitSchema, faqItemSchema, parseList, specificationSchema, textListSchema } from "@/lib/validation/content";

export const metadata = { title: "Edit product" };

const str = (n: number | null | undefined) => (n == null ? "" : String(n));

export default async function EditProductPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ saved?: string }>;
}) {
  await requireOwner();
  const { id } = await params;
  const { saved } = await searchParams;
  const [product, categories] = await Promise.all([
    prisma.product.findUnique({
      where: { id },
      include: {
        images: { orderBy: { sortOrder: "asc" } },
        variants: { orderBy: { sortOrder: "asc" } },
        quantityDiscounts: { orderBy: { minQuantity: "asc" } },
        _count: { select: { orderItems: true, reviews: true } },
      },
    }),
    prisma.category.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }], select: { id: true, name: true } }),
  ]);
  if (!product) notFound();

  const initial: ProductFormValue = {
    id: product.id,
    name: product.name,
    slug: product.slug,
    categoryId: product.categoryId ?? "",
    status: product.status,
    isFeatured: product.isFeatured,
    sortOrder: String(product.sortOrder),
    headline: product.headline ?? "",
    shortDescription: product.shortDescription ?? "",
    description: product.description ?? "",
    variantLabel: product.variantLabel,
    maxPerOrder: str(product.maxPerOrder),
    seoTitle: product.seoTitle ?? "",
    seoDescription: product.seoDescription ?? "",
    benefits: parseList(benefitSchema, product.benefits),
    includedItems: parseList(textListSchema.element, product.includedItems),
    specifications: parseList(specificationSchema, product.specifications),
    howToUse: parseList(textListSchema.element, product.howToUse),
    importantNotes: parseList(textListSchema.element, product.importantNotes),
    faqs: parseList(faqItemSchema, product.faqs),
    images: product.images.map((i) => ({ id: i.id, url: i.url, key: i.storageKey, width: i.width, height: i.height, alt: i.alt ?? "" })),
    variants: product.variants.map((v) => ({
      id: v.id,
      name: v.name,
      sku: v.sku ?? "",
      price: String(v.price),
      compareAtPrice: str(v.compareAtPrice),
      stock: str(v.stock),
      originalStock: v.stock,
      isActive: v.isActive,
    })),
    tiers: product.quantityDiscounts.map((t) => ({ minQuantity: String(t.minQuantity), type: t.type, value: String(t.value), isActive: t.isActive })),
  };

  return (
    <>
      <PageHeader title={product.name} description={`${product._count.orderItems} order line(s) include this product`} back={{ href: "/admin/products", label: "Products" }} />
      {/* Keyed on updatedAt so a save reloads the form from the database. The ?saved= notice comes in as a
          prop so it survives that remount (a message set in the form before it remounts would be lost). */}
      <ProductForm
        key={product.updatedAt.toISOString()}
        initial={initial}
        categories={categories}
        hasOrders={product._count.orderItems > 0}
        reviewCount={product._count.reviews}
        notice={saved === "updated" ? "Product saved." : saved ? "Product created." : undefined}
      />
    </>
  );
}
