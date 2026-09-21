"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionResult } from "@/lib/admin/common";
import { requireAdmin } from "@/lib/auth/guard";
import { hashPassword, passwordProblem, verifyPassword } from "@/lib/auth/password";
import { revokeUserSessions } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { rateLimit, resetRateLimit } from "@/lib/rate-limit";

const displayNameSchema = z
  .string()
  .trim()
  .min(1, { error: "Display name is required" })
  .max(60, { error: "Display name must be at most 60 characters" });

export async function updateMyDisplayName(displayName: string): Promise<ActionResult> {
  const admin = await requireAdmin();
  const parsed = displayNameSchema.safeParse(displayName);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid name" };

  await prisma.adminUser.update({ where: { id: admin.id }, data: { displayName: parsed.data } });
  // The sidebar shows the name on every admin page.
  revalidatePath("/admin", "layout");
  return { ok: true, message: "Display name updated." };
}

const passwordSchema = z.object({
  currentPassword: z.string().min(1, { error: "Enter your current password." }).max(200),
  newPassword: z.string().max(200, { error: "Password must be at most 128 characters." }),
  confirmPassword: z.string().max(200),
});

export type ChangePasswordInput = z.input<typeof passwordSchema>;

const ATTEMPTS = { limit: 5, windowMs: 15 * 60 * 1000 };

/** Changes the signed-in admin's password and signs out their other sessions. */
export async function changeMyPassword(input: ChangePasswordInput): Promise<ActionResult> {
  const admin = await requireAdmin();
  const parsed = passwordSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const { currentPassword, newPassword, confirmPassword } = parsed.data;

  if (newPassword !== confirmPassword) {
    return { ok: false, error: "The new passwords do not match.", fieldErrors: { confirmPassword: "Does not match the new password" } };
  }
  const problem = passwordProblem(newPassword);
  if (problem) return { ok: false, error: problem, fieldErrors: { newPassword: problem } };
  if (newPassword === currentPassword) {
    return { ok: false, error: "Choose a new password that is different from the current one.", fieldErrors: { newPassword: "Same as the current password" } };
  }

  // Limits guessing the current password from a stolen, still-signed-in session.
  const key = `pwchange:${admin.id}`;
  const limited = await rateLimit(key, ATTEMPTS.limit, ATTEMPTS.windowMs);
  if (!limited.ok) return { ok: false, error: "Too many attempts. Please wait 15 minutes and try again." };

  const user = await prisma.adminUser.findUnique({ where: { id: admin.id }, select: { passwordHash: true } });
  if (!(await verifyPassword(currentPassword, user?.passwordHash))) {
    return { ok: false, error: "Your current password is incorrect.", fieldErrors: { currentPassword: "Incorrect password" } };
  }

  await prisma.adminUser.update({ where: { id: admin.id }, data: { passwordHash: await hashPassword(newPassword) } });
  await revokeUserSessions(admin.id, admin.sessionId);
  await resetRateLimit(key);
  revalidatePath("/admin/account");
  return { ok: true, message: "Password changed. You stay signed in here; all your other devices have been signed out." };
}
