export interface SheetsConfig {
  spreadsheetId: string;
  tab: string;
  clientEmail: string;
  privateKey: string;
}

/**
 * Normalizes a service-account private key from an environment variable.
 * Handles keys pasted with literal "\n" sequences or wrapped in quotes.
 */
export function normalizePrivateKey(raw: string): string {
  let key = raw.trim();
  if ((key.startsWith('"') && key.endsWith('"')) || (key.startsWith("'") && key.endsWith("'"))) {
    key = key.slice(1, -1);
  }
  return key.replace(/\\n/g, "\n");
}

/** Returns the Sheets configuration, or null when it is incomplete. */
export function getSheetsConfig(): SheetsConfig | null {
  const spreadsheetId = process.env.GOOGLE_SHEET_ID?.trim();
  const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL?.trim();
  const rawKey = process.env.GOOGLE_PRIVATE_KEY;
  if (!spreadsheetId || !clientEmail || !rawKey?.trim()) return null;
  return {
    spreadsheetId,
    tab: process.env.GOOGLE_SHEET_TAB?.trim() || "Orders",
    clientEmail,
    privateKey: normalizePrivateKey(rawKey),
  };
}
