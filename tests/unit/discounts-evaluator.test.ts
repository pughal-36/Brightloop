import { describe, it, expect, vi } from "vitest";

// Mock server-only to allow importing server code in tests
vi.mock("server-only", () => ({}));

import { evaluateBestDiscount } from "@/server/modules/discounts/service";
import { DiscountType, DiscountScope } from "@/generated/prisma/enums";
import type { DiscountCandidate, LineForDiscount } from "@/server/modules/discounts/schema";

describe("evaluateBestDiscount pure function (Spec 06)", () => {
  const productA = "prod-00000000-0000-4000-a000-000000000001";
  const productB = "prod-00000000-0000-4000-a000-000000000002";
  const productC = "prod-00000000-0000-4000-a000-000000000003";

  const standardLines: LineForDiscount[] = [
    {
      productId: productA,
      qty: 2,
      amount: 200000, // ₹2,000.00
      unitPrice: 100000,
    },
    {
      productId: productB,
      qty: 3,
      amount: 150000, // ₹1,500.00
      unitPrice: 50000,
    },
  ];

  const planFee = 50000; // ₹500.00
  const evalDate = new Date("2026-06-15T00:00:00.000Z");

  it("returns null if candidates list is empty", () => {
    const result = evaluateBestDiscount(standardLines, planFee, evalDate, []);
    expect(result).toBeNull();
  });

  describe("Date eligibility window", () => {
    const baseDiscount: DiscountCandidate = {
      id: "disc-dates-1",
      name: "Spring Sale 10%",
      type: DiscountType.PERCENT,
      value: 1000, // 10%
      startDate: new Date("2026-06-01T00:00:00.000Z"),
      endDate: new Date("2026-06-30T00:00:00.000Z"),
      usageLimit: 100,
      usedCount: 10,
      scope: DiscountScope.SUBSCRIPTION,
      isActive: true,
    };

    it("accepts evaluation date within startDate and endDate", () => {
      const result = evaluateBestDiscount(standardLines, planFee, new Date("2026-06-15"), [baseDiscount]);
      expect(result).not.toBeNull();
      expect(result?.discountId).toBe("disc-dates-1");
    });

    it("rejects evaluation date before startDate", () => {
      const result = evaluateBestDiscount(standardLines, planFee, new Date("2026-05-31"), [baseDiscount]);
      expect(result).toBeNull();
    });

    it("rejects evaluation date after endDate", () => {
      const result = evaluateBestDiscount(standardLines, planFee, new Date("2026-07-01"), [baseDiscount]);
      expect(result).toBeNull();
    });
  });

  describe("Usage limit eligibility", () => {
    it("is eligible when usedCount < usageLimit", () => {
      const discount: DiscountCandidate = {
        id: "disc-limit-1",
        name: "Limited Promo",
        type: DiscountType.FIXED,
        value: 10000,
        startDate: new Date("2026-01-01"),
        endDate: new Date("2026-12-31"),
        usageLimit: 5,
        usedCount: 4,
        scope: DiscountScope.SUBSCRIPTION,
        isActive: true,
      };

      const result = evaluateBestDiscount(standardLines, planFee, evalDate, [discount]);
      expect(result).not.toBeNull();
      expect(result?.amount).toBe(10000);
    });

    it("is not eligible when usedCount >= usageLimit (exhausted)", () => {
      const discount: DiscountCandidate = {
        id: "disc-limit-2",
        name: "Exhausted Promo",
        type: DiscountType.FIXED,
        value: 10000,
        startDate: new Date("2026-01-01"),
        endDate: new Date("2026-12-31"),
        usageLimit: 5,
        usedCount: 5,
        scope: DiscountScope.SUBSCRIPTION,
        isActive: true,
      };

      const result = evaluateBestDiscount(standardLines, planFee, evalDate, [discount]);
      expect(result).toBeNull();
    });
  });

  describe("Thresholds: minPurchase and minQty", () => {
    // Total subtotal for standardLines (350000) + planFee (50000) = 400000 paise (₹4,000.00)
    // Total qty = 2 + 3 = 5

    it("enforces minPurchase on SUBSCRIPTION scope (including planFee)", () => {
      const discountMeetingThreshold: DiscountCandidate = {
        id: "disc-thresh-1",
        name: "Big Spender ₹500 Off",
        type: DiscountType.FIXED,
        value: 50000,
        minPurchase: 400000, // exactly 400000
        startDate: new Date("2026-01-01"),
        endDate: new Date("2026-12-31"),
        usageLimit: 50,
        usedCount: 0,
        scope: DiscountScope.SUBSCRIPTION,
        isActive: true,
      };

      const discountFailingThreshold: DiscountCandidate = {
        ...discountMeetingThreshold,
        id: "disc-thresh-2",
        minPurchase: 400001, // exceeds 400000
      };

      expect(evaluateBestDiscount(standardLines, planFee, evalDate, [discountMeetingThreshold])?.amount).toBe(50000);
      expect(evaluateBestDiscount(standardLines, planFee, evalDate, [discountFailingThreshold])).toBeNull();
    });

    it("enforces minQty on SUBSCRIPTION scope", () => {
      const discountMeetingQty: DiscountCandidate = {
        id: "disc-qty-1",
        name: "Bulk 5+ items",
        type: DiscountType.PERCENT,
        value: 1000, // 10%
        minQty: 5,
        startDate: new Date("2026-01-01"),
        endDate: new Date("2026-12-31"),
        usageLimit: 50,
        usedCount: 0,
        scope: DiscountScope.SUBSCRIPTION,
        isActive: true,
      };

      const discountFailingQty: DiscountCandidate = {
        ...discountMeetingQty,
        id: "disc-qty-2",
        minQty: 6,
      };

      expect(evaluateBestDiscount(standardLines, planFee, evalDate, [discountMeetingQty])?.amount).toBe(40000); // 10% of 400000
      expect(evaluateBestDiscount(standardLines, planFee, evalDate, [discountFailingQty])).toBeNull();
    });
  });

  describe("Scope: SUBSCRIPTION vs PRODUCTS", () => {
    it("scope SUBSCRIPTION applies to the whole pre-tax subtotal including plan fee", () => {
      // Subtotal = 200000 + 150000 + 50000 = 400000 paise
      // 10% = 40000 paise
      const subDiscount: DiscountCandidate = {
        id: "disc-sub",
        name: "10% Off Subscription",
        type: DiscountType.PERCENT,
        value: 1000, // 10%
        startDate: new Date("2026-01-01"),
        endDate: new Date("2026-12-31"),
        usageLimit: 100,
        usedCount: 0,
        scope: DiscountScope.SUBSCRIPTION,
        isActive: true,
      };

      const result = evaluateBestDiscount(standardLines, planFee, evalDate, [subDiscount]);
      expect(result).not.toBeNull();
      expect(result?.amount).toBe(40000);
      expect(result?.baseAmount).toBe(400000);
    });

    it("scope PRODUCTS applies only to matching products and NEVER to plan fee", () => {
      // Only productA matches: amount = 200000 paise. (Plan fee 50000 is ignored).
      // 10% of 200000 = 20000 paise
      const prodDiscount: DiscountCandidate = {
        id: "disc-prod",
        name: "10% Off Product A",
        type: DiscountType.PERCENT,
        value: 1000,
        startDate: new Date("2026-01-01"),
        endDate: new Date("2026-12-31"),
        usageLimit: 100,
        usedCount: 0,
        scope: DiscountScope.PRODUCTS,
        productIds: [productA],
        isActive: true,
      };

      const result = evaluateBestDiscount(standardLines, planFee, evalDate, [prodDiscount]);
      expect(result).not.toBeNull();
      expect(result?.amount).toBe(20000);
      expect(result?.baseAmount).toBe(200000);
    });

    it("scope PRODUCTS returns null if no products match", () => {
      const nonMatchingDiscount: DiscountCandidate = {
        id: "disc-prod-c",
        name: "10% Off Product C",
        type: DiscountType.PERCENT,
        value: 1000,
        startDate: new Date("2026-01-01"),
        endDate: new Date("2026-12-31"),
        usageLimit: 100,
        usedCount: 0,
        scope: DiscountScope.PRODUCTS,
        productIds: [productC], // not in standardLines
        isActive: true,
      };

      expect(evaluateBestDiscount(standardLines, planFee, evalDate, [nonMatchingDiscount])).toBeNull();
    });

    it("enforces minPurchase and minQty against matching products only", () => {
      // Product A: qty 2, amount 200000
      const prodDiscount: DiscountCandidate = {
        id: "disc-prod-min",
        name: "Special Deal on Product A",
        type: DiscountType.FIXED,
        value: 30000,
        minPurchase: 250000, // product A only has 200000 -> should fail
        startDate: new Date("2026-01-01"),
        endDate: new Date("2026-12-31"),
        usageLimit: 100,
        usedCount: 0,
        scope: DiscountScope.PRODUCTS,
        productIds: [productA],
        isActive: true,
      };

      expect(evaluateBestDiscount(standardLines, planFee, evalDate, [prodDiscount])).toBeNull();
    });
  });

  describe("Fixed discount ceiling rule", () => {
    it("caps fixed discount at the base amount it applies to (never exceeds base)", () => {
      // Base = 200000 paise for product A
      const largeFixedDiscount: DiscountCandidate = {
        id: "disc-large-fixed",
        name: "Huge ₹5,000 Off",
        type: DiscountType.FIXED,
        value: 500000, // ₹5,000 (500000 paise) > base 200000
        startDate: new Date("2026-01-01"),
        endDate: new Date("2026-12-31"),
        usageLimit: 10,
        usedCount: 0,
        scope: DiscountScope.PRODUCTS,
        productIds: [productA],
        isActive: true,
      };

      const result = evaluateBestDiscount(standardLines, planFee, evalDate, [largeFixedDiscount]);
      expect(result).not.toBeNull();
      // Must be capped at base amount 200000 paise
      expect(result?.amount).toBe(200000);
      expect(result?.baseAmount).toBe(200000);
    });
  });

  describe("Best single discount (best of many)", () => {
    it("selects the single discount with the largest savings and never stacks", () => {
      const candidates: DiscountCandidate[] = [
        {
          id: "disc-small",
          name: "₹100 Off",
          type: DiscountType.FIXED,
          value: 10000, // ₹100
          startDate: new Date("2026-01-01"),
          endDate: new Date("2026-12-31"),
          usageLimit: 100,
          usedCount: 0,
          scope: DiscountScope.SUBSCRIPTION,
          isActive: true,
        },
        {
          id: "disc-percent-10",
          name: "10% Off Subscription",
          type: DiscountType.PERCENT,
          value: 1000, // 10% of 400000 = ₹400 (40000 paise)
          startDate: new Date("2026-01-01"),
          endDate: new Date("2026-12-31"),
          usageLimit: 100,
          usedCount: 0,
          scope: DiscountScope.SUBSCRIPTION,
          isActive: true,
        },
        {
          id: "disc-fixed-500",
          name: "₹500 Off",
          type: DiscountType.FIXED,
          value: 50000, // ₹500 (50000 paise) -> HIGHEST
          startDate: new Date("2026-01-01"),
          endDate: new Date("2026-12-31"),
          usageLimit: 100,
          usedCount: 0,
          scope: DiscountScope.SUBSCRIPTION,
          isActive: true,
        },
        {
          id: "disc-percent-12-prodA",
          name: "12% Off Product A",
          type: DiscountType.PERCENT,
          value: 1200, // 12% of 200000 = 24000 paise
          startDate: new Date("2026-01-01"),
          endDate: new Date("2026-12-31"),
          usageLimit: 100,
          usedCount: 0,
          scope: DiscountScope.PRODUCTS,
          productIds: [productA],
          isActive: true,
        },
      ];

      const best = evaluateBestDiscount(standardLines, planFee, evalDate, candidates);
      expect(best).not.toBeNull();
      expect(best?.discountId).toBe("disc-fixed-500");
      expect(best?.amount).toBe(50000);
    });
  });

  describe("Polymorphic invocation signatures", () => {
    const discount: DiscountCandidate = {
      id: "disc-poly",
      name: "Poly 10%",
      type: DiscountType.PERCENT,
      value: 1000,
      startDate: new Date("2026-01-01"),
      endDate: new Date("2026-12-31"),
      usageLimit: 100,
      usedCount: 0,
      scope: DiscountScope.SUBSCRIPTION,
      isActive: true,
    };

    it("supports object options signature", () => {
      const result = evaluateBestDiscount({
        subscriptionLines: standardLines,
        planFee,
        date: evalDate,
        candidateDiscounts: [discount],
      });
      expect(result?.amount).toBe(40000);
    });

    it("supports (subscription, lines, date, discounts) signature", () => {
      const result = evaluateBestDiscount({ planFee }, standardLines, evalDate, [discount]);
      expect(result?.amount).toBe(40000);
    });
  });
});
