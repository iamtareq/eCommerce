"use server";

import { revalidatePath, updateTag } from "next/cache";
import { z } from "zod";
import { zodFieldErrors, type ActionResult } from "@/lib/admin/common";
import { requireOwner } from "@/lib/auth/guard";
import { saveSettings, SETTINGS_TAG, siteSettingsSchema } from "@/lib/settings";

export type SiteSettingsInput = z.input<typeof siteSettingsSchema>;

const LABELS: Record<string, string> = {
  acceptingOrders: "Accepting orders",
  cashOnDelivery: "Cash on delivery",
  closedMessage: "Message while orders are paused",
  defaultMaxPerOrder: "Default max quantity per product",
  duplicateWindowHours: "Repeat-order check window",
  freeDeliveryMinAmount: "Free delivery minimum",
  announcement: "Announcement bar",
  homeHeadline: "Home headline",
  homeSubheadline: "Home sub-headline",
  contactPhone: "Contact phone",
  whatsappNumber: "WhatsApp number",
  messengerUrl: "Messenger link",
  facebookPageUrl: "Facebook page link",
  email: "Email",
  businessAddress: "Business address",
  whyChoose: "Why choose Deenbox",
  faqs: "FAQ",
  returnPolicy: "Return/exchange policy",
};

const SUB_LABELS: Record<string, string> = { title: "title", description: "description", question: "question", answer: "answer" };

/** "faqs.2.question" → "FAQ #3 question". */
function describePath(path: readonly PropertyKey[]): string {
  const [field, index, sub] = path;
  const label = LABELS[String(field)] ?? String(field ?? "Settings");
  if (typeof index !== "number") return label;
  return `${label} #${index + 1}${sub != null ? ` ${SUB_LABELS[String(sub)] ?? String(sub)}` : ""}`;
}

/** Plain-English messages for the built-in checks (custom schema messages still win). */
const friendlyErrors: z.core.$ZodErrorMap = (issue) => {
  if (issue.code === "too_small") {
    if (issue.origin === "string") return Number(issue.minimum) <= 1 ? "Required" : `Must be at least ${issue.minimum} characters`;
    if (issue.origin === "number" || issue.origin === "int") return `Must be at least ${issue.minimum}`;
  }
  if (issue.code === "too_big") {
    if (issue.origin === "string") return `Must be at most ${issue.maximum} characters`;
    if (issue.origin === "number" || issue.origin === "int") return `Must be at most ${issue.maximum}`;
    if (issue.origin === "array") return `At most ${issue.maximum} items allowed`;
  }
  if (issue.code === "invalid_type" && (issue.expected === "number" || issue.expected === "int")) {
    return issue.input == null ? "Required" : "Must be a whole number";
  }
  return undefined;
};

export async function saveSiteSettings(input: SiteSettingsInput): Promise<ActionResult> {
  await requireOwner();
  const parsed = siteSettingsSchema.safeParse(input, { error: friendlyErrors });
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return {
      ok: false,
      error: issue ? `${describePath(issue.path)}: ${issue.message}` : "Invalid settings",
      fieldErrors: zodFieldErrors(parsed.error),
    };
  }

  try {
    await saveSettings(parsed.data);
  } catch (error) {
    console.error("[admin] saveSiteSettings failed", error);
    return { ok: false, error: "Could not save the settings. Please try again." };
  }

  updateTag(SETTINGS_TAG);
  revalidatePath("/", "layout");
  return { ok: true, message: "Settings saved. The store now shows the new values." };
}
