import { describe, it, expect, vi, beforeAll } from "vitest";

// Top-level mocks
vi.mock("server-only", () => ({}));

const mockCookiesMap = new Map<string, string>();
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => {
      const val = mockCookiesMap.get(name);
      return val ? { name, value: val } : undefined;
    },
    set: vi.fn(),
    delete: vi.fn(),
  }),
}));

import { db } from "@/server/db";
import { Role } from "@/generated/prisma/enums";
import { createSessionToken, SESSION_COOKIE_NAME } from "@/server/lib/session";

// Page imports
import AdminDashboardPage from "@/app/admin/page";
import CustomersPage from "@/app/admin/customers/page";
import ProductsPage from "@/app/admin/products/page";
import TaxesPage from "@/app/admin/taxes/page";
import PlansPage from "@/app/admin/plans/page";
import StaffPage from "@/app/admin/staff/page";
import SubscriptionsPage from "@/app/admin/subscriptions/page";
import DiscountsPage from "@/app/admin/discounts/page";
import AdminBillingPage from "@/app/admin/billing/page";
import AdminInvoicesPage from "@/app/admin/invoices/page";

describe("Admin Sidebar Routes Rendering Verification", () => {
  beforeAll(async () => {
    const adminUser = await db.user.findFirst({
      where: { role: Role.ADMIN, isActive: true },
    });
    expect(adminUser).not.toBeNull();

    const token = await createSessionToken({
      userId: adminUser!.id,
      role: Role.ADMIN,
      sessionVersion: adminUser!.sessionVersion,
    });

    mockCookiesMap.set(SESSION_COOKIE_NAME, token);
  });

  it("renders Dashboard (/admin) without throwing", async () => {
    const page = await AdminDashboardPage({ searchParams: Promise.resolve({}) });
    expect(page).toBeDefined();
  });

  it("renders Customers (/admin/customers) without throwing", async () => {
    const page = await CustomersPage({ searchParams: Promise.resolve({}) });
    expect(page).toBeDefined();
  });

  it("renders Products (/admin/products) without throwing", async () => {
    const page = await ProductsPage({ searchParams: Promise.resolve({}) });
    expect(page).toBeDefined();
  });

  it("renders Taxes (/admin/taxes) without throwing", async () => {
    const page = await TaxesPage({ searchParams: Promise.resolve({}) });
    expect(page).toBeDefined();
  });

  it("renders Plans (/admin/plans) without throwing", async () => {
    const page = await PlansPage({ searchParams: Promise.resolve({}) });
    expect(page).toBeDefined();
  });

  it("renders Staff (/admin/staff) without throwing", async () => {
    const page = await StaffPage({ searchParams: Promise.resolve({}) });
    expect(page).toBeDefined();
  });

  it("renders Subscriptions (/admin/subscriptions) without throwing", async () => {
    const page = await SubscriptionsPage({ searchParams: Promise.resolve({}) });
    expect(page).toBeDefined();
  });

  it("renders Discounts (/admin/discounts) without throwing", async () => {
    const page = await DiscountsPage({ searchParams: Promise.resolve({}) });
    expect(page).toBeDefined();
  });

  it("renders Billing (/admin/billing) without throwing", async () => {
    const page = await AdminBillingPage();
    expect(page).toBeDefined();
  });

  it("renders Invoices (/admin/invoices) without throwing", async () => {
    const page = await AdminInvoicesPage({ searchParams: Promise.resolve({}) });
    expect(page).toBeDefined();
  });
});
