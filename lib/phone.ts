const BANGLA_DIGITS = "০১২৩৪৫৬৭৮৯";

/** Converts Bangla numerals (০-৯) to ASCII digits; other characters are kept. */
export function toAsciiDigits(input: string): string {
  return input.replace(/[০-৯]/g, (d) => String(BANGLA_DIGITS.indexOf(d)));
}

/** Converts ASCII digits to Bangla numerals. */
export function toBanglaDigits(input: string | number): string {
  return String(input).replace(/[0-9]/g, (d) => BANGLA_DIGITS[Number(d)] ?? d);
}

const LOCAL_MOBILE = /^01[3-9]\d{8}$/;

/**
 * Normalizes a Bangladeshi mobile number to the local 11-digit form (01XXXXXXXXX).
 * Accepts 01XXXXXXXXX, +8801XXXXXXXXX, 8801XXXXXXXXX, 008801XXXXXXXXX, 1XXXXXXXXX,
 * with spaces, dashes, dots or brackets, and Bangla numerals.
 * Returns null when the number is not a valid BD mobile number.
 */
export function normalizeBdPhone(input: string): string | null {
  let s = toAsciiDigits(input).replace(/[\s\-().]/g, "");
  if (s.startsWith("+")) s = s.slice(1);
  if (s.startsWith("0088")) s = s.slice(2);
  if (s.startsWith("880")) s = s.slice(2);
  if (/^1[3-9]\d{8}$/.test(s)) s = `0${s}`;
  return LOCAL_MOBILE.test(s) ? s : null;
}

/** 01712345678 → 017••••5678 (for customer-facing pages). */
export function maskPhone(phone: string): string {
  if (phone.length < 7) return phone;
  return `${phone.slice(0, 3)}${"•".repeat(phone.length - 7)}${phone.slice(-4)}`;
}
