import { describe, it, expect } from "vitest";
import {
  formatDayLabel,
  formatSelectedDays,
  formatTimeWindow,
  formatDateRange,
  formatTimeWindows,
  formatSpecialSchedule,
} from "@/lib/utils/specials";

describe("formatDayLabel", () => {
  it("returns short labels for known days", () => {
    expect(formatDayLabel("mon")).toBe("Mon");
    expect(formatDayLabel("fri")).toBe("Fri");
    expect(formatDayLabel("SUN")).toBe("Sun");
  });

  it("falls back to the input for unknown keys", () => {
    expect(formatDayLabel("xyz")).toBe("xyz");
  });
});

describe("formatSelectedDays", () => {
  it("returns null for empty or null input", () => {
    expect(formatSelectedDays(null)).toBeNull();
    expect(formatSelectedDays([])).toBeNull();
  });

  it("returns 'Every day' for all seven days", () => {
    expect(formatSelectedDays(["mon", "tue", "wed", "thu", "fri", "sat", "sun"])).toBe(
      "Every day"
    );
  });

  it("sorts days and joins them", () => {
    expect(formatSelectedDays(["fri", "mon", "wed"])).toBe("Mon, Wed, Fri");
  });

  it("ignores unknown day keys", () => {
    expect(formatSelectedDays(["mon", "xyz"])).toBe("Mon");
  });
});

describe("formatTimeWindow", () => {
  it("returns null when both ends are missing", () => {
    expect(formatTimeWindow(null, null)).toBeNull();
  });

  it("formats a full window", () => {
    expect(formatTimeWindow("09:00", "14:00")).toBe("09:00 – 14:00");
  });

  it("handles seconds by truncating to HH:MM", () => {
    expect(formatTimeWindow("09:00:00", "14:30:00")).toBe("09:00 – 14:30");
  });

  it("handles open-ended windows", () => {
    expect(formatTimeWindow("09:00", null)).toBe("From 09:00");
    expect(formatTimeWindow(null, "22:00")).toBe("Until 22:00");
  });
});

describe("formatDateRange", () => {
  it("returns null when both dates are missing", () => {
    expect(formatDateRange(null, null)).toBeNull();
  });

  it("formats a full range", () => {
    expect(formatDateRange("2026-06-01", "2026-06-30")).toBe("2026-06-01 to 2026-06-30");
  });

  it("handles open-ended ranges", () => {
    expect(formatDateRange("2026-06-01", null)).toBe("From 2026-06-01");
    expect(formatDateRange(null, "2026-06-30")).toBe("Until 2026-06-30");
  });
});

describe("formatTimeWindows", () => {
  it("returns null for non-arrays", () => {
    expect(formatTimeWindows(null)).toBeNull();
    expect(formatTimeWindows("not an array")).toBeNull();
  });

  it("formats valid window objects", () => {
    expect(
      formatTimeWindows([
        { from: "09:00", to: "12:00" },
        { from: "17:00", to: "20:00" },
      ])
    ).toEqual(["09:00 – 12:00", "17:00 – 20:00"]);
  });

  it("skips invalid window entries", () => {
    expect(formatTimeWindows([{ from: "09:00" }, "bad", { to: "22:00" }])).toEqual([
      "From 09:00",
      "Until 22:00",
    ]);
  });
});

describe("formatSpecialSchedule", () => {
  it("returns an empty array when no schedule is set", () => {
    expect(
      formatSpecialSchedule({
        date_from: null,
        date_to: null,
        time_from: null,
        time_to: null,
        selected_days: null,
      })
    ).toEqual([]);
  });

  it("combines date, days and time into ordered lines", () => {
    const lines = formatSpecialSchedule({
      date_from: "2026-06-01",
      date_to: "2026-06-30",
      selected_days: ["mon", "wed", "fri"],
      time_from: "09:00",
      time_to: "14:00",
    });
    expect(lines).toEqual([
      "2026-06-01 to 2026-06-30",
      "Mon, Wed, Fri",
      "09:00 – 14:00",
    ]);
  });

  it("includes time_windows when present", () => {
    const lines = formatSpecialSchedule({
      date_from: null,
      date_to: null,
      time_from: null,
      time_to: null,
      selected_days: null,
      time_windows: [{ from: "09:00", to: "12:00" }],
    });
    expect(lines).toEqual(["09:00 – 12:00"]);
  });
});
