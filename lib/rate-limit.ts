import { prisma } from "@/lib/db";

export interface RateLimitResult {
  ok: boolean;
  remaining: number;
  resetAt: Date;
}

/**
 * Fixed-window rate limiter backed by PostgreSQL, so it works across multiple
 * server instances and on serverless hosting. One atomic upsert per call.
 */
export async function rateLimit(key: string, limit: number, windowMs: number): Promise<RateLimitResult> {
  const now = new Date();
  const windowEnd = new Date(now.getTime() + windowMs);
  const rows = await prisma.$queryRaw<{ count: number; resetAt: Date }[]>`
    INSERT INTO "RateLimit" ("key", "count", "resetAt")
    VALUES (${key}, 1, ${windowEnd})
    ON CONFLICT ("key") DO UPDATE SET
      "count"   = CASE WHEN "RateLimit"."resetAt" <= ${now} THEN 1 ELSE "RateLimit"."count" + 1 END,
      "resetAt" = CASE WHEN "RateLimit"."resetAt" <= ${now} THEN ${windowEnd} ELSE "RateLimit"."resetAt" END
    RETURNING "count", "resetAt"`;

  // Opportunistic cleanup of expired windows (~1% of calls).
  if (Math.random() < 0.01) {
    prisma.rateLimit.deleteMany({ where: { resetAt: { lt: new Date(now.getTime() - 60 * 60 * 1000) } } }).catch(() => {});
  }

  const row = rows[0];
  const count = Number(row?.count ?? 1);
  return { ok: count <= limit, remaining: Math.max(0, limit - count), resetAt: row?.resetAt ?? windowEnd };
}

/** True when the key has already used up its window, without counting a new hit. */
export async function isRateLimited(key: string, limit: number): Promise<boolean> {
  const row = await prisma.rateLimit.findUnique({ where: { key } });
  return !!row && row.resetAt > new Date() && row.count >= limit;
}

/** Clears a limiter key (e.g. after a successful login). */
export async function resetRateLimit(key: string): Promise<void> {
  await prisma.rateLimit.deleteMany({ where: { key } });
}

export const LIMITS = {
  orderPerIp: { limit: 8, windowMs: 10 * 60 * 1000 },
  orderPerPhone: { limit: 4, windowMs: 10 * 60 * 1000 },
  quotePerIp: { limit: 120, windowMs: 60 * 1000 },
  couponPerIp: { limit: 20, windowMs: 10 * 60 * 1000 },
  // Order lookups by number + phone. Many customers can share one mobile-network IP, so this is
  // generous; a lookup shows no name, address or phone, so guessing gains little.
  trackPerIp: { limit: 30, windowMs: 10 * 60 * 1000 },
  // Lookups against one phone number from any IP: bounds guessing someone's order numbers
  // even from many IPs, while a customer checking their own orders stays well under it.
  trackPerPhone: { limit: 10, windowMs: 60 * 60 * 1000 },
  // Unfinished-checkout saves: the form saves a few times while someone types.
  leadPerIp: { limit: 30, windowMs: 10 * 60 * 1000 },
  loginPerIp: { limit: 10, windowMs: 15 * 60 * 1000 },
  loginPerUserIp: { limit: 5, windowMs: 15 * 60 * 1000 },
  // Backstop against guessing one account's password from many IPs. Looser than one
  // IP can reach on its own (5 per 15 min), and never applied to known devices.
  loginPerUser: { limit: 30, windowMs: 60 * 60 * 1000 },
  // A browser that has signed in to the account (with its current password) before: only its own attempts count.
  loginPerDevice: { limit: 10, windowMs: 15 * 60 * 1000 },
} as const;
