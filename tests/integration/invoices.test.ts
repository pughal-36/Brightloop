import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";

// Mock server-only so we can import server modules in Vitest
vi.mock("server-only", () => ({}));

import { db } from "@/server/db";
import {
  Role,
  InvoiceStatus,
  InvoiceLineKind,
  PaymentMethod,
  DiscountType,
  DiscountScope,
  BillingPeriod,
  PaymentTerms,
} from "@/generated/prisma/enums";
import type { Session } from "@/server/lib/session";
import * as invoiceService from "@/server/modules/invoices/service";

describe("Invoices Lifecycle & Payments Integration Tests", { timeout: 40000 }, () => {
  let adminSession: Session;
  let staffSession: Session;

  const testCustomerId = "22222222-3333-4000-a000-000000000001";
  const testPlanId = "22222222-3333-4000-a000-000000000002";
  const testSubscriptionId = "22222222-3333-4000-a000-000000000003";

  async function cleanup() {
    await db.payment.deleteMany({
      where: {
        invoice: { customerId: testCustomerId },
      },
    });
    await db.discountApplication.deleteMany({
      where: {
        invoice: { customerId: testCustomerId },
      },
    });
    await db.invoiceLine.deleteMany({
      where: {
        invoice: { customerId: testCustomerId },
      },
    });
    await db.statusHistory.deleteMany({
      where: {
        entity: "INVOICE",
      },
    });
    await db.invoice.deleteMany({
      where: { customerId: testCustomerId },
    });
    await db.discount.deleteMany({
      where: { name: { startsWith: "Test Inv Disc" } },
    });
  }

  async function fullCleanup() {
    await cleanup();
    await db.subscriptionLine.deleteMany({
      where: { subscriptionId: testSubscriptionId },
    });
    await db.subscription.deleteMany({
      where: { customerId: testCustomerId },
    });
  }

  beforeAll(async () => {
    await fullCleanup();

    const adminUser = await db.user.findFirst({
      where: { role: Role.ADMIN, isActive: true },
    });
    adminSession = {
      user: {
        id: adminUser!.id,
        email: adminUser!.email,
        name: adminUser!.name,
        role: Role.ADMIN,
        sessionVersion: adminUser!.sessionVersion,
      },
    };

    const staffUser = await db.user.findFirst({
      where: { role: Role.STAFF, isActive: true },
    });
    staffSession = {
      user: {
        id: staffUser!.id,
        email: staffUser!.email,
        name: staffUser!.name,
        role: Role.STAFF,
        sessionVersion: staffUser!.sessionVersion,
      },
    };

    // Upsert test customer
    await db.customer.upsert({
      where: { id: testCustomerId },
      update: {},
      create: {
        id: testCustomerId,
        name: "Acme Invoices Test Corp",
        email: "invoices.test@acme.com",
        isActive: true,
      },
    });

    // Upsert test plan
    await db.plan.upsert({
      where: { id: testPlanId },
      update: {},
      create: {
        id: testPlanId,
        name: "Invoice Test Plan",
        price: 15000,
        billingPeriod: BillingPeriod.MONTHLY,
        minQty: 1,
        availableFrom: new Date("2026-01-01T00:00:00.000Z"),
        availableTo: new Date("2030-12-31T00:00:00.000Z"),
        isActive: true,
      },
    });

    // Upsert test subscription
    await db.subscription.upsert({
      where: { id: testSubscriptionId },
      update: {},
      create: {
        id: testSubscriptionId,
        customerId: testCustomerId,
        planId: testPlanId,
        startDate: new Date("2026-01-01T00:00:00.000Z"),
        expiryDate: new Date("2027-01-01T00:00:00.000Z"),
        paymentTerms: PaymentTerms.NET_15,
        planFee: 15000,
        planTaxRateBps: 1800,
      },
    });
  });

  afterAll(async () => {
    await fullCleanup();
  });

  it("payments blocked on DRAFT invoices", async () => {
    const draftInvoice = await db.invoice.create({
      data: {
        subscriptionId: testSubscriptionId,
        customerId: testCustomerId,
        periodStart: new Date("2026-01-01T00:00:00.000Z"),
        periodEnd: new Date("2026-01-31T00:00:00.000Z"),
        status: InvoiceStatus.DRAFT,
        issueDate: new Date("2026-01-01T00:00:00.000Z"),
        dueDate: new Date("2026-01-16T00:00:00.000Z"),
        subtotal: 15000,
        discountTotal: 0,
        taxTotal: 2700,
        total: 17700,
      },
    });

    await expect(
      invoiceService.recordPayment(adminSession, {
        invoiceId: draftInvoice.id,
        method: PaymentMethod.BANK_TRANSFER,
        amount: 5000,
      })
    ).rejects.toThrow("Payments can only be recorded on CONFIRMED invoices");
  });

  it("overpayment is rejected on CONFIRMED invoices", async () => {
    const invoice = await db.invoice.create({
      data: {
        subscriptionId: testSubscriptionId,
        customerId: testCustomerId,
        periodStart: new Date("2026-02-01T00:00:00.000Z"),
        periodEnd: new Date("2026-02-28T00:00:00.000Z"),
        status: InvoiceStatus.CONFIRMED,
        issueDate: new Date("2026-02-01T00:00:00.000Z"),
        dueDate: new Date("2026-02-16T00:00:00.000Z"),
        subtotal: 20000,
        discountTotal: 0,
        taxTotal: 3600,
        total: 23600,
        amountPaid: 0,
      },
    });

    // Try paying more than balance
    await expect(
      invoiceService.recordPayment(staffSession, {
        invoiceId: invoice.id,
        method: PaymentMethod.UPI,
        amount: 25000, // Balance is 23600
      })
    ).rejects.toThrow("exceeds invoice balance");
  });

  it("partial then full payment flips to PAID and voidPayment reverts to CONFIRMED", async () => {
    // Total 20,000 paise
    const invoice = await db.invoice.create({
      data: {
        subscriptionId: testSubscriptionId,
        customerId: testCustomerId,
        periodStart: new Date("2026-03-01T00:00:00.000Z"),
        periodEnd: new Date("2026-03-31T00:00:00.000Z"),
        status: InvoiceStatus.CONFIRMED,
        issueDate: new Date("2026-03-01T00:00:00.000Z"),
        dueDate: new Date("2026-03-16T00:00:00.000Z"),
        subtotal: 20000,
        discountTotal: 0,
        taxTotal: 0,
        total: 20000,
        amountPaid: 0,
      },
    });

    // 1. Partial payment: 12,000 paise
    const p1 = await invoiceService.recordPayment(staffSession, {
      invoiceId: invoice.id,
      method: PaymentMethod.BANK_TRANSFER,
      amount: 12000,
      note: "First installment",
    });

    expect(p1.newAmountPaid).toBe(12000);
    expect(p1.isFullyPaid).toBe(false);

    const invAfterP1 = await invoiceService.getInvoice(staffSession, invoice.id);
    expect(invAfterP1.status).toBe(InvoiceStatus.CONFIRMED);
    expect(invAfterP1.amountPaid).toBe(12000);
    expect(invAfterP1.balance).toBe(8000);

    // 2. Full balance settlement: 8,000 paise
    const p2 = await invoiceService.recordPayment(staffSession, {
      invoiceId: invoice.id,
      method: PaymentMethod.UPI,
      amount: 8000,
      note: "Final settlement",
    });

    expect(p2.newAmountPaid).toBe(20000);
    expect(p2.isFullyPaid).toBe(true);

    const invAfterP2 = await invoiceService.getInvoice(staffSession, invoice.id);
    expect(invAfterP2.status).toBe(InvoiceStatus.PAID);
    expect(invAfterP2.amountPaid).toBe(20000);
    expect(invAfterP2.balance).toBe(0);
    expect(invAfterP2.paidAt).not.toBeNull();

    // Verify timeline has PAID transition
    const timeline = await invoiceService.getInvoiceTimeline(staffSession, invoice.id);
    expect(timeline.some((t) => t.to === "PAID")).toBe(true);

    // 3. Void payment (ADMIN only) with required note
    await expect(
      invoiceService.voidPayment(staffSession, {
        paymentId: p2.payment.id,
        note: "Staff cannot void",
      })
    ).rejects.toThrow();

    const voidRes = await invoiceService.voidPayment(adminSession, {
      paymentId: p2.payment.id,
      note: "UPI transaction reversed by bank",
    });

    expect(voidRes.newAmountPaid).toBe(12000);

    const invAfterVoid = await invoiceService.getInvoice(staffSession, invoice.id);
    expect(invAfterVoid.status).toBe(InvoiceStatus.CONFIRMED);
    expect(invAfterVoid.amountPaid).toBe(12000);
    expect(invAfterVoid.balance).toBe(8000);
    expect(invAfterVoid.paidAt).toBeNull();

    // Verify timeline has PAID -> CONFIRMED transition
    const timelineAfterVoid = await invoiceService.getInvoiceTimeline(staffSession, invoice.id);
    expect(
      timelineAfterVoid.some((t) => t.from === "PAID" && t.to === "CONFIRMED")
    ).toBe(true);
  });

  it("confirm with exhausted discount returns RECONFIRM_REQUIRED and leaves DRAFT", async () => {
    // 1. Create a discount that is already exhausted (usageLimit 1, usedCount 1)
    const exhaustedDiscount = await db.discount.create({
      data: {
        name: "Test Inv Disc Exhausted",
        type: DiscountType.PERCENT,
        value: 1000, // 10%
        scope: DiscountScope.SUBSCRIPTION,
        startDate: new Date("2026-01-01T00:00:00.000Z"),
        endDate: new Date("2026-12-31T00:00:00.000Z"),
        usageLimit: 1,
        usedCount: 1, // Already exhausted!
        isActive: true,
      },
    });

    // 2. Draft invoice with plan fee 10,000 + 10% discount (1,000 paise), 18% tax on 9,000 = 1,620 paise
    // Old totals: subtotal = 10,000, discountTotal = 1,000, taxTotal = 1,620, total = 10,620
    const draftInvoice = await db.invoice.create({
      data: {
        subscriptionId: testSubscriptionId,
        customerId: testCustomerId,
        periodStart: new Date("2026-04-01T00:00:00.000Z"),
        periodEnd: new Date("2026-04-30T00:00:00.000Z"),
        status: InvoiceStatus.DRAFT,
        issueDate: new Date("2026-04-01T00:00:00.000Z"),
        dueDate: new Date("2026-04-16T00:00:00.000Z"),
        subtotal: 10000,
        discountTotal: 1000,
        taxTotal: 1620,
        total: 10620,
        lines: {
          create: [
            {
              kind: InvoiceLineKind.PLAN_FEE,
              sortOrder: 0,
              description: "Plan Fee",
              qty: 1,
              unitPrice: 10000,
              taxRateBps: 1800,
              amount: 10000,
              taxAmount: 1620,
            },
            {
              kind: InvoiceLineKind.DISCOUNT,
              sortOrder: 1,
              description: "Discount 10%",
              discountId: exhaustedDiscount.id,
              qty: 1,
              unitPrice: -1000,
              taxRateBps: 0,
              amount: -1000,
              taxAmount: 0,
            },
          ],
        },
      },
    });

    // 3. Confirm attempt
    const res = await invoiceService.confirmInvoice(adminSession, {
      invoiceId: draftInvoice.id,
    });

    expect(res.status).toBe("RECONFIRM_REQUIRED");
    expect(res.oldTotals!.total).toBe(10620);
    // Recalculated without discount: 10,000 + 18% of 10,000 (1,800) = 11,800
    expect(res.newTotals!.total).toBe(11800);
    expect(res.newTotals!.discountTotal).toBe(0);
    expect(res.newTotals!.taxTotal).toBe(1800);

    // Verify invoice in DB is still DRAFT
    const invInDb = await invoiceService.getInvoice(adminSession, draftInvoice.id);
    expect(invInDb.status).toBe(InvoiceStatus.DRAFT);
    expect(invInDb.discountTotal).toBe(0);
    expect(invInDb.total).toBe(11800);

    // Verify discount line was removed
    expect(invInDb.lines.some((l) => l.kind === InvoiceLineKind.DISCOUNT)).toBe(false);

    // Second confirm attempt now succeeds as no discount is attached
    const res2 = await invoiceService.confirmInvoice(adminSession, {
      invoiceId: draftInvoice.id,
    });
    expect(res2.status).toBe("CONFIRMED");

    const finalInv = await invoiceService.getInvoice(adminSession, draftInvoice.id);
    expect(finalInv.status).toBe(InvoiceStatus.CONFIRMED);
  });

  it("concurrent confirms never exceed usageLimit", async () => {
    // Discount with usageLimit = 2
    const limitedDiscount = await db.discount.create({
      data: {
        name: "Test Inv Disc Concurrent",
        type: DiscountType.FIXED,
        value: 2000,
        scope: DiscountScope.SUBSCRIPTION,
        startDate: new Date("2026-01-01T00:00:00.000Z"),
        endDate: new Date("2026-12-31T00:00:00.000Z"),
        usageLimit: 2,
        usedCount: 0,
        isActive: true,
      },
    });

    // Create 5 draft invoices that all have this discount
    const invoices = await Promise.all(
      [1, 2, 3, 4, 5].map((idx) =>
        db.invoice.create({
          data: {
            subscriptionId: testSubscriptionId,
            customerId: testCustomerId,
            periodStart: new Date(`2026-05-0${idx}T00:00:00.000Z`),
            periodEnd: new Date(`2026-05-2${idx}T00:00:00.000Z`),
            status: InvoiceStatus.DRAFT,
            issueDate: new Date(`2026-05-0${idx}T00:00:00.000Z`),
            dueDate: new Date(`2026-05-2${idx}T00:00:00.000Z`),
            subtotal: 10000,
            discountTotal: 2000,
            taxTotal: 1440,
            total: 9440,
            lines: {
              create: [
                {
                  kind: InvoiceLineKind.PLAN_FEE,
                  sortOrder: 0,
                  description: "Plan Fee",
                  qty: 1,
                  unitPrice: 10000,
                  taxRateBps: 1800,
                  amount: 10000,
                  taxAmount: 1440,
                },
                {
                  kind: InvoiceLineKind.DISCOUNT,
                  sortOrder: 1,
                  description: "Fixed Discount",
                  discountId: limitedDiscount.id,
                  qty: 1,
                  unitPrice: -2000,
                  taxRateBps: 0,
                  amount: -2000,
                  taxAmount: 0,
                },
              ],
            },
          },
        })
      )
    );

    // Fire 5 concurrent confirm calls
    const results = await Promise.all(
      invoices.map((inv) =>
        invoiceService.confirmInvoice(adminSession, { invoiceId: inv.id })
      )
    );

    const confirmedCount = results.filter((r) => r.status === "CONFIRMED").length;
    const reconfirmCount = results.filter((r) => r.status === "RECONFIRM_REQUIRED").length;

    expect(confirmedCount).toBe(2);
    expect(reconfirmCount).toBe(3);

    // Verify discount usedCount in DB is exactly 2, never exceeding limit
    const discInDb = await db.discount.findUnique({
      where: { id: limitedDiscount.id },
    });
    expect(discInDb!.usedCount).toBe(2);
  });

  it("cancel releases the discount use and decrements usedCount", async () => {
    // Discount with usageLimit = 5
    const discount = await db.discount.create({
      data: {
        name: "Test Inv Disc Cancel Release",
        type: DiscountType.PERCENT,
        value: 1000,
        scope: DiscountScope.SUBSCRIPTION,
        startDate: new Date("2026-01-01T00:00:00.000Z"),
        endDate: new Date("2026-12-31T00:00:00.000Z"),
        usageLimit: 5,
        usedCount: 0,
        isActive: true,
      },
    });

    const draftInvoice = await db.invoice.create({
      data: {
        subscriptionId: testSubscriptionId,
        customerId: testCustomerId,
        periodStart: new Date("2026-06-01T00:00:00.000Z"),
        periodEnd: new Date("2026-06-30T00:00:00.000Z"),
        status: InvoiceStatus.DRAFT,
        issueDate: new Date("2026-06-01T00:00:00.000Z"),
        dueDate: new Date("2026-06-16T00:00:00.000Z"),
        subtotal: 10000,
        discountTotal: 1000,
        taxTotal: 1620,
        total: 10620,
        lines: {
          create: [
            {
              kind: InvoiceLineKind.PLAN_FEE,
              sortOrder: 0,
              description: "Plan Fee",
              qty: 1,
              unitPrice: 10000,
              taxRateBps: 1800,
              amount: 10000,
              taxAmount: 1620,
            },
            {
              kind: InvoiceLineKind.DISCOUNT,
              sortOrder: 1,
              description: "10% Discount",
              discountId: discount.id,
              qty: 1,
              unitPrice: -1000,
              taxRateBps: 0,
              amount: -1000,
              taxAmount: 0,
            },
          ],
        },
      },
    });

    // 1. Confirm invoice -> increments usedCount from 0 to 1
    const confirmRes = await invoiceService.confirmInvoice(adminSession, {
      invoiceId: draftInvoice.id,
    });
    expect(confirmRes.status).toBe("CONFIRMED");

    let disc = await db.discount.findUnique({ where: { id: discount.id } });
    expect(disc!.usedCount).toBe(1);

    const app = await db.discountApplication.findUnique({
      where: { invoiceId: draftInvoice.id },
    });
    expect(app).not.toBeNull();

    // 2. Cancel invoice -> releases discount use, decrements usedCount to 0
    const cancelRes = await invoiceService.cancelInvoice(adminSession, {
      invoiceId: draftInvoice.id,
      reason: "Customer cancelled before settlement",
    });
    expect(cancelRes.status).toBe(InvoiceStatus.CANCELLED);

    disc = await db.discount.findUnique({ where: { id: discount.id } });
    expect(disc!.usedCount).toBe(0);

    const appAfterCancel = await db.discountApplication.findUnique({
      where: { invoiceId: draftInvoice.id },
    });
    expect(appAfterCancel).toBeNull();
  });
});
