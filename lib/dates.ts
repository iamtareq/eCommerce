/**
 * Asia/Dhaka helpers. Bangladesh is UTC+6 with no daylight saving time, so a
 * fixed offset is exact and avoids depending on the server's time zone.
 */
const DHAKA_OFFSET_MS = 6 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

function shifted(date: Date): Date {
  return new Date(date.getTime() + DHAKA_OFFSET_MS);
}

/** YYYYMMDD in Dhaka time, e.g. for order numbers. */
export function dhakaDateKey(date: Date = new Date()): string {
  const d = shifted(date);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}${m}${day}`;
}

/** YYYY-MM-DD in Dhaka time (for <input type="date"> values). */
export function dhakaIsoDate(date: Date = new Date()): string {
  const k = dhakaDateKey(date);
  return `${k.slice(0, 4)}-${k.slice(4, 6)}-${k.slice(6, 8)}`;
}

/** The UTC instant at which the Dhaka calendar day containing `date` starts. */
export function startOfDhakaDay(date: Date = new Date()): Date {
  const d = shifted(date);
  const utcMidnight = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  return new Date(utcMidnight - DHAKA_OFFSET_MS);
}

/**
 * Parses a YYYY-MM-DD string as a Dhaka calendar day and returns its [start, end)
 * range in UTC. Returns null for invalid input.
 */
export function dhakaDayRange(isoDate: string): { start: Date; end: Date } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate);
  if (!m) return null;
  const [, y, mo, d] = m;
  const utcMidnight = Date.UTC(Number(y), Number(mo) - 1, Number(d));
  if (Number.isNaN(utcMidnight)) return null;
  const start = new Date(utcMidnight - DHAKA_OFFSET_MS);
  if (dhakaIsoDate(start) !== isoDate) return null; // rejects 2026-02-31 etc.
  return { start, end: new Date(start.getTime() + DAY_MS) };
}

const pad = (n: number) => String(n).padStart(2, "0");

/**
 * Parses an <input type="datetime-local"> value ("2026-09-21T10:30") as Dhaka
 * local time. Returns null for empty or invalid input.
 */
export function parseDhakaDateTimeLocal(value: string | null | undefined): Date | null {
  const m = value ? /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(value) : null;
  if (!m) return null;
  const [, y, mo, d, h, mi] = m;
  const utc = Date.UTC(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi));
  return Number.isNaN(utc) ? null : new Date(utc - DHAKA_OFFSET_MS);
}

/** Formats a Date as a Dhaka-time value for <input type="datetime-local">. */
export function toDhakaDateTimeLocal(date: Date | null | undefined): string {
  if (!date) return "";
  const d = shifted(date);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
}

/** "2026-09-21 14:05" in Dhaka time — used for Google Sheets and CSV. */
export function formatDhakaDateTime(date: Date): string {
  const d = shifted(date);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
}

const bnDateFormatter = new Intl.DateTimeFormat("bn-BD", {
  timeZone: "Asia/Dhaka",
  day: "numeric",
  month: "long",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

const enDateFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Dhaka",
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: true,
});

/** Customer-facing Bangla date & time. */
export function formatDateBn(date: Date): string {
  return bnDateFormatter.format(date);
}

/** Admin-facing English date & time (Dhaka). */
export function formatDateEn(date: Date): string {
  return enDateFormatter.format(date);
}
