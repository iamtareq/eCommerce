import { json } from "@/lib/api";
import { leadSchema, saveLead } from "@/lib/leads";
import { LIMITS, rateLimit } from "@/lib/rate-limit";
import { getClientIp, readJsonBody } from "@/lib/request";
import { hashIp } from "@/lib/security";

export const dynamic = "force-dynamic";

/**
 * POST /api/checkout/lead — saves an unfinished checkout (name, valid phone, cart) so staff
 * can call to help. The checkout tells the customer this under the phone field. Public, rate
 * limited, JSON only (so other sites cannot post here through their visitors' browsers).
 */
export async function POST(request: Request) {
  try {
    const ipHash = hashIp(getClientIp(request.headers));
    const limit = await rateLimit(`lead:ip:${ipHash}`, LIMITS.leadPerIp.limit, LIMITS.leadPerIp.windowMs);
    if (!limit.ok) return json({ ok: false }, 429);

    const parsed = leadSchema.safeParse(await readJsonBody(request, 8 * 1024));
    if (!parsed.success) return json({ ok: false }, 400);
    const saved = await saveLead(parsed.data, ipHash);
    return json({ ok: true, saved });
  } catch (error) {
    console.error("[lead] save failed", error);
    return json({ ok: false }, 500);
  }
}
