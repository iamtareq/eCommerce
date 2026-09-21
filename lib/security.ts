import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function appSecret(): string {
  const secret = process.env.APP_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("APP_SECRET must be set to a random string of at least 32 characters.");
  }
  return secret;
}

/** Keyed hash (HMAC-SHA256) using APP_SECRET. */
export function keyedHash(value: string): string {
  return createHmac("sha256", appSecret()).update(value).digest("hex");
}

/** Pseudonymous IP identifier: lets us rate-limit and spot abuse without storing raw IPs. */
export function hashIp(ip: string): string {
  return keyedHash(`ip:${ip}`).slice(0, 32);
}

/** URL-safe random token. */
export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

/** Constant-time string comparison. */
export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}
