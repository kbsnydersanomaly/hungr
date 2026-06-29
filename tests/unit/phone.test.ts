import { describe, it, expect } from "vitest";
import {
  normalizeSouthAfricanPhone,
  isValidSouthAfricanPhone,
} from "@/lib/utils/phone";

describe("normalizeSouthAfricanPhone", () => {
  it("normalizes local 082 numbers", () => {
    expect(normalizeSouthAfricanPhone("082 123 4567")).toBe("+27821234567");
    expect(normalizeSouthAfricanPhone("(082) 123-4567")).toBe("+27821234567");
    expect(normalizeSouthAfricanPhone("0821234567")).toBe("+27821234567");
  });

  it("normalizes international +27 numbers", () => {
    expect(normalizeSouthAfricanPhone("+27 82 123 4567")).toBe("+27821234567");
    expect(normalizeSouthAfricanPhone("27821234567")).toBe("+27821234567");
    expect(normalizeSouthAfricanPhone("+27 (0)82 123 4567")).toBe("+27821234567");
  });

  it("rejects invalid numbers", () => {
    expect(normalizeSouthAfricanPhone("1234567890")).toBeNull();
    expect(normalizeSouthAfricanPhone("082123")).toBeNull();
    expect(normalizeSouthAfricanPhone("")).toBeNull();
    expect(normalizeSouthAfricanPhone("+1 555 123 4567")).toBeNull();
    expect(normalizeSouthAfricanPhone("2751234567")).toBeNull();
    expect(normalizeSouthAfricanPhone("0951234567")).toBeNull();
    expect(normalizeSouthAfricanPhone("08212345678")).toBeNull();
  });
});

describe("isValidSouthAfricanPhone", () => {
  it("accepts valid numbers", () => {
    expect(isValidSouthAfricanPhone("0821234567")).toBe(true);
    expect(isValidSouthAfricanPhone("+27 82 123 4567")).toBe(true);
  });

  it("rejects invalid numbers", () => {
    expect(isValidSouthAfricanPhone("123")).toBe(false);
    expect(isValidSouthAfricanPhone("")).toBe(false);
  });
});
