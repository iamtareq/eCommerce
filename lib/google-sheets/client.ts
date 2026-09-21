import { createSign } from "node:crypto";
import type { SheetsConfig } from "./config";

/**
 * Minimal Google Sheets REST client using a service account (JWT bearer flow).
 * Runs server-side only; credentials come from environment variables.
 */

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const SHEETS_API = "https://sheets.googleapis.com/v4/spreadsheets";
const SCOPE = "https://www.googleapis.com/auth/spreadsheets";
const TIMEOUT_MS = 15_000;

export class SheetsError extends Error {
  constructor(
    message: string,
    public status?: number,
  ) {
    super(message);
    this.name = "SheetsError";
  }
}

const b64url = (input: string | Buffer) => Buffer.from(input).toString("base64url");

let cachedToken: { key: string; token: string; expiresAt: number } | null = null;

async function getAccessToken(config: SheetsConfig): Promise<string> {
  const cacheKey = config.clientEmail;
  if (cachedToken && cachedToken.key === cacheKey && cachedToken.expiresAt > Date.now() + 60_000) {
    return cachedToken.token;
  }
  const iat = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = b64url(JSON.stringify({ iss: config.clientEmail, scope: SCOPE, aud: TOKEN_URL, iat, exp: iat + 3600 }));
  let signature: string;
  try {
    signature = createSign("RSA-SHA256").update(`${header}.${claims}`).sign(config.privateKey).toString("base64url");
  } catch {
    throw new SheetsError("GOOGLE_PRIVATE_KEY is not a valid PEM private key");
  }
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: `${header}.${claims}.${signature}`,
    }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  const body = (await res.json().catch(() => ({}))) as { access_token?: string; expires_in?: number; error_description?: string; error?: string };
  if (!res.ok || !body.access_token) {
    throw new SheetsError(`Google auth failed: ${body.error_description || body.error || res.status}`, res.status);
  }
  cachedToken = { key: cacheKey, token: body.access_token, expiresAt: Date.now() + (body.expires_in ?? 3600) * 1000 };
  return body.access_token;
}

async function request<T>(config: SheetsConfig, path: string, init: RequestInit = {}): Promise<T> {
  const token = await getAccessToken(config);
  const res = await fetch(`${SHEETS_API}/${encodeURIComponent(config.spreadsheetId)}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...(init.headers ?? {}) },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: { message?: string; status?: string } };
    const msg = body.error?.message || res.statusText;
    if (res.status === 401) cachedToken = null;
    throw new SheetsError(`Google Sheets API ${res.status}: ${msg}`, res.status);
  }
  return (await res.json()) as T;
}

/** A1 range with a safely quoted sheet name, e.g. 'Orders'!A1:Q1 */
export function a1(tab: string, range: string): string {
  return `'${tab.replace(/'/g, "''")}'!${range}`;
}

export type CellValue = string | number;

export async function getValues(config: SheetsConfig, range: string): Promise<string[][]> {
  const data = await request<{ values?: string[][] }>(
    config,
    `/values/${encodeURIComponent(a1(config.tab, range))}?majorDimension=ROWS&valueRenderOption=FORMATTED_VALUE`,
  );
  return data.values ?? [];
}

/** Writes values exactly as given (RAW) — no formulas are ever evaluated. */
export async function updateValues(config: SheetsConfig, range: string, rows: CellValue[][]): Promise<void> {
  await request(config, `/values/${encodeURIComponent(a1(config.tab, range))}?valueInputOption=RAW`, {
    method: "PUT",
    body: JSON.stringify({ values: rows }),
  });
}

/** Appends one row and returns the 1-based row number it was written to. */
export async function appendRow(config: SheetsConfig, lastColumn: string, row: CellValue[]): Promise<number> {
  const data = await request<{ updates?: { updatedRange?: string } }>(
    config,
    `/values/${encodeURIComponent(a1(config.tab, `A:${lastColumn}`))}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`,
    { method: "POST", body: JSON.stringify({ values: [row] }) },
  );
  const range = data.updates?.updatedRange ?? "";
  const match = /![A-Z]+(\d+)/.exec(range);
  if (!match) throw new SheetsError(`Unexpected append response range: ${range}`);
  return Number(match[1]);
}

/** Creates the tab if the spreadsheet does not have it yet. */
export async function ensureTab(config: SheetsConfig): Promise<void> {
  const meta = await request<{ sheets?: { properties?: { title?: string } }[] }>(config, "?fields=sheets.properties.title");
  const exists = meta.sheets?.some((s) => s.properties?.title === config.tab);
  if (exists) return;
  await request(config, ":batchUpdate", {
    method: "POST",
    body: JSON.stringify({ requests: [{ addSheet: { properties: { title: config.tab } } }] }),
  });
}

/** Test hook: drop the cached access token. */
export function resetTokenCache(): void {
  cachedToken = null;
}
