import { describe, it, expect } from "vitest";
import { BillingPeriod } from "@/generated/prisma/enums";
import {
  computePeriodSpan,
  findPeriodIndex,
  getMissedPeriods,
} from "@/server/modules/billing/periods";

describe("Billing Periods Pure Calculations", () => {
  it("Jan 31 monthly start yields correct periods without month-end drift", () => {
    const startDate = new Date("2026-01-31T00:00:00.000Z");

    // Period 0: Jan 31 -> Feb 28, next = Feb 28
    const p0 = computePeriodSpan(startDate, BillingPeriod.MONTHLY, 0);
    expect(p0.periodStart.toISOString().slice(0, 10)).toBe("2026-01-31");
    expect(p0.nextPeriodStart.toISOString().slice(0, 10)).toBe("2026-02-28");
    expect(p0.periodEnd.toISOString().slice(0, 10)).toBe("2026-02-27");

    // Period 1: Feb 28 -> Mar 31, next = Mar 31
    const p1 = computePeriodSpan(startDate, BillingPeriod.MONTHLY, 1);
    expect(p1.periodStart.toISOString().slice(0, 10)).toBe("2026-02-28");
    expect(p1.nextPeriodStart.toISOString().slice(0, 10)).toBe("2026-03-31");
    expect(p1.periodEnd.toISOString().slice(0, 10)).toBe("2026-03-30");

    // Period 2: Mar 31 -> Apr 30, next = Apr 30
    const p2 = computePeriodSpan(startDate, BillingPeriod.MONTHLY, 2);
    expect(p2.periodStart.toISOString().slice(0, 10)).toBe("2026-03-31");
    expect(p2.nextPeriodStart.toISOString().slice(0, 10)).toBe("2026-04-30");
    expect(p2.periodEnd.toISOString().slice(0, 10)).toBe("2026-04-29");

    // Period 3: Apr 30 -> May 31, next = May 31
    const p3 = computePeriodSpan(startDate, BillingPeriod.MONTHLY, 3);
    expect(p3.periodStart.toISOString().slice(0, 10)).toBe("2026-04-30");
    expect(p3.nextPeriodStart.toISOString().slice(0, 10)).toBe("2026-05-31");
    expect(p3.periodEnd.toISOString().slice(0, 10)).toBe("2026-05-30");
  });

  it("handles daily, weekly, and yearly periods correctly", () => {
    const dailyStart = new Date("2026-03-01T00:00:00.000Z");
    const d0 = computePeriodSpan(dailyStart, BillingPeriod.DAILY, 0);
    expect(d0.periodStart.toISOString().slice(0, 10)).toBe("2026-03-01");
    expect(d0.periodEnd.toISOString().slice(0, 10)).toBe("2026-03-01");
    expect(d0.nextPeriodStart.toISOString().slice(0, 10)).toBe("2026-03-02");

    const weeklyStart = new Date("2026-03-01T00:00:00.000Z");
    const w0 = computePeriodSpan(weeklyStart, BillingPeriod.WEEKLY, 0);
    expect(w0.periodStart.toISOString().slice(0, 10)).toBe("2026-03-01");
    expect(w0.periodEnd.toISOString().slice(0, 10)).toBe("2026-03-07");
    expect(w0.nextPeriodStart.toISOString().slice(0, 10)).toBe("2026-03-08");

    const yearlyStart = new Date("2026-02-28T00:00:00.000Z");
    const y0 = computePeriodSpan(yearlyStart, BillingPeriod.YEARLY, 0);
    expect(y0.periodStart.toISOString().slice(0, 10)).toBe("2026-02-28");
    expect(y0.nextPeriodStart.toISOString().slice(0, 10)).toBe("2027-02-28");
    expect(y0.periodEnd.toISOString().slice(0, 10)).toBe("2027-02-27");
  });

  it("findPeriodIndex resolves correct index for any cursor", () => {
    const start = new Date("2026-01-31T00:00:00.000Z");
    expect(findPeriodIndex(start, BillingPeriod.MONTHLY, new Date("2026-01-31T00:00:00.000Z"))).toBe(0);
    expect(findPeriodIndex(start, BillingPeriod.MONTHLY, new Date("2026-02-28T00:00:00.000Z"))).toBe(1);
    expect(findPeriodIndex(start, BillingPeriod.MONTHLY, new Date("2026-03-31T00:00:00.000Z"))).toBe(2);
  });

  it("getMissedPeriods returns all periods up to asOfDate before expiry", () => {
    const start = new Date("2026-01-01T00:00:00.000Z");
    const cursor = new Date("2026-01-01T00:00:00.000Z");
    const asOf = new Date("2026-03-15T00:00:00.000Z");
    const expiry = new Date("2026-12-31T00:00:00.000Z");

    const spans = getMissedPeriods(start, BillingPeriod.MONTHLY, cursor, asOf, expiry);
    expect(spans.length).toBe(3);
    expect(spans[0].periodStart.toISOString().slice(0, 10)).toBe("2026-01-01");
    expect(spans[1].periodStart.toISOString().slice(0, 10)).toBe("2026-02-01");
    expect(spans[2].periodStart.toISOString().slice(0, 10)).toBe("2026-03-01");
  });
});

