/**
 * Base seed — safe to run repeatedly; it never overwrites existing data.
 *
 *  • Delivery zones: "ঢাকা সিটির ভেতরে" (the 50 Dhaka city thanas) and
 *    "ঢাকা সিটির বাইরে" (default for everywhere else). Charges start at ৳0
 *    unless SEED_DELIVERY_INSIDE / SEED_DELIVERY_OUTSIDE are set — set the real
 *    charges in Admin → Delivery.
 *  • First owner account from ADMIN_USERNAME / ADMIN_PASSWORD (only if no admin exists).
 *
 * Run: npm run db:seed
 */
import "dotenv/config";
import { hashPassword, passwordProblem } from "../lib/auth/password";
import { prisma } from "../lib/db";
import { getLocationData } from "../lib/locations.server";

function envInt(name: string): number | null {
  const raw = process.env[name]?.trim();
  if (!raw) return null;
  const n = Number(raw);
  return Number.isInteger(n) && n >= 0 ? n : null;
}

async function seedDeliveryZones() {
  if ((await prisma.deliveryZone.count()) > 0) {
    console.log("• Delivery zones already exist — skipped");
    return;
  }
  const inside = envInt("SEED_DELIVERY_INSIDE");
  const outside = envInt("SEED_DELIVERY_OUTSIDE");
  const dhakaCity = getLocationData().areas.filter((a) => a.type === "city" && a.districtId === "dhaka");

  await prisma.$transaction(async (tx) => {
    const insideZone = await tx.deliveryZone.create({
      data: { name: "ঢাকা সিটির ভেতরে", charge: inside ?? 0, sortOrder: 0, isDefault: false },
    });
    await tx.deliveryZone.create({
      data: { name: "ঢাকা সিটির বাইরে", charge: outside ?? 0, sortOrder: 1, isDefault: true },
    });
    await tx.deliveryZoneArea.createMany({
      data: dhakaCity.map((a) => ({ zoneId: insideZone.id, districtId: "dhaka", areaId: a.id })),
    });
  });
  console.log(`• Created delivery zones (Dhaka city: ${dhakaCity.length} thanas).`);
  if (inside == null || outside == null) {
    console.warn("  ⚠ Delivery charges are ৳0 — set the real charges in Admin → Delivery before going live.");
  }
}

async function seedOwner() {
  if ((await prisma.adminUser.count()) > 0) {
    console.log("• Admin users already exist — skipped");
    return;
  }
  const username = process.env.ADMIN_USERNAME?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD ?? "";
  if (!username || !password) {
    console.warn("  ⚠ No admin user yet. Set ADMIN_USERNAME and ADMIN_PASSWORD, then run `npm run admin:create`.");
    return;
  }
  const problem = passwordProblem(password);
  if (problem) {
    console.warn(`  ⚠ ADMIN_PASSWORD rejected: ${problem} Owner not created.`);
    return;
  }
  await prisma.adminUser.create({
    data: { username, displayName: username, passwordHash: await hashPassword(password), role: "OWNER" },
  });
  console.log(`• Created owner account "${username}". You can now remove ADMIN_PASSWORD from .env.`);
}

async function main() {
  await seedDeliveryZones();
  await seedOwner();
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
