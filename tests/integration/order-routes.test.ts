import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { POST as postQuote } from "@/app/api/checkout/quote/route";
import { POST as postOrder } from "@/app/api/orders/route";
import { prisma } from "@/lib/db";
import { createOrder } from "@/lib/orders/create";
import { isRateLimited, LIMITS, rateLimit } from "@/lib/rate-limit";
import { hashIp } from "@/lib/security";
import { MSG } from "@/lib/validation/messages";
import { checkout, resetDb, seedFixture, type Fixture } from "./helpers";

// Only paths that return before after()/revalidateTag() run here: those need a
// live Next.js request context.

const IP = "203.0.113.7";
let f: Fixture;

function post(path: string, body: unknown) {
  return new Request(`http://localhost${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-real-ip": IP },
    body: JSON.stringify(body),
  });
}

beforeEach(async () => {
  await resetDb();
  f = await seedFixture();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("POST /api/orders", () => {
  it("returns an existing order to a retry even when the phone's limit is used up", async () => {
    const data = checkout({ items: [{ variantId: f.box, quantity: 1 }] });
    const first = await createOrder(data);
    if (!first.ok) throw new Error(JSON.stringify(first));
    const { limit, windowMs } = LIMITS.orderPerPhone;
    for (let i = 0; i < limit; i++) await rateLimit(`order:phone:${data.mobileNumber}`, limit, windowMs);

    const retry = await postOrder(post("/api/orders", data));
    expect(retry.status).toBe(200);
    expect(await retry.json()).toMatchObject({ ok: true, duplicate: true, orderNumber: first.order.orderNumber });

    // A new order from the same phone is still limited.
    const fresh = await postOrder(post("/api/orders", checkout({ items: [{ variantId: f.box, quantity: 1 }] })));
    expect(fresh.status).toBe(429);
    expect(await prisma.order.count()).toBe(1);
  });

  it("does not spend the phone's limit on attempts that place no order", async () => {
    const data = checkout({ items: [{ variantId: f.frameLarge, quantity: 1 }] });
    const phoneKey = `order:phone:${data.mobileNumber}`;
    // More confirms than the phone limit allows, each with a total that no longer matches.
    for (let i = 0; i <= LIMITS.orderPerPhone.limit; i++) {
      const res = await postOrder(post("/api/orders", { ...data, expectedTotal: 1 }));
      expect(res.status).toBe(409);
      expect(await res.json()).toMatchObject({ ok: false, code: "PRICE_CHANGED" });
    }
    expect(await isRateLimited(phoneKey, 1)).toBe(false);

    // Out of stock: also refunded.
    const cart = await postOrder(post("/api/orders", { ...data, items: [{ variantId: f.frameLarge, quantity: 3 }] }));
    expect(cart.status).toBe(409);
    expect(await isRateLimited(phoneKey, 1)).toBe(false);
    expect(await prisma.order.count()).toBe(0);
    expect((await prisma.productVariant.findUniqueOrThrow({ where: { id: f.frameLarge } })).stock).toBe(2);
  });

  it("keeps counting an attempt that was refused by the phone limit", async () => {
    const data = checkout({ items: [{ variantId: f.frameLarge, quantity: 1 }] });
    const { limit, windowMs } = LIMITS.orderPerPhone;
    for (let i = 0; i < limit; i++) await rateLimit(`order:phone:${data.mobileNumber}`, limit, windowMs);

    const res = await postOrder(post("/api/orders", { ...data, expectedTotal: 1 }));
    expect(res.status).toBe(429);
    const row = await prisma.rateLimit.findUniqueOrThrow({ where: { key: `order:phone:${data.mobileNumber}` } });
    expect(row.count).toBe(limit + 1);
  });
});

describe("POST /api/checkout/quote", () => {
  const items = () => [{ variantId: f.box, quantity: 1 }];
  const couponKey = () => `coupon:ip:${hashIp(IP)}`;
  const quoteCoupon = async (couponCode: string) => {
    const res = await postQuote(post("/api/checkout/quote", { items: items(), couponCode }));
    return ((await res.json()) as { quote: { coupon: { applied: boolean; message: string | null } } }).quote.coupon;
  };

  it("does not count re-quotes of a valid coupon that misses its minimum order", async () => {
    await prisma.coupon.create({ data: { code: "BIG", type: "FIXED", value: 100, minOrderAmount: 5000 } });
    for (let i = 0; i < LIMITS.couponPerIp.limit + 2; i++) {
      const coupon = await quoteCoupon("BIG");
      expect(coupon.applied).toBe(false);
      expect(coupon.message).toContain("৳৫,০০০");
    }
    expect(await isRateLimited(couponKey(), LIMITS.couponPerIp.limit)).toBe(false);
  });

  it("counts a rejected code once however often it is re-quoted, but still limits guessing", async () => {
    for (let i = 0; i < LIMITS.couponPerIp.limit + 2; i++) {
      expect((await quoteCoupon("NOPE")).message).toBe("কুপন কোডটি সঠিক নয়।");
    }
    expect(await isRateLimited(couponKey(), LIMITS.couponPerIp.limit)).toBe(false);

    // "NOPE" used 1 of the 20; the 20th distinct guess after it is refused.
    const messages: (string | null)[] = [];
    for (let i = 0; i < LIMITS.couponPerIp.limit; i++) messages.push((await quoteCoupon(`GUESS${i}`)).message);
    expect(messages.slice(0, -1).every((m) => m === "কুপন কোডটি সঠিক নয়।")).toBe(true);
    expect(messages.at(-1)).toBe(MSG.rateLimited);
  });
});
