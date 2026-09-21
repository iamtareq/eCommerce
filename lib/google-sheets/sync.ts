import { prisma } from "@/lib/db";
import { randomToken } from "@/lib/security";
import { appendRow, ensureTab, getValues, updateValues, type CellValue } from "./client";
import { LAST_COLUMN, orderToRow, SHEET_COLUMNS } from "./columns";
import { getSheetsConfig, type SheetsConfig } from "./config";

/**
 * Google Sheet synchronisation.
 *
 * The database is the source of truth; the sheet is a reporting copy. Each
 * order carries a version (bumped when sheet-visible data changes) and the
 * version last written to the sheet. A worker claims a short lease on the order,
 * locates the order's row by its order number (column A), updates it or appends
 * a new one, then records the synced version. Because rows are located by order
 * number before appending, a retry never creates a duplicate row — even if a
 * previous attempt wrote the row but crashed before recording it.
 */

export interface SheetGateway {
  /** 1-based row number holding this order, or null. `hint` is the last known row. */
  findRow(orderNumber: string, hint: number | null): Promise<number | null>;
  updateRow(row: number, values: CellValue[]): Promise<void>;
  appendRow(values: CellValue[]): Promise<number>;
  describe(row: number): string;
}

const preparedSheets = new Set<string>();

async function prepareSheet(config: SheetsConfig): Promise<void> {
  const key = `${config.spreadsheetId}/${config.tab}`;
  if (preparedSheets.has(key)) return;
  await ensureTab(config);
  const header = await getValues(config, `A1:${LAST_COLUMN}1`);
  if (!header[0]?.[0]) {
    await updateValues(config, `A1:${LAST_COLUMN}1`, [[...SHEET_COLUMNS]]);
  }
  preparedSheets.add(key);
}

export function createGoogleGateway(config: SheetsConfig | null = getSheetsConfig()): SheetGateway | null {
  if (!config) return null;
  return {
    async findRow(orderNumber, hint) {
      await prepareSheet(config);
      if (hint && hint > 1) {
        const cell = await getValues(config, `A${hint}`);
        if (cell[0]?.[0] === orderNumber) return hint;
      }
      const column = await getValues(config, "A:A");
      const index = column.findIndex((r) => r[0] === orderNumber);
      return index >= 0 ? index + 1 : null;
    },
    async updateRow(row, values) {
      await updateValues(config, `A${row}:${LAST_COLUMN}${row}`, [values]);
    },
    async appendRow(values) {
      await prepareSheet(config);
      return appendRow(config, LAST_COLUMN, values);
    },
    describe(row) {
      return `${config.tab}!A${row}`;
    },
  };
}

export type SyncOutcome = "synced" | "up-to-date" | "busy" | "not-configured" | "failed" | "not-found";

const LEASE_SECONDS = 120;
const NOT_CONFIGURED =
  "Google Sheets is not configured. Set GOOGLE_SHEET_ID, GOOGLE_SERVICE_ACCOUNT_EMAIL and GOOGLE_PRIVATE_KEY.";

function parseRowRef(ref: string | null): number | null {
  const m = ref ? /!A(\d+)$/.exec(ref) : null;
  return m ? Number(m[1]) : null;
}

function describeError(error: unknown): string {
  const msg = error instanceof Error ? error.message : String(error);
  return msg.slice(0, 500);
}

/**
 * Syncs one order to the sheet. Safe to call concurrently and repeatedly:
 * an order that is already up to date is left untouched.
 */
export async function syncOrderToSheet(
  orderId: string,
  options: { gateway?: SheetGateway | null } = {},
): Promise<{ outcome: SyncOutcome; error?: string }> {
  const gateway = options.gateway === undefined ? createGoogleGateway() : options.gateway;

  if (!gateway) {
    await prisma.$executeRaw`
      UPDATE "Order" SET "googleSheetSyncStatus" = 'FAILED', "googleSheetSyncError" = ${NOT_CONFIGURED}
      WHERE "id" = ${orderId} AND "googleSheetSyncLease" IS NULL
        AND "googleSheetSyncedVersion" < "googleSheetVersion"`;
    return { outcome: "not-configured", error: NOT_CONFIGURED };
  }

  // A newer version may land while we write; loop a few times to catch up.
  for (let round = 0; round < 3; round++) {
    const lease = randomToken(12);
    const claimed = await prisma.$queryRaw<{ id: string }[]>`
      UPDATE "Order" SET
        "googleSheetSyncStatus" = 'SYNCING',
        "googleSheetSyncLease" = ${lease},
        "googleSheetSyncStartedAt" = NOW(),
        "googleSheetSyncAttempts" = "googleSheetSyncAttempts" + 1
      WHERE "id" = ${orderId}
        AND "googleSheetSyncedVersion" < "googleSheetVersion"
        AND ("googleSheetSyncLease" IS NULL
             OR "googleSheetSyncStartedAt" < NOW() - make_interval(secs => ${LEASE_SECONDS}))
      RETURNING "id"`;

    if (claimed.length === 0) {
      const current = await prisma.order.findUnique({
        where: { id: orderId },
        select: { googleSheetVersion: true, googleSheetSyncedVersion: true },
      });
      if (!current) return { outcome: "not-found" };
      return { outcome: current.googleSheetSyncedVersion >= current.googleSheetVersion ? "up-to-date" : "busy" };
    }

    try {
      const order = await prisma.order.findUniqueOrThrow({
        where: { id: orderId },
        include: { items: { orderBy: { id: "asc" } } },
      });
      const version = order.googleSheetVersion;
      const values = orderToRow(order);

      let row = await gateway.findRow(order.orderNumber, parseRowRef(order.googleSheetRowReference));
      if (row) await gateway.updateRow(row, values);
      else row = await gateway.appendRow(values);

      // Attempts count consecutive failures only, so a successful write resets them.
      const released = await prisma.$queryRaw<{ status: string }[]>`
        UPDATE "Order" SET
          "googleSheetSyncedVersion" = GREATEST("googleSheetSyncedVersion", ${version}::int),
          "googleSheetRowReference" = ${gateway.describe(row)},
          "googleSheetLastSyncAt" = NOW(),
          "googleSheetSyncError" = NULL,
          "googleSheetSyncAttempts" = 0,
          "googleSheetSyncLease" = NULL,
          "googleSheetSyncStartedAt" = NULL,
          "googleSheetSyncStatus" = (CASE
            WHEN GREATEST("googleSheetSyncedVersion", ${version}::int) >= "googleSheetVersion" THEN 'SYNCED'
            ELSE 'PENDING' END)::"SheetSyncStatus"
        WHERE "id" = ${orderId} AND "googleSheetSyncLease" = ${lease}
        RETURNING "googleSheetSyncStatus"::text AS status`;

      if (released.length === 0) return { outcome: "busy" }; // lease expired and was taken over
      if (released[0]!.status === "SYNCED") return { outcome: "synced" };
    } catch (error) {
      const message = describeError(error);
      await prisma.$executeRaw`
        UPDATE "Order" SET
          "googleSheetSyncStatus" = 'FAILED',
          "googleSheetSyncError" = ${message},
          "googleSheetSyncLease" = NULL,
          "googleSheetSyncStartedAt" = NULL
        WHERE "id" = ${orderId} AND "googleSheetSyncLease" = ${lease}`;
      console.error(`[sheets] sync failed for order ${orderId}: ${message}`);
      return { outcome: "failed", error: message };
    }
  }
  // The order kept changing during every round and is still behind (PENDING).
  return { outcome: "busy" };
}

/**
 * Marks sheet-visible data as changed (e.g. after a status update) so the next
 * sync rewrites the row. Must run in the same transaction as the change.
 */
export async function markSheetStale(
  tx: { $executeRaw: typeof prisma.$executeRaw },
  orderId: string,
): Promise<void> {
  await tx.$executeRaw`
    UPDATE "Order" SET
      "googleSheetVersion" = "googleSheetVersion" + 1,
      "googleSheetSyncStatus" = (CASE WHEN "googleSheetSyncLease" IS NULL THEN 'PENDING'
                                      ELSE "googleSheetSyncStatus"::text END)::"SheetSyncStatus"
    WHERE "id" = ${orderId}`;
}

/**
 * Syncs orders that are behind (new, changed, or failed). Used by the admin
 * "Sync pending" button and the optional cron endpoint.
 */
export async function syncPendingOrders(
  options: { limit?: number; maxAttempts?: number | null; gateway?: SheetGateway | null } = {},
): Promise<{ processed: number; synced: number; failed: number; notConfigured: boolean }> {
  const limit = Math.min(Math.max(options.limit ?? 25, 1), 200);
  const maxAttempts = options.maxAttempts ?? null;
  const rows = await prisma.$queryRaw<{ id: string }[]>`
    SELECT "id" FROM "Order"
    WHERE "googleSheetSyncedVersion" < "googleSheetVersion"
      AND ("googleSheetSyncLease" IS NULL
           OR "googleSheetSyncStartedAt" < NOW() - make_interval(secs => ${LEASE_SECONDS}))
      AND (${maxAttempts}::int IS NULL OR "googleSheetSyncAttempts" < ${maxAttempts}::int)
    ORDER BY "createdAt" ASC
    LIMIT ${limit}`;

  let synced = 0;
  let failed = 0;
  let notConfigured = false;
  for (const { id } of rows) {
    const result = await syncOrderToSheet(id, { gateway: options.gateway });
    if (result.outcome === "synced" || result.outcome === "up-to-date") synced++;
    else if (result.outcome === "not-configured") {
      notConfigured = true;
      break;
    } else if (result.outcome === "failed") failed++;
  }
  return { processed: rows.length, synced, failed, notConfigured };
}
