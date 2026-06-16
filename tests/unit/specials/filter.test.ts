import { describe, it, expect } from "vitest";
import { isSpecialActiveNow } from "@/lib/specials/filter";

function makeSpecial(overrides: Partial<Parameters<typeof isSpecialActiveNow>[0]> = {}) {
  return {
    active: true,
    menu_id: null,
    date_from: null,
    date_to: null,
    time_from: null,
    time_to: null,
    selected_days: null,
    ...overrides,
  };
}

describe("isSpecialActiveNow", () => {
  it("returns false when special is inactive", () => {
    expect(isSpecialActiveNow(makeSpecial({ active: false }))).toBe(false);
  });

  it("returns true when no constraints are set", () => {
    expect(isSpecialActiveNow(makeSpecial())).toBe(true);
  });

  it("filters by menu_id", () => {
    expect(
      isSpecialActiveNow(makeSpecial({ menu_id: "menu-a" }), { menuId: "menu-a" })
    ).toBe(true);
    expect(
      isSpecialActiveNow(makeSpecial({ menu_id: "menu-a" }), { menuId: "menu-b" })
    ).toBe(false);
  });

  it("filters by date range", () => {
    const now = new Date("2026-06-15T12:00:00");
    expect(
      isSpecialActiveNow(
        makeSpecial({ date_from: "2026-06-01", date_to: "2026-06-30" }),
        { now }
      )
    ).toBe(true);
    expect(
      isSpecialActiveNow(
        makeSpecial({ date_from: "2026-07-01", date_to: "2026-07-31" }),
        { now }
      )
    ).toBe(false);
  });

  it("filters by time range", () => {
    const now = new Date("2026-06-15T12:00:00");
    expect(
      isSpecialActiveNow(
        makeSpecial({ time_from: "09:00", time_to: "14:00" }),
        { now }
      )
    ).toBe(true);
    expect(
      isSpecialActiveNow(
        makeSpecial({ time_from: "14:00", time_to: "18:00" }),
        { now }
      )
    ).toBe(false);
  });

  it("handles overnight time windows", () => {
    const now = new Date("2026-06-15T23:30:00");
    expect(
      isSpecialActiveNow(
        makeSpecial({ time_from: "22:00", time_to: "02:00" }),
        { now }
      )
    ).toBe(true);
  });

  it("filters by selected days", () => {
    // 2026-06-15 is a Monday
    const now = new Date("2026-06-15T12:00:00");
    expect(
      isSpecialActiveNow(makeSpecial({ selected_days: ["mon"] }), { now })
    ).toBe(true);
    expect(
      isSpecialActiveNow(makeSpecial({ selected_days: ["tue"] }), { now })
    ).toBe(false);
  });
});
