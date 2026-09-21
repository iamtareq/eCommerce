import "server-only";
import { cookies } from "next/headers";
import { cache } from "react";
import type { AdminRole } from "@/generated/prisma/enums";
import { prisma } from "@/lib/db";
import { randomToken, sha256 } from "@/lib/security";

export const SESSION_COOKIE = "dbx_admin";
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const TOUCH_INTERVAL_MS = 10 * 60 * 1000;

export interface AdminIdentity {
  id: string;
  username: string;
  displayName: string;
  role: AdminRole;
  sessionId: string;
}

/**
 * Creates a database-backed session and sets it as an HTTP-only cookie.
 * Only a SHA-256 hash of the token is stored, so a database leak does not
 * expose usable session tokens.
 */
export async function createSession(userId: string, meta: { ipHash?: string; userAgent?: string | null }): Promise<void> {
  const token = randomToken(32);
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await prisma.adminSession.create({
    data: {
      tokenHash: sha256(token),
      userId,
      expiresAt,
      ipHash: meta.ipHash ?? null,
      userAgent: meta.userAgent?.slice(0, 300) ?? null,
    },
  });
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
    priority: "high",
  });
}

/** Current admin for this request, or null. Cached per request. */
export const getCurrentAdmin = cache(async (): Promise<AdminIdentity | null> => {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token || token.length > 200) return null;
  const session = await prisma.adminSession.findUnique({
    where: { tokenHash: sha256(token) },
    include: { user: { select: { id: true, username: true, displayName: true, role: true, isActive: true } } },
  });
  if (!session) return null;
  const now = Date.now();
  if (session.expiresAt.getTime() <= now || !session.user.isActive) {
    await prisma.adminSession.delete({ where: { id: session.id } }).catch(() => {});
    return null;
  }
  if (now - session.lastSeenAt.getTime() > TOUCH_INTERVAL_MS) {
    await prisma.adminSession.update({ where: { id: session.id }, data: { lastSeenAt: new Date() } }).catch(() => {});
  }
  return {
    id: session.user.id,
    username: session.user.username,
    displayName: session.user.displayName,
    role: session.user.role,
    sessionId: session.id,
  };
});

/** Deletes the current session and clears the cookie. */
export async function destroySession(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await prisma.adminSession.deleteMany({ where: { tokenHash: sha256(token) } });
  jar.delete(SESSION_COOKIE);
}

/** Signs a user out everywhere (after password change or deactivation). */
export async function revokeUserSessions(userId: string, exceptSessionId?: string): Promise<void> {
  await prisma.adminSession.deleteMany({
    where: { userId, ...(exceptSessionId ? { id: { not: exceptSessionId } } : {}) },
  });
}
