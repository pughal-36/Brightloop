import { describe, it, expect, vi } from "vitest";

// Mock server-only for Vitest
vi.mock("server-only", () => ({}));

import { BillingPeriod } from "@/generated/prisma/enums";
import { normalizeToMRR, calculateARR } from "@/server/modules/dashboard/service";

describe("MRR Normalization & ARR Unit Tests", () => {
  it("normalizes MONTHLY plans without adjustment (1:1)", () => {
    // 50,000 paise = 500 INR/month
    const mrr = normalizeToMRR(50000, BillingPeriod.MONTHLY);
    expect(mrr).toBe(50000);
  });

  it("normalizes YEARLY plans by dividing by 12 with rounding", () => {
    // 120,000 paise = 1,200 INR/year -> 10,000 paise/month (100 INR/mo)
    expect(normalizeToMRR(120000, BillingPeriod.YEARLY)).toBe(10000);

    // 100,000 paise / 12 = 8,333.33 -> rounds to 8,333
    expect(normalizeToMRR(100000, BillingPeriod.YEARLY)).toBe(8333);

    // 10,000 paise / 12 = 833.33 -> rounds to 833
    expect(normalizeToMRR(10000, BillingPeriod.YEARLY)).toBe(833);
  });

  it("normalizes WEEKLY plans by multiplying by 52/12 with rounding", () => {
    // Formula: (recurring * 52) / 12
    // 12,000 paise/week -> (12,000 * 52) / 12 = 52,000 paise/month
    expect(normalizeToMRR(12000, BillingPeriod.WEEKLY)).toBe(52000);

    // 10,000 paise/week -> (10,000 * 52) / 12 = 43,333.33 -> 43,333 paise/month
    expect(normalizeToMRR(10000, BillingPeriod.WEEKLY)).toBe(43333);

    // 1,000 paise/week -> (1,000 * 52) / 12 = 4,333.33 -> 4,333 paise/month
    expect(normalizeToMRR(1000, BillingPeriod.WEEKLY)).toBe(4333);
  });

  it("normalizes DAILY plans by multiplying by 365/12 with rounding", () => {
    // Formula: (recurring * 365) / 12
    // 1,200 paise/day -> (1,200 * 365) / 12 = 36,500 paise/month
    expect(normalizeToMRR(1200, BillingPeriod.DAILY)).toBe(36500);

    // 10,000 paise/day (100 INR/day) -> (10,000 * 365) / 12 = 304,166.67 -> 304,167 paise/month
    expect(normalizeToMRR(10000, BillingPeriod.DAILY)).toBe(304167);

    // 100 paise/day (1 INR/day) -> (100 * 365) / 12 = 3,041.67 -> 3,042 paise/month
    expect(normalizeToMRR(100, BillingPeriod.DAILY)).toBe(3042);
  });

  it("handles zero recurring total across all billing periods", () => {
    expect(normalizeToMRR(0, BillingPeriod.DAILY)).toBe(0);
    expect(normalizeToMRR(0, BillingPeriod.WEEKLY)).toBe(0);
    expect(normalizeToMRR(0, BillingPeriod.MONTHLY)).toBe(0);
    expect(normalizeToMRR(0, BillingPeriod.YEARLY)).toBe(0);
  });

  it("calculates ARR accurately as MRR * 12", () => {
    // 100,000 paise MRR -> 1,200,000 paise ARR
    expect(calculateARR(100000)).toBe(1200000);
    expect(calculateARR(0)).toBe(0);
    expect(calculateARR(43333)).toBe(519996);
  });
});
