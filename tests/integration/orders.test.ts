import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { dhakaDateKey } from "@/lib/dates";
import { createOrder } from "@/lib/orders/create";
import { buildQuote } from "@/lib/orders/quote";
import { OrderUpdateError, updateOrderStatus, listOrders } from "@/lib/orders/admin";
import { findOrderTokenForTracking } from "@/lib/orders/public";
import { saveSettings, siteSettingsSchema } from "@/lib/settings";
import { checkoutSchema } from "@/lib/validation/checkout";
import { checkout, resetDb, seedFixture, type Fixture } from "./helpers";

let f: Fixture;
const actor = { id: "", username: "owner", displayName: "Owner", role: "OWNER" as const, sessionId: "s" };

beforeEach(async () => {
  await resetDb();
  f = await seedFixture();
  const owner = await prisma.adminUser.create({ data: { username: "owner", displayName: "Owner", passwordHash: "x", role: "OWNER" } });
  actor.id = owner.id;
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("createOrder", () => {
  it("saves an order with server-side prices, delivery and discounts", async () => {
    const r = await createOrder(checkout({ items: [{ variantId: f.frameSmall, quantity: 2 }, { variantId: f.box, quantity: 1 }] }));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const order = await prisma.order.findUniqueOrThrow({ where: { id: r.order.id }, include: { items: true, events: true } });
    expect(order.subtotal).toBe(2 * 1000 + 800);
    expect(order.quantityDiscount).toBe(200); // 10% of the frame group (2000)
    expect(order.deliveryCharge).toBe(70); // Dhanmondi → inside Dhaka city
    expect(order.deliveryZoneName).toBe("ঢাকা সিটির ভেতরে");
    expect(order.totalAmount).toBe(2800 - 200 + 70);
    expect(order.orderNumber).toMatch(new RegExp(`^DBX-${dhakaDateKey()}-0001$`));
    expect(order.orderStatus).toBe("PENDING");
    expect(order.googleSheetSyncStatus).toBe("PENDING");
    expect(order.division).toBe("ঢাকা");
    expect(order.area).toBe("ধানমন্ডি");
    expect(order.items).toHaveLength(2);
    expect(order.events[0]?.type).toBe("CREATED");
    expect(order.publicToken.length).toBeGreaterThanOrEqual(24);
    const small = await prisma.productVariant.findUniqueOrThrow({ where: { id: f.frameSmall } });
    expect(small.stock).toBe(8);
    expect(r.stockChanged).toBe(true);
    expect(Object.fromEntries(order.items.map((i) => [i.variantId, i.stockReserved]))).toEqual({
      [f.frameSmall]: true,
      [f.box]: false, // stock not tracked, nothing taken
    });
  });

  it("ignores prices sent by the browser", () => {
    const tampered = { ...checkout({ items: [{ variantId: f.box, quantity: 1 }] }), price: 1, total: 1, deliveryCharge: 0, discount: 9999 };
    const parsed = checkoutSchema.parse(tampered);
    expect(parsed).not.toHaveProperty("price");
    expect(parsed).not.toHaveProperty("total");
    expect(parsed).not.toHaveProperty("discount");
  });

  it("uses the default zone outside Dhaka city", async () => {
    const r = await createOrder(
      checkout({ districtId: "gazipur", areaId: "gazipur-gazipur-sadar", items: [{ variantId: f.box, quantity: 1 }] }),
    );
    if (!r.ok) throw new Error(JSON.stringify(r));
    const order = await prisma.order.findUniqueOrThrow({ where: { id: r.order.id } });
    expect(order.deliveryCharge).toBe(130);
    expect(order.totalAmount).toBe(930);
  });

  it("is idempotent — the same key never creates two orders, even concurrently", async () => {
    const data = checkout({ items: [{ variantId: f.box, quantity: 1 }] });
    const results = await Promise.all(Array.from({ length: 6 }, () => createOrder(data)));
    const ids = new Set(results.map((r) => (r.ok ? r.order.id : "fail")));
    expect(ids.size).toBe(1);
    expect(results.filter((r) => r.ok && !r.duplicate)).toHaveLength(1);
    expect(await prisma.order.count()).toBe(1);
  });

  it("a same-key retry gets the order even when that order took the last units and coupon use", async () => {
    await prisma.coupon.create({ data: { code: "LAST", type: "FIXED", value: 50, usageLimit: 1 } });
    // frameLarge has stock 2: the first request takes all of it and the only coupon use.
    const data = checkout({ couponCode: "LAST", items: [{ variantId: f.frameLarge, quantity: 2 }] });
    const results = await Promise.all(Array.from({ length: 4 }, () => createOrder(data)));
    expect(results.every((r) => r.ok)).toBe(true);
    expect(new Set(results.map((r) => (r.ok ? r.order.id : "fail"))).size).toBe(1);
    expect(results.filter((r) => r.ok && !r.duplicate)).toHaveLength(1);
    expect(results.filter((r) => r.ok && r.stockChanged)).toHaveLength(1);
    expect((await prisma.productVariant.findUniqueOrThrow({ where: { id: f.frameLarge } })).stock).toBe(0);
    expect((await prisma.coupon.findUniqueOrThrow({ where: { code: "LAST" } })).usedCount).toBe(1);
  });

  it("does not deadlock when concurrent orders list the same variants in opposite order", async () => {
    await prisma.productVariant.updateMany({ where: { id: { in: [f.frameSmall, f.frameLarge] } }, data: { stock: 100 } });
    const ab = [{ variantId: f.frameSmall, quantity: 1 }, { variantId: f.frameLarge, quantity: 1 }];
    const ba = [...ab].reverse();
    const results = await Promise.all(
      Array.from({ length: 8 }, (_, i) => createOrder(checkout({ mobileNumber: `0181000000${i}`, items: i % 2 ? ab : ba }))),
    );
    expect(results.filter((r) => r.ok)).toHaveLength(8);
    const variants = await prisma.productVariant.findMany({ where: { id: { in: [f.frameSmall, f.frameLarge] } } });
    expect(variants.map((v) => v.stock)).toEqual([92, 92]);
  });

  it("allocates unique sequential order numbers under concurrency", async () => {
    const results = await Promise.all(
      Array.from({ length: 10 }, (_, i) =>
        createOrder(checkout({ mobileNumber: `0171000000${i}`, items: [{ variantId: f.box, quantity: 1 }] })),
      ),
    );
    const numbers = results.map((r) => (r.ok ? r.order.orderNumber : "")).sort();
    expect(new Set(numbers).size).toBe(10);
    expect(numbers[0]).toMatch(/-0001$/);
    expect(numbers[9]).toMatch(/-0010$/);
  });

  it("never oversells the last units", async () => {
    // Large has stock 2 → two concurrent orders of 2 each: exactly one succeeds.
    const results = await Promise.all([
      createOrder(checkout({ mobileNumber: "01811111111", items: [{ variantId: f.frameLarge, quantity: 2 }] })),
      createOrder(checkout({ mobileNumber: "01822222222", items: [{ variantId: f.frameLarge, quantity: 2 }] })),
    ]);
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    const failed = results.find((r) => !r.ok);
    expect(failed && !failed.ok && failed.code).toBe("CART");
    const large = await prisma.productVariant.findUniqueOrThrow({ where: { id: f.frameLarge } });
    expect(large.stock).toBe(0);
  });

  it("rejects quantities over stock or the per-product limit", async () => {
    const overStock = await createOrder(checkout({ items: [{ variantId: f.frameLarge, quantity: 3 }] }));
    expect(overStock.ok).toBe(false);
    expect(!overStock.ok && overStock.code).toBe("CART");
    const overMax = await createOrder(checkout({ items: [{ variantId: f.frameSmall, quantity: 4 }, { variantId: f.frameLarge, quantity: 2 }] }));
    expect(!overMax.ok && overMax.code).toBe("CART"); // 6 frames > maxPerOrder 5
    expect(await prisma.order.count()).toBe(0);
  });

  it("rejects inconsistent locations", async () => {
    const r = await createOrder(checkout({ divisionId: "sylhet", items: [{ variantId: f.box, quantity: 1 }] }));
    expect(!r.ok && r.code).toBe("INVALID");
  });

  it("refuses to save a total different from what the customer confirmed", async () => {
    const r = await createOrder(checkout({ items: [{ variantId: f.box, quantity: 1 }] }), { expectedTotal: 1 });
    expect(!r.ok && r.code).toBe("PRICE_CHANGED");
    expect(await prisma.order.count()).toBe(0);
  });

  it("applies coupons and enforces usage limits", async () => {
    await prisma.coupon.create({ data: { code: "EID10", type: "PERCENT", value: 10, usageLimit: 1 } });
    const first = await createOrder(checkout({ couponCode: "EID10", items: [{ variantId: f.box, quantity: 1 }] }));
    if (!first.ok) throw new Error(JSON.stringify(first));
    const o = await prisma.order.findUniqueOrThrow({ where: { id: first.order.id } });
    expect(o.couponDiscount).toBe(80);
    expect(o.totalAmount).toBe(800 - 80 + 70);
    const second = await createOrder(checkout({ mobileNumber: "01999999999", couponCode: "EID10", items: [{ variantId: f.box, quantity: 1 }] }));
    expect(!second.ok && second.code).toBe("INVALID");
    expect((await prisma.coupon.findUniqueOrThrow({ where: { code: "EID10" } })).usedCount).toBe(1);
  });

  it("enforces the per-phone coupon limit for simultaneous orders", async () => {
    await prisma.coupon.create({ data: { code: "ONCE", type: "FIXED", value: 50, perPhoneLimit: 1 } });
    // Same phone, different idempotency keys, submitted at the same time.
    const results = await Promise.all(
      Array.from({ length: 4 }, () => createOrder(checkout({ couponCode: "ONCE", items: [{ variantId: f.box, quantity: 1 }] }))),
    );
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    for (const r of results.filter((x) => !x.ok)) {
      expect(!r.ok && r.code).toBe("INVALID");
      expect(!r.ok && r.message).toBe("এই মোবাইল নম্বর থেকে কুপনটি আর ব্যবহার করা যাবে না।");
    }
    expect(await prisma.order.count()).toBe(1);
    expect((await prisma.coupon.findUniqueOrThrow({ where: { code: "ONCE" } })).usedCount).toBe(1);
  });

  it("flags simultaneous repeat orders from the same phone", async () => {
    const results = await Promise.all(
      Array.from({ length: 3 }, () => createOrder(checkout({ items: [{ variantId: f.box, quantity: 1 }] }))),
    );
    expect(results.every((r) => r.ok)).toBe(true);
    const orders = await prisma.order.findMany({ orderBy: { orderNumber: "asc" } });
    expect(orders.map((o) => o.isFlagged)).toEqual([false, true, true]);
  });

  it("flags repeat orders from the same phone", async () => {
    const a = await createOrder(checkout({ items: [{ variantId: f.box, quantity: 1 }] }));
    const b = await createOrder(checkout({ items: [{ variantId: f.box, quantity: 1 }] }));
    if (!a.ok || !b.ok) throw new Error("orders failed");
    expect((await prisma.order.findUniqueOrThrow({ where: { id: a.order.id } })).isFlagged).toBe(false);
    const second = await prisma.order.findUniqueOrThrow({ where: { id: b.order.id } });
    expect(second.isFlagged).toBe(true);
    expect(second.flagReason).toMatch(/1 other order/);
  });

  it("stops taking orders when the store is closed", async () => {
    await saveSettings(siteSettingsSchema.parse({ acceptingOrders: false, closedMessage: "ঈদের ছুটি" }));
    const r = await createOrder(checkout({ items: [{ variantId: f.box, quantity: 1 }] }));
    expect(!r.ok && r.code).toBe("CLOSED");
    expect(!r.ok && r.message).toBe("ঈদের ছুটি");
  });

  it("gives free delivery above the threshold", async () => {
    await saveSettings(siteSettingsSchema.parse({ freeDeliveryMinAmount: 2000 }));
    const r = await createOrder(checkout({ items: [{ variantId: f.frameSmall, quantity: 3 }] }));
    if (!r.ok) throw new Error(JSON.stringify(r));
    const o = await prisma.order.findUniqueOrThrow({ where: { id: r.order.id } });
    expect(o.deliveryCharge).toBe(0);
    expect(o.totalAmount).toBe(3000 - 300);
  });
});

describe("buildQuote", () => {
  it("matches order creation and explains coupon problems in Bangla", async () => {
    await prisma.coupon.create({ data: { code: "BIG", type: "FIXED", value: 100, minOrderAmount: 5000 } });
    const q = await buildQuote({ items: [{ variantId: f.box, quantity: 1 }], districtId: "dhaka", areaId: "dhaka-city-mirpur", couponCode: "BIG" });
    expect(q.total).toBe(870);
    expect(q.zone?.name).toBe("ঢাকা সিটির ভেতরে");
    expect(q.coupon?.applied).toBe(false);
    expect(q.coupon?.message).toContain("৳৫,০০০");
    const bad = await buildQuote({ items: [{ variantId: f.box, quantity: 1 }], couponCode: "NOPE" });
    expect(bad.coupon?.message).toBe("কুপন কোডটি সঠিক নয়।");
    expect(bad.zone).toBeNull();
    expect(bad.deliveryCharge).toBe(0);
  });

  it("reports unavailable products without pricing them", async () => {
    await prisma.productVariant.update({ where: { id: f.frameLarge }, data: { stock: 0 } });
    const q = await buildQuote({ items: [{ variantId: f.frameLarge, quantity: 1 }, { variantId: f.box, quantity: 1 }] });
    expect(q.issues.map((i) => i.code)).toEqual(["OUT_OF_STOCK"]);
    expect(q.subtotal).toBe(800);
  });
});

describe("admin order management", () => {
  it("cancelling returns stock and coupon usage; restoring reserves them again", async () => {
    await prisma.coupon.create({ data: { code: "C1", type: "FIXED", value: 50 } });
    const r = await createOrder(checkout({ couponCode: "C1", items: [{ variantId: f.frameSmall, quantity: 3 }] }));
    if (!r.ok) throw new Error(JSON.stringify(r));
    expect((await prisma.productVariant.findUniqueOrThrow({ where: { id: f.frameSmall } })).stock).toBe(7);

    await updateOrderStatus(r.order.id, "CANCELLED", actor);
    expect((await prisma.productVariant.findUniqueOrThrow({ where: { id: f.frameSmall } })).stock).toBe(10);
    expect((await prisma.coupon.findUniqueOrThrow({ where: { code: "C1" } })).usedCount).toBe(0);

    await updateOrderStatus(r.order.id, "CONFIRMED", actor);
    expect((await prisma.productVariant.findUniqueOrThrow({ where: { id: f.frameSmall } })).stock).toBe(7);
    expect((await prisma.coupon.findUniqueOrThrow({ where: { code: "C1" } })).usedCount).toBe(1);

    const events = await prisma.orderEvent.findMany({ where: { orderId: r.order.id, type: "STATUS_CHANGED" } });
    expect(events).toHaveLength(2);
    const order = await prisma.order.findUniqueOrThrow({ where: { id: r.order.id } });
    expect(order.googleSheetVersion).toBe(3);
  });

  it("refuses to restore an order whose coupon slot another order has taken", async () => {
    await prisma.coupon.create({ data: { code: "ONE", type: "FIXED", value: 50, usageLimit: 1 } });
    const a = await createOrder(checkout({ couponCode: "ONE", items: [{ variantId: f.frameSmall, quantity: 1 }] }));
    if (!a.ok) throw new Error(JSON.stringify(a));
    await updateOrderStatus(a.order.id, "CANCELLED", actor);
    const b = await createOrder(checkout({ mobileNumber: "01811111111", couponCode: "ONE", items: [{ variantId: f.box, quantity: 1 }] }));
    if (!b.ok) throw new Error(JSON.stringify(b));

    await expect(updateOrderStatus(a.order.id, "CONFIRMED", actor)).rejects.toThrow(OrderUpdateError);
    // Nothing moved: still cancelled, stock still returned, the coupon used once.
    expect((await prisma.order.findUniqueOrThrow({ where: { id: a.order.id } })).orderStatus).toBe("CANCELLED");
    expect((await prisma.productVariant.findUniqueOrThrow({ where: { id: f.frameSmall } })).stock).toBe(10);
    expect((await prisma.coupon.findUniqueOrThrow({ where: { code: "ONE" } })).usedCount).toBe(1);
  });

  it("refuses to restore an order past the coupon's per-phone limit", async () => {
    await prisma.coupon.create({ data: { code: "PHONE1", type: "FIXED", value: 50, perPhoneLimit: 1 } });
    const a = await createOrder(checkout({ couponCode: "PHONE1", items: [{ variantId: f.box, quantity: 1 }] }));
    if (!a.ok) throw new Error(JSON.stringify(a));
    await updateOrderStatus(a.order.id, "CANCELLED", actor);
    const b = await createOrder(checkout({ couponCode: "PHONE1", items: [{ variantId: f.box, quantity: 1 }] }));
    if (!b.ok) throw new Error(JSON.stringify(b));

    await expect(updateOrderStatus(a.order.id, "PENDING", actor)).rejects.toThrow(OrderUpdateError);
    expect((await prisma.coupon.findUniqueOrThrow({ where: { code: "PHONE1" } })).usedCount).toBe(1);
  });

  it("saves a status change and its note together, or neither", async () => {
    const r = await createOrder(checkout({ items: [{ variantId: f.frameLarge, quantity: 2 }] }));
    if (!r.ok) throw new Error(JSON.stringify(r));
    await updateOrderStatus(r.order.id, "CANCELLED", actor, { adminNote: "customer called" });
    expect((await prisma.order.findUniqueOrThrow({ where: { id: r.order.id } })).adminNote).toBe("customer called");

    // Restoring fails (the stock is gone), so the note must not be saved either.
    await prisma.productVariant.update({ where: { id: f.frameLarge }, data: { stock: 0 } });
    await expect(updateOrderStatus(r.order.id, "CONFIRMED", actor, { adminNote: "changed" })).rejects.toThrow(OrderUpdateError);
    expect((await prisma.order.findUniqueOrThrow({ where: { id: r.order.id } })).adminNote).toBe("customer called");

    // An unchanged status still saves the note.
    await updateOrderStatus(r.order.id, "CANCELLED", actor, { adminNote: "" });
    expect((await prisma.order.findUniqueOrThrow({ where: { id: r.order.id } })).adminNote).toBeNull();
  });

  it("returns only the stock an order actually took", async () => {
    // Placed while the box's stock was untracked; tracking is switched on afterwards.
    const r = await createOrder(checkout({ items: [{ variantId: f.frameSmall, quantity: 1 }, { variantId: f.box, quantity: 2 }] }));
    if (!r.ok) throw new Error(JSON.stringify(r));
    await prisma.productVariant.update({ where: { id: f.box }, data: { stock: 5 } });
    const stockOf = async (id: string) => (await prisma.productVariant.findUniqueOrThrow({ where: { id } })).stock;
    const reserved = async () =>
      Object.fromEntries(
        (await prisma.orderItem.findMany({ where: { orderId: r.order.id } })).map((i) => [i.variantId, i.stockReserved]),
      );

    expect((await updateOrderStatus(r.order.id, "CANCELLED", actor)).stockChanged).toBe(true);
    expect(await stockOf(f.frameSmall)).toBe(10);
    expect(await stockOf(f.box)).toBe(5); // nothing was taken, so nothing is returned
    expect(await reserved()).toEqual({ [f.frameSmall]: false, [f.box]: false });

    // Un-cancelling reserves from every variant that tracks stock now.
    await updateOrderStatus(r.order.id, "CONFIRMED", actor);
    expect(await stockOf(f.frameSmall)).toBe(9);
    expect(await stockOf(f.box)).toBe(3);
    expect(await reserved()).toEqual({ [f.frameSmall]: true, [f.box]: true });

    await updateOrderStatus(r.order.id, "CANCELLED", actor);
    expect(await stockOf(f.frameSmall)).toBe(10);
    expect(await stockOf(f.box)).toBe(5);
  });

  it("reports whether a status change moved stock", async () => {
    const box = await createOrder(checkout({ items: [{ variantId: f.box, quantity: 1 }] }));
    if (!box.ok) throw new Error(JSON.stringify(box));
    expect(box.stockChanged).toBe(false);
    expect((await updateOrderStatus(box.order.id, "CANCELLED", actor)).stockChanged).toBe(false);

    const frame = await createOrder(checkout({ mobileNumber: "01811111111", items: [{ variantId: f.frameSmall, quantity: 1 }] }));
    if (!frame.ok) throw new Error(JSON.stringify(frame));
    expect((await updateOrderStatus(frame.order.id, "CONFIRMED", actor)).stockChanged).toBe(false);
    expect((await updateOrderStatus(frame.order.id, "CANCELLED", actor)).stockChanged).toBe(true);
    expect((await updateOrderStatus(frame.order.id, "CANCELLED", actor)).stockChanged).toBe(false);
    expect((await updateOrderStatus(frame.order.id, "PENDING", actor)).stockChanged).toBe(true);
  });

  it("applies simultaneous cancels once", async () => {
    await prisma.coupon.create({ data: { code: "C2", type: "FIXED", value: 50 } });
    const other = await createOrder(checkout({ mobileNumber: "01811111111", couponCode: "C2", items: [{ variantId: f.box, quantity: 1 }] }));
    const r = await createOrder(checkout({ couponCode: "C2", items: [{ variantId: f.frameSmall, quantity: 3 }] }));
    if (!other.ok || !r.ok) throw new Error("orders failed");
    expect((await prisma.coupon.findUniqueOrThrow({ where: { code: "C2" } })).usedCount).toBe(2);

    const results = await Promise.all(Array.from({ length: 3 }, () => updateOrderStatus(r.order.id, "CANCELLED", actor)));
    expect(results.filter((x) => x.stockChanged)).toHaveLength(1);
    expect((await prisma.productVariant.findUniqueOrThrow({ where: { id: f.frameSmall } })).stock).toBe(10);
    expect((await prisma.coupon.findUniqueOrThrow({ where: { code: "C2" } })).usedCount).toBe(1);
    expect(await prisma.orderEvent.count({ where: { orderId: r.order.id, type: "STATUS_CHANGED" } })).toBe(1);
  });

  it("keeps stock consistent when a cancel and a confirm race", async () => {
    for (let i = 0; i < 4; i++) {
      const r = await createOrder(checkout({ mobileNumber: `0181111111${i}`, items: [{ variantId: f.frameSmall, quantity: 2 }] }));
      if (!r.ok) throw new Error(JSON.stringify(r));
      await Promise.all([
        updateOrderStatus(r.order.id, "CANCELLED", actor),
        updateOrderStatus(r.order.id, "CONFIRMED", actor),
      ]);
    }
    const items = await prisma.orderItem.findMany({ where: { variantId: f.frameSmall }, include: { order: true } });
    for (const item of items) expect(item.stockReserved).toBe(item.order.orderStatus !== "CANCELLED");
    const held = items.filter((i) => i.stockReserved).reduce((sum, i) => sum + i.quantity, 0);
    expect((await prisma.productVariant.findUniqueOrThrow({ where: { id: f.frameSmall } })).stock).toBe(10 - held);
  });

  it("searches by order number, name and phone (any format)", async () => {
    const r = await createOrder(checkout({ customerName: "Fatema Khatun", mobileNumber: "01911223344", items: [{ variantId: f.box, quantity: 1 }] }));
    if (!r.ok) throw new Error("order failed");
    await createOrder(checkout({ customerName: "Someone Else", mobileNumber: "01700000000", items: [{ variantId: f.box, quantity: 1 }] }));
    expect((await listOrders({ q: "fatema" })).total).toBe(1);
    expect((await listOrders({ q: "+880 1911-223344" })).total).toBe(1);
    expect((await listOrders({ q: r.order.orderNumber.toLowerCase() })).total).toBe(1);
    expect((await listOrders({ status: "PENDING" })).total).toBe(2);
    expect((await listOrders({ status: "DELIVERED" })).total).toBe(0);
  });
});

describe("order tracking", () => {
  it("finds an order only by its number together with the phone it was placed with", async () => {
    const r = await createOrder(checkout({ mobileNumber: "01911223344", items: [{ variantId: f.box, quantity: 1 }] }));
    if (!r.ok) throw new Error(JSON.stringify(r));
    const n = r.order.orderNumber;

    expect(await findOrderTokenForTracking(n, "01911223344")).toBe(r.order.publicToken);
    // Typed loosely: lower case, spaces, Bangla digits, +880 prefix.
    const bn = (s: string) => s.replace(/\d/g, (d) => "০১২৩৪৫৬৭৮৯"[Number(d)]!);
    expect(await findOrderTokenForTracking(` ${bn(n.toLowerCase())} `, "+880 1911-223344")).toBe(r.order.publicToken);

    expect(await findOrderTokenForTracking(n, "01700000000")).toBeNull();
    expect(await findOrderTokenForTracking("DBX-19990101-0001", "01911223344")).toBeNull();
    expect(await findOrderTokenForTracking(n, "not a phone")).toBeNull();

    // Past the 60-day link window, like the link itself.
    await prisma.order.update({ where: { id: r.order.id }, data: { createdAt: new Date(Date.now() - 61 * 24 * 60 * 60 * 1000) } });
    expect(await findOrderTokenForTracking(n, "01911223344")).toBeNull();
  });
});
