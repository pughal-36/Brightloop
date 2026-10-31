import { describe, it, expect, beforeAll, afterAll } from "vitest";

// Mock server-only to allow importing db in Vitest
import { vi } from "vitest";
vi.mock("server-only", () => ({}));

import { db } from "@/server/db";

describe("Database schema, constraints and sequences integration tests", () => {
  const customerId = "test-cust-schema-001";
  const planId = "test-plan-schema-001";
  const subscriptionId = "test-sub-schema-001";
  const invoiceId1 = "test-inv-schema-001";
  const invoiceId2 = "test-inv-schema-002";
  const discountId = "test-disc-schema-001";

  beforeAll(async () => {
    // Clean up any stale test rows before starting
    await cleanup();

    // Reset sequence so numbers start at 1 for test (b)
    await db.$executeRawUnsafe("SELECT setval('invoice_number_seq', 1, false);");

    // Setup base fixtures
    await db.customer.create({
      data: {
        id: customerId,
        name: "Test Customer",
        email: "test.customer@brightloop.io",
      },
    });

    await db.plan.create({
      data: {
        id: planId,
        name: "Test Plan",
        price: 50000,
        billingPeriod: "MONTHLY",
        availableFrom: new Date("2026-01-01"),
      },
    });

    await db.subscription.create({
      data: {
        id: subscriptionId,
        customerId,
        planId,
        startDate: new Date("2026-01-01"),
        expiryDate: new Date("2026-12-31"),
        nextPeriodStart: new Date("2026-02-01"),
        paymentTerms: "IMMEDIATE",
        planFee: 50000,
        planTaxRateBps: 0,
      },
    });
  });

  afterAll(async () => {
    await cleanup();
  });

  async function cleanup() {
    try {
      await db.payment.deleteMany({
        where: { invoiceId: { in: [invoiceId1, invoiceId2] } },
      });
      await db.invoice.deleteMany({
        where: { id: { in: [invoiceId1, invoiceId2] } },
      });
      await db.subscription.deleteMany({
        where: { id: subscriptionId },
      });
      await db.plan.deleteMany({
        where: { id: planId },
      });
      await db.customer.deleteMany({
        where: { id: customerId },
      });
      await db.discount.deleteMany({
        where: { id: discountId },
      });
    } catch {
      // Ignore errors during cleanup
    }
  }

  it("(b) generates sequential invoice numbers INV-000001, INV-000002", async () => {
    const inv1 = await db.invoice.create({
      data: {
        id: invoiceId1,
        subscriptionId,
        customerId,
        periodStart: new Date("2026-01-01"),
        periodEnd: new Date("2026-01-31"),
        issueDate: new Date("2026-01-01"),
        dueDate: new Date("2026-01-15"),
        subtotal: 50000,
        discountTotal: 0,
        taxTotal: 0,
        total: 50000,
      },
    });

    const inv2 = await db.invoice.create({
      data: {
        id: invoiceId2,
        subscriptionId,
        customerId,
        periodStart: new Date("2026-02-01"),
        periodEnd: new Date("2026-02-28"),
        issueDate: new Date("2026-02-01"),
        dueDate: new Date("2026-02-15"),
        subtotal: 50000,
        discountTotal: 0,
        taxTotal: 0,
        total: 50000,
      },
    });

    expect(inv1.number).toBe("INV-000001");
    expect(inv2.number).toBe("INV-000002");
  });

  it("(a) two invoices with the same subscriptionId and periodStart fail on unique constraint", async () => {
    // inv1 already exists with subscriptionId and periodStart 2026-01-01
    await expect(
      db.invoice.create({
        data: {
          id: "test-inv-duplicate-period",
          subscriptionId,
          customerId,
          periodStart: new Date("2026-01-01"),
          periodEnd: new Date("2026-01-31"),
          issueDate: new Date("2026-01-01"),
          dueDate: new Date("2026-01-15"),
          subtotal: 50000,
          discountTotal: 0,
          taxTotal: 0,
          total: 50000,
        },
      })
    ).rejects.toThrow();
  });

  it("(c) a Discount with usedCount > usageLimit is rejected by the CHECK constraint", async () => {
    await expect(
      db.discount.create({
        data: {
          id: discountId,
          name: "Test Limit Exceeded",
          type: "FIXED",
          value: 1000,
          usageLimit: 5,
          usedCount: 6, // Violates: usedCount <= usageLimit
          scope: "SUBSCRIPTION",
          startDate: new Date("2026-01-01"),
          endDate: new Date("2026-12-31"),
        },
      })
    ).rejects.toThrow();
  });

  it("(d) a Payment with amount 0 is rejected by the CHECK constraint", async () => {
    await expect(
      db.payment.create({
        data: {
          invoiceId: invoiceId1,
          method: "CASH",
          amount: 0, // Violates: amount > 0
          paidOn: new Date("2026-01-05"),
        },
      })
    ).rejects.toThrow();
  });
});
