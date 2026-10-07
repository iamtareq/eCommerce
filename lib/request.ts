/**
 * Client IP as reported by the hosting proxy, used for rate limiting.
 *
 * It is only as trustworthy as the header it comes from, so it must be a header the
 * front proxy *overwrites* (a client can send any header it likes). Set
 * CLIENT_IP_HEADER to match the deployment:
 *
 * - unset (default): X-Real-IP, else the right-most X-Forwarded-For entry. Safe on
 *   Vercel and behind Nginx with `proxy_set_header X-Real-IP $remote_addr;`. NOT safe
 *   where clients can pass their own X-Real-IP through: bare `next start` (Next.js
 *   keeps a client's X-Real-IP and X-Forwarded-For), Caddy, or Cloudflare straight
 *   to the app.
 * - "x-forwarded-for": the entry TRUSTED_PROXY_HOPS (default 1) from the right, i.e.
 *   the address seen by the outermost trusted proxy. Caddy: 1; Cloudflare → Nginx: 2.
 * - any other header name, e.g. "cf-connecting-ip" (Cloudflare, when the origin only
 *   accepts Cloudflare's IP ranges) or "x-real-ip": used as is, with no fallback.
 */
export function getClientIp(headers: Headers): string {
  const configured = process.env.CLIENT_IP_HEADER?.trim().toLowerCase();
  if (!configured) {
    return headers.get("x-real-ip")?.trim() || forwardedFor(headers, 1) || "unknown";
  }
  if (!/^[a-z0-9-]+$/.test(configured)) {
    throw new Error("CLIENT_IP_HEADER must be a header name, e.g. x-real-ip, x-forwarded-for or cf-connecting-ip.");
  }
  if (configured === "x-forwarded-for") return forwardedFor(headers, trustedHops()) || "unknown";
  return headers.get(configured)?.trim() || "unknown";
}

/** The X-Forwarded-For entry `hops` places from the right (each proxy appends the address it saw). */
function forwardedFor(headers: Headers, hops: number): string | undefined {
  const parts = (headers.get("x-forwarded-for") ?? "").split(",").map((p) => p.trim()).filter(Boolean);
  return parts[parts.length - hops];
}

function trustedHops(): number {
  const hops = Number(process.env.TRUSTED_PROXY_HOPS?.trim() || "1");
  return Number.isInteger(hops) && hops >= 1 && hops <= 10 ? hops : 1;
}

/**
 * CSRF defence for cookie-authenticated route handlers: mutating requests must
 * come from our own origin. (Server Actions get the same check from Next.js.)
 */
export function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  if (!origin) {
    // Some browsers omit Origin on same-origin requests; fall back to Fetch Metadata.
    return request.headers.get("sec-fetch-site") === "same-origin";
  }
  if (!host) return false;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

/**
 * Reads a JSON body with a hard size limit. Returns undefined when the request is not
 * `application/json`, or the body is invalid or too large.
 *
 * Requiring the JSON content type keeps other websites from posting here through their
 * visitors' browsers: a cross-origin request with that type needs a CORS preflight,
 * which we never approve (text/plain forms and no-cors fetches do not).
 * The body is streamed and dropped as soon as it passes the limit, so a chunked upload
 * without Content-Length cannot fill the server's memory.
 */
export async function readJsonBody(request: Request, maxBytes = 32 * 1024): Promise<unknown> {
  const type = request.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase();
  if (type !== "application/json") return undefined;
  const body = await readBodyLimited(request, maxBytes);
  if (!body) return undefined;
  try {
    return JSON.parse(new TextDecoder().decode(body));
  } catch {
    return undefined;
  }
}

/**
 * Reads a multipart/form-data body with a hard size limit. Returns undefined when the
 * body is too large or is not valid form data. Like readJsonBody, the body is streamed
 * and dropped at the limit, so a chunked upload cannot fill the server's memory first.
 */
export async function readFormData(request: Request, maxBytes: number): Promise<FormData | undefined> {
  const type = request.headers.get("content-type");
  if (!type?.toLowerCase().startsWith("multipart/form-data")) return undefined;
  const body = await readBodyLimited(request, maxBytes);
  if (!body) return undefined;
  try {
    return await new Response(body, { headers: { "content-type": type } }).formData();
  } catch {
    return undefined;
  }
}

/** The raw body, or undefined when it is missing, unreadable or larger than maxBytes. */
async function readBodyLimited(request: Request, maxBytes: number): Promise<Uint8Array<ArrayBuffer> | undefined> {
  const declared = Number(request.headers.get("content-length") ?? "0");
  if (declared > maxBytes) return undefined;
  try {
    const reader = request.body?.getReader();
    if (!reader) return undefined;
    const chunks: Uint8Array[] = [];
    let size = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) {
        await reader.cancel().catch(() => {});
        return undefined;
      }
      chunks.push(value);
    }
    const body = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
      body.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return body;
  } catch {
    return undefined;
  }
}
