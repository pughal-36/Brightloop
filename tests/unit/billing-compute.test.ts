import { describe, it, expect, vi } from "vitest";

// Mock server-only so we can import server modules in Vitest
vi.mock("server-only", () => ({}));

import {
  PaymentTerms,
  DiscountScope,
  DiscountType,
  InvoiceLineKind,
} from "@/generated/prisma/enums";
import { computeInvoice, computeDueDate } from "@/server/modules/billing/compute";
import type { DiscountCandidate } from "@/server/modules/discounts/schema";

describe("Invoice Computation Pure Functions", () => {
  it("computes due date correctly for all payment terms", () => {
    const issueDate = new Date("2026-05-01T00:00:00.000Z");
    expect(computeDueDate(issueDate, PaymentTerms.IMMEDIATE).toISOString().slice(0, 10)).toBe("2026-05-01");
    expect(computeDueDate(issueDate, PaymentTerms.NET_15).toISOString().slice(0, 10)).toBe("2026-05-16");
    expect(computeDueDate(issueDate, PaymentTerms.NET_30).toISOString().slice(0, 10)).toBe("2026-05-31");
  });

  it("computes invoice lines, discount, and tax matching exact hand calculation", () => {
    // Hand calculation:
    // Plan fee = 10,000 paise (₹100), tax rate = 1800 bps (18%)
    // Line 1: qty = 2, unitPrice = 25,000 paise (₹250), tax rate = 1800 bps (18%), amount = 50,000 paise (₹500)
    // Pre-tax subtotal = 10,000 + 50,000 = 60,000 paise (₹600)
    // Discount: Scope = SUBSCRIPTION, Type = PERCENT, Value = 1000 bps (10%)
    //
    // Discount amount: 10% of 60,000 = 6,000 paise (₹60)
    //
    // Line discounted bases & taxes:
    // Plan fee: 10,000 - 1,000 = 9,000 paise base. Tax = 18% of 9,000 = 1,620 paise.
    // Line 1: 50,000 - 5,000 = 45,000 paise base. Tax = 18% of 45,000 = 8,100 paise.
    // Discount line: amount = -6,000, tax = 0.
    //
    // Invoice totals:
    // subtotal = 60,000 paise
    // discountTotal = 6,000 paise
    // taxTotal = 1,620 + 8,100 = 9,720 paise
    // total = 60,000 - 6,000 + 9,720 = 63,720 paise (₹637.20)

    const subscription = {
      id: "sub-123",
      customerId: "cust-123",
      planFee: 10000,
      planTaxRateBps: 1800,
      planName: "Pro Monthly",
      paymentTerms: PaymentTerms.NET_15,
      lines: [
        {
          productId: "prod-1",
          description: "API Access",
          qty: 2,
          unitPrice: 25000,
          taxRateBps: 1800,
          amount: 50000,
        },
      ],
    };

    const candidateDiscounts: DiscountCandidate[] = [
      {
        id: "disc-10pct",
        name: "10% Off All",
        type: DiscountType.PERCENT,
        value: 1000, // 10.00%
        scope: DiscountScope.SUBSCRIPTION,
        startDate: new Date("2026-01-01T00:00:00.000Z"),
        endDate: new Date("2026-12-31T00:00:00.000Z"),
        usageLimit: 100,
        usedCount: 0,
        isActive: true,
      },
    ];

    const periodStart = new Date("2026-06-01T00:00:00.000Z");
    const periodEnd = new Date("2026-06-30T00:00:00.000Z");

    const invoice = computeInvoice(subscription, periodStart, periodEnd, candidateDiscounts);

    expect(invoice.subtotal).toBe(60000);
    expect(invoice.discountTotal).toBe(6000);
    expect(invoice.taxTotal).toBe(9720);
    expect(invoice.total).toBe(63720);
    expect(invoice.dueDate.toISOString().slice(0, 10)).toBe("2026-06-16");

    // Line 0: PLAN_FEE first
    expect(invoice.lines[0].kind).toBe(InvoiceLineKind.PLAN_FEE);
    expect(invoice.lines[0].description).toBe("Plan Fee: Pro Monthly");
    expect(invoice.lines[0].unitPrice).toBe(10000);
    expect(invoice.lines[0].amount).toBe(10000);
    expect(invoice.lines[0].taxAmount).toBe(1620);

    // Line 1: PRODUCT
    expect(invoice.lines[1].kind).toBe(InvoiceLineKind.PRODUCT);
    expect(invoice.lines[1].description).toBe("API Access");
    expect(invoice.lines[1].qty).toBe(2);
    expect(invoice.lines[1].unitPrice).toBe(25000);
    expect(invoice.lines[1].amount).toBe(50000);
    expect(invoice.lines[1].taxAmount).toBe(8100);

    // Line 2: DISCOUNT
    expect(invoice.lines[2].kind).toBe(InvoiceLineKind.DISCOUNT);
    expect(invoice.lines[2].description).toBe("Discount: 10% Off All");
    expect(invoice.lines[2].amount).toBe(-6000);
    expect(invoice.lines[2].taxAmount).toBe(0);
    expect(invoice.lines[2].discountId).toBe("disc-10pct");
  });
});
