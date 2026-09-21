import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { hashPassword, passwordProblem, verifyPassword } from "@/lib/auth/password";
import { toCsv } from "@/lib/csv";
import { prisma } from "@/lib/db";
import { isRateLimited, rateLimit, resetRateLimit } from "@/lib/rate-limit";
import { resetDb } from "./helpers";

beforeEach(async () => {
  await resetDb();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("rate limiting", () => {
  it("blocks after the limit and resets after the window", async () => {
    for (let i = 0; i < 3; i++) expect((await rateLimit("t:a", 3, 60_000)).ok).toBe(true);
    expect((await rateLimit("t:a", 3, 60_000)).ok).toBe(false);
    expect(await isRateLimited("t:a", 3)).toBe(true);
    await resetRateLimit("t:a");
    expect((await rateLimit("t:a", 3, 60_000)).ok).toBe(true);

    await rateLimit("t:b", 1, 50);
    expect((await rateLimit("t:b", 1, 50)).ok).toBe(false);
    await new Promise((r) => setTimeout(r, 80));
    expect((await rateLimit("t:b", 1, 50)).ok).toBe(true);
  });

  it("counts concurrent hits atomically", async () => {
    const results = await Promise.all(Array.from({ length: 10 }, () => rateLimit("t:c", 5, 60_000)));
    expect(results.filter((r) => r.ok)).toHaveLength(5);
  });
});

describe("passwords", () => {
  it("hashes and verifies; unknown users never verify", async () => {
    const hash = await hashPassword("correct horse 42");
    expect(hash).not.toContain("correct");
    expect(await verifyPassword("correct horse 42", hash)).toBe(true);
    expect(await verifyPassword("wrong horse 42", hash)).toBe(false);
    expect(await verifyPassword("anything", null)).toBe(false);
    expect(passwordProblem("short1")).toMatch(/at least 10/);
    expect(passwordProblem("onlyletters")).toMatch(/letters and numbers/);
    expect(passwordProblem("letters4and5numbers")).toBeNull();
  });
});

describe("CSV export", () => {
  it("neutralises formulas and escapes quotes/newlines", () => {
    const csv = toCsv(["a", "b"], [["=HYPERLINK(\"x\")", "line1\nline2"], ["+880", "-5"]]);
    expect(csv.startsWith("﻿")).toBe(true);
    expect(csv).toContain(`"'=HYPERLINK(""x"")"`);
    expect(csv).toContain(`"line1\nline2"`);
    expect(csv).toContain("'+880,'-5");
  });
});
