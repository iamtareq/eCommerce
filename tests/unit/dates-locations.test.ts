import { describe, expect, it } from "vitest";
import { dhakaDateKey, dhakaDayRange, formatDhakaDateTime, startOfDhakaDay } from "@/lib/dates";
import { resolveZone } from "@/lib/delivery";
import { areasOf, districtsOf, OTHER_AREA_ID, resolveLocation } from "@/lib/locations";
import { getLocationData } from "@/lib/locations.server";

describe("Dhaka dates", () => {
  it("uses Dhaka calendar day, not UTC", () => {
    // 2026-09-20 19:30 UTC = 2026-09-21 01:30 in Dhaka
    const d = new Date("2026-09-20T19:30:00Z");
    expect(dhakaDateKey(d)).toBe("20260921");
    expect(formatDhakaDateTime(d)).toBe("2026-09-21 01:30");
    expect(startOfDhakaDay(d).toISOString()).toBe("2026-09-20T18:00:00.000Z");
  });

  it("parses day ranges and rejects invalid dates", () => {
    const r = dhakaDayRange("2026-09-21");
    expect(r?.start.toISOString()).toBe("2026-09-20T18:00:00.000Z");
    expect(r?.end.toISOString()).toBe("2026-09-21T18:00:00.000Z");
    expect(dhakaDayRange("2026-02-31")).toBeNull();
    expect(dhakaDayRange("21-09-2026")).toBeNull();
  });
});

describe("locations", () => {
  const data = getLocationData();

  it("has the full national dataset", () => {
    expect(data.divisions).toHaveLength(8);
    expect(data.districts).toHaveLength(64);
    expect(data.areas.filter((a) => a.type === "city").length).toBe(50);
    expect(new Set(data.areas.map((a) => a.id)).size).toBe(data.areas.length);
    for (const d of data.districts) expect(areasOf(data, d.id).length).toBeGreaterThan(0);
    for (const dv of data.divisions) expect(districtsOf(data, dv.id).length).toBeGreaterThan(0);
  });

  it("validates the division → district → area chain", () => {
    const ok = resolveLocation(data, { divisionId: "dhaka", districtId: "dhaka", areaId: "dhaka-city-dhanmondi" });
    expect(ok?.areaName).toBe("ধানমন্ডি");
    expect(resolveLocation(data, { divisionId: "sylhet", districtId: "dhaka", areaId: "dhaka-city-dhanmondi" })).toBeNull();
    expect(resolveLocation(data, { divisionId: "dhaka", districtId: "gazipur", areaId: "dhaka-city-dhanmondi" })).toBeNull();
    const other = resolveLocation(data, { divisionId: "dhaka", districtId: "gazipur", areaId: OTHER_AREA_ID, areaOther: "টঙ্গী" });
    expect(other?.area).toBeNull();
    expect(other?.areaName).toBe("টঙ্গী");
    expect(resolveLocation(data, { divisionId: "dhaka", districtId: "gazipur", areaId: OTHER_AREA_ID })).toBeNull();
  });
});

describe("resolveZone", () => {
  const zones = [
    { id: "in", name: "Inside", charge: 70, isDefault: false, estimatedDelivery: null },
    { id: "sub", name: "Sub", charge: 100, isDefault: false, estimatedDelivery: null },
    { id: "out", name: "Outside", charge: 130, isDefault: true, estimatedDelivery: null },
  ];
  const rules = [
    { zoneId: "in", districtId: "dhaka", areaId: "dhaka-city-dhanmondi" },
    { zoneId: "sub", districtId: "dhaka", areaId: "" },
  ];

  it("prefers area rule, then district rule, then default", () => {
    expect(resolveZone(zones, rules, "dhaka", "dhaka-city-dhanmondi")?.id).toBe("in");
    expect(resolveZone(zones, rules, "dhaka", "dhaka-savar")?.id).toBe("sub");
    expect(resolveZone(zones, rules, "dhaka", null)?.id).toBe("sub");
    expect(resolveZone(zones, rules, "sylhet", "sylhet-sylhet-sadar")?.id).toBe("out");
  });
});
