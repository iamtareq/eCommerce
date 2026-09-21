import { z } from "zod";

const int = (label: string, min: number, max: number) =>
  z
    .number({ error: `${label} must be a number` })
    .int({ error: `${label} must be a whole number` })
    .min(min, { error: `${label} must be at least ${min}` })
    .max(max, { error: `${label} must be at most ${max}` });

/** Same rules as product images (lib/validation/product.ts). */
export const reviewImageSchema = z.object({
  url: z
    .string()
    .max(500)
    .refine((u) => u.startsWith("/media/") || u.startsWith("https://res.cloudinary.com/"), { error: "Invalid image URL" }),
  key: z.string().max(300).regex(/^(local|cloudinary):/, { error: "Invalid image key" }),
});

export const reviewInputSchema = z.object({
  id: z.string().max(40).optional(),
  /** null = general store review (shown on all pages). */
  productId: z.string().max(40).nullable(),
  customerName: z
    .string()
    .trim()
    .min(1, { error: "Customer name is required" })
    .max(80, { error: "Customer name must be at most 80 characters" }),
  location: z
    .string()
    .trim()
    .max(80, { error: "Location must be at most 80 characters" })
    .transform((v) => v || null),
  rating: int("Rating", 1, 5),
  text: z.string().trim().min(1, { error: "Review text is required" }).max(1000, { error: "Review text must be at most 1000 characters" }),
  image: reviewImageSchema.nullable(),
  isPublished: z.boolean(),
  sortOrder: int("Sort order", -10000, 10000),
});

export type ReviewInput = z.input<typeof reviewInputSchema>;

/** First validation message (all messages above already name their field). */
export function firstIssue(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Invalid input";
}
