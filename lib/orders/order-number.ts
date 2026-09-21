import { siteConfig } from "@/config/site";
import { dhakaDateKey } from "@/lib/dates";
import type { TransactionClient } from "@/lib/db";

export function formatOrderNumber(dateKey: string, sequence: number): string {
  return `${siteConfig.orderNumberPrefix}-${dateKey}-${String(sequence).padStart(4, "0")}`;
}

/**
 * Allocates the next order number for the current Dhaka day, e.g. DBX-20260921-0001.
 * The counter row is incremented atomically inside the order transaction, so
 * concurrent orders never share a number.
 */
export async function nextOrderNumber(tx: TransactionClient, now: Date = new Date()): Promise<string> {
  const dateKey = dhakaDateKey(now);
  const rows = await tx.$queryRaw<{ value: number }[]>`
    INSERT INTO "OrderCounter" ("date", "value") VALUES (${dateKey}, 1)
    ON CONFLICT ("date") DO UPDATE SET "value" = "OrderCounter"."value" + 1
    RETURNING "value"`;
  const value = Number(rows[0]?.value);
  if (!Number.isFinite(value) || value < 1) throw new Error("Failed to allocate order number");
  return formatOrderNumber(dateKey, value);
}
