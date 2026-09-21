import { z } from "zod";

/** Structured content blocks stored as JSON on products and settings. */

// Plain messages: admin actions prefix them with the field, e.g. "Specification #2 value: Required".
const tooLong = (max: number) => ({ error: `Must be at most ${max} characters` });
const line = (max: number) => z.string().trim().min(1, { error: "Required" }).max(max, tooLong(max));
const optionalLine = (max: number) => z.string().trim().max(max, tooLong(max)).default("");

export const benefitSchema = z.object({
  title: line(80),
  description: optionalLine(300),
});

export const specificationSchema = z.object({
  label: line(60),
  value: line(200),
});

export const faqItemSchema = z.object({
  question: line(200),
  /** Empty answer = hidden on the site until filled in. */
  answer: optionalLine(2000),
});

export const textListSchema = z.array(line(300)).max(30);

export type Benefit = z.infer<typeof benefitSchema>;
export type Specification = z.infer<typeof specificationSchema>;
export type FaqItem = z.infer<typeof faqItemSchema>;

/** Parses a JSON column, falling back to an empty list when the data is malformed. */
export function parseList<T>(schema: z.ZodType<T>, value: unknown): T[] {
  const result = z.array(schema).safeParse(value);
  return result.success ? result.data : [];
}
