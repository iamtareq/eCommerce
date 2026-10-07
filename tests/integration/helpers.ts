import { prisma } from "@/lib/db";
import type { SheetGateway } from "@/lib/google-sheets/sync";
import type { CellValue } from "@/lib/google-sheets/client";
import type { CheckoutData } from "@/lib/validation/checkout";

if (!process.env.TEST_DATABASE_URL) {
  throw new Error("Integration tests need TEST_DATABASE_URL (a separate, disposable database).");
}
if (process.env.DATABASE_URL !== process.env.TEST_DATABASE_URL) {
  throw new Error("Refusing to run integration tests against a non-test database.");
}

export async function resetDb() {
  const tables = await prisma.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
  const list = tables.map((t) => `"public"."${t.tablename}"`).join(", ");
  if (list) await prisma.$executeRawUnsafe(`TRUNCATE ${list} RESTART IDENTITY CASCADE`);
}

export interface Fixture {
  insideZoneId: string;
  outsideZoneId: string;
  frameSmall: string;
  frameLarge: string;
  box: string;
  frameProductId: string;
}

/** Zones: Dhaka city (Dhanmondi, Mirpur) ৳70, default ৳130. Products with stock and a 2+ tier. */
export async function seedFixture(): Promise<Fixture> {
  const inside = await prisma.deliveryZone.create({ data: { name: "ঢাকা সিটির ভেতরে", charge: 70 } });
  const outside = await prisma.deliveryZone.create({ data: { name: "ঢাকা সিটির বাইরে", charge: 130, isDefault: true } });
  await prisma.deliveryZoneArea.createMany({
    data: [
      { zoneId: inside.id, districtId: "dhaka", areaId: "dhaka-city-dhanmondi" },
      { zoneId: inside.id, districtId: "dhaka", areaId: "dhaka-city-mirpur" },
    ],
  });
  const frame = await prisma.product.create({
    data: {
      slug: "wall-frame",
      name: "Wall Frame",
      status: "ACTIVE",
      maxPerOrder: 5,
      variants: {
        create: [
          { name: "Small", price: 1000, compareAtPrice: 1200, stock: 10, sortOrder: 0 },
          { name: "Large", price: 1500, stock: 2, sortOrder: 1 },
        ],
      },
      quantityDiscounts: { create: [{ minQuantity: 2, type: "PERCENT", value: 10 }] },
    },
    include: { variants: { orderBy: { sortOrder: "asc" } } },
  });
  const box = await prisma.product.create({
    data: { slug: "gift-box", name: "Gift Box", status: "ACTIVE", variants: { create: [{ name: "", price: 800, stock: null }] } },
    include: { variants: true },
  });
  return {
    insideZoneId: inside.id,
    outsideZoneId: outside.id,
    frameSmall: frame.variants[0]!.id,
    frameLarge: frame.variants[1]!.id,
    box: box.variants[0]!.id,
    frameProductId: frame.id,
  };
}

let keyCounter = 0;
export function checkout(overrides: Partial<CheckoutData> = {}): CheckoutData {
  keyCounter += 1;
  return {
    customerName: "Abdullah Rahman",
    mobileNumber: "01712345678",
    divisionId: "dhaka",
    districtId: "dhaka",
    areaId: "dhaka-city-dhanmondi",
    areaOther: undefined,
    address: "House 12, Road 5, Dhanmondi",
    customerNote: undefined,
    couponCode: undefined,
    items: [],
    idempotencyKey: `test-key-${Date.now()}-${keyCounter}-abcdef`,
    ...overrides,
  };
}

/** In-memory Google Sheet used to test sync behaviour without the network. */
export class FakeSheet implements SheetGateway {
  rows: CellValue[][] = [["Order Number"]];
  failNext = 0;
  appends = 0;
  updates = 0;
  /** Lookups that had to read the whole order-number column. */
  scans = 0;
  delayMs = 0;
  /** Runs after every successful write, e.g. to change the order mid-sync. */
  onWrite: (() => Promise<void>) | null = null;

  private async maybeFail() {
    if (this.delayMs) await new Promise((r) => setTimeout(r, this.delayMs));
    if (this.failNext > 0) {
      this.failNext -= 1;
      throw new Error("Simulated Google Sheets outage");
    }
  }
  async findRow(orderNumber: string, hint: number | null) {
    await this.maybeFail();
    if (hint && this.rows[hint - 1]?.[0] === orderNumber) return hint;
    this.scans += 1;
    const index = this.rows.findIndex((r) => r[0] === orderNumber);
    return index >= 0 ? index + 1 : null;
  }
  async updateRow(row: number, values: CellValue[]) {
    await this.maybeFail();
    this.rows[row - 1] = values;
    this.updates += 1;
    await this.onWrite?.();
  }
  async appendRow(values: CellValue[]) {
    await this.maybeFail();
    this.rows.push(values);
    this.appends += 1;
    await this.onWrite?.();
    return this.rows.length;
  }
  describe(row: number) {
    return `Orders!A${row}`;
  }
  count(orderNumber: string) {
    return this.rows.filter((r) => r[0] === orderNumber).length;
  }
}
