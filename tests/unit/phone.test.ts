import { describe, expect, it } from "vitest";
import { maskPhone, normalizeBdPhone, toAsciiDigits, toBanglaDigits } from "@/lib/phone";

describe("normalizeBdPhone", () => {
  it.each([
    ["01712345678", "01712345678"],
    ["+8801712345678", "01712345678"],
    ["8801712345678", "01712345678"],
    ["008801712345678", "01712345678"],
    ["1712345678", "01712345678"],
    ["017-1234-5678", "01712345678"],
    ["+880 1712 345 678", "01712345678"],
    ["(017) 12345678", "01712345678"],
    ["০১৭১২৩৪৫৬৭৮", "01712345678"],
    ["+৮৮০১৯১২৩৪৫৬৭৮", "01912345678"],
    ["01312345678", "01312345678"],
  ])("accepts %s", (input, expected) => {
    expect(normalizeBdPhone(input)).toBe(expected);
  });

  it.each([
    "",
    "0171234567", // 10 digits
    "017123456789", // 12 digits
    "01212345678", // invalid operator prefix 012
    "01112345678",
    "02712345678",
    "+9101712345678",
    "abc01712345678",
    "8801212345678",
  ])("rejects %s", (input) => {
    expect(normalizeBdPhone(input)).toBeNull();
  });
});

describe("digit helpers", () => {
  it("converts both ways", () => {
    expect(toAsciiDigits("০১২৩৪৫৬৭৮৯")).toBe("0123456789");
    expect(toBanglaDigits(1250)).toBe("১২৫০");
    expect(toBanglaDigits("৳1,250")).toBe("৳১,২৫০");
  });

  it("masks phones", () => {
    expect(maskPhone("01712345678")).toBe("017••••5678");
  });
});
