import { requireOwner } from "@/lib/auth/guard";
import { prisma } from "@/lib/db";
import { ReviewManager, type ProductOption, type ReviewRow } from "./ReviewManager";

export const metadata = { title: "Reviews" };

export default async function ReviewsAdminPage() {
  await requireOwner();
  const [rows, products] = await Promise.all([
    prisma.review.findMany({
      orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
      include: { product: { select: { name: true } } },
    }),
    prisma.product.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, status: true },
    }),
  ]);

  const reviews: ReviewRow[] = rows.map((r) => ({
    id: r.id,
    productId: r.productId,
    productName: r.product?.name ?? null,
    customerName: r.customerName,
    location: r.location,
    rating: r.rating,
    text: r.text,
    imageUrl: r.imageUrl,
    imageKey: r.imageKey,
    isPublished: r.isPublished,
    sortOrder: r.sortOrder,
  }));
  const productOptions: ProductOption[] = products;

  return <ReviewManager reviews={reviews} products={productOptions} />;
}
