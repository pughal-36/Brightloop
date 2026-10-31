import "dotenv/config";
import path from "node:path";
import { fileURLToPath } from "node:url";
import bcrypt from "bcryptjs";
import { fakerEN_IN as faker } from "@faker-js/faker";
import { PrismaPg } from "@prisma/adapter-pg";
import {
  PrismaClient,
  Role,
  ProductType,
  BillingPeriod,
  DiscountType,
  DiscountScope,
} from "../src/generated/prisma/client";
import { getToday, addDays, subDays } from "../src/lib/dates";

// Deterministic UUID constants
export const SEED_IDS = {
  users: {
    admin: "00000000-0000-4000-a000-000000000001",
    staff1: "00000000-0000-4000-a000-000000000002",
    staff2: "00000000-0000-4000-a000-000000000003",
    customer: "00000000-0000-4000-a000-000000000004",
  },
  taxes: {
    gst5: "00000000-0000-4000-c000-000000000001",
    gst12: "00000000-0000-4000-c000-000000000002",
    gst18: "00000000-0000-4000-c000-000000000003",
  },
  products: {
    software: "00000000-0000-4000-d000-000000000001",
    service: "00000000-0000-4000-d000-000000000002",
    addOn: "00000000-0000-4000-d000-000000000003",
    physical: "00000000-0000-4000-d000-000000000004",
    other: "00000000-0000-4000-d000-000000000005",
  },
  variants: {
    odoo: "00000000-0000-4000-e000-000000000001",
    sap: "00000000-0000-4000-e000-000000000002",
    custom: "00000000-0000-4000-e000-000000000003",
  },
  plans: {
    daily: "00000000-0000-4000-f000-000000000001",
    weekly: "00000000-0000-4000-f000-000000000002",
    monthly: "00000000-0000-4000-f000-000000000003",
    yearly: "00000000-0000-4000-f000-000000000004",
  },
  templates: {
    monthly: "00000000-0000-4000-1000-000000000001",
    yearly: "00000000-0000-4000-1000-000000000002",
  },
  templateLines: {
    t1_l1: "00000000-0000-4000-1100-000000000001",
    t1_l2: "00000000-0000-4000-1100-000000000002",
    t2_l1: "00000000-0000-4000-1100-000000000003",
    t2_l2: "00000000-0000-4000-1100-000000000004",
  },
  discounts: {
    percent: "00000000-0000-4000-2000-000000000001",
    fixed: "00000000-0000-4000-2000-000000000002",
    nearlyExhausted: "00000000-0000-4000-2000-000000000003",
    expired: "00000000-0000-4000-2000-000000000004",
  },
  customers: [
    "00000000-0000-4000-b000-000000000001",
    "00000000-0000-4000-b000-000000000002",
    "00000000-0000-4000-b000-000000000003",
    "00000000-0000-4000-b000-000000000004",
    "00000000-0000-4000-b000-000000000005",
    "00000000-0000-4000-b000-000000000006",
    "00000000-0000-4000-b000-000000000007",
    "00000000-0000-4000-b000-000000000008",
    "00000000-0000-4000-b000-000000000009",
    "00000000-0000-4000-b000-000000000010",
  ],
} as const;

/**
 * Validates password policy from docs/specs/01-auth.md:
 * Password length >= 9, with upper, lower, special char.
 */
export function validatePasswordPolicy(password: string, fieldName: string): void {
  if (password.length < 9) {
    throw new Error(`${fieldName} must be at least 9 characters long`);
  }
  if (!/[A-Z]/.test(password)) {
    throw new Error(`${fieldName} must contain at least one uppercase letter`);
  }
  if (!/[a-z]/.test(password)) {
    throw new Error(`${fieldName} must contain at least one lowercase letter`);
  }
  if (!/[^A-Za-z0-9]/.test(password)) {
    throw new Error(`${fieldName} must contain at least one special character`);
  }
}

/**
 * Validates and retrieves required seed environment variables.
 */
export function getSeedEnv() {
  const adminEmail = process.env.SEED_ADMIN_EMAIL;
  const adminPassword = process.env.SEED_ADMIN_PASSWORD;
  const staffPassword = process.env.SEED_STAFF_PASSWORD;
  const customerEmail = process.env.SEED_CUSTOMER_EMAIL;
  const customerPassword = process.env.SEED_CUSTOMER_PASSWORD;
  const databaseUrl = process.env.DATABASE_URL;

  const missing: string[] = [];
  if (!databaseUrl) missing.push("DATABASE_URL");
  if (!adminEmail) missing.push("SEED_ADMIN_EMAIL");
  if (!adminPassword) missing.push("SEED_ADMIN_PASSWORD");
  if (!staffPassword) missing.push("SEED_STAFF_PASSWORD");
  if (!customerEmail) missing.push("SEED_CUSTOMER_EMAIL");
  if (!customerPassword) missing.push("SEED_CUSTOMER_PASSWORD");

  if (missing.length > 0) {
    throw new Error(
      `Seed aborted: Missing required environment variables: ${missing.join(", ")}. Please configure them in .env`
    );
  }

  validatePasswordPolicy(adminPassword!, "SEED_ADMIN_PASSWORD");
  validatePasswordPolicy(staffPassword!, "SEED_STAFF_PASSWORD");
  validatePasswordPolicy(customerPassword!, "SEED_CUSTOMER_PASSWORD");

  return {
    databaseUrl: databaseUrl!,
    adminEmail: adminEmail!.trim().toLowerCase(),
    adminPassword: adminPassword!,
    staffPassword: staffPassword!,
    customerEmail: customerEmail!.trim().toLowerCase(),
    customerPassword: customerPassword!,
  };
}

export function createSeedPrismaClient(databaseUrl: string): PrismaClient {
  const adapter = new PrismaPg({
    connectionString: databaseUrl,
  });
  return new PrismaClient({ adapter });
}

export interface SeedSummary {
  usersCount: number;
  customersCount: number;
  taxesCount: number;
  productsCount: number;
  variantsCount: number;
  plansCount: number;
  templatesCount: number;
  templateLinesCount: number;
  discountsCount: number;
  discountProductsCount: number;
}

export async function seed(client?: PrismaClient): Promise<SeedSummary> {
  const env = getSeedEnv();
  const prisma = client ?? createSeedPrismaClient(env.databaseUrl);

  try {
    const today = getToday();

    // 1. Users & Linked Customer
    const usersToSeed = [
      {
        id: SEED_IDS.users.admin,
        email: env.adminEmail,
        name: "Admin User",
        plainPassword: env.adminPassword,
        role: Role.ADMIN,
        isActive: true,
      },
      {
        id: SEED_IDS.users.staff1,
        email: "priya.sharma@brightloop.io",
        name: "Priya Sharma",
        plainPassword: env.staffPassword,
        role: Role.STAFF,
        isActive: true,
      },
      {
        id: SEED_IDS.users.staff2,
        email: "rahul.verma@brightloop.io",
        name: "Rahul Verma",
        plainPassword: env.staffPassword,
        role: Role.STAFF,
        isActive: true,
      },
      {
        id: SEED_IDS.users.customer,
        email: env.customerEmail,
        name: "Aarav Patel",
        plainPassword: env.customerPassword,
        role: Role.CUSTOMER,
        isActive: true,
      },
    ];

    for (const u of usersToSeed) {
      const existing = await prisma.user.findUnique({ where: { id: u.id } });
      const passwordHash =
        existing && bcrypt.compareSync(u.plainPassword, existing.passwordHash)
          ? existing.passwordHash
          : bcrypt.hashSync(u.plainPassword, 12);

      await prisma.user.upsert({
        where: { id: u.id },
        update: {
          email: u.email,
          name: u.name,
          passwordHash,
          role: u.role,
          isActive: u.isActive,
        },
        create: {
          id: u.id,
          email: u.email,
          name: u.name,
          passwordHash,
          role: u.role,
          isActive: u.isActive,
        },
      });
    }

    // 2. Taxes: GST 5%, 12%, 18% as rateBps (500, 1200, 1800)
    const taxesToSeed = [
      {
        id: SEED_IDS.taxes.gst5,
        name: "GST 5%",
        rateBps: 500,
        isActive: true,
      },
      {
        id: SEED_IDS.taxes.gst12,
        name: "GST 12%",
        rateBps: 1200,
        isActive: true,
      },
      {
        id: SEED_IDS.taxes.gst18,
        name: "GST 18%",
        rateBps: 1800,
        isActive: true,
      },
    ];

    for (const t of taxesToSeed) {
      await prisma.tax.upsert({
        where: { id: t.id },
        update: {
          name: t.name,
          rateBps: t.rateBps,
          isActive: t.isActive,
        },
        create: t,
      });
    }

    // 3. Products: at least one per ProductType, costPrice < salesPrice, linked to a tax
    const productsToSeed = [
      {
        id: SEED_IDS.products.software,
        name: "Enterprise ERP Cloud",
        type: ProductType.SOFTWARE,
        salesPrice: 2500000, // ₹25,000.00
        costPrice: 1500000,  // ₹15,000.00
        notes: "Core enterprise ERP platform with multi-tenant hosting.",
        taxId: SEED_IDS.taxes.gst18,
        isActive: true,
      },
      {
        id: SEED_IDS.products.service,
        name: "Dedicated Technical Support",
        type: ProductType.SERVICE,
        salesPrice: 1000000, // ₹10,000.00
        costPrice: 600000,   // ₹6,000.00
        notes: "24/7 dedicated support engineering retainer.",
        taxId: SEED_IDS.taxes.gst18,
        isActive: true,
      },
      {
        id: SEED_IDS.products.addOn,
        name: "Additional 100GB Cloud Storage",
        type: ProductType.ADD_ON,
        salesPrice: 150000, // ₹1,500.00
        costPrice: 80000,   // ₹800.00
        notes: "High-speed NVMe block storage add-on.",
        taxId: SEED_IDS.taxes.gst18,
        isActive: true,
      },
      {
        id: SEED_IDS.products.physical,
        name: "Biometric POS Smart Terminal",
        type: ProductType.PHYSICAL,
        salesPrice: 1800000, // ₹18,000.00
        costPrice: 1200000,  // ₹12,000.00
        notes: "Hardware Android POS device with thermal printer and scanner.",
        taxId: SEED_IDS.taxes.gst12,
        isActive: true,
      },
      {
        id: SEED_IDS.products.other,
        name: "Custom Data Migration Pack",
        type: ProductType.OTHER,
        salesPrice: 500000, // ₹5,000.00
        costPrice: 300000,  // ₹3,000.00
        notes: "Legacy database import and schema mapping assistance.",
        taxId: SEED_IDS.taxes.gst5,
        isActive: true,
      },
    ];

    for (const p of productsToSeed) {
      await prisma.product.upsert({
        where: { id: p.id },
        update: {
          name: p.name,
          type: p.type,
          salesPrice: p.salesPrice,
          costPrice: p.costPrice,
          notes: p.notes,
          taxId: p.taxId,
          isActive: p.isActive,
        },
        create: p,
      });
    }

    // Variants for SOFTWARE product: Brand with "Odoo" (extraPrice 56000) and at least one other brand
    const variantsToSeed = [
      {
        id: SEED_IDS.variants.odoo,
        productId: SEED_IDS.products.software,
        attribute: "Brand",
        value: "Odoo",
        extraPrice: 56000, // 560 INR in paise
      },
      {
        id: SEED_IDS.variants.sap,
        productId: SEED_IDS.products.software,
        attribute: "Brand",
        value: "SAP",
        extraPrice: 120000, // 1,200 INR in paise
      },
      {
        id: SEED_IDS.variants.custom,
        productId: SEED_IDS.products.software,
        attribute: "Brand",
        value: "Custom",
        extraPrice: 0,
      },
    ];

    for (const v of variantsToSeed) {
      await prisma.productVariant.upsert({
        where: { id: v.id },
        update: {
          productId: v.productId,
          attribute: v.attribute,
          value: v.value,
          extraPrice: v.extraPrice,
        },
        create: v,
      });
    }

    // 4. Plans (flat fee in paise, availableFrom = today, availableTo null on most, one with a real end date)
    // - DAILY: autoClose true, closable false, pausable false, renewable false, untaxed, minQty 1
    // - WEEKLY: autoClose false, closable true, pausable true, renewable false, untaxed, minQty 1
    // - MONTHLY: closable, pausable and renewable all true, taxId = GST 18%, minQty 5
    // - YEARLY: renewable true, others false, untaxed, minQty 1, real end date
    const plansToSeed = [
      {
        id: SEED_IDS.plans.daily,
        name: "Daily Starter Pass",
        price: 10000, // ₹100.00
        billingPeriod: BillingPeriod.DAILY,
        minQty: 1,
        availableFrom: today,
        availableTo: null,
        autoClose: true,
        closable: false,
        pausable: false,
        renewable: false,
        taxId: null,
        isActive: true,
      },
      {
        id: SEED_IDS.plans.weekly,
        name: "Weekly Growth Plan",
        price: 50000, // ₹500.00
        billingPeriod: BillingPeriod.WEEKLY,
        minQty: 1,
        availableFrom: today,
        availableTo: null,
        autoClose: false,
        closable: true,
        pausable: true,
        renewable: false,
        taxId: null,
        isActive: true,
      },
      {
        id: SEED_IDS.plans.monthly,
        name: "Monthly Professional Suite",
        price: 200000, // ₹2,000.00
        billingPeriod: BillingPeriod.MONTHLY,
        minQty: 5,
        availableFrom: today,
        availableTo: null,
        autoClose: false,
        closable: true,
        pausable: true,
        renewable: true,
        taxId: SEED_IDS.taxes.gst18, // taxId on MONTHLY plan only
        isActive: true,
      },
      {
        id: SEED_IDS.plans.yearly,
        name: "Annual Enterprise License",
        price: 2000000, // ₹20,000.00
        billingPeriod: BillingPeriod.YEARLY,
        minQty: 1,
        availableFrom: today,
        availableTo: addDays(today, 365), // real end date
        autoClose: false,
        closable: false,
        pausable: false,
        renewable: true,
        taxId: null,
        isActive: true,
      },
    ];

    for (const plan of plansToSeed) {
      await prisma.plan.upsert({
        where: { id: plan.id },
        update: {
          name: plan.name,
          price: plan.price,
          billingPeriod: plan.billingPeriod,
          minQty: plan.minQty,
          availableFrom: plan.availableFrom,
          availableTo: plan.availableTo,
          autoClose: plan.autoClose,
          closable: plan.closable,
          pausable: plan.pausable,
          renewable: plan.renewable,
          taxId: plan.taxId,
          isActive: plan.isActive,
        },
        create: plan,
      });
    }

    // 5. Two quotation templates with lines (validityDays 15 and 30), each tied to a plan
    const templatesToSeed = [
      {
        id: SEED_IDS.templates.monthly,
        name: "Monthly Business Starter Quote",
        planId: SEED_IDS.plans.monthly,
        validityDays: 15,
        isActive: true,
      },
      {
        id: SEED_IDS.templates.yearly,
        name: "Annual Complete Turnkey Pack",
        planId: SEED_IDS.plans.yearly,
        validityDays: 30,
        isActive: true,
      },
    ];

    for (const tmpl of templatesToSeed) {
      await prisma.quotationTemplate.upsert({
        where: { id: tmpl.id },
        update: {
          name: tmpl.name,
          planId: tmpl.planId,
          validityDays: tmpl.validityDays,
          isActive: tmpl.isActive,
        },
        create: tmpl,
      });
    }

    const templateLinesToSeed = [
      {
        id: SEED_IDS.templateLines.t1_l1,
        templateId: SEED_IDS.templates.monthly,
        productId: SEED_IDS.products.software,
        variantId: SEED_IDS.variants.odoo,
        qty: 5, // satisfies plan minQty 5
      },
      {
        id: SEED_IDS.templateLines.t1_l2,
        templateId: SEED_IDS.templates.monthly,
        productId: SEED_IDS.products.service,
        variantId: null,
        qty: 5,
      },
      {
        id: SEED_IDS.templateLines.t2_l1,
        templateId: SEED_IDS.templates.yearly,
        productId: SEED_IDS.products.software,
        variantId: SEED_IDS.variants.sap,
        qty: 2,
      },
      {
        id: SEED_IDS.templateLines.t2_l2,
        templateId: SEED_IDS.templates.yearly,
        productId: SEED_IDS.products.physical,
        variantId: null,
        qty: 2,
      },
    ];

    for (const line of templateLinesToSeed) {
      await prisma.templateLine.upsert({
        where: { id: line.id },
        update: {
          templateId: line.templateId,
          productId: line.productId,
          variantId: line.variantId,
          qty: line.qty,
        },
        create: line,
      });
    }

    // 6. Discounts:
    // - PERCENT (1000 bps = 10%, minQty 5, scope SUBSCRIPTION)
    // - FIXED (50000 paise = ₹500, minPurchase set, scope PRODUCTS linked to two products)
    // - Nearly exhausted (usageLimit 5, usedCount 4)
    // - Expired (endDate in the past)
    const discountsToSeed = [
      {
        id: SEED_IDS.discounts.percent,
        name: "Volume Subscription 10% Off",
        type: DiscountType.PERCENT,
        value: 1000, // 1000 bps
        minPurchase: null,
        minQty: 5,
        startDate: subDays(today, 30),
        endDate: addDays(today, 365),
        usageLimit: 100,
        usedCount: 0,
        scope: DiscountScope.SUBSCRIPTION,
        isActive: true,
      },
      {
        id: SEED_IDS.discounts.fixed,
        name: "Product Bundle ₹500 Off",
        type: DiscountType.FIXED,
        value: 50000, // 50000 paise
        minPurchase: 100000, // 100000 paise pre-tax threshold
        minQty: null,
        startDate: subDays(today, 30),
        endDate: addDays(today, 365),
        usageLimit: 50,
        usedCount: 1,
        scope: DiscountScope.PRODUCTS,
        isActive: true,
      },
      {
        id: SEED_IDS.discounts.nearlyExhausted,
        name: "Early Bird Reward (Nearly Exhausted)",
        type: DiscountType.FIXED,
        value: 25000,
        minPurchase: 50000,
        minQty: 1,
        startDate: subDays(today, 10),
        endDate: addDays(today, 60),
        usageLimit: 5,
        usedCount: 4,
        scope: DiscountScope.SUBSCRIPTION,
        isActive: true,
      },
      {
        id: SEED_IDS.discounts.expired,
        name: "Launch Special 2025 (Expired)",
        type: DiscountType.PERCENT,
        value: 1500,
        minPurchase: null,
        minQty: 1,
        startDate: subDays(today, 90),
        endDate: subDays(today, 10), // in the past
        usageLimit: 20,
        usedCount: 12,
        scope: DiscountScope.SUBSCRIPTION,
        isActive: true,
      },
    ];

    for (const disc of discountsToSeed) {
      await prisma.discount.upsert({
        where: { id: disc.id },
        update: {
          name: disc.name,
          type: disc.type,
          value: disc.value,
          minPurchase: disc.minPurchase,
          minQty: disc.minQty,
          startDate: disc.startDate,
          endDate: disc.endDate,
          usageLimit: disc.usageLimit,
          usedCount: disc.usedCount,
          scope: disc.scope,
          isActive: disc.isActive,
        },
        create: disc,
      });
    }

    // Link the FIXED discount to two products via DiscountProduct
    const discountProductsToSeed = [
      {
        discountId: SEED_IDS.discounts.fixed,
        productId: SEED_IDS.products.software,
      },
      {
        discountId: SEED_IDS.discounts.fixed,
        productId: SEED_IDS.products.addOn,
      },
    ];

    for (const dp of discountProductsToSeed) {
      await prisma.discountProduct.upsert({
        where: {
          discountId_productId: {
            discountId: dp.discountId,
            productId: dp.productId,
          },
        },
        update: {},
        create: dp,
      });
    }

    // 7. Customers: 10 total (including the portal customer), realistic names, emails, phones, addresses
    // Reset faker to seed 42 so generated customers repeat identically
    faker.seed(42);

    interface CustomerSeedItem {
      id: string;
      name: string;
      email: string;
      phone: string;
      billingAddress: string;
      isActive: boolean;
      userId: string | null;
    }

    const customersToSeed: CustomerSeedItem[] = [
      {
        id: SEED_IDS.customers[0],
        name: "Aarav Patel",
        email: env.customerEmail,
        phone: "+91-98765-43210",
        billingAddress: "42, MG Road, Bengaluru, Karnataka 560001",
        isActive: true,
        userId: SEED_IDS.users.customer,
      },
    ];

    for (let i = 1; i < 10; i++) {
      const name = faker.person.fullName();
      const email = faker.internet.email().toLowerCase();
      const phone = faker.phone.number();
      const billingAddress = `${faker.location.streetAddress()}, ${faker.location.city()}, ${faker.location.state()} ${faker.location.zipCode()}`;

      customersToSeed.push({
        id: SEED_IDS.customers[i],
        name,
        email,
        phone,
        billingAddress,
        isActive: true,
        userId: null,
      });
    }

    for (const c of customersToSeed) {
      await prisma.customer.upsert({
        where: { id: c.id },
        update: {
          name: c.name,
          email: c.email,
          phone: c.phone,
          billingAddress: c.billingAddress,
          isActive: c.isActive,
          userId: c.userId,
        },
        create: c,
      });
    }

    const summary: SeedSummary = {
      usersCount: await prisma.user.count(),
      customersCount: await prisma.customer.count(),
      taxesCount: await prisma.tax.count(),
      productsCount: await prisma.product.count(),
      variantsCount: await prisma.productVariant.count(),
      plansCount: await prisma.plan.count(),
      templatesCount: await prisma.quotationTemplate.count(),
      templateLinesCount: await prisma.templateLine.count(),
      discountsCount: await prisma.discount.count(),
      discountProductsCount: await prisma.discountProduct.count(),
    };

    return summary;
  } finally {
    if (!client) {
      await prisma.$disconnect();
    }
  }
}

// Self-invoking execution when called via CLI
const isDirectRun =
  Boolean(process.argv[1]) &&
  (path.resolve(process.argv[1]).endsWith("seed.ts") ||
    path.resolve(process.argv[1]).endsWith("seed.js") ||
    (typeof import.meta.url === "string" &&
      fileURLToPath(import.meta.url) === path.resolve(process.argv[1])));

if (isDirectRun) {
  seed()
    .then((summary) => {
      console.log("Seed completed successfully:");
      console.table(summary);
    })
    .catch((err) => {
      console.error("Seed failed:", err);
      process.exit(1);
    });
}
