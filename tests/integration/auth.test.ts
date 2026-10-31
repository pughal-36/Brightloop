import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock server-only so we can import server code in Vitest
vi.mock("server-only", () => ({}));

import { db } from "@/server/db";
import { Role } from "@/generated/prisma/enums";
import { AppError } from "@/server/errors";
import {
  signup,
  login,
  requestPasswordReset,
  resetPassword,
} from "@/server/modules/auth/service";
import { validateSessionToken } from "@/server/lib/session";
import { clearRateLimitsForTesting } from "@/server/lib/rate-limit";
import { hashToken } from "@/server/lib/tokens";

describe("Auth service integration tests", { timeout: 30000 }, () => {
  beforeEach(() => {
    clearRateLimitsForTesting();
  });

  it("rejects signup duplicate with different email casing", async () => {
    const emailLower = `casing.test.${Date.now()}@example.com`;
    const emailUpper = emailLower.toUpperCase();

    // First signup succeeds
    const result = await signup({
      name: "Casing User",
      email: emailLower,
      password: "ValidPassword123!",
    });
    expect(result.user.email).toBe(emailLower);

    // Second signup with upper case email is rejected with CONFLICT
    await expect(
      signup({
        name: "Casing User Duplicate",
        email: emailUpper,
        password: "ValidPassword123!",
      })
    ).rejects.toThrowError(AppError);

    try {
      await signup({
        name: "Casing User Duplicate",
        email: emailUpper,
        password: "ValidPassword123!",
      });
    } catch (err) {
      expect(err).toBeInstanceOf(AppError);
      const appErr = err as AppError;
      expect(appErr.code).toBe("CONFLICT");
      expect(appErr.status).toBe(409);
      expect(appErr.message).toBe("An account with this email already exists");
    }
  });

  it("ignores role in signup input and always creates a CUSTOMER", async () => {
    const email = `role.ignore.${Date.now()}@example.com`;

    // Attempt to pass role: ADMIN in signup input
    const result = await signup({
      name: "Role Hacker",
      email,
      password: "ValidPassword123!",
      role: "ADMIN",
    });

    expect(result.user.role).toBe(Role.CUSTOMER);

    // Verify in database
    const dbUser = await db.user.findUnique({ where: { email } });
    expect(dbUser).not.toBeNull();
    expect(dbUser?.role).toBe(Role.CUSTOMER);

    // Verify linked customer record was created in the same transaction
    const dbCustomer = await db.customer.findUnique({
      where: { userId: dbUser?.id },
    });
    expect(dbCustomer).not.toBeNull();
    expect(dbCustomer?.name).toBe("Role Hacker");
    expect(dbCustomer?.email).toBe(email);
  });

  it("locks login on the 6th failure for the same email and IP", async () => {
    const email = `lockout.${Date.now()}@example.com`;
    const ip = `10.0.0.${Math.floor(Math.random() * 250) + 1}`;

    // Create a real user
    await signup({
      name: "Lockout Test User",
      email,
      password: "CorrectPassword123!",
    });

    // 5 failed attempts with wrong password
    for (let i = 1; i <= 5; i++) {
      try {
        await login({ email, password: "WrongPassword123!" }, ip);
        expect.unreachable("Login should have failed");
      } catch (err) {
        expect(err).toBeInstanceOf(AppError);
        const appErr = err as AppError;
        expect(appErr.code).toBe("UNAUTHENTICATED");
        expect(appErr.status).toBe(401);
        expect(appErr.message).toBe("Invalid email or password");
      }
    }

    // 6th failed attempt triggers lockout
    try {
      await login({ email, password: "WrongPassword123!" }, ip);
      expect.unreachable("Login should have failed with lockout");
    } catch (err) {
      expect(err).toBeInstanceOf(AppError);
      const appErr = err as AppError;
      expect(appErr.code).toBe("FORBIDDEN");
      expect(appErr.status).toBe(429);
      expect(appErr.message).toContain("Too many failed login attempts");
    }
  });

  it("returns identical generic error for unknown user and wrong password", async () => {
    const knownEmail = `generic.error.${Date.now()}@example.com`;
    const unknownEmail = `nonexistent.${Date.now()}@example.com`;
    const ip = "127.0.0.1";

    await signup({
      name: "Known User",
      email: knownEmail,
      password: "RealPassword123!",
    });

    let errUnknown: AppError | null = null;
    try {
      await login({ email: unknownEmail, password: "AnyPassword123!" }, ip);
    } catch (err) {
      errUnknown = err as AppError;
    }

    let errWrongPass: AppError | null = null;
    try {
      await login({ email: knownEmail, password: "WrongPassword123!" }, ip);
    } catch (err) {
      errWrongPass = err as AppError;
    }

    expect(errUnknown).not.toBeNull();
    expect(errWrongPass).not.toBeNull();
    expect(errUnknown?.message).toBe("Invalid email or password");
    expect(errWrongPass?.message).toBe("Invalid email or password");
    expect(errUnknown?.code).toBe(errWrongPass?.code);
    expect(errUnknown?.status).toBe(errWrongPass?.status);
  });

  it("returns the same reset request response for unknown email as known email", async () => {
    const knownEmail = `reset.known.${Date.now()}@example.com`;
    const unknownEmail = `reset.unknown.${Date.now()}@example.com`;

    await signup({
      name: "Reset User",
      email: knownEmail,
      password: "Password123!",
    });

    const resKnown = await requestPasswordReset({ email: knownEmail });
    const resUnknown = await requestPasswordReset({ email: unknownEmail });

    expect(resKnown).toEqual(resUnknown);
    expect(resKnown.success).toBe(true);
    expect(resKnown.message).toBe(
      "If an account exists with this email, a password reset link has been sent."
    );
  });

  it("reset token works exactly once", async () => {
    const email = `token.once.${Date.now()}@example.com`;
    await signup({
      name: "Once User",
      email,
      password: "OldPassword123!",
    });

    const rawToken = `token-once-${Date.now()}-${Math.random()}`;
    const hashed = hashToken(rawToken);

    const user = await db.user.findUniqueOrThrow({ where: { email } });
    await db.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash: hashed,
        expiresAt: new Date(Date.now() + 30 * 60 * 1000),
      },
    });

    // 1st reset: works
    const result1 = await resetPassword({
      token: rawToken,
      password: "NewPassword123!",
    });
    expect(result1.success).toBe(true);

    // 2nd reset with same token: rejected
    await expect(
      resetPassword({
        token: rawToken,
        password: "AnotherNewPass123!",
      })
    ).rejects.toThrowError(AppError);

    try {
      await resetPassword({
        token: rawToken,
        password: "AnotherNewPass123!",
      });
    } catch (err) {
      const appErr = err as AppError;
      expect(appErr.message).toBe("Invalid or expired password reset link");
    }
  });

  it("rejects an expired reset token", async () => {
    const email = `token.expired.${Date.now()}@example.com`;
    await signup({
      name: "Expired User",
      email,
      password: "OldPassword123!",
    });

    const rawToken = `expired-token-${Date.now()}-${Math.random()}`;
    const hashed = hashToken(rawToken);

    const user = await db.user.findUniqueOrThrow({ where: { email } });
    await db.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash: hashed,
        expiresAt: new Date(Date.now() - 5000), // 5 seconds in the past
      },
    });

    await expect(
      resetPassword({
        token: rawToken,
        password: "NewPassword123!",
      })
    ).rejects.toThrowError(AppError);

    try {
      await resetPassword({
        token: rawToken,
        password: "NewPassword123!",
      });
    } catch (err) {
      const appErr = err as AppError;
      expect(appErr.message).toBe("Invalid or expired password reset link");
    }
  });

  it("resetting the password invalidates an older session (sessionVersion)", async () => {
    const email = `session.version.${Date.now()}@example.com`;
    await signup({
      name: "Session User",
      email,
      password: "InitialPassword123!",
    });

    // Log in to get session token
    const { token } = await login(
      { email, password: "InitialPassword123!" },
      "127.0.0.1"
    );

    // Session is initially valid
    const sessionBefore = await validateSessionToken(token);
    expect(sessionBefore).not.toBeNull();
    expect(sessionBefore?.user.sessionVersion).toBe(0);

    // Request reset and perform password reset
    const rawToken = `session-version-token-${Date.now()}-${Math.random()}`;
    const hashed = hashToken(rawToken);
    const user = await db.user.findUniqueOrThrow({ where: { email } });

    await db.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash: hashed,
        expiresAt: new Date(Date.now() + 30 * 60 * 1000),
      },
    });

    await resetPassword({
      token: rawToken,
      password: "BrandNewPassword123!",
    });

    // Check user's sessionVersion in DB has incremented
    const updatedUser = await db.user.findUniqueOrThrow({ where: { email } });
    expect(updatedUser.sessionVersion).toBe(1);

    // The old session token is now invalid (validateSessionToken returns null)
    const sessionAfter = await validateSessionToken(token);
    expect(sessionAfter).toBeNull();

    // Logging in with the new password works and issues a new session with sessionVersion 1
    const { token: newToken } = await login(
      { email, password: "BrandNewPassword123!" },
      "127.0.0.1"
    );
    const newSession = await validateSessionToken(newToken);
    expect(newSession).not.toBeNull();
    expect(newSession?.user.sessionVersion).toBe(1);
  });
});
