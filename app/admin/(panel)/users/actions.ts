"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import type { ActionResult } from "@/lib/admin/common";
import { requireOwner } from "@/lib/auth/guard";
import { hashPassword, passwordProblem } from "@/lib/auth/password";
import { revokeUserSessions } from "@/lib/auth/session";
import { isUniqueViolation, prisma } from "@/lib/db";

const displayName = z
  .string()
  .trim()
  .min(1, { error: "Display name is required" })
  .max(60, { error: "Display name must be at most 60 characters" });
const role = z.enum(["OWNER", "STAFF"], { error: "Choose a role" });

const createSchema = z.object({
  username: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9._-]{3,40}$/, { error: "Username must be 3–40 characters: lowercase English letters, numbers, dot (.), dash (-) or underscore (_)." }),
  displayName,
  role,
  password: z.string().max(200, { error: "Password must be at most 128 characters." }),
});

export type CreateUserInput = z.input<typeof createSchema>;

const updateSchema = z.object({
  id: z.string().min(1).max(40),
  displayName,
  role,
  isActive: z.boolean(),
  /** Empty = keep the current password. */
  newPassword: z.string().max(200, { error: "Password must be at most 128 characters." }).default(""),
});

export type UpdateUserInput = z.input<typeof updateSchema>;

class UserFacingError extends Error {}

/** Serializable transactions can abort when two owners change users at the same moment. */
function isWriteConflict(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034";
}

export async function createAdminUser(input: CreateUserInput): Promise<ActionResult> {
  await requireOwner();
  const parsed = createSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const { username, password } = parsed.data;

  const problem = passwordProblem(password);
  if (problem) return { ok: false, error: problem };

  const taken = await prisma.adminUser.findUnique({ where: { username }, select: { id: true } });
  if (taken) return { ok: false, error: `The username “${username}” is already taken.` };

  try {
    await prisma.adminUser.create({
      data: {
        username,
        displayName: parsed.data.displayName,
        role: parsed.data.role,
        passwordHash: await hashPassword(password),
      },
    });
  } catch (error) {
    if (isUniqueViolation(error)) return { ok: false, error: `The username “${username}” is already taken.` };
    console.error("[admin] createAdminUser failed", error);
    return { ok: false, error: "Could not create the user. Please try again." };
  }

  revalidatePath("/admin/users");
  return {
    ok: true,
    message: `User “${username}” created. Share the password with them privately — they can change it under My account.`,
  };
}

/**
 * Updates another admin (or your own display name). Guard rails: you cannot
 * deactivate or demote yourself, and at least one active owner must remain.
 * Deactivating a user or resetting their password signs them out everywhere.
 */
export async function updateAdminUser(input: UpdateUserInput): Promise<ActionResult> {
  const me = await requireOwner();
  const parsed = updateSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const { id, role: newRole, isActive, newPassword } = parsed.data;

  const isSelf = id === me.id;
  if (isSelf && !isActive) return { ok: false, error: "You cannot deactivate your own account." };
  if (isSelf && newRole !== "OWNER") return { ok: false, error: "You cannot remove your own owner role. Another owner can do it." };

  const resetPassword = newPassword.length > 0;
  if (resetPassword) {
    if (isSelf) return { ok: false, error: "Change your own password under My account (it asks for your current password)." };
    const problem = passwordProblem(newPassword);
    if (problem) return { ok: false, error: problem };
  }
  const passwordHash = resetPassword ? await hashPassword(newPassword) : null;

  try {
    const outcome = await prisma.$transaction(
      async (tx) => {
        const user = await tx.adminUser.findUnique({ where: { id }, select: { username: true, role: true, isActive: true } });
        if (!user) throw new UserFacingError("User not found. Reload the page.");

        const losesOwner = user.role === "OWNER" && user.isActive && (newRole !== "OWNER" || !isActive);
        if (losesOwner) {
          const otherOwners = await tx.adminUser.count({ where: { role: "OWNER", isActive: true, id: { not: id } } });
          if (otherOwners === 0) throw new UserFacingError("There must always be at least one active owner. Make someone else an owner first.");
        }

        await tx.adminUser.update({
          where: { id },
          data: {
            displayName: parsed.data.displayName,
            role: newRole,
            isActive,
            ...(passwordHash ? { passwordHash } : {}),
          },
        });
        return { username: user.username, deactivated: user.isActive && !isActive, reactivated: !user.isActive && isActive };
      },
      { isolationLevel: "Serializable" },
    );

    if (!isActive || resetPassword) await revokeUserSessions(id);
    revalidatePath("/admin/users");

    const notes = [`Saved “${outcome.username}”.`];
    if (outcome.deactivated) notes.push("The account is deactivated and has been signed out everywhere.");
    else if (resetPassword) notes.push("Password reset — they have been signed out everywhere and must sign in with the new password.");
    if (outcome.reactivated) notes.push("The account can sign in again.");
    return { ok: true, message: notes.join(" ") };
  } catch (error) {
    if (error instanceof UserFacingError) return { ok: false, error: error.message };
    if (isWriteConflict(error)) return { ok: false, error: "Another change was saved at the same time. Reload the page and try again." };
    console.error("[admin] updateAdminUser failed", error);
    return { ok: false, error: "Could not save the user. Please try again." };
  }
}
