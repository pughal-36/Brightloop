import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";

// Mock server-only so we can import server modules in Vitest
vi.mock("server-only", () => ({}));

import { db } from "@/server/db";
import {
  Role,
  SubscriptionStatus,
  DiscountType,
  DiscountScope,
  BillingPeriod,
  PaymentTerms,
  InvoiceStatus,
  InvoiceLineKind,
} from "@/generated/prisma/enums";
import type { Session } from "@/server/lib/session";
import * as billingService from "@/server/modules/billing/service";
import * as subService from "@/server/modules/subscriptions/service";
import * as discountService from "@/server/modules/discounts/service";
import * as billingRepo from "@/server/modules/billing/repo";
import { getMissedPeriods } from "@/server/modules/billing/periods";
import { POST as cronBillingRoute } from "@/app/api/cron/billing/route";
import { NextRequest } from "next/server";
import { env } from "@/server/env";

describe("Billing Engine Integration Tests", { timeout: 40000 }, () => {
  let adminSession: Session;
  let testCustomer: { id: string; email: string };
  let testPlanMonthly: { id: string; price: number; name: string };
  let testProduct: { id: string; salesPrice: number };
  let testTax: { id: string; rateBps: number };

  const testPlanId = "11111111-2222-4000-b000-000000000001";
  const testCustomerId = "11111111-2222-4000-b000-000000000002";
  const testDiscountId = "11111111-2222-4000-b000-000000000003";

  async function cleanup() {
    await db.invoiceLine.deleteMany({
      where: {
        invoice: {
          subscription: {
            customerId: testCustomerId,
          },
        },
      },
    });
    await db.invoice.deleteMany({
      where: { customerId: testCustomerId },
    });
    await db.subscriptionLine.deleteMany({
      where: {
        subscription: { customerId: testCustomerId },
      },
    });
    await db.statusHistory.deleteMany({
      where: {
        entity: "SUBSCRIPTION",
        entityId: {
          in: (
            await db.subscription.findMany({
              where: { customerId: testCustomerId },
              select: { id: true },
            })
          ).map((s) => s.id),
        },
      },
    });
    await db.subscription.deleteMany({
      where: { customerId: testCustomerId },
    });
    await db.discountProduct.deleteMany({
      where: { discountId: testDiscountId },
    });
    await db.discount.deleteMany({
      where: { id: testDiscountId },
    });
    await db.billingRun.deleteMany({
      where: {
        startedById: adminSession?.user?.id ?? "non-existent",
      },
    });
  }

  beforeAll(async () => {
    const adminUser = await db.user.findFirst({
      where: { role: Role.ADMIN, isActive: true },
    });
    expect(adminUser).not.toBeNull();
    adminSession = {
      user: {
        id: adminUser!.id,
        email: adminUser!.email,
        name: adminUser!.name,
        role: Role.ADMIN,
        sessionVersion: adminUser!.sessionVersion,
      },
    };

    // Upsert test customer
    const user = await db.user.findFirst({
      where: { email: "billing.test.customer@brightloop.io" },
    });
    if (!user) {
      testCustomer = await db.customer.upsert({
        where: { id: testCustomerId },
        update: {},
        create: {
          id: testCustomerId,
          name: "Billing Test Corp",
          email: "billing.test.customer@brightloop.io",
          isActive: true,
        },
      });
    } else {
      testCustomer = (await db.customer.findFirst({
        where: { userId: user.id },
      }))!;
    }

    // Upsert Tax 18%
    const tax = await db.tax.findFirst({ where: { rateBps: 1800, isActive: true } });
    if (tax) {
      testTax = tax;
    } else {
      testTax = await db.tax.create({
        data: {
          name: "GST 18% Test",
          rateBps: 1800,
          isActive: true,
        },
      });
    }

    // Upsert Monthly Plan
    const plan = await db.plan.upsert({
      where: { id: testPlanId },
      update: {
        price: 10000, // ₹100
        taxId: testTax.id,
        isActive: true,
        availableFrom: new Date("2026-01-01T00:00:00.000Z"),
        availableTo: new Date("2030-12-31T00:00:00.000Z"),
        pausable: true,
        renewable: true,
        closable: true,
        autoClose: true,
      },
      create: {
        id: testPlanId,
        name: "Test Monthly Plan 100",
        price: 10000,
        billingPeriod: BillingPeriod.MONTHLY,
        minQty: 1,
        availableFrom: new Date("2026-01-01T00:00:00.000Z"),
        availableTo: new Date("2030-12-31T00:00:00.000Z"),
        taxId: testTax.id,
        pausable: true,
        renewable: true,
        closable: true,
        autoClose: true,
        isActive: true,
      },
    });
    testPlanMonthly = plan;

    // Find or create test product
    const product = await db.product.findFirst({
      where: { isActive: true },
      include: { tax: true },
    });
    testProduct = product!;

    await cleanup();
  });

  afterAll(async () => {
    await cleanup();
  });

  it("Jan 31 monthly start yields correct periods without drifting to Feb 28 base", () => {
    const startDate = new Date("2026-01-31T00:00:00.000Z");
    const expiryDate = new Date("2026-06-30T00:00:00.000Z");
    const asOf = new Date("2026-05-15T00:00:00.000Z");

    const spans = getMissedPeriods(
      startDate,
      BillingPeriod.MONTHLY,
      startDate,
      asOf,
      expiryDate
    );

    expect(spans.length).toBe(4);
    // Jan 31 -> Feb 28
    expect(spans[0].periodStart.toISOString().slice(0, 10)).toBe("2026-01-31");
    expect(spans[0].periodEnd.toISOString().slice(0, 10)).toBe("2026-02-27");
    expect(spans[0].nextPeriodStart.toISOString().slice(0, 10)).toBe("2026-02-28");

    // Feb 28 -> Mar 31 (retains 31st!)
    expect(spans[1].periodStart.toISOString().slice(0, 10)).toBe("2026-02-28");
    expect(spans[1].periodEnd.toISOString().slice(0, 10)).toBe("2026-03-30");
    expect(spans[1].nextPeriodStart.toISOString().slice(0, 10)).toBe("2026-03-31");

    // Mar 31 -> Apr 30
    expect(spans[2].periodStart.toISOString().slice(0, 10)).toBe("2026-03-31");
    expect(spans[2].periodEnd.toISOString().slice(0, 10)).toBe("2026-04-29");
    expect(spans[2].nextPeriodStart.toISOString().slice(0, 10)).toBe("2026-04-30");

    // Apr 30 -> May 31
    expect(spans[3].periodStart.toISOString().slice(0, 10)).toBe("2026-04-30");
    expect(spans[3].periodEnd.toISOString().slice(0, 10)).toBe("2026-05-30");
    expect(spans[3].nextPeriodStart.toISOString().slice(0, 10)).toBe("2026-05-31");
  });

  it("a 3-month gap creates 3 invoices in chronological order", async () => {
    // Subscription starting 2026-01-01, nextPeriodStart = 2026-01-01
    const sub = await db.subscription.create({
      data: {
        customerId: testCustomerId,
        planId: testPlanMonthly.id,
        status: SubscriptionStatus.ACTIVE,
        startDate: new Date("2026-01-01T00:00:00.000Z"),
        expiryDate: new Date("2026-12-31T00:00:00.000Z"),
        paymentTerms: PaymentTerms.NET_15,
        planFee: testPlanMonthly.price,
        planTaxRateBps: 1800,
        nextPeriodStart: new Date("2026-01-01T00:00:00.000Z"),
        lines: {
          create: [
            {
              productId: testProduct.id,
              description: "API Seats",
              qty: 1,
              unitPrice: 20000,
              taxRateBps: 1800,
              amount: 20000,
            },
          ],
        },
      },
    });

    // Run billing as of 2026-03-15
    const asOfDate = new Date("2026-03-15T00:00:00.000Z");
    const runResult = await billingService.runBilling(adminSession, { asOfDate });

    expect(runResult.created).toBeGreaterThanOrEqual(3);

    // Verify invoices for this subscription
    const invoices = await db.invoice.findMany({
      where: { subscriptionId: sub.id },
      orderBy: { periodStart: "asc" },
      include: { lines: true },
    });

    expect(invoices.length).toBe(3);

    expect(invoices[0].periodStart.toISOString().slice(0, 10)).toBe("2026-01-01");
    expect(invoices[0].periodEnd.toISOString().slice(0, 10)).toBe("2026-01-31");
    expect(invoices[0].status).toBe(InvoiceStatus.DRAFT);
    expect(invoices[0].dueDate.toISOString().slice(0, 10)).toBe("2026-01-16");

    expect(invoices[1].periodStart.toISOString().slice(0, 10)).toBe("2026-02-01");
    expect(invoices[1].periodEnd.toISOString().slice(0, 10)).toBe("2026-02-28");

    expect(invoices[2].periodStart.toISOString().slice(0, 10)).toBe("2026-03-01");
    expect(invoices[2].periodEnd.toISOString().slice(0, 10)).toBe("2026-03-31");

    // Subscription cursor must have advanced to 2026-04-01
    const updatedSub = await db.subscription.findUnique({ where: { id: sub.id } });
    expect(updatedSub!.nextPeriodStart!.toISOString().slice(0, 10)).toBe("2026-04-01");
  });

  it("second run creates 0 invoices (idempotence)", async () => {
    // Run billing again with the same asOfDate
    const asOfDate = new Date("2026-03-15T00:00:00.000Z");
    const runResult = await billingService.runBilling(adminSession, { asOfDate });

    // Invoices created in this second run must be 0
    expect(runResult.created).toBe(0);
  });

  it("paused subscription is skipped and not caught up after resume", async () => {
    // Create active subscription starting 2026-01-01
    const sub = await db.subscription.create({
      data: {
        customerId: testCustomerId,
        planId: testPlanMonthly.id,
        status: SubscriptionStatus.ACTIVE,
        startDate: new Date("2026-01-01T00:00:00.000Z"),
        expiryDate: new Date("2026-12-31T00:00:00.000Z"),
        paymentTerms: PaymentTerms.IMMEDIATE,
        planFee: testPlanMonthly.price,
        planTaxRateBps: 1800,
        nextPeriodStart: new Date("2026-02-01T00:00:00.000Z"),
        // Create Jan invoice as already billed
        invoices: {
          create: {
            customerId: testCustomerId,
            periodStart: new Date("2026-01-01T00:00:00.000Z"),
            periodEnd: new Date("2026-01-31T00:00:00.000Z"),
            status: InvoiceStatus.DRAFT,
            issueDate: new Date("2026-01-01T00:00:00.000Z"),
            dueDate: new Date("2026-01-01T00:00:00.000Z"),
            subtotal: 10000,
            discountTotal: 0,
            taxTotal: 1800,
            total: 11800,
          },
        },
      },
    });

    // Pause subscription on 2026-02-05
    await subService.pauseSubscription(adminSession, sub.id, {
      asOfDate: new Date("2026-02-05T00:00:00.000Z"),
      note: "Customer paused account",
    });

    // Run billing as of 2026-03-20 while paused
    const pausedRun = await billingService.runBilling(adminSession, {
      asOfDate: new Date("2026-03-20T00:00:00.000Z"),
    });

    // Sub must have 0 invoices created while paused
    const invoicesDuringPause = await db.invoice.findMany({
      where: { subscriptionId: sub.id },
    });
    expect(invoicesDuringPause.length).toBe(1); // Only the initial Jan invoice

    // Resume subscription on 2026-04-10
    // Cursor advances to the first period start on or after resume date (which is 2026-05-01)
    await subService.resumeSubscription(adminSession, sub.id, {
      resumeDate: new Date("2026-04-10T00:00:00.000Z"),
      note: "Resumed by customer request",
    });

    const resumedSub = await db.subscription.findUnique({ where: { id: sub.id } });
    expect(resumedSub!.pausedAt).toBeNull();
    expect(resumedSub!.nextPeriodStart!.toISOString().slice(0, 10)).toBe("2026-05-01");

    // Run billing as of 2026-04-15 -> nextPeriodStart is 2026-05-01, so 0 invoices
    const preMayRun = await billingService.runBilling(adminSession, {
      asOfDate: new Date("2026-04-15T00:00:00.000Z"),
    });

    const invoicesPreMay = await db.invoice.findMany({
      where: { subscriptionId: sub.id },
    });
    expect(invoicesPreMay.length).toBe(1); // Still only 1 invoice; Feb, Mar, Apr were skipped!

    // Run billing as of 2026-05-05 -> Creates 1 invoice for May period
    const mayRun = await billingService.runBilling(adminSession, {
      asOfDate: new Date("2026-05-05T00:00:00.000Z"),
    });

    const invoicesPostResume = await db.invoice.findMany({
      where: { subscriptionId: sub.id },
      orderBy: { periodStart: "asc" },
    });
    expect(invoicesPostResume.length).toBe(2);
    expect(invoicesPostResume[1].periodStart.toISOString().slice(0, 10)).toBe("2026-05-01");
  });

  it("expired subscription gets no further invoice", async () => {
    // Subscription with expiry 2026-04-01 and nextPeriodStart at expiryDate
    const sub = await db.subscription.create({
      data: {
        customerId: testCustomerId,
        planId: testPlanMonthly.id,
        status: SubscriptionStatus.ACTIVE,
        startDate: new Date("2026-01-01T00:00:00.000Z"),
        expiryDate: new Date("2026-04-01T00:00:00.000Z"),
        paymentTerms: PaymentTerms.IMMEDIATE,
        planFee: testPlanMonthly.price,
        planTaxRateBps: 1800,
        nextPeriodStart: new Date("2026-04-01T00:00:00.000Z"),
      },
    });

    // Run billing as of 2026-05-01
    await billingService.runBilling(adminSession, {
      asOfDate: new Date("2026-05-01T00:00:00.000Z"),
    });

    // No invoices created for this expired subscription
    const invoices = await db.invoice.findMany({
      where: { subscriptionId: sub.id },
    });
    expect(invoices.length).toBe(0);

    // AutoClose housekeeping should have transitioned it to CLOSED
    const closedSub = await db.subscription.findUnique({ where: { id: sub.id } });
    expect(closedSub!.status).toBe(SubscriptionStatus.CLOSED);
  });

  it("discount applied and tax math matches a hand calculation written in the test", async () => {
    // Set up a 10% discount in DB
    await db.discount.upsert({
      where: { id: testDiscountId },
      update: {
        isActive: true,
        usedCount: 0,
        usageLimit: 100,
      },
      create: {
        id: testDiscountId,
        name: "Test Billing 10% Discount",
        type: DiscountType.PERCENT,
        value: 1000, // 10.00%
        scope: DiscountScope.SUBSCRIPTION,
        startDate: new Date("2026-01-01T00:00:00.000Z"),
        endDate: new Date("2026-12-31T00:00:00.000Z"),
        usageLimit: 100,
        usedCount: 0,
        isActive: true,
      },
    });

    // Create subscription with:
    // Plan fee: 10,000 paise (tax 18%)
    // Product 1: qty = 2, unitPrice = 25,000 paise (tax 18%), amount = 50,000 paise
    // Hand calculation:
    // Subtotal = 10,000 + 50,000 = 60,000 paise
    // Discount = 10% of 60,000 = 6,000 paise
    // Plan fee discounted base: 10,000 - 1,000 = 9,000 paise -> tax (18%) = 1,620 paise
    // Product discounted base: 50,000 - 5,000 = 45,000 paise -> tax (18%) = 8,100 paise
    // Tax total = 1,620 + 8,100 = 9,720 paise
    // Invoice total = 60,000 - 6,000 + 9,720 = 63,720 paise

    const sub = await db.subscription.create({
      data: {
        customerId: testCustomerId,
        planId: testPlanMonthly.id,
        status: SubscriptionStatus.ACTIVE,
        startDate: new Date("2026-06-01T00:00:00.000Z"),
        expiryDate: new Date("2026-12-31T00:00:00.000Z"),
        paymentTerms: PaymentTerms.NET_15,
        planFee: 10000,
        planTaxRateBps: 1800,
        nextPeriodStart: new Date("2026-06-01T00:00:00.000Z"),
        lines: {
          create: [
            {
              productId: testProduct.id,
              description: "API Addon",
              qty: 2,
              unitPrice: 25000,
              taxRateBps: 1800,
              amount: 50000,
            },
          ],
        },
      },
    });

    // Run billing as of 2026-06-05
    await billingService.runBilling(adminSession, {
      asOfDate: new Date("2026-06-05T00:00:00.000Z"),
    });

    const invoice = await db.invoice.findFirst({
      where: { subscriptionId: sub.id },
      include: { lines: { orderBy: { sortOrder: "asc" } } },
    });

    expect(invoice).not.toBeNull();
    expect(invoice!.subtotal).toBe(60000);
    expect(invoice!.discountTotal).toBe(6000);
    expect(invoice!.taxTotal).toBe(9720);
    expect(invoice!.total).toBe(63720);

    // Lines verification
    expect(invoice!.lines.length).toBe(3);

    // Line 0: PLAN_FEE
    expect(invoice!.lines[0].kind).toBe(InvoiceLineKind.PLAN_FEE);
    expect(invoice!.lines[0].amount).toBe(10000);
    expect(invoice!.lines[0].taxAmount).toBe(1620);

    // Line 1: PRODUCT
    expect(invoice!.lines[1].kind).toBe(InvoiceLineKind.PRODUCT);
    expect(invoice!.lines[1].amount).toBe(50000);
    expect(invoice!.lines[1].taxAmount).toBe(8100);

    // Line 2: DISCOUNT
    expect(invoice!.lines[2].kind).toBe(InvoiceLineKind.DISCOUNT);
    expect(invoice!.lines[2].amount).toBe(-6000);
    expect(invoice!.lines[2].taxAmount).toBe(0);
    expect(invoice!.lines[2].discountId).toBe(testDiscountId);
  });

  it("one bad subscription doesn't stop the batch", async () => {
    // Create good subscription
    const goodSub = await db.subscription.create({
      data: {
        customerId: testCustomerId,
        planId: testPlanMonthly.id,
        status: SubscriptionStatus.ACTIVE,
        startDate: new Date("2026-07-01T00:00:00.000Z"),
        expiryDate: new Date("2026-12-31T00:00:00.000Z"),
        paymentTerms: PaymentTerms.IMMEDIATE,
        planFee: testPlanMonthly.price,
        planTaxRateBps: 1800,
        nextPeriodStart: new Date("2026-07-01T00:00:00.000Z"),
      },
    });

    // Create bad subscription with a missing required relation or intentionally bad data
    const badSub = await db.subscription.create({
      data: {
        customerId: testCustomerId,
        planId: testPlanMonthly.id,
        status: SubscriptionStatus.ACTIVE,
        startDate: new Date("2026-07-01T00:00:00.000Z"),
        expiryDate: new Date("2026-12-31T00:00:00.000Z"),
        paymentTerms: PaymentTerms.IMMEDIATE,
        planFee: testPlanMonthly.price,
        planTaxRateBps: 1800,
        nextPeriodStart: new Date("2026-07-01T00:00:00.000Z"),
      },
    });

    // Spy on processSubscriptionBillingRecord to throw on the bad subscription
    const originalProcess = billingRepo.processSubscriptionBillingRecord;
    const processSpy = vi
      .spyOn(billingRepo, "processSubscriptionBillingRecord")
      .mockImplementation(async (subId, asOf, runId, discounts) => {
        if (subId === badSub.id) {
          throw new Error("Simulated failure for bad subscription");
        }
        return originalProcess(subId, asOf, runId, discounts);
      });

    // Run billing
    const result = await billingService.runBilling(adminSession, {
      asOfDate: new Date("2026-07-05T00:00:00.000Z"),
    });

    processSpy.mockRestore();

    // Good subscription succeeded, bad subscription failed, run completed
    expect(result.created).toBeGreaterThanOrEqual(1);
    expect(result.failed).toBeGreaterThanOrEqual(1);
    expect(result.errors).not.toBeNull();
    const badError = result.errors!.find((e) => e.subscriptionId === badSub.id);
    expect(badError).toBeDefined();
    expect(badError!.error).toContain("Simulated failure");

    // Verify good subscription got an invoice
    const goodInvoices = await db.invoice.findMany({
      where: { subscriptionId: goodSub.id },
    });
    expect(goodInvoices.length).toBe(1);
  });

  it("POST /api/cron/billing is protected by CRON_SECRET header", async () => {
    // 1. Missing secret -> 401
    const unauthReq = new NextRequest("http://localhost:3000/api/cron/billing", {
      method: "POST",
    });
    const unauthRes = await cronBillingRoute(unauthReq);
    expect(unauthRes.status).toBe(401);

    // 2. Wrong secret -> 401
    const wrongReq = new NextRequest("http://localhost:3000/api/cron/billing", {
      method: "POST",
      headers: {
        "x-cron-secret": "wrong_secret_value",
      },
    });
    const wrongRes = await cronBillingRoute(wrongReq);
    expect(wrongRes.status).toBe(401);

    // 3. Valid secret in x-cron-secret -> 200
    const validReq = new NextRequest("http://localhost:3000/api/cron/billing", {
      method: "POST",
      headers: {
        "x-cron-secret": env.CRON_SECRET,
      },
    });
    const validRes = await cronBillingRoute(validReq);
    expect(validRes.status).toBe(200);
    const body = await validRes.json();
    expect(body.ok).toBe(true);
    expect(body.billingRun).toBeDefined();
  });
});