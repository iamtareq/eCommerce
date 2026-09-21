/**
 * Create an admin account, or reset its password.
 *
 *   npm run admin:create                       # uses ADMIN_USERNAME / ADMIN_PASSWORD from .env
 *   npm run admin:create -- tareq "S3cure-pass" # explicit username and password
 *   npm run admin:create -- tareq "S3cure-pass" --staff
 *
 * If the username exists, its password is reset and all its sessions are signed out.
 */
import "dotenv/config";
import { hashPassword, passwordProblem } from "../lib/auth/password";
import { prisma } from "../lib/db";

async function main() {
  const args = process.argv.slice(2).filter((a) => !a.startsWith("--"));
  const staff = process.argv.includes("--staff");
  const username = (args[0] ?? process.env.ADMIN_USERNAME ?? "").trim().toLowerCase();
  const password = args[1] ?? process.env.ADMIN_PASSWORD ?? "";

  if (!/^[a-z0-9._-]{3,40}$/.test(username)) {
    throw new Error("Username must be 3–40 characters: lowercase letters, numbers, dot, dash or underscore.");
  }
  const problem = passwordProblem(password);
  if (problem) throw new Error(problem);

  const passwordHash = await hashPassword(password);
  const existing = await prisma.adminUser.findUnique({ where: { username } });
  if (existing) {
    await prisma.adminUser.update({ where: { id: existing.id }, data: { passwordHash, isActive: true } });
    await prisma.adminSession.deleteMany({ where: { userId: existing.id } });
    console.log(`Password reset for "${username}" (all sessions signed out).`);
  } else {
    await prisma.adminUser.create({
      data: { username, displayName: username, passwordHash, role: staff ? "STAFF" : "OWNER" },
    });
    console.log(`Created ${staff ? "staff" : "owner"} account "${username}".`);
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e instanceof Error ? e.message : e);
    await prisma.$disconnect();
    process.exit(1);
  });
