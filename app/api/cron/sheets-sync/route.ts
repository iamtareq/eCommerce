import { json } from "@/lib/api";
import { syncPendingOrders } from "@/lib/google-sheets/sync";
import { safeEqual } from "@/lib/security";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * GET /api/cron/sheets-sync — optional scheduled catch-up for orders whose
 * sheet sync is pending or failed. Protected by `Authorization: Bearer CRON_SECRET`
 * (Vercel Cron sends this header automatically when CRON_SECRET is set).
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return json({ error: "CRON_SECRET is not configured" }, 404);
  const auth = request.headers.get("authorization") ?? "";
  if (!safeEqual(auth, `Bearer ${secret}`)) return json({ error: "Unauthorized" }, 401);
  const result = await syncPendingOrders({ limit: 50, maxAttempts: 10 });
  return json(result);
}
