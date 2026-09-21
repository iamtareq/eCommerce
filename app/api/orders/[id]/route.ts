import { revalidateTag } from "next/cache";
import { after } from "next/server";
import { z } from "zod";
import { OrderStatus } from "@/generated/prisma/enums";
import { json } from "@/lib/api";
import { authorizeApi } from "@/lib/auth/guard";
import { CATALOG_TAG } from "@/lib/catalog";
import { syncOrderToSheet } from "@/lib/google-sheets/sync";
import { getOrderDetail, OrderUpdateError, updateAdminNote, updateOrderStatus } from "@/lib/orders/admin";
import { readJsonBody } from "@/lib/request";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/** GET /api/orders/:id — full order (admin). */
export async function GET(request: Request, ctx: Ctx) {
  const auth = await authorizeApi(request);
  if (!auth.ok) return auth.response;
  const { id } = await ctx.params;
  const order = await getOrderDetail(id);
  if (!order) return json({ error: "Not found" }, 404);
  return json({ order });
}

const patchSchema = z
  .object({
    status: z.enum(OrderStatus).optional(),
    adminNote: z.string().max(2000).optional(),
  })
  .refine((v) => v.status !== undefined || v.adminNote !== undefined, { error: "Nothing to update" });

/** PATCH /api/orders/:id — change status and/or admin note (admin). */
export async function PATCH(request: Request, ctx: Ctx) {
  const auth = await authorizeApi(request);
  if (!auth.ok) return auth.response;
  const { id } = await ctx.params;
  const parsed = patchSchema.safeParse(await readJsonBody(request));
  if (!parsed.success) return json({ error: parsed.error.issues[0]?.message ?? "Invalid request" }, 400);

  try {
    if (parsed.data.status) {
      const { stockChanged } = await updateOrderStatus(id, parsed.data.status, auth.admin);
      // Cancelling returns stock and un-cancelling takes it again; refresh the storefront.
      if (stockChanged) revalidateTag(CATALOG_TAG, { expire: 0 });
      after(() => syncOrderToSheet(id).then(() => undefined).catch((e) => console.error("[orders] sheet sync error", e)));
    }
    if (parsed.data.adminNote !== undefined) {
      await updateAdminNote(id, parsed.data.adminNote, auth.admin);
    }
  } catch (error) {
    if (error instanceof OrderUpdateError) return json({ error: error.message }, 409);
    console.error("[orders] update failed", error);
    return json({ error: "Update failed" }, 500);
  }
  const order = await getOrderDetail(id);
  return json({ order });
}
