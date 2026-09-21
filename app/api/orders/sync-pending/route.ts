import { json } from "@/lib/api";
import { authorizeApi } from "@/lib/auth/guard";
import { syncPendingOrders } from "@/lib/google-sheets/sync";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** POST /api/orders/sync-pending — push every new/changed/failed order to the sheet (admin). */
export async function POST(request: Request) {
  const auth = await authorizeApi(request);
  if (!auth.ok) return auth.response;
  const result = await syncPendingOrders({ limit: 50 });
  return json(result);
}
