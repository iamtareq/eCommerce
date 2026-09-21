/**
 * Removes the demo data created by `npm run db:seed:demo`.
 * Demo products that were ordered are archived (order history is kept).
 *
 * Run: npm run db:demo:remove
 */
import "dotenv/config";
import { rm } from "node:fs/promises";
import path from "node:path";
import { prisma } from "../lib/db";

async function main() {
  const products = await prisma.product.findMany({
    where: { slug: { startsWith: "demo-" } },
    include: { _count: { select: { orderItems: true } } },
  });
  let deleted = 0;
  let archived = 0;
  for (const p of products) {
    if (p._count.orderItems > 0) {
      await prisma.product.update({ where: { id: p.id }, data: { status: "ARCHIVED", isFeatured: false } });
      archived++;
    } else {
      await prisma.product.delete({ where: { id: p.id } });
      deleted++;
    }
  }
  const cats = await prisma.category.deleteMany({ where: { slug: { startsWith: "demo-" }, products: { none: {} } } });
  const coupon = await prisma.coupon.findUnique({ where: { code: "DEMO10" }, include: { _count: { select: { orders: true } } } });
  if (coupon) {
    if (coupon._count.orders > 0) await prisma.coupon.update({ where: { id: coupon.id }, data: { isActive: false } });
    else await prisma.coupon.delete({ where: { id: coupon.id } });
  }
  if (archived === 0) {
    const dir = path.resolve(process.cwd(), process.env.UPLOAD_DIR?.trim() || "./storage/uploads", "products/demo");
    await rm(dir, { recursive: true, force: true });
  }
  console.log(`Demo products deleted: ${deleted}, archived (had orders): ${archived}, categories removed: ${cats.count}.`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
