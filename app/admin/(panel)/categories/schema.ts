import { z } from "zod";
import { SLUG_RE } from "@/lib/admin/common";

export const categoryInputSchema = z.object({
  id: z.string().max(40).optional(),
  name: z.string().trim().min(1, { error: "Name is required" }).max(80, { error: "Name must be at most 80 characters" }),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .min(1, { error: "URL slug is required" })
    .max(80, { error: "URL slug must be at most 80 characters" })
    .regex(SLUG_RE, { error: "URL slug: use lowercase English letters, numbers and single dashes" }),
  description: z
    .string()
    .trim()
    .max(500, { error: "Description must be at most 500 characters" })
    .transform((v) => v || null),
  sortOrder: z
    .number({ error: "Sort order must be a number" })
    .int({ error: "Sort order must be a whole number" })
    .min(-10000, { error: "Sort order is too small" })
    .max(10000, { error: "Sort order is too large" }),
  isActive: z.boolean(),
});

export type CategoryInput = z.input<typeof categoryInputSchema>;

/** First validation message (all messages above already name their field). */
export function firstIssue(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Invalid input";
}
