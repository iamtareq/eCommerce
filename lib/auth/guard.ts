import "server-only";
import { redirect } from "next/navigation";
import { NextResponse } from "next/server";
import { isSameOrigin } from "@/lib/request";
import { getCurrentAdmin, type AdminIdentity } from "./session";

/** For admin pages and server actions: redirects to the login page when signed out. */
export async function requireAdmin(): Promise<AdminIdentity> {
  const admin = await getCurrentAdmin();
  if (!admin) redirect("/admin/login");
  return admin;
}

/** Owner-only pages and actions (catalog, pricing, settings, users). */
export async function requireOwner(): Promise<AdminIdentity> {
  const admin = await requireAdmin();
  if (admin.role !== "OWNER") redirect("/admin?denied=1");
  return admin;
}

type ApiAuth = { ok: true; admin: AdminIdentity } | { ok: false; response: NextResponse };

/**
 * For admin route handlers: checks the session (401), role (403) and, for
 * mutating methods, that the request comes from our own origin (CSRF, 403).
 */
export async function authorizeApi(request: Request, options: { owner?: boolean } = {}): Promise<ApiAuth> {
  const mutating = !["GET", "HEAD", "OPTIONS"].includes(request.method);
  if (mutating && !isSameOrigin(request)) {
    return { ok: false, response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  const admin = await getCurrentAdmin();
  if (!admin) return { ok: false, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  if (options.owner && admin.role !== "OWNER") {
    return { ok: false, response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { ok: true, admin };
}
