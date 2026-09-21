import { NextResponse } from "next/server";

/** JSON response that is never cached by browsers or CDNs. */
export function json(body: unknown, status = 200, headers: Record<string, string> = {}): NextResponse {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store", ...headers } });
}

export function retryAfterSeconds(resetAt: Date): string {
  return String(Math.max(1, Math.ceil((resetAt.getTime() - Date.now()) / 1000)));
}
