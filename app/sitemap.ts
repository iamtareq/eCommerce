import type { MetadataRoute } from "next";
import { connection } from "next/server";
import { getSiteUrl } from "@/config/site";
import { prisma } from "@/lib/db";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  await connection();
  const base = getSiteUrl();
  const products = await prisma.product
    .findMany({ where: { status: "ACTIVE" }, select: { slug: true, updatedAt: true } })
    .catch(() => []);
  return [
    { url: `${base}/`, changeFrequency: "daily", priority: 1 },
    { url: `${base}/products`, changeFrequency: "daily", priority: 0.8 },
    ...products.map((p) => ({
      url: `${base}/products/${encodeURIComponent(p.slug)}`,
      lastModified: p.updatedAt,
      changeFrequency: "weekly" as const,
      priority: 0.9,
    })),
  ];
}
