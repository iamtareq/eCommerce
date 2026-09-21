import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { orderToRow, SHEET_COLUMNS } from "@/lib/google-sheets/columns";
import { markSheetStale, syncOrderToSheet, syncPendingOrders } from "@/lib/google-sheets/sync";
import { updateOrderStatus } from "@/lib/orders/admin";
import { createOrder } from "@/lib/orders/create";
import { checkout, FakeSheet, resetDb, seedFixture, type Fixture } from "./helpers";

let f: Fixture;
let sheet: FakeSheet;

async function placeOrder(phone = "01712345678") {
  const r = await createOrder(checkout({ mobileNumber: phone, items: [{ variantId: f.frameSmall, quantity: 2 }, { variantId: f.box, quantity: 1 }] }));
  if (!r.ok) throw new Error(JSON.stringify(r));
  return r.order;
}

beforeEach(async () => {
  await resetDb();
  f = await seedFixture();
  sheet = new FakeSheet();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("Google Sheet sync", () => {
  it("writes one row with the required columns", async () => {
    const o = await placeOrder();
    const res = await syncOrderToSheet(o.id, { gateway: sheet });
    expect(res.outcome).toBe("synced");
    expect(sheet.count(o.orderNumber)).toBe(1);
    const row = sheet.rows[1]!;
    expect(row).toHaveLength(SHEET_COLUMNS.length);
    expect(row[0]).toBe(o.orderNumber);
    expect(row[3]).toBe("01712345678"); // leading zero kept (RAW string)
    expect(row[8]).toBe("Wall Frame (Small)\nGift Box");
    expect(row[9]).toBe("2\n1");
    expect(row[14]).toBe(o.totalAmount);
    expect(row[15]).toBe("Pending");
    const saved = await prisma.order.findUniqueOrThrow({ where: { id: o.id } });
    expect(saved.googleSheetSyncStatus).toBe("SYNCED");
    expect(saved.googleSheetRowReference).toBe("Orders!A2");
    expect(saved.googleSheetLastSyncAt).not.toBeNull();
  });

  it("does nothing when the order is already synced", async () => {
    const o = await placeOrder();
    await syncOrderToSheet(o.id, { gateway: sheet });
    const again = await syncOrderToSheet(o.id, { gateway: sheet });
    expect(again.outcome).toBe("up-to-date");
    expect(sheet.appends).toBe(1);
    expect(sheet.updates).toBe(0);
  });

  it("keeps the order when Google Sheets is down, then retries without duplicates", async () => {
    const o = await placeOrder();
    sheet.failNext = 1;
    const failed = await syncOrderToSheet(o.id, { gateway: sheet });
    expect(failed.outcome).toBe("failed");
    const afterFail = await prisma.order.findUniqueOrThrow({ where: { id: o.id } });
    expect(afterFail.googleSheetSyncStatus).toBe("FAILED");
    expect(afterFail.googleSheetSyncError).toContain("Simulated");
    expect(afterFail.googleSheetSyncLease).toBeNull();

    const retried = await syncOrderToSheet(o.id, { gateway: sheet });
    expect(retried.outcome).toBe("synced");
    expect(sheet.count(o.orderNumber)).toBe(1);
  });

  it("finds a row written by a crashed attempt instead of appending again", async () => {
    const o = await placeOrder();
    const order = await prisma.order.findUniqueOrThrow({ where: { id: o.id }, include: { items: true } });
    sheet.rows.push(orderToRow(order)); // row exists but DB still says PENDING
    const res = await syncOrderToSheet(o.id, { gateway: sheet });
    expect(res.outcome).toBe("synced");
    expect(sheet.appends).toBe(0);
    expect(sheet.updates).toBe(1);
    expect(sheet.count(o.orderNumber)).toBe(1);
  });

  it("updates the existing row when the status changes", async () => {
    const o = await placeOrder();
    await syncOrderToSheet(o.id, { gateway: sheet });
    const owner = await prisma.adminUser.create({ data: { username: "o", displayName: "O", passwordHash: "x", role: "OWNER" } });
    await updateOrderStatus(o.id, "CONFIRMED", { id: owner.id, username: "o", displayName: "O", role: "OWNER", sessionId: "s" });
    expect((await prisma.order.findUniqueOrThrow({ where: { id: o.id } })).googleSheetSyncStatus).toBe("PENDING");
    const res = await syncOrderToSheet(o.id, { gateway: sheet });
    expect(res.outcome).toBe("synced");
    expect(sheet.appends).toBe(1);
    expect(sheet.rows[1]![15]).toBe("Confirmed");
  });

  it("never appends twice when syncs race", async () => {
    const o = await placeOrder();
    sheet.delayMs = 30;
    const results = await Promise.all(Array.from({ length: 5 }, () => syncOrderToSheet(o.id, { gateway: sheet })));
    expect(results.filter((r) => r.outcome === "synced")).toHaveLength(1);
    expect(sheet.count(o.orderNumber)).toBe(1);
  });

  it("marks orders FAILED (not lost) when Sheets is not configured", async () => {
    const o = await placeOrder();
    const res = await syncOrderToSheet(o.id, { gateway: null });
    expect(res.outcome).toBe("not-configured");
    const saved = await prisma.order.findUniqueOrThrow({ where: { id: o.id } });
    expect(saved.googleSheetSyncStatus).toBe("FAILED");
    expect(saved.googleSheetSyncError).toMatch(/not configured/);
  });

  it("does not report 'synced' when the order changed during every round", async () => {
    const o = await placeOrder();
    sheet.onWrite = () => markSheetStale(prisma, o.id); // e.g. rapid status changes
    const res = await syncOrderToSheet(o.id, { gateway: sheet });
    expect(res.outcome).toBe("busy");
    const saved = await prisma.order.findUniqueOrThrow({ where: { id: o.id } });
    expect(saved.googleSheetSyncStatus).toBe("PENDING");
    expect(saved.googleSheetSyncLease).toBeNull();
    expect(saved.googleSheetSyncedVersion).toBeLessThan(saved.googleSheetVersion);

    sheet.onWrite = null;
    expect((await syncOrderToSheet(o.id, { gateway: sheet })).outcome).toBe("synced");
    expect(sheet.count(o.orderNumber)).toBe(1);
  });

  it("counts only consecutive failed attempts, so the cron keeps picking up busy orders", async () => {
    const o = await placeOrder();
    const owner = await prisma.adminUser.create({ data: { username: "o", displayName: "O", passwordHash: "x", role: "OWNER" } });
    const actor = { id: owner.id, username: "o", displayName: "O", role: "OWNER" as const, sessionId: "s" };
    const attempts = async () => (await prisma.order.findUniqueOrThrow({ where: { id: o.id } })).googleSheetSyncAttempts;

    sheet.failNext = 1;
    expect((await syncOrderToSheet(o.id, { gateway: sheet })).outcome).toBe("failed");
    expect(await attempts()).toBe(1);
    expect((await syncOrderToSheet(o.id, { gateway: sheet })).outcome).toBe("synced");
    expect(await attempts()).toBe(0);

    // A normal lifecycle, each change synced right away.
    for (const status of ["CONFIRMED", "PROCESSING", "SHIPPED"] as const) {
      await updateOrderStatus(o.id, status, actor);
      expect((await syncOrderToSheet(o.id, { gateway: sheet })).outcome).toBe("synced");
    }
    expect(await attempts()).toBe(0);

    // The next change is still eligible for an attempt-limited run (like the cron's).
    await updateOrderStatus(o.id, "DELIVERED", actor);
    const res = await syncPendingOrders({ gateway: sheet, maxAttempts: 2 });
    expect(res.processed).toBe(1);
    expect(res.synced).toBe(1);
    expect(sheet.rows[1]![15]).toBe("Delivered");
  });

  it("syncs every pending/failed order in bulk", async () => {
    const a = await placeOrder("01711111111");
    const b = await placeOrder("01722222222");
    sheet.failNext = 1;
    await syncOrderToSheet(a.id, { gateway: sheet }); // fails
    const res = await syncPendingOrders({ gateway: sheet });
    expect(res.processed).toBe(2);
    expect(res.synced).toBe(2);
    expect(sheet.count(a.orderNumber)).toBe(1);
    expect(sheet.count(b.orderNumber)).toBe(1);
    expect((await syncPendingOrders({ gateway: sheet })).processed).toBe(0);
  });
});
