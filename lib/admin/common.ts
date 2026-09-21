import { z } from "zod";

/** Result returned by admin server actions. */
export type ActionResult<T = undefined> =
  | { ok: true; message?: string; data?: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

export const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** URL slug from a (usually English) name; Bangla-only names get a short random slug. */
export function slugify(input: string): string {
  const slug = input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/g, "");
  return slug || `item-${Math.random().toString(36).slice(2, 8)}`;
}

/** Maps Zod issues to "path.to.field" → message. */
export function zodFieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.map(String).join(".") || "_form";
    if (!(key in out)) out[key] = issue.message;
  }
  return out;
}

export function firstError(error: z.ZodError): string {
  const issue = error.issues[0];
  if (!issue) return "Invalid input";
  const where = issue.path.length ? `${issue.path.map(String).join(" › ")}: ` : "";
  return `${where}${issue.message}`;
}

/** Optional integer from a form value: "" → null. */
export const optionalInt = (min: number, max: number) =>
  z.preprocess(
    (v) => (v === "" || v === undefined || v === null ? null : typeof v === "string" ? Number(v) : v),
    z.number().int().min(min).max(max).nullable(),
  );

export const requiredInt = (min: number, max: number) =>
  z.preprocess((v) => (typeof v === "string" && v.trim() !== "" ? Number(v) : v), z.number({ error: "Required" }).int().min(min).max(max));

export const trimmed = (max: number) => z.string().trim().max(max);

/** Trimmed string where "" becomes null. */
export const nullableText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => (v === "" ? null : v))
    .nullable()
    .optional()
    .transform((v) => v ?? null);
