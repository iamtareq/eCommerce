import { describe, expect, it } from "vitest";
import { allocate, calculatePricing, type PricedVariant, type PricingInput } from "@/lib/pricing";

const v = (id: string, productId: string, price: number, compareAtPrice: number | null = null): PricedVariant => ({
  variantId: id,
  productId,
  productName: `Product ${productId}`,
  productSlug: productId,
  variantName: id,
  sku: null,
  price,
  compareAtPrice,
});

const base = (over: Partial<PricingInput> = {}): PricingInput => ({
  lines: [],
  tiers: [],
  coupon: null,
  deliveryCharge: 0,
  freeDeliveryMinAmount: null,
  ...over,
});

describe("calculatePricing", () => {
  it("computes subtotal, delivery and total", () => {
    const r = calculatePricing(
      base({ lines: [{ variant: v("a", "p1", 500), quantity: 2 }, { variant: v("b", "p2", 300), quantity: 1 }], deliveryCharge: 70 }),
    );
    expect(r.subtotal).toBe(1300);
    expect(r.itemCount).toBe(3);
    expect(r.deliveryCharge).toBe(70);
    expect(r.discount).toBe(0);
    expect(r.total).toBe(1370);
  });

  it("applies the highest matching quantity tier across variants of one product", () => {
    const r = calculatePricing(
      base({
        lines: [
          { variant: v("small", "p1", 400), quantity: 1 },
          { variant: v("large", "p1", 600), quantity: 2 },
        ],
        tiers: [
          { productId: "p1", minQuantity: 2, type: "PERCENT", value: 5 },
          { productId: "p1", minQuantity: 3, type: "PERCENT", value: 10 },
          { productId: "p1", minQuantity: 5, type: "PERCENT", value: 20 },
        ],
        deliveryCharge: 60,
      }),
    );
    expect(r.subtotal).toBe(1600);
    expect(r.quantityDiscount).toBe(160);
    expect(r.lines.map((l) => l.lineDiscount)).toEqual([40, 120]);
    expect(r.total).toBe(1600 - 160 + 60);
    expect(r.appliedTiers).toHaveLength(1);
  });

  it("fixed tier discount never exceeds the product subtotal", () => {
    const r = calculatePricing(
      base({
        lines: [{ variant: v("a", "p1", 100), quantity: 2 }],
        tiers: [{ productId: "p1", minQuantity: 2, type: "FIXED", value: 1000 }],
      }),
    );
    expect(r.quantityDiscount).toBe(200);
    expect(r.total).toBe(0);
  });

  it("does not apply tiers of other products", () => {
    const r = calculatePricing(
      base({
        lines: [{ variant: v("a", "p1", 100), quantity: 5 }],
        tiers: [{ productId: "p2", minQuantity: 2, type: "FIXED", value: 50 }],
      }),
    );
    expect(r.quantityDiscount).toBe(0);
  });

  it("applies percent coupon after quantity discount, with cap", () => {
    const r = calculatePricing(
      base({
        lines: [{ variant: v("a", "p1", 1000), quantity: 3 }],
        tiers: [{ productId: "p1", minQuantity: 3, type: "FIXED", value: 300 }],
        coupon: { code: "EID10", type: "PERCENT", value: 10, minOrderAmount: null, maxDiscountAmount: 200 },
        deliveryCharge: 120,
      }),
    );
    expect(r.quantityDiscount).toBe(300);
    expect(r.couponDiscount).toBe(200); // 10% of 2700 = 270, capped at 200
    expect(r.discount).toBe(500);
    expect(r.total).toBe(3000 - 500 + 120);
    expect(r.coupon).toEqual({ code: "EID10", applied: true, reason: null });
  });

  it("rejects a coupon below the minimum order amount", () => {
    const r = calculatePricing(
      base({
        lines: [{ variant: v("a", "p1", 400), quantity: 1 }],
        coupon: { code: "BIG", type: "FIXED", value: 100, minOrderAmount: 500, maxDiscountAmount: null },
        deliveryCharge: 60,
      }),
    );
    expect(r.couponDiscount).toBe(0);
    expect(r.coupon?.applied).toBe(false);
    expect(r.coupon?.reason).toBe("min:500");
    expect(r.total).toBe(460);
  });

  it("free-delivery coupon waives delivery", () => {
    const r = calculatePricing(
      base({
        lines: [{ variant: v("a", "p1", 400), quantity: 1 }],
        coupon: { code: "FREESHIP", type: "FREE_DELIVERY", value: 0, minOrderAmount: null, maxDiscountAmount: null },
        deliveryCharge: 120,
      }),
    );
    expect(r.deliveryCharge).toBe(0);
    expect(r.baseDeliveryCharge).toBe(120);
    expect(r.deliveryWaiver).toBe("coupon");
    expect(r.total).toBe(400);
  });

  it("free-delivery threshold uses the amount after discounts", () => {
    const input = base({
      lines: [{ variant: v("a", "p1", 1000), quantity: 1 }],
      coupon: { code: "X", type: "FIXED", value: 100, minOrderAmount: null, maxDiscountAmount: null },
      deliveryCharge: 60,
      freeDeliveryMinAmount: 1000,
    });
    expect(calculatePricing(input).deliveryCharge).toBe(60); // 900 < 1000
    expect(calculatePricing({ ...input, coupon: null }).deliveryWaiver).toBe("threshold");
  });

  it("fixed coupon is capped at the remaining product amount", () => {
    const r = calculatePricing(
      base({
        lines: [{ variant: v("a", "p1", 100), quantity: 1 }],
        coupon: { code: "HUGE", type: "FIXED", value: 5000, minOrderAmount: null, maxDiscountAmount: null },
        deliveryCharge: 50,
      }),
    );
    expect(r.couponDiscount).toBe(100);
    expect(r.total).toBe(50);
  });
});

describe("allocate", () => {
  it("splits exactly", () => {
    expect(allocate(100, [1, 1, 1])).toEqual([34, 33, 33]);
    expect(allocate(10, [0, 0])).toEqual([0, 0]);
    const parts = allocate(157, [300, 450, 1250]);
    expect(parts.reduce((a, b) => a + b, 0)).toBe(157);
  });
});
