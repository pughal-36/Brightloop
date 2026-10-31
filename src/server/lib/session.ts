import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import { env } from "@/server/env";
import { AppError } from "@/server/errors";
import { findUserById } from "@/server/modules/auth/repo";
import type { Role } from "@/generated/prisma/enums";

export const SESSION_COOKIE_NAME = "bl_session";
const SESSION_EXPIRY = "7d";
const SESSION_MAX_AGE_SECONDS = 7 * 24 * 60 * 60; // 7 days in seconds

export interface SessionPayload {
  userId: string;
  role: Role;
  sessionVersion: number;
}

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: Role;
  sessionVersion: number;
  customerId?: string | null;
}

export interface Session {
  user: SessionUser;
}

function getSecretKey(): Uint8Array {
  return new TextEncoder().encode(env.AUTH_SECRET);
}

/**
 * Creates a signed JWT session token with HS256 algorithm and 7-day expiry.
 */
export async function createSessionToken(payload: SessionPayload): Promise<string> {
  return new SignJWT({
    userId: payload.userId,
    role: payload.role,
    sessionVersion: payload.sessionVersion,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(SESSION_EXPIRY)
    .sign(getSecretKey());
}

/**
 * Verifies a JWT token's signature, algorithm, and expiry.
 */
export async function verifySessionToken(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecretKey(), {
      algorithms: ["HS256"],
    });

    if (
      typeof payload.userId !== "string" ||
      typeof payload.role !== "string" ||
      typeof payload.sessionVersion !== "number"
    ) {
      return null;
    }

    return {
      userId: payload.userId,
      role: payload.role as Role,
      sessionVersion: payload.sessionVersion,
    };
  } catch {
    return null;
  }
}

/**
 * Verifies the JWT and loads the user from the database.
 * If user is missing, inactive, or sessionVersion differs, returns null (treated as logged out).
 */
export async function validateSessionToken(token: string): Promise<Session | null> {
  const payload = await verifySessionToken(token);
  if (!payload) {
    return null;
  }

  const user = await findUserById(payload.userId);
  if (!user || !user.isActive || user.sessionVersion !== payload.sessionVersion) {
    return null;
  }

  return {
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      sessionVersion: user.sessionVersion,
      customerId: user.customer?.id ?? null,
    },
  };
}

/**
 * Reads session cookie and returns validated session, memoized per request.
 */
export const getSession = cache(async (): Promise<Session | null> => {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
    if (!token) {
      return null;
    }
    return await validateSessionToken(token);
  } catch {
    return null;
  }
});

/**
 * Returns the current session or throws AppError UNAUTHENTICATED.
 */
export async function requireSession(): Promise<Session> {
  const session = await getSession();
  if (!session) {
    throw new AppError("UNAUTHENTICATED", 401, "Authentication required");
  }
  return session;
}

/**
 * Sets the httpOnly, SameSite=Lax, Secure(in production) session cookie.
 */
export async function setSessionCookie(token: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
}

/**
 * Clears the session cookie.
 */
export async function clearSessionCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
}

