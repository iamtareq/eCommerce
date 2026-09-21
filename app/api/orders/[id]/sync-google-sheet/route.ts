import { json } from "@/lib/api";
import { authorizeApi } from "@/lib/auth/guard";
import { prisma } from "@/lib/db";
import { syncOrderToSheet } from "@/lib/google-sheets/sync";

export const dynamic = "force-dynamic";

/**
 * POST /api/orders/:id/sync-google-sheet — retry Google Sheet sync (admin).
 * Already-synced orders are left untouched; otherwise the order's row is
 * located by order number and updated, or appended if it does not exist.
 */
export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await authorizeApi(request);
  if (!auth.ok) return auth.response;
  const { id } = await ctx.params;
  const exists = await prisma.order.findUnique({ where: { id }, select: { id: true } });
  if (!exists) return json({ error: "Not found" }, 404);

  const result = await syncOrderToSheet(id);
  const order = await prisma.order.findUnique({
    where: { id },
    select: {
      googleSheetSyncStatus: true,
      googleSheetSyncError: true,
      googleSheetLastSyncAt: true,
      googleSheetRowReference: true,
    },
  });
  const status = result.outcome === "failed" || result.outcome === "not-configured" ? 502 : 200;
  return json({ outcome: result.outcome, error: result.error ?? null, order }, status);
}
