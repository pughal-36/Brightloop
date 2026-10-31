import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";

// Mock server-only for Vitest
vi.mock("server-only", () => ({}));

import { db } from "@/server/db";
import {
  Role,
  SubscriptionStatus,
  InvoiceStatus,
  InvoiceLineKind,
  ProductType,
  BillingPeriod,
  PaymentTerms,
  PaymentMethod,
} from "@/generated/prisma/enums";
import type { Session } from "@/server/lib/session";
import { AppError } from "@/server/errors";
import * as portalService from "@/server/modules/portal/service";
import * as subService from "@/server/modules/subscriptions/service";
import * as invoiceService from "@/server/modules/invoices/service";

describe("Portal IDOR & Role Authorization Integration Tests", { timeout: 40000 }, () => {
  const custAId = "99999999-1111-4000-a000-000000000001";
  const custBId = "99999999-2222-4000-a000-000000000002";
  const userAId = "99999999-1111-4000-b000-000000000001";
  const userBId = "99999999-2222-4000-b000-000000000002";
  const staffUserId = "99999999-3333-4000-b000-000000000003";

  const planId = "99999999-0000-4000-c000-000000000001";
  const productId = "99999999-0000-4000-d000-000000000001";

  const subAId = "99999999-1111-4000-e000-000000000001";
  const subBId = "99999999-2222-4000-e000-000000000002";
  const expiredSubAId = "99999999-1111-4000-e000-000000000003";

  const invAId = "99999999-1111-4000-f000-000000000001";
  const invBId = "99999999-2222-4000-f000-000000000002";

  let sessionA: Session;
  let sessionB: Session;

  beforeAll(async () => {
    // Cleanup prior test artifacts
    await cleanup();

    // 1. Create Users & Customers
    await db.user.createMany({
      data: [
        {
          id: userAId,
          email: "customera.idor@test.com",
          name: "Customer A IDOR",
          passwordHash: "hash123",
          role: Role.CUSTOMER,
        },
        {
          id: userBId,
          email: "customerb.idor@test.com",
          name: "Customer B IDOR",
          passwordHash: "hash123",
          role: Role.CUSTOMER,
        },
        {
          id: staffUserId,
          email: "staff.idor@test.com",
          name: "Staff Operator IDOR",
          passwordHash: "hash123",
          role: Role.STAFF,
        },
      ],
    });

    await db.customer.createMany({
      data: [
        {
          id: custAId,
          userId: userAId,
          name: "Customer A Corp",
          email: "customera.idor@test.com",
        },
        {
          id: custBId,
          userId: userBId,
          name: "Customer B LLC",
          email: "customerb.idor@test.com",
        },
      ],
    });

    // 2. Create Product with confidential costPrice and notes
    await db.product.create({
      data: {
        id: productId,
        name: "Confidential Enterprise Module",
        type: ProductType.SOFTWARE,
        salesPrice: 20000, // 200 INR
        costPrice: 5000, // 50 INR internal cost
        notes: "CONFIDENTIAL INTERNAL NOTE: Vendor cost is 50 INR",
      },
    });

    // 3. Create Plan
    await db.plan.create({
      data: {
        id: planId,
        name: "Portal Monthly Plan",
        price: 50000,
        billingPeriod: BillingPeriod.MONTHLY,
        availableFrom: new Date("2026-01-01"),
        pausable: true,
        closable: true,
        renewable: true,
      },
    });

    // 4. Create Subscriptions
    // Sub A (QUOTATION) for Customer A
    await db.subscription.create({
      data: {
        id: subAId,
        customerId: custAId,
        planId,
        status: SubscriptionStatus.QUOTATION,
        startDate: new Date("2026-06-01"),
        expiryDate: new Date("2027-06-01"),
        paymentTerms: PaymentTerms.NET_30,
        planFee: 50000,
        validUntil: new Date("2026-12-31"),
        createdById: staffUserId,
        lines: {
          create: [
            {
              productId,
              description: "Confidential Enterprise Module",
              qty: 1,
              unitPrice: 20000,
              taxRateBps: 1800,
              amount: 20000,
            },
          ],
        },
      },
    });

    // Sub A Expired (QUOTATION) with past validUntil
    await db.subscription.create({
      data: {
        id: expiredSubAId,
        customerId: custAId,
        planId,
        status: SubscriptionStatus.QUOTATION,
        startDate: new Date("2026-01-01"),
        expiryDate: new Date("2027-01-01"),
        paymentTerms: PaymentTerms.IMMEDIATE,
        planFee: 50000,
        validUntil: new Date("2026-01-15"), // already expired
        createdById: staffUserId,
      },
    });

    // Sub B (ACTIVE) for Customer B
    await db.subscription.create({
      data: {
        id: subBId,
        customerId: custBId,
        planId,
        status: SubscriptionStatus.ACTIVE,
        startDate: new Date("2026-05-01"),
        expiryDate: new Date("2027-05-01"),
        paymentTerms: PaymentTerms.NET_15,
        planFee: 50000,
        createdById: staffUserId,
      },
    });

    // 5. Create Invoices
    await db.invoice.create({
      data: {
        id: invAId,
        customerId: custAId,
        subscriptionId: subAId,
        status: InvoiceStatus.CONFIRMED,
        periodStart: new Date("2026-06-01"),
        periodEnd: new Date("2026-06-30"),
        issueDate: new Date("2026-06-01"),
        dueDate: new Date("2026-07-01"),
        subtotal: 70000,
        discountTotal: 0,
        taxTotal: 12600,
        total: 82600,
        amountPaid: 0,
        lines: {
          create: [
            {
              kind: InvoiceLineKind.PRODUCT,
              productId,
              description: "Confidential Enterprise Module",
              qty: 1,
              unitPrice: 20000,
              taxRateBps: 1800,
              amount: 20000,
              taxAmount: 3600,
            },
          ],
        },
      },
    });

    await db.invoice.create({
      data: {
        id: invBId,
        customerId: custBId,
        subscriptionId: subBId,
        status: InvoiceStatus.CONFIRMED,
        periodStart: new Date("2026-05-01"),
        periodEnd: new Date("2026-05-31"),
        issueDate: new Date("2026-05-01"),
        dueDate: new Date("2026-05-15"),
        subtotal: 50000,
        discountTotal: 0,
        taxTotal: 9000,
        total: 59000,
        amountPaid: 0,
      },
    });

    // 6. Record payment for Customer B
    await db.payment.create({
      data: {
        invoiceId: invBId,
        amount: 20000,
        paidOn: new Date("2026-05-10"),
        method: PaymentMethod.BANK_TRANSFER,
      },
    });

    sessionA = {
      user: {
        id: userAId,
        email: "customera.idor@test.com",
        name: "Customer A IDOR",
        role: Role.CUSTOMER,
        sessionVersion: 0,
        customerId: custAId,
      },
    };

    sessionB = {
      user: {
        id: userBId,
        email: "customerb.idor@test.com",
        name: "Customer B IDOR",
        role: Role.CUSTOMER,
        sessionVersion: 0,
        customerId: custBId,
      },
    };
  });

  afterAll(async () => {
    await cleanup();
  });

  async function cleanup() {
    await db.payment.deleteMany({
      where: { invoiceId: { in: [invAId, invBId] } },
    });
    await db.invoiceLine.deleteMany({
      where: { invoiceId: { in: [invAId, invBId] } },
    });
    await db.invoice.deleteMany({
      where: { id: { in: [invAId, invBId] } },
    });
    await db.subscriptionLine.deleteMany({
      where: { subscriptionId: { in: [subAId, subBId, expiredSubAId] } },
    });
    await db.statusHistory.deleteMany({
      where: { entityId: { in: [subAId, subBId, expiredSubAId, invAId, invBId] } },
    });
    await db.subscription.deleteMany({
      where: { id: { in: [subAId, subBId, expiredSubAId] } },
    });
    await db.plan.deleteMany({
      where: { id: planId },
    });
    await db.product.deleteMany({
      where: { id: productId },
    });
    await db.customer.deleteMany({
      where: { id: { in: [custAId, custBId] } },
    });
    await db.user.deleteMany({
      where: { id: { in: [userAId, userBId, staffUserId] } },
    });
  }

  describe("IDOR Protection: Subscriptions", () => {
    it("returns NOT_FOUND (404) when Customer A attempts to get Customer B's subscription", async () => {
      try {
        await portalService.getMySubscription(sessionA, subBId);
        expect.unreachable("Should have thrown NOT_FOUND");
      } catch (err) {
        expect(err).toBeInstanceOf(AppError);
        expect((err as AppError).status).toBe(404);
        expect((err as AppError).code).toBe("NOT_FOUND");
      }
    });

    it("returns NOT_FOUND (404) when Customer A calls subService.getSubscription directly for Customer B", async () => {
      try {
        await subService.getSubscription(sessionA, subBId);
        expect.unreachable("Should have thrown NOT_FOUND");
      } catch (err) {
        expect(err).toBeInstanceOf(AppError);
        expect((err as AppError).status).toBe(404);
        expect((err as AppError).code).toBe("NOT_FOUND");
      }
    });

    it("returns NOT_FOUND (404) when Customer A requests timeline for Customer B's subscription", async () => {
      try {
        await subService.getSubscriptionTimeline(sessionA, subBId);
        expect.unreachable("Should have thrown NOT_FOUND");
      } catch (err) {
        expect(err).toBeInstanceOf(AppError);
        expect((err as AppError).status).toBe(404);
        expect((err as AppError).code).toBe("NOT_FOUND");
      }
    });

    it("returns NOT_FOUND (404) when Customer A attempts to accept Customer B's quotation", async () => {
      try {
        await portalService.acceptQuotation(sessionA, subBId);
        expect.unreachable("Should have thrown NOT_FOUND");
      } catch (err) {
        expect(err).toBeInstanceOf(AppError);
        expect((err as AppError).status).toBe(404);
        expect((err as AppError).code).toBe("NOT_FOUND");
      }
    });

    it("scopes subscription list strictly to the authenticated customer", async () => {
      const listA = await portalService.listMySubscriptions(sessionA);
      expect(listA.items.length).toBeGreaterThan(0);
      expect(listA.items.every((s) => s.customerId === custAId)).toBe(true);
      expect(listA.items.some((s) => s.id === subBId)).toBe(false);

      const listB = await portalService.listMySubscriptions(sessionB);
      expect(listB.items.every((s) => s.customerId === custBId)).toBe(true);
      expect(listB.items.some((s) => s.id === subAId)).toBe(false);
    });
  });

  describe("IDOR Protection: Invoices & Payments", () => {
    it("returns NOT_FOUND (404) when Customer A attempts to view Customer B's invoice", async () => {
      try {
        await portalService.getMyInvoice(sessionA, invBId);
        expect.unreachable("Should have thrown NOT_FOUND");
      } catch (err) {
        expect(err).toBeInstanceOf(AppError);
        expect((err as AppError).status).toBe(404);
        expect((err as AppError).code).toBe("NOT_FOUND");
      }
    });

    it("returns NOT_FOUND (404) when Customer A calls invoiceService.getInvoice for Customer B", async () => {
      try {
        await invoiceService.getInvoice(sessionA, invBId);
        expect.unreachable("Should have thrown NOT_FOUND");
      } catch (err) {
        expect(err).toBeInstanceOf(AppError);
        expect((err as AppError).status).toBe(404);
        expect((err as AppError).code).toBe("NOT_FOUND");
      }
    });

    it("returns NOT_FOUND (404) when Customer A requests timeline for Customer B's invoice", async () => {
      try {
        await invoiceService.getInvoiceTimeline(sessionA, invBId);
        expect.unreachable("Should have thrown NOT_FOUND");
      } catch (err) {
        expect(err).toBeInstanceOf(AppError);
        expect((err as AppError).status).toBe(404);
        expect((err as AppError).code).toBe("NOT_FOUND");
      }
    });

    it("scopes invoice list strictly to the authenticated customer", async () => {
      const invoicesA = await portalService.listMyInvoices(sessionA);
      expect(invoicesA.invoices.length).toBeGreaterThan(0);
      expect(invoicesA.invoices.every((i) => i.customerId === custAId)).toBe(true);
      expect(invoicesA.invoices.some((i) => i.id === invBId)).toBe(false);

      const invoicesB = await portalService.listMyInvoices(sessionB);
      expect(invoicesB.invoices.every((i) => i.customerId === custBId)).toBe(true);
      expect(invoicesB.invoices.some((i) => i.id === invAId)).toBe(false);
    });

    it("scopes payment history strictly to the authenticated customer", async () => {
      const paymentsA = await portalService.listMyPayments(sessionA);
      // Customer A has made no payments
      expect(paymentsA.total).toBe(0);

      const paymentsB = await portalService.listMyPayments(sessionB);
      // Customer B has 1 payment
      expect(paymentsB.total).toBe(1);
      expect(paymentsB.items[0].invoice.id).toBe(invBId);
    });
  });

  describe("Quotation Acceptance Rules", () => {
    it("allows Customer A to accept their own valid quotation", async () => {
      const accepted = await portalService.acceptQuotation(sessionA, subAId);
      expect(accepted.status).toBe(SubscriptionStatus.CONFIRMED);

      const fetched = await portalService.getMySubscription(sessionA, subAId);
      expect(fetched.subscription.status).toBe(SubscriptionStatus.CONFIRMED);
    });

    it("rejects quotation acceptance after validUntil with CONFLICT (409)", async () => {
      try {
        await portalService.acceptQuotation(sessionA, expiredSubAId);
        expect.unreachable("Should have rejected expired quotation");
      } catch (err) {
        expect(err).toBeInstanceOf(AppError);
        expect((err as AppError).status).toBe(409);
        expect((err as AppError).code).toBe("CONFLICT");
        expect((err as AppError).message).toContain("expired");
      }
    });
  });

  describe("RBAC Enforcement & Staff Action Guards", () => {
    it("rejects Customer session attempting to pause a subscription with FORBIDDEN (403)", async () => {
      try {
        await subService.pauseSubscription(sessionB, subBId);
        expect.unreachable("Should have rejected pause");
      } catch (err) {
        expect(err).toBeInstanceOf(AppError);
        expect((err as AppError).status).toBe(403);
      }
    });

    it("rejects Customer session attempting to close a subscription with FORBIDDEN (403)", async () => {
      try {
        await subService.closeSubscription(sessionB, subBId, "Customer cancelling");
        expect.unreachable("Should have rejected close");
      } catch (err) {
        expect(err).toBeInstanceOf(AppError);
        expect((err as AppError).status).toBe(403);
      }
    });

    it("rejects Customer session attempting to renew a subscription with FORBIDDEN (403)", async () => {
      try {
        await subService.renewSubscription(sessionB, subBId);
        expect.unreachable("Should have rejected renew");
      } catch (err) {
        expect(err).toBeInstanceOf(AppError);
        expect((err as AppError).status).toBe(403);
      }
    });

    it("rejects Customer session attempting to activate a subscription with FORBIDDEN (403)", async () => {
      try {
        await subService.activateSubscription(sessionA, subAId);
        expect.unreachable("Should have rejected activate");
      } catch (err) {
        expect(err).toBeInstanceOf(AppError);
        expect((err as AppError).status).toBe(403);
      }
    });
  });

  describe("Confidential Data Sanitization", () => {
    it("sanitizes product costPrice and internal notes from customer subscription responses", async () => {
      const data = await portalService.getMySubscription(sessionA, subAId);
      const line = data.subscription.lines[0];
      expect(line.product).toBeDefined();
      expect(line.product).not.toBeNull();
      expect(line.product?.costPrice).toBeUndefined();
      expect(line.product?.notes).toBeNull();
      // Internal staff userId is not leaked
      expect(data.subscription.createdById).toBeNull();
    });

    it("sanitizes product costPrice and notes from customer invoice responses", async () => {
      const data = await portalService.getMyInvoice(sessionA, invAId);
      const line = data.invoice.lines[0];
      expect(line.product).toBeDefined();
      expect(line.product).not.toBeNull();
      expect(line.product?.costPrice).toBeUndefined();
      expect(line.product?.notes).toBeNull();
    });

    it("sanitizes byUserId from customer timeline history responses", async () => {
      const data = await portalService.getMySubscription(sessionA, subAId);
      for (const entry of data.timeline) {
        expect(entry.byUserId).toBeNull();
      }
    });
  });
});
