import { describe, it, expect } from "vitest";
import bcrypt from "bcryptjs";
import { vi } from "vitest";

// Mock server-only to allow importing db in Vitest
vi.mock("server-only", () => ({}));

import { db } from "@/server/db";
import { seed, SEED_IDS, validatePasswordPolicy } from "../../prisma/seed";
import { Role } from "@/generated/prisma/enums";

describe("Base seed data integration tests", { timeout: 30000 }, () => {
  it("validates the password policy helper", () => {
    // Valid password
    expect(() => validatePasswordPolicy("ValidPassword123!", "test")).not.toThrow();

    // Less than 9 characters
    expect(() => validatePasswordPolicy("Short1!", "test")).toThrow(/at least 9 characters/);

    // Missing uppercase
    expect(() => validatePasswordPolicy("lowercase123!", "test")).toThrow(/uppercase/);

    // Missing lowercase
    expect(() => validatePasswordPolicy("UPPERCASE123!", "test")).toThrow(/lowercase/);

    // Missing special character
    expect(() => validatePasswordPolicy("NoSpecialChar123", "test")).toThrow(/special character/);
  });

  it("running the seed twice gives identical row counts for every table it touches", async () => {
    // Run 1
    const run1 = await seed(db);

    const counts1 = {
      users: await db.user.count(),
      customers: await db.customer.count(),
      taxes: await db.tax.count(),
      products: await db.product.count(),
      variants: await db.productVariant.count(),
      plans: await db.plan.count(),
      templates: await db.quotationTemplate.count(),
      templateLines: await db.templateLine.count(),
      discounts: await db.discount.count(),
      discountProducts: await db.discountProduct.count(),
    };

    expect(run1.usersCount).toBe(counts1.users);
    expect(run1.customersCount).toBe(counts1.customers);
    expect(run1.taxesCount).toBe(counts1.taxes);
    expect(run1.productsCount).toBe(counts1.products);
    expect(run1.variantsCount).toBe(counts1.variants);
    expect(run1.plansCount).toBe(counts1.plans);
    expect(run1.templatesCount).toBe(counts1.templates);
    expect(run1.templateLinesCount).toBe(counts1.templateLines);
    expect(run1.discountsCount).toBe(counts1.discounts);
    expect(run1.discountProductsCount).toBe(counts1.discountProducts);

    // Run 2
    const run2 = await seed(db);

    const counts2 = {
      users: await db.user.count(),
      customers: await db.customer.count(),
      taxes: await db.tax.count(),
      products: await db.product.count(),
      variants: await db.productVariant.count(),
      plans: await db.plan.count(),
      templates: await db.quotationTemplate.count(),
      templateLines: await db.templateLine.count(),
      discounts: await db.discount.count(),
      discountProducts: await db.discountProduct.count(),
    };

    expect(counts2).toEqual(counts1);
    expect(run2).toEqual(run1);
  });

  it("the Odoo variant's extraPrice is 56000", async () => {
    const odooVariant = await db.productVariant.findUnique({
      where: { id: SEED_IDS.variants.odoo },
    });

    expect(odooVariant).not.toBeNull();
    expect(odooVariant?.attribute).toBe("Brand");
    expect(odooVariant?.value).toBe("Odoo");
    expect(odooVariant?.extraPrice).toBe(56000);
  });

  it("no ADMIN exists other than the one from env", async () => {
    const admins = await db.user.findMany({
      where: { role: Role.ADMIN },
    });

    const expectedAdminEmail = process.env.SEED_ADMIN_EMAIL?.trim().toLowerCase();
    expect(expectedAdminEmail).toBeDefined();

    expect(admins).toHaveLength(1);
    expect(admins[0].email).toBe(expectedAdminEmail);
    expect(admins[0].id).toBe(SEED_IDS.users.admin);
  });

  it("seeded passwords are not stored in plain text", async () => {
    const admin = await db.user.findUniqueOrThrow({
      where: { id: SEED_IDS.users.admin },
    });
    const staff1 = await db.user.findUniqueOrThrow({
      where: { id: SEED_IDS.users.staff1 },
    });
    const staff2 = await db.user.findUniqueOrThrow({
      where: { id: SEED_IDS.users.staff2 },
    });
    const customerUser = await db.user.findUniqueOrThrow({
      where: { id: SEED_IDS.users.customer },
    });

    const adminPassword = process.env.SEED_ADMIN_PASSWORD!;
    const staffPassword = process.env.SEED_STAFF_PASSWORD!;
    const customerPassword = process.env.SEED_CUSTOMER_PASSWORD!;

    // Must not be plain text
    expect(admin.passwordHash).not.toBe(adminPassword);
    expect(staff1.passwordHash).not.toBe(staffPassword);
    expect(staff2.passwordHash).not.toBe(staffPassword);
    expect(customerUser.passwordHash).not.toBe(customerPassword);

    // Must be bcrypt hash with cost 12
    expect(admin.passwordHash).toMatch(/^\$2[ab]\$12\$/);
    expect(staff1.passwordHash).toMatch(/^\$2[ab]\$12\$/);
    expect(staff2.passwordHash).toMatch(/^\$2[ab]\$12\$/);
    expect(customerUser.passwordHash).toMatch(/^\$2[ab]\$12\$/);

    // Must verify against plain text passwords
    expect(bcrypt.compareSync(adminPassword, admin.passwordHash)).toBe(true);
    expect(bcrypt.compareSync(staffPassword, staff1.passwordHash)).toBe(true);
    expect(bcrypt.compareSync(staffPassword, staff2.passwordHash)).toBe(true);
    expect(bcrypt.compareSync(customerPassword, customerUser.passwordHash)).toBe(true);
  });

  it("links customer portal user to customer record", async () => {
    const portalCustomer = await db.customer.findUniqueOrThrow({
      where: { id: SEED_IDS.customers[0] },
      include: { user: true },
    });

    expect(portalCustomer.userId).toBe(SEED_IDS.users.customer);
    expect(portalCustomer.user?.email).toBe(process.env.SEED_CUSTOMER_EMAIL?.trim().toLowerCase());
    expect(portalCustomer.user?.role).toBe(Role.CUSTOMER);
  });

  it("seeds plans and quotation templates with required flag combinations and line items", async () => {
    const daily = await db.plan.findUniqueOrThrow({ where: { id: SEED_IDS.plans.daily } });
    expect(daily.autoClose).toBe(true);
    expect(daily.closable).toBe(false);
    expect(daily.pausable).toBe(false);
    expect(daily.renewable).toBe(false);
    expect(daily.taxId).toBeNull();

    const weekly = await db.plan.findUniqueOrThrow({ where: { id: SEED_IDS.plans.weekly } });
    expect(weekly.autoClose).toBe(false);
    expect(weekly.closable).toBe(true);
    expect(weekly.pausable).toBe(true);
    expect(weekly.renewable).toBe(false);
    expect(weekly.taxId).toBeNull();

    const monthly = await db.plan.findUniqueOrThrow({ where: { id: SEED_IDS.plans.monthly } });
    expect(monthly.autoClose).toBe(false);
    expect(monthly.closable).toBe(true);
    expect(monthly.pausable).toBe(true);
    expect(monthly.renewable).toBe(true);
    expect(monthly.taxId).toBe(SEED_IDS.taxes.gst18);
    expect(monthly.minQty).toBe(5);

    const yearly = await db.plan.findUniqueOrThrow({ where: { id: SEED_IDS.plans.yearly } });
    expect(yearly.autoClose).toBe(false);
    expect(yearly.closable).toBe(false);
    expect(yearly.pausable).toBe(false);
    expect(yearly.renewable).toBe(true);
    expect(yearly.availableTo).not.toBeNull();

    const templates = await db.quotationTemplate.findMany({
      include: { lines: true },
    });
    expect(templates).toHaveLength(2);
    for (const t of templates) {
      expect(t.lines.length).toBeGreaterThanOrEqual(1);
    }
  });

  it("seeds discounts covering percent, fixed, nearly exhausted, and expired cases", async () => {
    const percent = await db.discount.findUniqueOrThrow({ where: { id: SEED_IDS.discounts.percent } });
    expect(percent.value).toBe(1000);
    expect(percent.minQty).toBe(5);
    expect(percent.scope).toBe("SUBSCRIPTION");

    const fixed = await db.discount.findUniqueOrThrow({
      where: { id: SEED_IDS.discounts.fixed },
      include: { products: true },
    });
    expect(fixed.value).toBe(50000);
    expect(fixed.minPurchase).toBe(100000);
    expect(fixed.scope).toBe("PRODUCTS");
    expect(fixed.products).toHaveLength(2);

    const nearlyExhausted = await db.discount.findUniqueOrThrow({
      where: { id: SEED_IDS.discounts.nearlyExhausted },
    });
    expect(nearlyExhausted.usageLimit).toBe(5);
    expect(nearlyExhausted.usedCount).toBe(4);

    const expired = await db.discount.findUniqueOrThrow({ where: { id: SEED_IDS.discounts.expired } });
    expect(new Date(expired.endDate).getTime()).toBeLessThan(Date.now());
  });
});
