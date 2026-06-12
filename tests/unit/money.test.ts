import { describe, it, expect } from "vitest";
import { formatZar, parseZar } from "@/lib/utils/money";

describe("formatZar", () => {
  it("formats zero", () => {
    expect(formatZar(0)).toBe("R 0.00");
  });

  it("formats cents below one rand", () => {
    expect(formatZar(99)).toBe("R 0.99");
    expect(formatZar(5)).toBe("R 0.05");
  });

  it("formats whole rand amounts", () => {
    expect(formatZar(4500)).toBe("R 45.00");
  });

  it("groups thousands with spaces", () => {
    expect(formatZar(123456)).toBe("R 1 234.56");
    expect(formatZar(100000000)).toBe("R 1 000 000.00");
  });

  it("formats negative amounts", () => {
    expect(formatZar(-12345)).toBe("R -123.45");
  });

  it("is deterministic (no locale-dependent separators)", () => {
    // Regression test for a hydration mismatch: toLocaleString("en-ZA")
    // produced different group separators on server vs client ICU.
    const out = formatZar(987654321);
    expect(out).toBe("R 9 876 543.21");
    // Only plain ASCII spaces, never NBSP/narrow NBSP from locale data.
    expect(out).not.toMatch(/[\u00A0\u202F]/);
  });
});

describe("parseZar", () => {
  it("parses plain decimal values", () => {
    expect(parseZar("45.00")).toBe(4500);
    expect(parseZar("0.99")).toBe(99);
  });

  it("parses comma decimal separators", () => {
    expect(parseZar("12,50")).toBe(1250);
  });

  it("parses formatted output back to cents (round-trip)", () => {
    for (const cents of [0, 99, 4500, 123456, 100000000]) {
      expect(parseZar(formatZar(cents))).toBe(cents);
    }
  });
});
