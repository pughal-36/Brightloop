import { describe, it, expect } from "vitest";
import {
  APP_TZ,
  getToday,
  getTodayDateString,
  today,
  addDays,
  subDays,
  addBillingPeriod,
  getNextPeriodStartOnOrAfter,
} from "./dates";
import { BillingPeriod } from "@/generated/prisma/enums";

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

  it("adds billing periods correctly", () => {
    const base = new Date("2026-01-15T00:00:00.000Z");
    expect(addBillingPeriod(base, BillingPeriod.DAILY, 3).toISOString()).toBe("2026-01-18T00:00:00.000Z");
    expect(addBillingPeriod(base, BillingPeriod.WEEKLY, 2).toISOString()).toBe("2026-01-29T00:00:00.000Z");
    expect(addBillingPeriod(base, BillingPeriod.MONTHLY, 1).toISOString()).toBe("2026-02-15T00:00:00.000Z");
    expect(addBillingPeriod(base, BillingPeriod.YEARLY, 1).toISOString()).toBe("2027-01-15T00:00:00.000Z");

    // Month-end clipping
    const endOfMonth = new Date("2026-01-31T00:00:00.000Z");
    expect(addBillingPeriod(endOfMonth, BillingPeriod.MONTHLY, 1).toISOString()).toBe("2026-02-28T00:00:00.000Z");
  });

  it("calculates next period start on or after resume date", () => {
    const initial = new Date("2026-01-01T00:00:00.000Z");
    // Resume is exactly on a period start
    expect(
      getNextPeriodStartOnOrAfter(initial, BillingPeriod.MONTHLY, new Date("2026-03-01T00:00:00.000Z")).toISOString()
    ).toBe("2026-03-01T00:00:00.000Z");

    // Resume is between period starts (e.g. 2026-03-15) -> advances to 2026-04-01
    expect(
      getNextPeriodStartOnOrAfter(initial, BillingPeriod.MONTHLY, new Date("2026-03-15T00:00:00.000Z")).toISOString()
    ).toBe("2026-04-01T00:00:00.000Z");

    // Resume is before initial -> remains initial
    expect(
      getNextPeriodStartOnOrAfter(initial, BillingPeriod.MONTHLY, new Date("2025-12-15T00:00:00.000Z")).toISOString()
    ).toBe("2026-01-01T00:00:00.000Z");
  });
});

