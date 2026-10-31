import { describe, it, expect } from "vitest";
import { APP_TZ, getToday, getTodayDateString, today, addDays, subDays } from "./dates";

describe("dates helpers", () => {
  it("exports APP_TZ as Asia/Kolkata", () => {
    expect(APP_TZ).toBe("Asia/Kolkata");
  });

  it("calculates today date string correctly in Asia/Kolkata", () => {
    // 2026-10-31T20:00:00Z is 2026-11-01 01:30 in Asia/Kolkata (+5:30)
    const testDate = new Date("2026-10-31T20:00:00.000Z");
    expect(getTodayDateString(testDate)).toBe("2026-11-01");
  });

  it("returns midnight UTC for the calculated date", () => {
    const testDate = new Date("2026-10-31T20:00:00.000Z");
    const d = getToday(testDate);
    expect(d.toISOString()).toBe("2026-11-01T00:00:00.000Z");
    expect(today(testDate).toISOString()).toBe("2026-11-01T00:00:00.000Z");
  });

  it("adds and subtracts days correctly at UTC boundaries", () => {
    const base = new Date("2026-01-01T00:00:00.000Z");
    expect(addDays(base, 15).toISOString()).toBe("2026-01-16T00:00:00.000Z");
    expect(subDays(base, 5).toISOString()).toBe("2025-12-27T00:00:00.000Z");
  });
});

