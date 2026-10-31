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
} from "@/generated/prisma/enums";
import { AppError } from "@/server/errors";
import type { Session } from "@/server/lib/session";
import * as subService from "@/server/modules/subscriptions/service";
import * as discountService from "@/server/modules/discounts/service";
import { addBillingPeriod } from "@/lib/dates";

describe("Specs 05 & 06 Integration Tests", { timeout: 30000 }, () => {
  let adminSession: Session;
  let staffSession: Session;
  let customerSession: Session;

  let testCustomer: { id: string; email: string };
  let testSoftwareProduct: { id: string; salesPrice: number };
  let testServiceProduct: { id: string; salesPrice: number };
  let testVariantOdoo: { id: string; extraPrice: number };

  let fullyConfiguredPlan: { id: string; price: number; minQty: number; billingPeriod: BillingPeriod };
  let rigidPlan: { id: string; price: number; minQty: number; billingPeriod: BillingPeriod }; // pausable: false, renewable: false, closable: false

  const baseStartDate = new Date("2026-11-01T00:00:00.000Z");
  const baseExpiryDate = new Date("2027-11-01T00:00:00.000Z");

  async function cleanupTestData() {
    const testPlanIds = [
      "00000000-0000-4000-f000-888888888888",
      "00000000-0000-4000-f000-999999999999",
    ];

    await db.subscriptionLine.deleteMany({
      where: {
        subscription: {
          planId: { in: testPlanIds },
        },
      },
    });
    await db.statusHistory.deleteMany({
      where: { entity: "SUBSCRIPTION" },
    });
    await db.subscription.deleteMany({
      where: {
        planId: { in: testPlanIds },
      },
    });
    await db.templateLine.deleteMany({
      where: {
        templateId: {
          notIn: [
            "00000000-0000-4000-1000-000000000001",
            "00000000-0000-4000-1000-000000000002",
          ],
        },
      },
    });
    await db.quotationTemplate.deleteMany({
      where: {
        id: {
          notIn: [
            "00000000-0000-4000-1000-000000000001",
            "00000000-0000-4000-1000-000000000002",
          ],
        },
      },
    });
    await db.plan.deleteMany({
      where: {
        id: { in: testPlanIds },
      },
    });
    await db.discountProduct.deleteMany({
      where: {
        discountId: {
          notIn: [
            "00000000-0000-4000-2000-000000000001",
            "00000000-0000-4000-2000-000000000002",
            "00000000-0000-4000-2000-000000000003",
            "00000000-0000-4000-2000-000000000004",
          ],
        },
      },
    });
    await db.discount.deleteMany({
      where: {
        id: {
          notIn: [
            "00000000-0000-4000-2000-000000000001",
            "00000000-0000-4000-2000-000000000002",
            "00000000-0000-4000-2000-000000000003",
            "00000000-0000-4000-2000-000000000004",
          ],
        },
      },
    });
  }

  beforeAll(async () => {
    await cleanupTestData();

    // 1. Fetch sessions
    const adminUser = await db.user.findFirst({ where: { role: Role.ADMIN, isActive: true } });
    adminSession = {
      user: {
        id: adminUser!.id,
        email: adminUser!.email,
        name: adminUser!.name,
        role: Role.ADMIN,
        sessionVersion: adminUser!.sessionVersion,
      },
    };

    const staffUser = await db.user.findFirst({ where: { role: Role.STAFF, isActive: true } });
    staffSession = {
      user: {
        id: staffUser!.id,
        email: staffUser!.email,
        name: staffUser!.name,
        role: Role.STAFF,
        sessionVersion: staffUser!.sessionVersion,
      },
    };

    const customerUser = await db.user.findFirst({
      where: { role: Role.CUSTOMER, isActive: true },
      include: { customer: true },
    });
    customerSession = {
      user: {
        id: customerUser!.id,
        email: customerUser!.email,
        name: customerUser!.name,
        role: Role.CUSTOMER,
        sessionVersion: customerUser!.sessionVersion,
        customerId: customerUser!.customer?.id ?? null,
      },
    };

    // 2. Fetch seeded fixtures
    const customer = await db.customer.findFirst({ where: { isActive: true } });
    expect(customer).not.toBeNull();
    testCustomer = customer!;

    const software = await db.product.findFirst({
      where: { name: { contains: "ERP" } },
      include: { variants: true },
    });
    expect(software).not.toBeNull();
    testSoftwareProduct = software!;
    testVariantOdoo = software!.variants[0]!;

    const service = await db.product.findFirst({
      where: { name: { contains: "Support" } },
    });
    expect(service).not.toBeNull();
    testServiceProduct = service!;

    // Create a dedicated fully-configured plan: closable, pausable, renewable, minQty: 5
    const fully = await db.plan.upsert({
      where: { id: "00000000-0000-4000-f000-888888888888" },
      update: {
        isActive: true,
        availableFrom: new Date("2026-01-01"),
        availableTo: null,
      },
      create: {
        id: "00000000-0000-4000-f000-888888888888",
        name: "Fully Configured Test Plan",
        price: 200000,
        billingPeriod: BillingPeriod.MONTHLY,
        minQty: 5,
        availableFrom: new Date("2026-01-01"),
        availableTo: null,
        autoClose: false,
        closable: true,
        pausable: true,
        renewable: true,
        isActive: true,
      },
    });
    fullyConfiguredPlan = fully;

    // Create a rigid plan for testing flag enforcement: pausable: false, renewable: false, closable: false
    const rigid = await db.plan.upsert({
      where: { id: "00000000-0000-4000-f000-999999999999" },
      update: {
        isActive: true,
        availableFrom: new Date("2026-01-01"),
        availableTo: null,
      },
      create: {
        id: "00000000-0000-4000-f000-999999999999",
        name: "Rigid Non-flexible Plan",
        price: 30000,
        billingPeriod: BillingPeriod.MONTHLY,
        minQty: 1,
        availableFrom: new Date("2026-01-01"),
        availableTo: null,
        autoClose: false,
        closable: false,
        pausable: false,
        renewable: false,
        isActive: true,
      },
    });
    rigidPlan = rigid;
  });

  afterAll(async () => {
    await cleanupTestData();
  });

  // ──────────────────────────────────────────────
  // 1. Quotation Templates (Spec 05)
  // ──────────────────────────────────────────────
  describe("Quotation Templates", () => {
    it("allows ADMIN to create a quotation template with lines", async () => {
      const template = await subService.createQuotationTemplate(adminSession, {
        name: `Integration Test Template ${Date.now()}`,
        planId: fullyConfiguredPlan.id,
        validityDays: 20,
        lines: [
          {
            productId: testSoftwareProduct.id,
            variantId: testVariantOdoo.id,
            qty: fullyConfiguredPlan.minQty,
          },
        ],
      });

      expect(template.id).toBeDefined();
      expect(template.lines).toHaveLength(1);
      expect(template.validityDays).toBe(20);
    });

    it("rejects STAFF attempting to create a quotation template with FORBIDDEN (403)", async () => {
      await expect(
        subService.createQuotationTemplate(staffSession, {
          name: "Staff Template",
          planId: fullyConfiguredPlan.id,
          validityDays: 15,
          lines: [{ productId: testSoftwareProduct.id, qty: fullyConfiguredPlan.minQty }],
        })
      ).rejects.toThrowError(AppError);
    });

    it("allows STAFF to list quotation templates", async () => {
      const list = await subService.listQuotationTemplates(staffSession, { page: 1, pageSize: 10 });
      expect(list.items.length).toBeGreaterThan(0);
    });
  });

  // ──────────────────────────────────────────────
  // 2. Subscription Creation & Snapshots (Spec 05)
  // ──────────────────────────────────────────────
  describe("Subscription Creation & Line Snapshots", () => {
    it("creates a blank subscription with snapshotted planFee, taxRate, unitPrice and DB default SUB- number", async () => {
      const sub = await subService.createSubscriptionBlank(staffSession, {
        customerId: testCustomer.id,
        planId: fullyConfiguredPlan.id,
        startDate: baseStartDate,
        expiryDate: baseExpiryDate,
        paymentTerms: PaymentTerms.IMMEDIATE,
        lines: [
          {
            productId: testSoftwareProduct.id,
            variantId: testVariantOdoo.id,
            qty: fullyConfiguredPlan.minQty,
          },
          {
            productId: testServiceProduct.id,
            qty: fullyConfiguredPlan.minQty,
          },
        ],
      });

      expect(sub.id).toBeDefined();
      // DB default sequence creates SUB-00000X
      expect(sub.number).toMatch(/^SUB-\d{6}$/);
      expect(sub.status).toBe(SubscriptionStatus.DRAFT);
      expect(sub.planFee).toBe(fullyConfiguredPlan.price);

      // Verify line snapshots
      expect(sub.lines).toHaveLength(2);
      const softwareLine = sub.lines.find((l) => l.productId === testSoftwareProduct.id)!;
      expect(softwareLine.unitPrice).toBe(testSoftwareProduct.salesPrice + testVariantOdoo.extraPrice);
      expect(softwareLine.amount).toBe(fullyConfiguredPlan.minQty * softwareLine.unitPrice);

      // Verify initial status history
      const timeline = await subService.getSubscriptionTimeline(staffSession, sub.id);
      expect(timeline).toHaveLength(1);
      expect(timeline[0].from).toBeNull();
      expect(timeline[0].to).toBe(SubscriptionStatus.DRAFT);
    });

    it("rejects line quantity less than plan.minQty", async () => {
      await expect(
        subService.createSubscriptionBlank(staffSession, {
          customerId: testCustomer.id,
          planId: fullyConfiguredPlan.id,
          startDate: baseStartDate,
          expiryDate: baseExpiryDate,
          paymentTerms: PaymentTerms.NET_15,
          lines: [
            {
              productId: testSoftwareProduct.id,
              qty: fullyConfiguredPlan.minQty - 1, // less than plan.minQty!
            },
          ],
        })
      ).rejects.toThrowError(AppError);
    });

    it("creates a subscription from a quotation template copying plan and lines", async () => {
      const seededTemplate = await db.quotationTemplate.findFirst({
        where: { id: "00000000-0000-4000-1000-000000000001" },
        include: { lines: true, plan: true },
      });
      expect(seededTemplate).not.toBeNull();

      const sub = await subService.createSubscriptionFromTemplate(staffSession, {
        customerId: testCustomer.id,
        templateId: seededTemplate!.id,
        startDate: baseStartDate,
      });

      expect(sub.templateId).toBe(seededTemplate!.id);
      expect(sub.planId).toBe(seededTemplate!.planId);
      expect(sub.lines.length).toBe(seededTemplate!.lines.length);
      expect(sub.status).toBe(SubscriptionStatus.DRAFT);
    });
  });

  // ──────────────────────────────────────────────
  // 3. Draft Operations (Spec 05)
  // ──────────────────────────────────────────────
  describe("Draft Operations: Edit and Delete", () => {
    it("allows editing a DRAFT subscription", async () => {
      const draft = await subService.createSubscriptionBlank(staffSession, {
        customerId: testCustomer.id,
        planId: fullyConfiguredPlan.id,
        startDate: baseStartDate,
        expiryDate: baseExpiryDate,
        lines: [{ productId: testSoftwareProduct.id, qty: fullyConfiguredPlan.minQty }],
      });

      const updated = await subService.updateDraftSubscription(staffSession, draft.id, {
        paymentTerms: PaymentTerms.NET_30,
        lines: [{ productId: testSoftwareProduct.id, qty: fullyConfiguredPlan.minQty + 2 }],
      });

      expect(updated.paymentTerms).toBe(PaymentTerms.NET_30);
      expect(updated.lines[0].qty).toBe(fullyConfiguredPlan.minQty + 2);
    });

    it("allows deleting a DRAFT subscription", async () => {
      const draft = await subService.createSubscriptionBlank(staffSession, {
        customerId: testCustomer.id,
        planId: fullyConfiguredPlan.id,
        startDate: baseStartDate,
        expiryDate: baseExpiryDate,
        lines: [{ productId: testSoftwareProduct.id, qty: fullyConfiguredPlan.minQty }],
      });

      await subService.deleteDraftSubscription(staffSession, draft.id);

      await expect(subService.getSubscription(staffSession, draft.id)).rejects.toThrowError(AppError);
    });
  });

  // ──────────────────────────────────────────────
  // 4. Central Status Transitions & Flags (Spec 05)
  // ──────────────────────────────────────────────
  describe("Central Transition Function: Full Lifecycle", () => {
    it("runs complete legal lifecycle: Draft -> Quotation -> Confirmed -> Active -> Paused -> Resumed -> Renewed -> Closed", async () => {
      // 1. Create Draft
      const sub = await subService.createSubscriptionBlank(staffSession, {
        customerId: testCustomer.id,
        planId: fullyConfiguredPlan.id,
        startDate: baseStartDate,
        expiryDate: baseExpiryDate,
        lines: [{ productId: testSoftwareProduct.id, qty: fullyConfiguredPlan.minQty }],
      });
      expect(sub.status).toBe(SubscriptionStatus.DRAFT);

      // 2. SEND_QUOTATION: Draft -> Quotation
      const quoted = await subService.sendQuotation(staffSession, sub.id);
      expect(quoted.status).toBe(SubscriptionStatus.QUOTATION);
      expect(quoted.quotationSentAt).not.toBeNull();
      expect(quoted.validUntil).not.toBeNull();

      // Sent quotation is immutable: cannot be edited or deleted
      await expect(
        subService.updateDraftSubscription(staffSession, quoted.id, {
          paymentTerms: PaymentTerms.NET_30,
        })
      ).rejects.toThrowError(AppError);

      await expect(subService.deleteDraftSubscription(staffSession, quoted.id)).rejects.toThrowError(
        AppError
      );

      // 3. CONFIRM: Quotation -> Confirmed
      const confirmed = await subService.confirmSubscription(staffSession, quoted.id);
      expect(confirmed.status).toBe(SubscriptionStatus.CONFIRMED);

      // 4. ACTIVATE: Confirmed -> Active
      const activated = await subService.activateSubscription(staffSession, confirmed.id);
      expect(activated.status).toBe(SubscriptionStatus.ACTIVE);
      expect(activated.nextPeriodStart).not.toBeNull();

      // 5. PAUSE: Active -> Paused (Active with pausedAt set)
      const paused = await subService.pauseSubscription(staffSession, activated.id);
      expect(paused.status).toBe(SubscriptionStatus.ACTIVE);
      expect(paused.pausedAt).not.toBeNull();

      // 6. RESUME: Paused -> Active (resuming moves nextPeriodStart to first period start on or after resume date)
      // Next period start was initially Nov 01 2026.
      // Resume on Jan 15 2027 -> next period start moves to Feb 01 2027!
      const resumed = await subService.resumeSubscription(staffSession, paused.id, {
        resumeDate: new Date("2027-01-15"),
      });
      expect(resumed.status).toBe(SubscriptionStatus.ACTIVE);
      expect(resumed.pausedAt).toBeNull();
      expect(new Date(resumed.nextPeriodStart!).toISOString().slice(0, 10)).toBe("2027-02-01");

      // 7. RENEW: Active -> Active (extends expiryDate by one billing period)
      const prevExpiry = new Date(resumed.expiryDate);
      const renewed = await subService.renewSubscription(staffSession, resumed.id);
      expect(renewed.status).toBe(SubscriptionStatus.ACTIVE);
      const expectedNewExpiry = addBillingPeriod(prevExpiry, fullyConfiguredPlan.billingPeriod, 1);
      expect(new Date(renewed.expiryDate).toISOString().slice(0, 10)).toBe(
        expectedNewExpiry.toISOString().slice(0, 10)
      );

      // 8. CLOSE: Active -> Closed with reason
      const closed = await subService.closeSubscription(
        staffSession,
        renewed.id,
        "Customer completed migration project"
      );
      expect(closed.status).toBe(SubscriptionStatus.CLOSED);
      expect(closed.closeReason).toBe("Customer completed migration project");
      expect(closed.closedAt).not.toBeNull();

      // Verify StatusHistory recorded all 8 steps in order
      const timeline = await subService.getSubscriptionTimeline(staffSession, sub.id);
      expect(timeline.length).toBe(8);
      expect(timeline.map((t) => `${t.from || "NEW"}->${t.to}`)).toEqual([
        "NEW->DRAFT",
        "DRAFT->QUOTATION",
        "QUOTATION->CONFIRMED",
        "CONFIRMED->ACTIVE",
        "ACTIVE->PAUSED",
        "PAUSED->ACTIVE",
        "ACTIVE->ACTIVE",
        "ACTIVE->CLOSED",
      ]);
    });

    it("allows closing a QUOTATION directly with a reason", async () => {
      const sub = await subService.createSubscriptionBlank(staffSession, {
        customerId: testCustomer.id,
        planId: fullyConfiguredPlan.id,
        startDate: baseStartDate,
        expiryDate: baseExpiryDate,
        lines: [{ productId: testSoftwareProduct.id, qty: fullyConfiguredPlan.minQty }],
      });

      const quoted = await subService.sendQuotation(staffSession, sub.id);
      const closed = await subService.closeSubscription(staffSession, quoted.id, "Customer rejected price");

      expect(closed.status).toBe(SubscriptionStatus.CLOSED);
      expect(closed.closeReason).toBe("Customer rejected price");
    });
  });

  // ──────────────────────────────────────────────
  // 5. Illegal Transitions (Conflict 409)
  // ──────────────────────────────────────────────
  describe("Illegal Transition Enforcements", () => {
    it("rejects DRAFT -> CONFIRMED (cannot skip quotation)", async () => {
      const sub = await subService.createSubscriptionBlank(staffSession, {
        customerId: testCustomer.id,
        planId: fullyConfiguredPlan.id,
        startDate: baseStartDate,
        expiryDate: baseExpiryDate,
        lines: [{ productId: testSoftwareProduct.id, qty: fullyConfiguredPlan.minQty }],
      });

      await expect(subService.confirmSubscription(staffSession, sub.id)).rejects.toThrowError(AppError);
    });

    it("rejects DRAFT -> ACTIVE (cannot activate draft)", async () => {
      const sub = await subService.createSubscriptionBlank(staffSession, {
        customerId: testCustomer.id,
        planId: fullyConfiguredPlan.id,
        startDate: baseStartDate,
        expiryDate: baseExpiryDate,
        lines: [{ productId: testSoftwareProduct.id, qty: fullyConfiguredPlan.minQty }],
      });

      await expect(subService.activateSubscription(staffSession, sub.id)).rejects.toThrowError(AppError);
    });

    it("rejects QUOTATION -> ACTIVE (cannot skip confirmation)", async () => {
      const sub = await subService.createSubscriptionBlank(staffSession, {
        customerId: testCustomer.id,
        planId: fullyConfiguredPlan.id,
        startDate: baseStartDate,
        expiryDate: baseExpiryDate,
        lines: [{ productId: testSoftwareProduct.id, qty: fullyConfiguredPlan.minQty }],
      });
      const quoted = await subService.sendQuotation(staffSession, sub.id);

      await expect(subService.activateSubscription(staffSession, quoted.id)).rejects.toThrowError(AppError);
    });

    it("rejects CONFIRMED -> QUOTATION (cannot roll back to quotation)", async () => {
      const sub = await subService.createSubscriptionBlank(staffSession, {
        customerId: testCustomer.id,
        planId: fullyConfiguredPlan.id,
        startDate: baseStartDate,
        expiryDate: baseExpiryDate,
        lines: [{ productId: testSoftwareProduct.id, qty: fullyConfiguredPlan.minQty }],
      });
      const quoted = await subService.sendQuotation(staffSession, sub.id);
      const confirmed = await subService.confirmSubscription(staffSession, quoted.id);

      await expect(subService.sendQuotation(staffSession, confirmed.id)).rejects.toThrowError(AppError);
    });

    it("rejects CLOSED -> ACTIVE (cannot reactivate closed subscription)", async () => {
      const sub = await subService.createSubscriptionBlank(staffSession, {
        customerId: testCustomer.id,
        planId: fullyConfiguredPlan.id,
        startDate: baseStartDate,
        expiryDate: baseExpiryDate,
        lines: [{ productId: testSoftwareProduct.id, qty: fullyConfiguredPlan.minQty }],
      });
      const quoted = await subService.sendQuotation(staffSession, sub.id);
      const closed = await subService.closeSubscription(staffSession, quoted.id, "Declined");

      await expect(subService.activateSubscription(staffSession, closed.id)).rejects.toThrowError(AppError);
    });

    it("rejects PAUSE on an already paused subscription", async () => {
      const sub = await subService.createSubscriptionBlank(staffSession, {
        customerId: testCustomer.id,
        planId: fullyConfiguredPlan.id,
        startDate: baseStartDate,
        expiryDate: baseExpiryDate,
        lines: [{ productId: testSoftwareProduct.id, qty: fullyConfiguredPlan.minQty }],
      });
      await subService.sendQuotation(staffSession, sub.id);
      await subService.confirmSubscription(staffSession, sub.id);
      await subService.activateSubscription(staffSession, sub.id);
      await subService.pauseSubscription(staffSession, sub.id);

      await expect(subService.pauseSubscription(staffSession, sub.id)).rejects.toThrowError(AppError);
    });

    it("rejects RESUME on an unpaused subscription", async () => {
      const sub = await subService.createSubscriptionBlank(staffSession, {
        customerId: testCustomer.id,
        planId: fullyConfiguredPlan.id,
        startDate: baseStartDate,
        expiryDate: baseExpiryDate,
        lines: [{ productId: testSoftwareProduct.id, qty: fullyConfiguredPlan.minQty }],
      });
      await subService.sendQuotation(staffSession, sub.id);
      await subService.confirmSubscription(staffSession, sub.id);
      await subService.activateSubscription(staffSession, sub.id);

      await expect(subService.resumeSubscription(staffSession, sub.id)).rejects.toThrowError(AppError);
    });

    it("rejects confirming a quotation after validUntil has passed", async () => {
      const sub = await subService.createSubscriptionBlank(staffSession, {
        customerId: testCustomer.id,
        planId: fullyConfiguredPlan.id,
        startDate: baseStartDate,
        expiryDate: baseExpiryDate,
        validUntil: new Date("2026-11-10"),
        lines: [{ productId: testSoftwareProduct.id, qty: fullyConfiguredPlan.minQty }],
      });
      await subService.sendQuotation(staffSession, sub.id);

      // Attempt to confirm on Nov 15 (after Nov 10)
      await expect(
        subService.confirmSubscription(staffSession, sub.id, {
          asOfDate: new Date("2026-11-15"),
        })
      ).rejects.toThrowError(AppError);
    });
  });

  // ──────────────────────────────────────────────
  // 6. Plan Flag Enforcements (pausable, renewable, closable)
  // ──────────────────────────────────────────────
  describe("Plan Flag Enforcements", () => {
    it("enforces plan.pausable = false: rejects pause", async () => {
      const sub = await subService.createSubscriptionBlank(staffSession, {
        customerId: testCustomer.id,
        planId: rigidPlan.id,
        startDate: baseStartDate,
        expiryDate: baseExpiryDate,
        lines: [{ productId: testSoftwareProduct.id, qty: rigidPlan.minQty }],
      });
      await subService.sendQuotation(staffSession, sub.id);
      await subService.confirmSubscription(staffSession, sub.id);
      await subService.activateSubscription(staffSession, sub.id);

      await expect(subService.pauseSubscription(staffSession, sub.id)).rejects.toThrowError(AppError);
    });

    it("enforces plan.renewable = false: rejects renew", async () => {
      const sub = await subService.createSubscriptionBlank(staffSession, {
        customerId: testCustomer.id,
        planId: rigidPlan.id,
        startDate: baseStartDate,
        expiryDate: baseExpiryDate,
        lines: [{ productId: testSoftwareProduct.id, qty: rigidPlan.minQty }],
      });
      await subService.sendQuotation(staffSession, sub.id);
      await subService.confirmSubscription(staffSession, sub.id);
      await subService.activateSubscription(staffSession, sub.id);

      await expect(subService.renewSubscription(staffSession, sub.id)).rejects.toThrowError(AppError);
    });

    it("enforces plan.closable = false: rejects early close before expiry", async () => {
      const sub = await subService.createSubscriptionBlank(staffSession, {
        customerId: testCustomer.id,
        planId: rigidPlan.id,
        startDate: baseStartDate,
        expiryDate: baseExpiryDate,
        lines: [{ productId: testSoftwareProduct.id, qty: rigidPlan.minQty }],
      });
      await subService.sendQuotation(staffSession, sub.id);
      await subService.confirmSubscription(staffSession, sub.id);
      await subService.activateSubscription(staffSession, sub.id);

      // Attempting early close on June 15 2027 when expiry is Nov 1 2027
      await expect(
        subService.closeSubscription(staffSession, sub.id, "Early termination", {
          asOfDate: new Date("2027-06-15"),
        })
      ).rejects.toThrowError(AppError);
    });

    it("rejects close without reason", async () => {
      const sub = await subService.createSubscriptionBlank(staffSession, {
        customerId: testCustomer.id,
        planId: fullyConfiguredPlan.id,
        startDate: baseStartDate,
        expiryDate: baseExpiryDate,
        lines: [{ productId: testSoftwareProduct.id, qty: fullyConfiguredPlan.minQty }],
      });
      await subService.sendQuotation(staffSession, sub.id);

      await expect(subService.closeSubscription(staffSession, sub.id, "   ")).rejects.toThrowError(
        AppError
      );
    });
  });

  // ──────────────────────────────────────────────
  // 7. Discounts Admin CRUD (Spec 06)
  // ──────────────────────────────────────────────
  describe("Discounts Admin CRUD", () => {
    it("allows ADMIN to create, update, and deactivate discounts", async () => {
      const discount = await discountService.createDiscount(adminSession, {
        name: `VIP Loyalty 15% ${Date.now()}`,
        type: DiscountType.PERCENT,
        value: 1500, // 15%
        minPurchase: 100000,
        minQty: 2,
        startDate: new Date("2026-01-01"),
        endDate: new Date("2026-12-31"),
        usageLimit: 50,
        scope: DiscountScope.SUBSCRIPTION,
      });

      expect(discount.id).toBeDefined();
      expect(discount.value).toBe(1500);
      expect(discount.isActive).toBe(true);

      const updated = await discountService.updateDiscount(adminSession, discount.id, {
        name: `${discount.name} Updated`,
        value: 2000, // 20%
      });
      expect(updated.value).toBe(2000);

      const deactivated = await discountService.deactivateDiscount(adminSession, discount.id);
      expect(deactivated.isActive).toBe(false);
    });

    it("rejects STAFF attempting to create a discount with FORBIDDEN (403)", async () => {
      await expect(
        discountService.createDiscount(staffSession, {
          name: "Staff Discount",
          type: DiscountType.FIXED,
          value: 10000,
          startDate: new Date("2026-01-01"),
          endDate: new Date("2026-12-31"),
          usageLimit: 10,
          scope: DiscountScope.SUBSCRIPTION,
        })
      ).rejects.toThrowError(AppError);
    });

    it("rejects CUSTOMER attempting to access discount administration", async () => {
      await expect(
        discountService.createDiscount(customerSession, {
          name: "Customer Discount",
          type: DiscountType.FIXED,
          value: 10000,
          startDate: new Date("2026-01-01"),
          endDate: new Date("2026-12-31"),
          usageLimit: 10,
          scope: DiscountScope.SUBSCRIPTION,
        })
      ).rejects.toThrowError(AppError);

      await expect(discountService.listDiscounts(customerSession)).rejects.toThrowError(AppError);
    });

    it("allows STAFF to list discounts", async () => {
      const list = await discountService.listDiscounts(staffSession, { page: 1, pageSize: 10 });
      expect(list.items.length).toBeGreaterThan(0);
    });
  });
});
