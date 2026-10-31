import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock server-only
vi.mock("server-only", () => ({}));

// Mock next/navigation
const mockRedirect = vi.fn();
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    mockRedirect(url);
    throw new Error(`REDIRECT:${url}`);
  },
  usePathname: () => "/admin",
}));

import type { Session } from "@/server/lib/session";
import HomePage from "@/app/page";
import { Role } from "@/generated/prisma/enums";

// Mock session
let mockSessionResult: Session | null = null;
vi.mock("@/server/lib/session", () => ({
  getSession: vi.fn(async () => mockSessionResult),
}));

describe("Root page (src/app/page.tsx) routing", () => {
  beforeEach(() => {
    mockRedirect.mockClear();
    mockSessionResult = null;
  });

  it("redirects to /login when there is no active session", async () => {
    mockSessionResult = null;
    await expect(HomePage()).rejects.toThrow("REDIRECT:/login");
    expect(mockRedirect).toHaveBeenCalledWith("/login");
  });

  it("redirects to /admin when session role is ADMIN", async () => {
    mockSessionResult = {
      user: {
        id: "admin-1",
        email: "admin@example.com",
        name: "Admin User",
        role: Role.ADMIN,
        sessionVersion: 1,
      },
    };
    await expect(HomePage()).rejects.toThrow("REDIRECT:/admin");
    expect(mockRedirect).toHaveBeenCalledWith("/admin");
  });

  it("redirects to /admin when session role is STAFF", async () => {
    mockSessionResult = {
      user: {
        id: "staff-1",
        email: "staff@example.com",
        name: "Staff User",
        role: Role.STAFF,
        sessionVersion: 1,
      },
    };
    await expect(HomePage()).rejects.toThrow("REDIRECT:/admin");
    expect(mockRedirect).toHaveBeenCalledWith("/admin");
  });

  it("redirects to /portal when session role is CUSTOMER", async () => {
    mockSessionResult = {
      user: {
        id: "cust-1",
        email: "customer@example.com",
        name: "Customer User",
        role: Role.CUSTOMER,
        sessionVersion: 1,
      },
    };
    await expect(HomePage()).rejects.toThrow("REDIRECT:/portal");
    expect(mockRedirect).toHaveBeenCalledWith("/portal");
  });
});
