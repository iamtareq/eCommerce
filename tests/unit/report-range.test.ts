import { describe, expect, it } from "vitest";
import { MAX_REPORT_DAYS, resolveReportRange } from "@/lib/reports";

// 2026-10-07 02:00 in Dhaka (UTC+6) is still 2026-10-06 in UTC.
const now = new Date("2026-10-06T20:00:00Z");

describe("resolveReportRange", () => {
  it("resolves presets in Dhaka days", () => {
    expect(resolveReportRange({ preset: "7d" }, now)).toEqual({ from: "2026-10-01", to: "2026-10-07", preset: "7d" });
    expect(resolveReportRange({ preset: "month" }, now)).toEqual({ from: "2026-10-01", to: "2026-10-07", preset: "month" });
    expect(resolveReportRange({ preset: "last-month" }, now)).toEqual({ from: "2026-09-01", to: "2026-09-30", preset: "last-month" });
  });

  it("defaults to the last 30 days for missing or invalid input", () => {
    const last30 = { from: "2026-09-08", to: "2026-10-07", preset: "30d" };
    expect(resolveReportRange({}, now)).toEqual(last30);
    expect(resolveReportRange({ from: "2026-02-31", to: "2026-03-05" }, now)).toEqual(last30);
    expect(resolveReportRange({ preset: "forever" }, now)).toEqual(last30);
  });

  it("swaps a reversed range, stops at today and caps the length", () => {
    expect(resolveReportRange({ from: "2026-09-10", to: "2026-09-01" }, now)).toEqual({ from: "2026-09-01", to: "2026-09-10", preset: null });
    expect(resolveReportRange({ from: "2026-10-01", to: "2027-01-01" }, now).to).toBe("2026-10-07");
    const long = resolveReportRange({ from: "2020-01-01", to: "2026-10-07" }, now);
    const days = (Date.parse(long.to) - Date.parse(long.from)) / 86_400_000 + 1;
    expect(days).toBe(MAX_REPORT_DAYS);
  });
});
