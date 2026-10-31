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
  SubscriptionStatus,
  InvoiceStatus,
  InvoiceLineKind,
  PaymentTerms,
  PaymentMethod,
  PaymentProvider,
  StatusEntity,
} from "../src/generated/prisma/client";
import { getToday, addDays, subDays } from "../src/lib/dates";

// ────────── Deterministic UUID Constants ──────────
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
    expiring: "00000000-0000-4000-2000-000000000005",
    exhausted: "00000000-0000-4000-2000-000000000006",
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

// ────────── Named demo edge case IDs ──────────
const DEMO_IDS = {
  pausedSub: "00000000-0000-4000-5000-000000000001",
  partiallyPaidInv: "00000000-0000-4000-5000-000000000002",
  overdueInv: "00000000-0000-4000-5000-000000000003",
};

// ────────── Helpers ──────────

export function validatePasswordPolicy(password: string, fieldName: string): void {
  if (password.length < 9) throw new Error(`${fieldName} must be at least 9 characters long`);
  if (!/[A-Z]/.test(password)) throw new Error(`${fieldName} must contain at least one uppercase letter`);
  if (!/[a-z]/.test(password)) throw new Error(`${fieldName} must contain at least one lowercase letter`);
  if (!/[^A-Za-z0-9]/.test(password)) throw new Error(`${fieldName} must contain at least one special character`);
}

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
    throw new Error(`Seed aborted: Missing required environment variables: ${missing.join(", ")}`);
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
  const adapter = new PrismaPg({ connectionString: databaseUrl });
  return new PrismaClient({ adapter });
}

/** Generate a deterministic UUID from a namespace prefix and numeric index. */
function deterministicId(prefix: string, index: number): string {
  const hex = index.toString(16).padStart(12, "0");
  return `${prefix}-${hex.slice(0, 4)}-4000-8000-${hex.slice(4)}`;
}

/** Compute period start date n periods from a start date. */
function periodStartDate(startDate: Date, period: BillingPeriod, n: number): Date {
  const d = new Date(startDate);
  switch (period) {
    case "DAILY":
      d.setUTCDate(d.getUTCDate() + n);
      break;
    case "WEEKLY":
      d.setUTCDate(d.getUTCDate() + n * 7);
      break;
    case "MONTHLY": {
      const origDay = d.getUTCDate();
      d.setUTCDate(1);
      d.setUTCMonth(d.getUTCMonth() + n);
      const maxDay = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
      d.setUTCDate(Math.min(origDay, maxDay));
      break;
    }
    case "YEARLY": {
      const origDay = d.getUTCDate();
      const origMonth = d.getUTCMonth();
      d.setUTCDate(1);
      d.setUTCFullYear(d.getUTCFullYear() + n);
      d.setUTCMonth(origMonth);
      const maxDay = new Date(Date.UTC(d.getUTCFullYear(), origMonth + 1, 0)).getUTCDate();
      d.setUTCDate(Math.min(origDay, maxDay));
      break;
    }
  }
  return d;
}

/** Tax-exclusive half-up per line. */
function percentOf(paise: number, rateBps: number): number {
  return Math.round((paise * rateBps) / 10000);
}

// ────────── Core Seed (Small) ──────────

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
  subscriptionsCount?: number;
  invoicesCount?: number;
  paymentsCount?: number;
}

export async function seed(client?: PrismaClient): Promise<SeedSummary> {
  const env = getSeedEnv();
  const prisma = client ?? createSeedPrismaClient(env.databaseUrl);

  try {
    const today = getToday();

    // 1. Users & Linked Customer
    const usersToSeed = [
      { id: SEED_IDS.users.admin, email: env.adminEmail, name: "Admin User", plainPassword: env.adminPassword, role: Role.ADMIN, isActive: true },
      { id: SEED_IDS.users.staff1, email: "priya.sharma@brightloop.io", name: "Priya Sharma", plainPassword: env.staffPassword, role: Role.STAFF, isActive: true },
      { id: SEED_IDS.users.staff2, email: "rahul.verma@brightloop.io", name: "Rahul Verma", plainPassword: env.staffPassword, role: Role.STAFF, isActive: true },
      { id: SEED_IDS.users.customer, email: env.customerEmail, name: "Aarav Patel", plainPassword: env.customerPassword, role: Role.CUSTOMER, isActive: true },
    ];

    for (const u of usersToSeed) {
      const existing = await prisma.user.findUnique({ where: { id: u.id } });
      const passwordHash =
        existing && bcrypt.compareSync(u.plainPassword, existing.passwordHash)
          ? existing.passwordHash
          : bcrypt.hashSync(u.plainPassword, 12);

      await prisma.user.upsert({
        where: { id: u.id },
        update: { email: u.email, name: u.name, passwordHash, role: u.role, isActive: u.isActive },
        create: { id: u.id, email: u.email, name: u.name, passwordHash, role: u.role, isActive: u.isActive },
      });
    }

    // 2. Taxes
    const taxesToSeed = [
      { id: SEED_IDS.taxes.gst5, name: "GST 5%", rateBps: 500, isActive: true },
      { id: SEED_IDS.taxes.gst12, name: "GST 12%", rateBps: 1200, isActive: true },
      { id: SEED_IDS.taxes.gst18, name: "GST 18%", rateBps: 1800, isActive: true },
    ];
    for (const t of taxesToSeed) {
      await prisma.tax.upsert({ where: { id: t.id }, update: { name: t.name, rateBps: t.rateBps, isActive: t.isActive }, create: t });
    }

    // 3. Products
    const productsToSeed = [
      { id: SEED_IDS.products.software, name: "Enterprise ERP Cloud", type: ProductType.SOFTWARE, salesPrice: 2500000, costPrice: 1500000, notes: "Core enterprise ERP platform with multi-tenant hosting.", taxId: SEED_IDS.taxes.gst18, isActive: true },
      { id: SEED_IDS.products.service, name: "Dedicated Technical Support", type: ProductType.SERVICE, salesPrice: 1000000, costPrice: 600000, notes: "24/7 dedicated support engineering retainer.", taxId: SEED_IDS.taxes.gst18, isActive: true },
      { id: SEED_IDS.products.addOn, name: "Additional 100GB Cloud Storage", type: ProductType.ADD_ON, salesPrice: 150000, costPrice: 80000, notes: "High-speed NVMe block storage add-on.", taxId: SEED_IDS.taxes.gst18, isActive: true },
      { id: SEED_IDS.products.physical, name: "Biometric POS Smart Terminal", type: ProductType.PHYSICAL, salesPrice: 1800000, costPrice: 1200000, notes: "Hardware Android POS device with thermal printer and scanner.", taxId: SEED_IDS.taxes.gst12, isActive: true },
      { id: SEED_IDS.products.other, name: "Custom Data Migration Pack", type: ProductType.OTHER, salesPrice: 500000, costPrice: 300000, notes: "Legacy database import and schema mapping assistance.", taxId: SEED_IDS.taxes.gst5, isActive: true },
    ];
    for (const p of productsToSeed) {
      await prisma.product.upsert({ where: { id: p.id }, update: { name: p.name, type: p.type, salesPrice: p.salesPrice, costPrice: p.costPrice, notes: p.notes, taxId: p.taxId, isActive: p.isActive }, create: p });
    }

    // Variants
    const variantsToSeed = [
      { id: SEED_IDS.variants.odoo, productId: SEED_IDS.products.software, attribute: "Brand", value: "Odoo", extraPrice: 56000 },
      { id: SEED_IDS.variants.sap, productId: SEED_IDS.products.software, attribute: "Brand", value: "SAP", extraPrice: 120000 },
      { id: SEED_IDS.variants.custom, productId: SEED_IDS.products.software, attribute: "Brand", value: "Custom", extraPrice: 0 },
    ];
    for (const v of variantsToSeed) {
      await prisma.productVariant.upsert({ where: { id: v.id }, update: { productId: v.productId, attribute: v.attribute, value: v.value, extraPrice: v.extraPrice }, create: v });
    }

    // 4. Plans
    const plansToSeed = [
      { id: SEED_IDS.plans.daily, name: "Daily Starter Pass", price: 10000, billingPeriod: BillingPeriod.DAILY, minQty: 1, availableFrom: today, availableTo: null, autoClose: true, closable: false, pausable: false, renewable: false, taxId: null, isActive: true },
      { id: SEED_IDS.plans.weekly, name: "Weekly Growth Plan", price: 50000, billingPeriod: BillingPeriod.WEEKLY, minQty: 1, availableFrom: today, availableTo: null, autoClose: false, closable: true, pausable: true, renewable: false, taxId: null, isActive: true },
      { id: SEED_IDS.plans.monthly, name: "Monthly Professional Suite", price: 200000, billingPeriod: BillingPeriod.MONTHLY, minQty: 5, availableFrom: today, availableTo: null, autoClose: false, closable: true, pausable: true, renewable: true, taxId: SEED_IDS.taxes.gst18, isActive: true },
      { id: SEED_IDS.plans.yearly, name: "Annual Enterprise License", price: 2000000, billingPeriod: BillingPeriod.YEARLY, minQty: 1, availableFrom: today, availableTo: addDays(today, 365), autoClose: false, closable: false, pausable: false, renewable: true, taxId: null, isActive: true },
    ];
    for (const plan of plansToSeed) {
      await prisma.plan.upsert({ where: { id: plan.id }, update: { name: plan.name, price: plan.price, billingPeriod: plan.billingPeriod, minQty: plan.minQty, availableFrom: plan.availableFrom, availableTo: plan.availableTo, autoClose: plan.autoClose, closable: plan.closable, pausable: plan.pausable, renewable: plan.renewable, taxId: plan.taxId, isActive: plan.isActive }, create: plan });
    }

    // 5. Templates
    const templatesToSeed = [
      { id: SEED_IDS.templates.monthly, name: "Monthly Business Starter Quote", planId: SEED_IDS.plans.monthly, validityDays: 15, isActive: true },
      { id: SEED_IDS.templates.yearly, name: "Annual Complete Turnkey Pack", planId: SEED_IDS.plans.yearly, validityDays: 30, isActive: true },
    ];
    for (const tmpl of templatesToSeed) {
      await prisma.quotationTemplate.upsert({ where: { id: tmpl.id }, update: { name: tmpl.name, planId: tmpl.planId, validityDays: tmpl.validityDays, isActive: tmpl.isActive }, create: tmpl });
    }

    const templateLinesToSeed = [
      { id: SEED_IDS.templateLines.t1_l1, templateId: SEED_IDS.templates.monthly, productId: SEED_IDS.products.software, variantId: SEED_IDS.variants.odoo, qty: 5 },
      { id: SEED_IDS.templateLines.t1_l2, templateId: SEED_IDS.templates.monthly, productId: SEED_IDS.products.service, variantId: null, qty: 5 },
      { id: SEED_IDS.templateLines.t2_l1, templateId: SEED_IDS.templates.yearly, productId: SEED_IDS.products.software, variantId: SEED_IDS.variants.sap, qty: 2 },
      { id: SEED_IDS.templateLines.t2_l2, templateId: SEED_IDS.templates.yearly, productId: SEED_IDS.products.physical, variantId: null, qty: 2 },
    ];
    for (const line of templateLinesToSeed) {
      await prisma.templateLine.upsert({ where: { id: line.id }, update: { templateId: line.templateId, productId: line.productId, variantId: line.variantId, qty: line.qty }, create: line });
    }

    // 6. Discounts (including edge cases)
    const discountsToSeed = [
      { id: SEED_IDS.discounts.percent, name: "Volume Subscription 10% Off", type: DiscountType.PERCENT, value: 1000, minPurchase: null, minQty: 5, startDate: subDays(today, 30), endDate: addDays(today, 365), usageLimit: 100, usedCount: 0, scope: DiscountScope.SUBSCRIPTION, isActive: true },
      { id: SEED_IDS.discounts.fixed, name: "Product Bundle ₹500 Off", type: DiscountType.FIXED, value: 50000, minPurchase: 100000, minQty: null, startDate: subDays(today, 30), endDate: addDays(today, 365), usageLimit: 50, usedCount: 1, scope: DiscountScope.PRODUCTS, isActive: true },
      { id: SEED_IDS.discounts.nearlyExhausted, name: "DEMO - Early Bird Reward (Nearly Exhausted)", type: DiscountType.FIXED, value: 25000, minPurchase: 50000, minQty: 1, startDate: subDays(today, 10), endDate: addDays(today, 60), usageLimit: 5, usedCount: 4, scope: DiscountScope.SUBSCRIPTION, isActive: true },
      { id: SEED_IDS.discounts.expired, name: "Launch Special 2025 (Expired)", type: DiscountType.PERCENT, value: 1500, minPurchase: null, minQty: 1, startDate: subDays(today, 90), endDate: subDays(today, 10), usageLimit: 20, usedCount: 12, scope: DiscountScope.SUBSCRIPTION, isActive: true },
      { id: SEED_IDS.discounts.expiring, name: "DEMO - Diwali Flash Sale (Expiring Soon)", type: DiscountType.PERCENT, value: 2000, minPurchase: null, minQty: 1, startDate: subDays(today, 5), endDate: addDays(today, 2), usageLimit: 100, usedCount: 3, scope: DiscountScope.SUBSCRIPTION, isActive: true },
      { id: SEED_IDS.discounts.exhausted, name: "DEMO - Exhausted VIP Discount", type: DiscountType.FIXED, value: 50000, minPurchase: 100000, minQty: 1, startDate: subDays(today, 60), endDate: addDays(today, 60), usageLimit: 10, usedCount: 10, scope: DiscountScope.SUBSCRIPTION, isActive: true },
    ];
    for (const disc of discountsToSeed) {
      await prisma.discount.upsert({ where: { id: disc.id }, update: { name: disc.name, type: disc.type, value: disc.value, minPurchase: disc.minPurchase, minQty: disc.minQty, startDate: disc.startDate, endDate: disc.endDate, usageLimit: disc.usageLimit, usedCount: disc.usedCount, scope: disc.scope, isActive: disc.isActive }, create: disc });
    }

    // Link FIXED discount to products
    const discountProductsToSeed = [
      { discountId: SEED_IDS.discounts.fixed, productId: SEED_IDS.products.software },
      { discountId: SEED_IDS.discounts.fixed, productId: SEED_IDS.products.addOn },
    ];
    for (const dp of discountProductsToSeed) {
      await prisma.discountProduct.upsert({ where: { discountId_productId: { discountId: dp.discountId, productId: dp.productId } }, update: {}, create: dp });
    }

    // 7. Customers
    faker.seed(42);
    interface CustomerSeedItem { id: string; name: string; email: string; phone: string; billingAddress: string; isActive: boolean; userId: string | null; }
    const customersToSeed: CustomerSeedItem[] = [
      { id: SEED_IDS.customers[0], name: "Aarav Patel", email: env.customerEmail, phone: "+91-98765-43210", billingAddress: "42, MG Road, Bengaluru, Karnataka 560001", isActive: true, userId: SEED_IDS.users.customer },
    ];
    for (let i = 1; i < 10; i++) {
      customersToSeed.push({
        id: SEED_IDS.customers[i],
        name: faker.person.fullName(),
        email: faker.internet.email().toLowerCase(),
        phone: faker.phone.number(),
        billingAddress: `${faker.location.streetAddress()}, ${faker.location.city()}, ${faker.location.state()} ${faker.location.zipCode()}`,
        isActive: true,
        userId: null,
      });
    }
    for (const c of customersToSeed) {
      await prisma.customer.upsert({ where: { id: c.id }, update: { name: c.name, email: c.email, phone: c.phone, billingAddress: c.billingAddress, isActive: c.isActive, userId: c.userId }, create: c });
    }

    // ────────── Named Demo Edge Cases ──────────

    // 8. DEMO - Paused Subscription
    const existingPausedSub = await prisma.subscription.findUnique({ where: { id: DEMO_IDS.pausedSub } });
    if (!existingPausedSub) {
      await prisma.subscription.create({
        data: {
          id: DEMO_IDS.pausedSub,
          customerId: SEED_IDS.customers[0],
          planId: SEED_IDS.plans.weekly,
          status: SubscriptionStatus.ACTIVE,
          startDate: subDays(today, 30),
          expiryDate: addDays(today, 335),
          paymentTerms: PaymentTerms.NET_15,
          planFee: 50000,
          planTaxRateBps: 0,
          pausedAt: subDays(today, 3),
          nextPeriodStart: addDays(today, 4),
          createdById: SEED_IDS.users.admin,
        },
      });
      await prisma.subscriptionLine.create({
        data: {
          subscriptionId: DEMO_IDS.pausedSub,
          productId: SEED_IDS.products.addOn,
          description: "DEMO - Additional 100GB Cloud Storage",
          qty: 2,
          unitPrice: 150000,
          taxRateBps: 1800,
          amount: 300000,
        },
      });
      await prisma.statusHistory.createMany({
        data: [
          { entity: StatusEntity.SUBSCRIPTION, entityId: DEMO_IDS.pausedSub, from: null, to: "DRAFT", byUserId: SEED_IDS.users.admin, note: "Created" },
          { entity: StatusEntity.SUBSCRIPTION, entityId: DEMO_IDS.pausedSub, from: "DRAFT", to: "QUOTATION", byUserId: SEED_IDS.users.admin, note: "Sent quotation" },
          { entity: StatusEntity.SUBSCRIPTION, entityId: DEMO_IDS.pausedSub, from: "QUOTATION", to: "CONFIRMED", byUserId: SEED_IDS.users.admin, note: "Confirmed" },
          { entity: StatusEntity.SUBSCRIPTION, entityId: DEMO_IDS.pausedSub, from: "CONFIRMED", to: "ACTIVE", byUserId: SEED_IDS.users.admin, note: "Activated" },
          { entity: StatusEntity.SUBSCRIPTION, entityId: DEMO_IDS.pausedSub, from: "ACTIVE", to: "ACTIVE", byUserId: SEED_IDS.users.admin, note: "Paused" },
        ],
      });
    }

    // 9. DEMO - Partially Paid Invoice
    const existingPartialInv = await prisma.invoice.findUnique({ where: { id: DEMO_IDS.partiallyPaidInv } });
    if (!existingPartialInv) {
      // Need a subscription to attach to - use paused sub
      const planFee = 50000;
      const lineAmount = 300000;
      const subtotal = planFee + lineAmount;
      const lineTax = percentOf(lineAmount, 1800);
      const taxTotal = lineTax; // plan untaxed
      const total = subtotal + taxTotal;
      const pStart = subDays(today, 14);
      const pEnd = subDays(today, 8);

      await prisma.invoice.create({
        data: {
          id: DEMO_IDS.partiallyPaidInv,
          subscriptionId: DEMO_IDS.pausedSub,
          customerId: SEED_IDS.customers[0],
          periodStart: pStart,
          periodEnd: pEnd,
          status: InvoiceStatus.CONFIRMED,
          issueDate: pStart,
          dueDate: addDays(pStart, 15),
          subtotal,
          discountTotal: 0,
          taxTotal,
          total,
          amountPaid: Math.round(total / 2),
          confirmedAt: pStart,
        },
      });
      await prisma.invoiceLine.createMany({
        data: [
          { invoiceId: DEMO_IDS.partiallyPaidInv, kind: InvoiceLineKind.PLAN_FEE, sortOrder: 0, description: "DEMO - Plan fee", qty: 1, unitPrice: planFee, taxRateBps: 0, amount: planFee, taxAmount: 0 },
          { invoiceId: DEMO_IDS.partiallyPaidInv, kind: InvoiceLineKind.PRODUCT, sortOrder: 1, description: "DEMO - Additional 100GB Cloud Storage x2", qty: 2, unitPrice: 150000, taxRateBps: 1800, amount: lineAmount, taxAmount: lineTax },
        ],
      });
      await prisma.payment.create({
        data: {
          invoiceId: DEMO_IDS.partiallyPaidInv,
          method: PaymentMethod.UPI,
          provider: PaymentProvider.MANUAL,
          amount: Math.round(total / 2),
          paidOn: subDays(today, 10),
          note: "DEMO - Partial payment",
          recordedById: SEED_IDS.users.staff1,
        },
      });
      await prisma.statusHistory.createMany({
        data: [
          { entity: StatusEntity.INVOICE, entityId: DEMO_IDS.partiallyPaidInv, from: "DRAFT", to: "CONFIRMED", byUserId: SEED_IDS.users.admin, note: "Confirmed" },
        ],
      });
    }

    // 10. DEMO - Overdue Invoice
    const existingOverdueInv = await prisma.invoice.findUnique({ where: { id: DEMO_IDS.overdueInv } });
    if (!existingOverdueInv) {
      const planFee = 50000;
      const lineAmount = 300000;
      const subtotal = planFee + lineAmount;
      const lineTax = percentOf(lineAmount, 1800);
      const taxTotal = lineTax;
      const total = subtotal + taxTotal;
      const pStart = subDays(today, 45);
      const pEnd = subDays(today, 38);

      await prisma.invoice.create({
        data: {
          id: DEMO_IDS.overdueInv,
          subscriptionId: DEMO_IDS.pausedSub,
          customerId: SEED_IDS.customers[0],
          periodStart: pStart,
          periodEnd: pEnd,
          status: InvoiceStatus.CONFIRMED,
          issueDate: pStart,
          dueDate: subDays(today, 20),
          subtotal,
          discountTotal: 0,
          taxTotal,
          total,
          amountPaid: 0,
          confirmedAt: pStart,
        },
      });
      await prisma.invoiceLine.createMany({
        data: [
          { invoiceId: DEMO_IDS.overdueInv, kind: InvoiceLineKind.PLAN_FEE, sortOrder: 0, description: "DEMO - Plan fee (overdue)", qty: 1, unitPrice: planFee, taxRateBps: 0, amount: planFee, taxAmount: 0 },
          { invoiceId: DEMO_IDS.overdueInv, kind: InvoiceLineKind.PRODUCT, sortOrder: 1, description: "DEMO - Additional 100GB Cloud Storage x2 (overdue)", qty: 2, unitPrice: 150000, taxRateBps: 1800, amount: lineAmount, taxAmount: lineTax },
        ],
      });
      await prisma.statusHistory.createMany({
        data: [
          { entity: StatusEntity.INVOICE, entityId: DEMO_IDS.overdueInv, from: "DRAFT", to: "CONFIRMED", byUserId: SEED_IDS.users.admin, note: "Confirmed" },
        ],
      });
    }

    // ────────── Full Scale Seed ──────────
    const scale = (process.env.SEED_SCALE || "small").trim().toLowerCase();

    if (scale === "full") {
      console.log("Starting full-scale seed (~5,000 subscriptions, ~30,000 invoices)...");
      await seedFullScale(prisma, today);
    }

    // ────────── Reset Sequences ──────────
    const maxSubNumber = await prisma.$queryRawUnsafe<{ max: string | null }[]>(
      `SELECT MAX(CAST(REPLACE("number", 'SUB-', '') AS INTEGER)) AS max FROM "Subscription"`
    );
    const maxInvNumber = await prisma.$queryRawUnsafe<{ max: string | null }[]>(
      `SELECT MAX(CAST(REPLACE("number", 'INV-', '') AS INTEGER)) AS max FROM "Invoice"`
    );
    const nextSubVal = Number(maxSubNumber[0]?.max ?? 0) + 1;
    const nextInvVal = Number(maxInvNumber[0]?.max ?? 0) + 1;
    await prisma.$executeRawUnsafe(`SELECT setval('subscription_number_seq', ${nextSubVal}, false)`);
    await prisma.$executeRawUnsafe(`SELECT setval('invoice_number_seq', ${nextInvVal}, false)`);
    console.log(`Sequences reset: subscription_number_seq → ${nextSubVal}, invoice_number_seq → ${nextInvVal}`);

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
      subscriptionsCount: await prisma.subscription.count(),
      invoicesCount: await prisma.invoice.count(),
      paymentsCount: await prisma.payment.count(),
    };

    return summary;
  } finally {
    if (!client) {
      await prisma.$disconnect();
    }
  }
}

// ────────── Full Scale Seed ──────────

async function seedFullScale(prisma: PrismaClient, today: Date) {
  faker.seed(12345); // Fixed Faker seed for determinism

  const TARGET_SUBS = 5000;
  const CHUNK_SIZE = 1000;

  // Check existing full-scale data
  const existingSubCount = await prisma.subscription.count();
  if (existingSubCount >= TARGET_SUBS) {
    console.log(`Already have ${existingSubCount} subscriptions, skipping full-scale seed.`);
    return;
  }

  // Generate 200 customers for the full-scale seed
  const fullCustomerIds: string[] = [...SEED_IDS.customers];
  const customerBatch: Array<{
    id: string; name: string; email: string; phone: string;
    billingAddress: string; isActive: boolean; userId: null;
  }> = [];

  for (let i = 0; i < 200; i++) {
    const id = deterministicId("10000000", i + 100);
    fullCustomerIds.push(id);
    customerBatch.push({
      id,
      name: faker.person.fullName(),
      email: faker.internet.email().toLowerCase(),
      phone: faker.phone.number(),
      billingAddress: `${faker.location.streetAddress()}, ${faker.location.city()}, ${faker.location.state()} ${faker.location.zipCode()}`,
      isActive: true,
      userId: null,
    });
  }

  // Batch insert customers
  for (let i = 0; i < customerBatch.length; i += CHUNK_SIZE) {
    const chunk = customerBatch.slice(i, i + CHUNK_SIZE);
    await prisma.customer.createMany({ data: chunk, skipDuplicates: true });
  }
  console.log(`Created ${customerBatch.length} additional customers.`);

  // Plan configurations for full-scale subscriptions
  const planConfigs = [
    { id: SEED_IDS.plans.monthly, fee: 200000, taxBps: 1800, period: BillingPeriod.MONTHLY, minQty: 5, pausable: true, closable: true },
    { id: SEED_IDS.plans.weekly, fee: 50000, taxBps: 0, period: BillingPeriod.WEEKLY, minQty: 1, pausable: true, closable: true },
    { id: SEED_IDS.plans.yearly, fee: 2000000, taxBps: 0, period: BillingPeriod.YEARLY, minQty: 1, pausable: false, closable: false },
    { id: SEED_IDS.plans.daily, fee: 10000, taxBps: 0, period: BillingPeriod.DAILY, minQty: 1, pausable: false, closable: false },
  ];

  // Products for lines
  const lineProducts = [
    { id: SEED_IDS.products.software, variantId: SEED_IDS.variants.odoo, desc: "Enterprise ERP Cloud (Odoo)", unitPrice: 2500000 + 56000, taxBps: 1800 },
    { id: SEED_IDS.products.service, variantId: null, desc: "Dedicated Technical Support", unitPrice: 1000000, taxBps: 1800 },
    { id: SEED_IDS.products.addOn, variantId: null, desc: "Additional 100GB Cloud Storage", unitPrice: 150000, taxBps: 1800 },
    { id: SEED_IDS.products.physical, variantId: null, desc: "Biometric POS Smart Terminal", unitPrice: 1800000, taxBps: 1200 },
  ];

  // Status distribution: 70% ACTIVE, 10% PAUSED (ACTIVE with pausedAt), 10% CLOSED, 5% QUOTATION, 5% CONFIRMED
  // Invoices per sub: MONTHLY → 6, WEEKLY → 12, YEARLY → 1, DAILY → 30
  // Invoice status distribution: 60% PAID, 15% partially paid (CONFIRMED), 10% overdue (CONFIRMED, past due), 10% DRAFT, 5% CANCELLED

  const allSubData: Array<{
    id: string; number: string; customerId: string; planId: string; status: SubscriptionStatus;
    startDate: Date; expiryDate: Date; paymentTerms: PaymentTerms;
    planFee: number; planTaxRateBps: number; pausedAt: Date | null;
    nextPeriodStart: Date | null; createdById: string; closeReason: string | null; closedAt: Date | null;
  }> = [];

  const allSubLineData: Array<{
    id: string; subscriptionId: string; productId: string; variantId: string | null;
    description: string; qty: number; unitPrice: number; taxRateBps: number; amount: number;
  }> = [];

  const allInvoiceData: Array<{
    id: string; number: string; subscriptionId: string; customerId: string;
    periodStart: Date; periodEnd: Date; status: InvoiceStatus;
    issueDate: Date; dueDate: Date; subtotal: number; discountTotal: number;
    taxTotal: number; total: number; amountPaid: number;
    confirmedAt: Date | null; paidAt: Date | null; cancelledAt: Date | null;
  }> = [];

  const allInvoiceLineData: Array<{
    id: string; invoiceId: string; kind: InvoiceLineKind; sortOrder: number;
    description: string; qty: number; unitPrice: number; taxRateBps: number;
    amount: number; taxAmount: number; productId: string | null; variantId: string | null;
    discountId: string | null;
  }> = [];

  const allPaymentData: Array<{
    id: string; invoiceId: string; method: PaymentMethod; provider: PaymentProvider;
    amount: number; paidOn: Date; note: string | null; recordedById: string | null;
  }> = [];

  const allStatusHistoryData: Array<{
    entity: StatusEntity; entityId: string; from: string | null;
    to: string; byUserId: string | null; note: string | null;
  }> = [];

  // Track periodStart per subscription to avoid UNIQUE violation
  const usedPeriods = new Set<string>();

  const paymentTermsList = [PaymentTerms.IMMEDIATE, PaymentTerms.NET_15, PaymentTerms.NET_30];
  const paymentMethods = [PaymentMethod.BANK_TRANSFER, PaymentMethod.UPI, PaymentMethod.CARD, PaymentMethod.NETBANKING, PaymentMethod.CASH, PaymentMethod.CHEQUE];

  let invoiceCounter = 0;
  let paymentCounter = 0;
  let subLineCounter = 0;
  let invoiceLineCounter = 0;

  console.log(`Generating ${TARGET_SUBS} subscriptions...`);

  for (let s = 0; s < TARGET_SUBS; s++) {
    const subId = deterministicId("20000000", s);
    const customerId = fullCustomerIds[s % fullCustomerIds.length];
    const planConfig = planConfigs[s % planConfigs.length];
    const terms = paymentTermsList[s % paymentTermsList.length];

    // Deterministic start dates: spread over the last 12 months
    const monthsBack = (s % 12) + 1;
    const dayOffset = s % 28;
    const startDate = new Date(Date.UTC(
      today.getUTCFullYear(),
      today.getUTCMonth() - monthsBack,
      Math.min(dayOffset + 1, 28)
    ));
    const expiryDate = addDays(startDate, 365);

    // Status assignment
    let status: SubscriptionStatus;
    let pausedAt: Date | null = null;
    let closeReason: string | null = null;
    let closedAt: Date | null = null;
    const statusRoll = s % 20;

    if (statusRoll < 14) {
      status = SubscriptionStatus.ACTIVE; // 70%
    } else if (statusRoll < 16) {
      status = SubscriptionStatus.ACTIVE; // 10% paused
      pausedAt = subDays(today, (s % 10) + 1);
    } else if (statusRoll < 18) {
      status = SubscriptionStatus.CLOSED; // 10%
      closeReason = "Contract ended";
      closedAt = subDays(today, (s % 30) + 1);
    } else if (statusRoll === 18) {
      status = SubscriptionStatus.QUOTATION; // 5%
    } else {
      status = SubscriptionStatus.CONFIRMED; // 5%
    }

    // Number of invoices based on plan period
    let invoiceCount: number;
    switch (planConfig.period) {
      case BillingPeriod.MONTHLY: invoiceCount = 6; break;
      case BillingPeriod.WEEKLY: invoiceCount = 10; break;
      case BillingPeriod.YEARLY: invoiceCount = 1; break;
      case BillingPeriod.DAILY: invoiceCount = 10; break;
    }

    // Only ACTIVE or CLOSED subscriptions get invoices
    const hasInvoices = status === SubscriptionStatus.ACTIVE || status === SubscriptionStatus.CLOSED;

    // Determine nextPeriodStart
    // For ACTIVE subscriptions, nextPeriodStart is upcoming in the future (next billing cycle)
    let nextPeriodStart: Date | null = null;
    if (status === SubscriptionStatus.ACTIVE) {
      nextPeriodStart = addDays(today, (s % 28) + 1);
    } else if (status === SubscriptionStatus.CONFIRMED) {
      nextPeriodStart = startDate;
    }

    // Subscription lines: 1-3 products
    const lineCount = (s % 3) + 1;
    const subLines: typeof allSubLineData = [];
    for (let l = 0; l < lineCount; l++) {
      const prod = lineProducts[(s + l) % lineProducts.length];
      const qty = Math.max(planConfig.minQty, (s % 3) + 1);
      const amount = qty * prod.unitPrice;
      const lineId = deterministicId("30000000", subLineCounter++);
      subLines.push({
        id: lineId,
        subscriptionId: subId,
        productId: prod.id,
        variantId: prod.variantId,
        description: prod.desc,
        qty,
        unitPrice: prod.unitPrice,
        taxRateBps: prod.taxBps,
        amount,
      });
    }

    allSubData.push({
      id: subId,
      number: `SUB-${(10001 + s).toString().padStart(6, "0")}`,
      customerId,
      planId: planConfig.id,
      status,
      startDate,
      expiryDate,
      paymentTerms: terms,
      planFee: planConfig.fee,
      planTaxRateBps: planConfig.taxBps,
      pausedAt,
      nextPeriodStart,
      createdById: SEED_IDS.users.admin,
      closeReason,
      closedAt,
    });

    allSubLineData.push(...subLines);

    // Status history for subscription
    allStatusHistoryData.push({
      entity: StatusEntity.SUBSCRIPTION,
      entityId: subId,
      from: null,
      to: "DRAFT",
      byUserId: SEED_IDS.users.admin,
      note: "Created",
    });

    if (hasInvoices && invoiceCount > 0) {
      // Generate invoices
      for (let p = 0; p < invoiceCount; p++) {
        const pStart = periodStartDate(startDate, planConfig.period, p);
        const pEnd = periodStartDate(startDate, planConfig.period, p + 1);
        pEnd.setUTCDate(pEnd.getUTCDate() - 1);

        // Enforce UNIQUE(subscriptionId, periodStart)
        const key = `${subId}|${pStart.toISOString()}`;
        if (usedPeriods.has(key)) continue;
        usedPeriods.add(key);

        const invoiceId = deterministicId("40000000", invoiceCounter++);

        // Invoice lines
        const planFeeTax = percentOf(planConfig.fee, planConfig.taxBps);
        const invoiceLines: typeof allInvoiceLineData = [];

        // Plan fee line
        invoiceLines.push({
          id: deterministicId("50000000", invoiceLineCounter++),
          invoiceId,
          kind: InvoiceLineKind.PLAN_FEE,
          sortOrder: 0,
          description: "Plan fee",
          qty: 1,
          unitPrice: planConfig.fee,
          taxRateBps: planConfig.taxBps,
          amount: planConfig.fee,
          taxAmount: planFeeTax,
          productId: null,
          variantId: null,
          discountId: null,
        });

        // Product lines matching subscription lines
        let productSubtotal = planConfig.fee;
        let productTaxTotal = planFeeTax;
        for (const sl of subLines) {
          const lineTax = percentOf(sl.amount, sl.taxRateBps);
          invoiceLines.push({
            id: deterministicId("50000000", invoiceLineCounter++),
            invoiceId,
            kind: InvoiceLineKind.PRODUCT,
            sortOrder: invoiceLines.length,
            description: sl.description,
            qty: sl.qty,
            unitPrice: sl.unitPrice,
            taxRateBps: sl.taxRateBps,
            amount: sl.amount,
            taxAmount: lineTax,
            productId: sl.productId,
            variantId: sl.variantId,
            discountId: null,
          });
          productSubtotal += sl.amount;
          productTaxTotal += lineTax;
        }

        const subtotal = productSubtotal;
        const discountTotal = 0;
        const taxTotal = productTaxTotal;
        const total = subtotal - discountTotal + taxTotal;

        // Due date
        let dueDate: Date;
        switch (terms) {
          case PaymentTerms.IMMEDIATE: dueDate = new Date(pStart); break;
          case PaymentTerms.NET_15: dueDate = addDays(pStart, 15); break;
          case PaymentTerms.NET_30: dueDate = addDays(pStart, 30); break;
        }

        // Invoice status distribution
        const invStatusRoll = (invoiceCounter + s) % 20;
        let invStatus: InvoiceStatus;
        let amountPaid = 0;
        let confirmedAt: Date | null = null;
        let paidAt: Date | null = null;
        let cancelledAt: Date | null = null;

        if (invStatusRoll < 12) {
          // 60% PAID
          invStatus = InvoiceStatus.PAID;
          amountPaid = total;
          confirmedAt = pStart;
          paidAt = addDays(pStart, (s % 5) + 1);
        } else if (invStatusRoll < 15) {
          // 15% partially paid (CONFIRMED)
          invStatus = InvoiceStatus.CONFIRMED;
          amountPaid = Math.round(total * ((s % 4 + 1) * 20) / 100); // 20-80%
          confirmedAt = pStart;
        } else if (invStatusRoll < 17) {
          // 10% overdue (CONFIRMED, dueDate in past)
          invStatus = InvoiceStatus.CONFIRMED;
          amountPaid = 0;
          confirmedAt = pStart;
          dueDate = subDays(today, (s % 20) + 1);
        } else if (invStatusRoll < 19) {
          // 10% DRAFT
          invStatus = InvoiceStatus.DRAFT;
        } else {
          // 5% CANCELLED
          invStatus = InvoiceStatus.CANCELLED;
          cancelledAt = addDays(pStart, 2);
        }

        allInvoiceData.push({
          id: invoiceId,
          number: `INV-${(10001 + invoiceCounter).toString().padStart(6, "0")}`,
          subscriptionId: subId,
          customerId,
          periodStart: pStart,
          periodEnd: pEnd,
          status: invStatus,
          issueDate: pStart,
          dueDate,
          subtotal,
          discountTotal,
          taxTotal,
          total,
          amountPaid,
          confirmedAt,
          paidAt,
          cancelledAt,
        });

        allInvoiceLineData.push(...invoiceLines);

        // Payments for paid/partially paid invoices
        if (amountPaid > 0) {
          allPaymentData.push({
            id: deterministicId("60000000", paymentCounter++),
            invoiceId,
            method: paymentMethods[(s + p) % paymentMethods.length],
            provider: PaymentProvider.MANUAL,
            amount: amountPaid,
            paidOn: paidAt || addDays(pStart, (s % 10) + 1),
            note: null,
            recordedById: SEED_IDS.users.staff1,
          });
        }
      }
    }
  }

  // ────────── Batch Insert with Chunks ──────────
  console.log(`Inserting ${allSubData.length} subscriptions...`);
  for (let i = 0; i < allSubData.length; i += CHUNK_SIZE) {
    const chunk = allSubData.slice(i, i + CHUNK_SIZE);
    await prisma.subscription.createMany({ data: chunk, skipDuplicates: true });
    if ((i / CHUNK_SIZE) % 5 === 0) console.log(`  Subscriptions: ${Math.min(i + CHUNK_SIZE, allSubData.length)}/${allSubData.length}`);
  }

  console.log(`Inserting ${allSubLineData.length} subscription lines...`);
  for (let i = 0; i < allSubLineData.length; i += CHUNK_SIZE) {
    const chunk = allSubLineData.slice(i, i + CHUNK_SIZE);
    await prisma.subscriptionLine.createMany({ data: chunk, skipDuplicates: true });
  }

  console.log(`Inserting ${allInvoiceData.length} invoices...`);
  for (let i = 0; i < allInvoiceData.length; i += CHUNK_SIZE) {
    const chunk = allInvoiceData.slice(i, i + CHUNK_SIZE);
    await prisma.invoice.createMany({ data: chunk, skipDuplicates: true });
    if ((i / CHUNK_SIZE) % 5 === 0) console.log(`  Invoices: ${Math.min(i + CHUNK_SIZE, allInvoiceData.length)}/${allInvoiceData.length}`);
  }

  console.log(`Inserting ${allInvoiceLineData.length} invoice lines...`);
  for (let i = 0; i < allInvoiceLineData.length; i += CHUNK_SIZE) {
    const chunk = allInvoiceLineData.slice(i, i + CHUNK_SIZE);
    await prisma.invoiceLine.createMany({ data: chunk, skipDuplicates: true });
    if ((i / CHUNK_SIZE) % 10 === 0) console.log(`  Invoice lines: ${Math.min(i + CHUNK_SIZE, allInvoiceLineData.length)}/${allInvoiceLineData.length}`);
  }

  console.log(`Inserting ${allPaymentData.length} payments...`);
  for (let i = 0; i < allPaymentData.length; i += CHUNK_SIZE) {
    const chunk = allPaymentData.slice(i, i + CHUNK_SIZE);
    await prisma.payment.createMany({ data: chunk, skipDuplicates: true });
  }

  console.log(`Inserting ${allStatusHistoryData.length} status history entries...`);
  for (let i = 0; i < allStatusHistoryData.length; i += CHUNK_SIZE) {
    const chunk = allStatusHistoryData.slice(i, i + CHUNK_SIZE);
    await prisma.statusHistory.createMany({ data: chunk, skipDuplicates: true });
  }

  console.log("Full-scale seed complete!");
  console.log(`  Subscriptions: ${allSubData.length}`);
  console.log(`  Invoices: ${allInvoiceData.length}`);
  console.log(`  Payments: ${allPaymentData.length}`);
  console.log(`  Invoice lines: ${allInvoiceLineData.length}`);
}

// ────────── CLI Entry Point ──────────
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
