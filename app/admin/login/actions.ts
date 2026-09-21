"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { verifyPassword } from "@/lib/auth/password";
import { createSession, destroySession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { LIMITS, rateLimit, resetRateLimit } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/request";
import { hashIp, keyedHash, randomToken, safeEqual } from "@/lib/security";

/** `username` is echoed back so a failed sign-in keeps the username field filled in. */
export type LoginState = { error: string; username?: string } | null;

const schema = z.object({
  username: z.string().trim().toLowerCase().min(1).max(60),
  password: z.string().min(1).max(200),
});

const GENERIC = "Invalid username or password.";
const TOO_MANY = "Too many login attempts. Please wait 15 minutes and try again.";
const ACCOUNT_BUSY =
  "Too many failed sign-ins for this account. Please try again in an hour, or use a browser you have signed in with before.";

const DEVICE_COOKIE_MAX_AGE = 180 * 24 * 60 * 60; // seconds

/** One cookie per account, so several admins can share a browser. Hashed so the username is not visible. */
function deviceCookieName(username: string): string {
  return `dbx_dev_${keyedHash(`login-device-name:${username}`).slice(0, 16)}`;
}

/**
 * Signed together with the account's current password hash, so changing or resetting
 * the password retires every remembered browser: someone who once knew an old password
 * cannot keep cookies that skip the other limits.
 */
function deviceSignature(username: string, deviceId: string, passwordHash: string): string {
  return keyedHash(`login-device:${username}:${deviceId}:${passwordHash}`);
}

/** Device id from a valid "signed in to this account here before" cookie, or null. */
function knownDeviceId(
  jar: Awaited<ReturnType<typeof cookies>>,
  username: string,
  passwordHash: string | null,
): string | null {
  if (!passwordHash) return null;
  const value = jar.get(deviceCookieName(username))?.value;
  if (!value || value.length > 200) return null;
  const [deviceId, signature] = value.split(".");
  if (!deviceId || !signature) return null;
  return safeEqual(signature, deviceSignature(username, deviceId, passwordHash)) ? deviceId : null;
}

export async function loginAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const typed = formData.get("username");
  const echo = typeof typed === "string" ? typed.slice(0, 60) : undefined;
  const parsed = schema.safeParse({ username: typed, password: formData.get("password") });
  if (!parsed.success) return { error: GENERIC, username: echo };
  const { username, password } = parsed.data;

  const h = await headers();
  const jar = await cookies();
  const ipHash = hashIp(getClientIp(h));

  // Brute-force limits that nobody else can use to lock an admin out. A browser that
  // has signed in to this account (with its current password) before has its own
  // allowance, which only its own attempts use up. Other browsers are limited per IP,
  // per account and IP, and by a looser per-account backstop that only counts attempts
  // the per-IP limits let through.
  const user = await prisma.adminUser.findUnique({ where: { username } });
  const passwordHash = user?.isActive ? user.passwordHash : null;
  const deviceId = knownDeviceId(jar, username, passwordHash);
  const attemptKey = deviceId ? `login:device:${deviceId}` : `login:user:${username}:ip:${ipHash}`;
  if (deviceId) {
    const byDevice = await rateLimit(attemptKey, LIMITS.loginPerDevice.limit, LIMITS.loginPerDevice.windowMs);
    if (!byDevice.ok) return { error: TOO_MANY, username: echo };
  } else {
    const [byIp, byUserIp] = await Promise.all([
      rateLimit(`login:ip:${ipHash}`, LIMITS.loginPerIp.limit, LIMITS.loginPerIp.windowMs),
      rateLimit(attemptKey, LIMITS.loginPerUserIp.limit, LIMITS.loginPerUserIp.windowMs),
    ]);
    if (!byIp.ok || !byUserIp.ok) return { error: TOO_MANY, username: echo };
    const byUser = await rateLimit(`login:user:${username}`, LIMITS.loginPerUser.limit, LIMITS.loginPerUser.windowMs);
    if (!byUser.ok) return { error: ACCOUNT_BUSY, username: echo };
  }

  const valid = await verifyPassword(password, passwordHash);
  if (!user || !passwordHash || !valid) return { error: GENERIC, username: echo };

  // The per-account backstop is not reset here: that would hand a distributed guesser a fresh allowance.
  await resetRateLimit(attemptKey);
  const device = deviceId ?? randomToken(16);
  jar.set(deviceCookieName(username), `${device}.${deviceSignature(username, device, passwordHash)}`, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/admin/login",
    maxAge: DEVICE_COOKIE_MAX_AGE,
  });
  await createSession(user.id, { ipHash, userAgent: h.get("user-agent") });
  await prisma.adminUser.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  redirect("/admin");
}

export async function logoutAction(): Promise<void> {
  await destroySession();
  redirect("/admin/login");
}
