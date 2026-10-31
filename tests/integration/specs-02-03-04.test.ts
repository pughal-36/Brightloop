import { describe, it, expect, vi } from "vitest";

// Mock server-only so we can import server code in Vitest
vi.mock("server-only", () => ({}));

import { db } from "@/server/db";
import { Role, ProductType, BillingPeriod } from "@/generated/prisma/enums";
import { AppError } from "@/server/errors";
import type { Session } from "@/server/lib/session";
import { createSessionToken, validateSessionToken } from "@/server/lib/session";
import * as staffService from "@/server/modules/staff/service";
import * as customerService from "@/server/modules/customers/service";
import * as catalogService from "@/server/modules/catalog/service";
import * as planService from "@/server/modules/plans/service";

describe("Specs 02, 03, 04 Integration Tests", { timeout: 30000 }, () => {
  let adminSession: Session;
  let staffSession: Session;
  let customerSession: Session;

  // Set up real users in the DB for sessions
  it("prepares test sessions for ADMIN, STAFF, and CUSTOMER", async () => {
    // Look up or find seeded users
    const adminUser = await db.user.findFirst({ where: { role: Role.ADMIN, isActive: true } });
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

    const staffUser = await db.user.findFirst({ where: { role: Role.STAFF, isActive: true } });
    expect(staffUser).not.toBeNull();
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
    expect(customerUser).not.toBeNull();
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
  });

  describe("Guards & RBAC", () => {
    it("rejects STAFF calling admin-only services with FORBIDDEN (403)", async () => {
      // 1. Staff management
      await expect(
        staffService.createStaff(staffSession, {
          name: "Test Staff",
          email: "staff.test@example.com",
        })
      ).rejects.toThrowError(AppError);

      await expect(
        staffService.deactivateStaff(staffSession, { userId: adminSession.user.id })
      ).rejects.toThrowError(AppError);

      await expect(staffService.listStaff(staffSession)).rejects.toThrowError(AppError);

      // 2. Catalog write services
      await expect(
        catalogService.createTax(staffSession, { name: "Test Tax", rateBps: 1800 })
      ).rejects.toThrowError(AppError);

      await expect(
        catalogService.createProduct(staffSession, {
          name: "Test Product",
          type: ProductType.SERVICE,
          salesPrice: 10000,
          costPrice: 5000,
        })
      ).rejects.toThrowError(AppError);

      await expect(
        catalogService.createVariant(staffSession, "dummy-id", {
          attribute: "Brand",
          value: "Test",
          extraPrice: 100,
        })
      ).rejects.toThrowError(AppError);

      // 3. Plans write services
      await expect(
        planService.createPlan(staffSession, {
          name: "Test Plan",
          price: 10000,
          billingPeriod: BillingPeriod.MONTHLY,
          minQty: 1,
          availableFrom: new Date(),
        })
      ).rejects.toThrowError(AppError);

      // Verify status code is 403
      try {
        await staffService.createStaff(staffSession, {
          name: "Test Staff",
          email: "staff.test@example.com",
        });
      } catch (err) {
        expect(err).toBeInstanceOf(AppError);
        expect((err as AppError).status).toBe(403);
        expect((err as AppError).code).toBe("FORBIDDEN");
      }
    });

    it("blocks CUSTOMER session from /admin services with FORBIDDEN (403)", async () => {
      // Customer trying to access admin customer directory
      await expect(customerService.listCustomers(customerSession)).rejects.toThrowError(
        AppError
      );

      // Customer trying to create customer
      await expect(
        customerService.createCustomer(customerSession, {
          name: "Illegal Customer",
          email: "illegal@example.com",
        })
      ).rejects.toThrowError(AppError);

      // Customer trying to list catalog products
      await expect(catalogService.listProducts(customerSession)).rejects.toThrowError(
        AppError
      );

      // Customer trying to list plans
      await expect(planService.listPlans(customerSession)).rejects.toThrowError(AppError);

      // Customer trying to list staff
      await expect(staffService.listStaff(customerSession)).rejects.toThrowError(AppError);

      try {
        await customerService.listCustomers(customerSession);
      } catch (err) {
        expect(err).toBeInstanceOf(AppError);
        expect((err as AppError).status).toBe(403);
        expect((err as AppError).code).toBe("FORBIDDEN");
      }
    });
  });

  describe("Staff Management (Spec 02)", () => {
    it("allows ADMIN to create staff with set-password reset token flow", async () => {
      const email = `staff.new.${Date.now()}@brightloop.io`;
      const result = await staffService.createStaff(adminSession, {
        name: "New Staff Member",
        email,
      });

      expect(result.staff.name).toBe("New Staff Member");
      expect(result.staff.email).toBe(email);
      expect(result.staff.role).toBe(Role.STAFF);
      expect(result.resetLink).toContain("/reset-password?token=");

      // Verify reset token exists in database for this staff user
      const resetToken = await db.passwordResetToken.findFirst({
        where: { userId: result.staff.id },
      });
      expect(resetToken).not.toBeNull();
      expect(resetToken?.usedAt).toBeNull();
    });

    it("prevents ADMIN from deactivating self", async () => {
      await expect(
        staffService.deactivateStaff(adminSession, { userId: adminSession.user.id })
      ).rejects.toThrowError(/Cannot deactivate yourself/);
    });

    it("immediately invalidates session when staff member is deactivated", async () => {
      const email = `staff.deact.${Date.now()}@brightloop.io`;
      const created = await staffService.createStaff(adminSession, {
        name: "Deactivate Candidate",
        email,
      });

      // Issue a session token for this staff user
      const token = await createSessionToken({
        userId: created.staff.id,
        role: Role.STAFF,
        sessionVersion: 0,
      });

      // Before deactivation: session is valid
      const validSession = await validateSessionToken(token);
      expect(validSession).not.toBeNull();
      expect(validSession?.user.email).toBe(email);

      // Deactivate the staff member
      await staffService.deactivateStaff(adminSession, { userId: created.staff.id });

      // After deactivation: session is invalid immediately (returns null)
      const afterSession = await validateSessionToken(token);
      expect(afterSession).toBeNull();
    });
  });

  describe("Customers CRUD (Spec 02)", () => {
    it("allows STAFF to create, list, search, and update customers", async () => {
      const uniqueSuffix = Date.now();
      const customerEmail = `acme.${uniqueSuffix}@example.com`;

      // 1. Create customer
      const created = await customerService.createCustomer(staffSession, {
        name: `Acme Corp ${uniqueSuffix}`,
        email: customerEmail,
        phone: "+91 9876543210",
        billingAddress: "42 Tech Park, Bengaluru",
      });

      expect(created.id).toBeDefined();
      expect(created.name).toBe(`Acme Corp ${uniqueSuffix}`);
      expect(created.createdById).toBe(staffSession.user.id);

      // 2. Search customer
      const searchResult = await customerService.listCustomers(staffSession, {
        search: `Acme Corp ${uniqueSuffix}`,
        page: 1,
        pageSize: 10,
      });

      expect(searchResult.total).toBeGreaterThanOrEqual(1);
      expect(searchResult.items[0]?.email).toBe(customerEmail);

      // 3. Update customer
      const updated = await customerService.updateCustomer(staffSession, created.id, {
        name: `Acme Global ${uniqueSuffix}`,
        billingAddress: "100 Innovation Blvd, Hyderabad",
      });

      expect(updated.name).toBe(`Acme Global ${uniqueSuffix}`);
      expect(updated.billingAddress).toBe("100 Innovation Blvd, Hyderabad");
    });
  });

  describe("Catalog & Variant Price Math (Spec 03)", () => {
    it("calculates effective unit price and margin correctly", async () => {
      // Direct helper checks
      const effectivePrice = catalogService.calculateEffectiveUnitPrice(100000, 56000);
      expect(effectivePrice).toBe(156000); // 1000 INR + 560 INR = 1560 INR in paise

      const margin = catalogService.calculateMargin(100000, 40000);
      expect(margin).toBe(60000); // 1000 INR - 400 INR = 600 INR margin

      // Database-backed test
      const tax = await catalogService.createTax(adminSession, {
        name: `GST 18% ${Date.now()}`,
        rateBps: 1800,
      });

      const product = await catalogService.createProduct(adminSession, {
        name: `Odoo Subscription Base ${Date.now()}`,
        type: ProductType.SOFTWARE,
        salesPrice: 100000, // ₹1,000.00
        costPrice: 40000, // ₹400.00
        taxId: tax.id,
      });

      const variant = await catalogService.createVariant(adminSession, product.id, {
        attribute: "Brand",
        value: "Odoo Enterprise",
        extraPrice: 56000, // +₹560.00
      });

      expect(variant.effectivePrice).toBe(156000);

      // Fetch as ADMIN: margin and costPrice must be present
      const adminView = await catalogService.getProduct(adminSession, product.id);
      expect(adminView.salesPrice).toBe(100000);
      expect(adminView.costPrice).toBe(40000);
      expect(adminView.margin).toBe(60000);
      expect(adminView.variants[0]?.effectivePrice).toBe(156000);

      // Fetch as STAFF: costPrice and margin must be omitted/undefined
      const staffView = await catalogService.getProduct(staffSession, product.id);
      expect(staffView.salesPrice).toBe(100000);
      expect(staffView.costPrice).toBeUndefined();
      expect(staffView.margin).toBeUndefined();
      expect(staffView.variants[0]?.effectivePrice).toBe(156000);
    });

    it("enforces unique (productId, attribute, value) on variants", async () => {
      const product = await catalogService.createProduct(adminSession, {
        name: `Unique Variant Test ${Date.now()}`,
        type: ProductType.SERVICE,
        salesPrice: 50000,
        costPrice: 20000,
      });

      await catalogService.createVariant(adminSession, product.id, {
        attribute: "Color",
        value: "Blue",
        extraPrice: 5000,
      });

      // Attempting duplicate variant attribute/value
      await expect(
        catalogService.createVariant(adminSession, product.id, {
          attribute: "Color",
          value: "Blue",
          extraPrice: 10000,
        })
      ).rejects.toThrowError(AppError);
    });
  });

  describe("Plans Availability Window & Lifecycle Flags (Spec 04)", () => {
    it("creates plan with flags and checks isPlanSelectable availability window", async () => {
      const now = new Date();
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const nextMonth = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
      const nextYear = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);

      const plan = await planService.createPlan(adminSession, {
        name: `Enterprise Active Plan ${Date.now()}`,
        price: 250000, // ₹2,500.00
        billingPeriod: BillingPeriod.MONTHLY,
        minQty: 2,
        availableFrom: yesterday,
        availableTo: nextMonth,
        autoClose: true,
        closable: true,
        pausable: true,
        renewable: true,
      });

      expect(plan.autoClose).toBe(true);
      expect(plan.closable).toBe(true);
      expect(plan.pausable).toBe(true);
      expect(plan.renewable).toBe(true);
      expect(plan.minQty).toBe(2);

      // Check isPlanSelectable today: within window and active -> true
      expect(planService.isPlanSelectable(plan, now)).toBe(true);

      // Check isPlanSelectable in the past before availableFrom -> false
      const wayPast = new Date(now.getTime() - 100 * 24 * 60 * 60 * 1000);
      expect(planService.isPlanSelectable(plan, wayPast)).toBe(false);

      // Check isPlanSelectable after availableTo -> false
      expect(planService.isPlanSelectable(plan, nextYear)).toBe(false);

      // Inactive plan is never selectable
      const deactivated = await planService.deactivatePlan(adminSession, plan.id);
      expect(planService.isPlanSelectable(deactivated, now)).toBe(false);
    });

    it("rejects plan creation where availableTo is before availableFrom", async () => {
      const from = new Date("2026-10-31");
      const to = new Date("2026-10-15"); // before availableFrom

      await expect(
        planService.createPlan(adminSession, {
          name: "Invalid Dates Plan",
          price: 50000,
          billingPeriod: BillingPeriod.DAILY,
          minQty: 1,
          availableFrom: from,
          availableTo: to,
        })
      ).rejects.toThrow();
    });
  });
});

