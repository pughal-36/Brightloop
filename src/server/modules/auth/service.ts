import "server-only";
import bcrypt from "bcryptjs";
import { AppError } from "@/server/errors";
import { env } from "@/server/env";
import { sendEmail } from "@/server/lib/email";
import { generateResetToken, hashToken } from "@/server/lib/tokens";
import { checkPasswordResetRateLimit } from "@/server/lib/rate-limit";
import { createSessionToken } from "@/server/lib/session";
import {
  findUserByEmail,
  createUserWithCustomer,
  recordLoginAttempt,
  countFailedLoginAttempts,
  findPasswordResetToken,
  invalidateUnusedResetTokensForUser,
  createPasswordResetToken,
  countRecentResetTokens,
  completePasswordReset,
} from "./repo";
import {
  signupSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  passwordSchema,
} from "./schema";

// Pre-computed bcrypt cost 12 dummy hash for constant-time comparison on unknown user
const DUMMY_HASH = "$2b$12$hAsK8C81A9J3Sif771cWIeCWhkWi6moN9CedUjGVj93Rt55V67nnu";
const GENERIC_LOGIN_ERROR = "Invalid email or password";
const GENERIC_RESET_REJECTION = "Invalid or expired password reset link";
const GENERIC_RESET_REQUEST_SUCCESS =
  "If an account exists with this email, a password reset link has been sent.";

export async function signup(rawInput: unknown) {
  const input = signupSchema.parse(rawInput);
  const emailLower = input.email.trim().toLowerCase();

  const existingUser = await findUserByEmail(emailLower);
  if (existingUser) {
    throw new AppError("CONFLICT", 409, "An account with this email already exists");
  }

  const passwordHash = await bcrypt.hash(input.password, 12);

  const user = await createUserWithCustomer({
    name: input.name.trim(),
    emailLower,
    passwordHash,
  });

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

export async function login(rawInput: unknown, ip: string) {
  const input = loginSchema.parse(rawInput);
  const emailLower = input.email.trim().toLowerCase();

  // 1. Check lockout (count failed attempts in the last 15 minutes for email + ip)
  const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);
  const failedAttempts = await countFailedLoginAttempts(emailLower, ip, fifteenMinutesAgo);

  if (failedAttempts >= 5) {
    await recordLoginAttempt({ email: emailLower, ip, success: false });
    throw new AppError(
      "FORBIDDEN",
      429,
      "Too many failed login attempts. Please try again in 15 minutes."
    );
  }

  // 2. Look up user
  const user = await findUserByEmail(emailLower);

  if (!user) {
    // Run compare against dummy hash to prevent timing attacks
    await bcrypt.compare(input.password, DUMMY_HASH);
    await recordLoginAttempt({ email: emailLower, ip, success: false });
    throw new AppError("UNAUTHENTICATED", 401, GENERIC_LOGIN_ERROR);
  }

  // 3. Verify password
  const isMatch = await bcrypt.compare(input.password, user.passwordHash);
  if (!isMatch) {
    await recordLoginAttempt({ email: emailLower, ip, success: false });
    throw new AppError("UNAUTHENTICATED", 401, GENERIC_LOGIN_ERROR);
  }

  // 4. Verify user is active
  if (!user.isActive) {
    await recordLoginAttempt({ email: emailLower, ip, success: false });
    throw new AppError("UNAUTHENTICATED", 401, GENERIC_LOGIN_ERROR);
  }

  // 5. Successful login
  await recordLoginAttempt({ email: emailLower, ip, success: true });

  const token = await createSessionToken({
    userId: user.id,
    role: user.role,
    sessionVersion: user.sessionVersion,
  });

  return {
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      sessionVersion: user.sessionVersion,
      customerId: user.customer?.id ?? null,
    },
    token,
  };
}

export async function requestPasswordReset(rawInput: unknown) {
  const input = forgotPasswordSchema.parse(rawInput);
  const emailLower = input.email.trim().toLowerCase();

  // Limit to 3 requests per hour per email
  const allowed = checkPasswordResetRateLimit(emailLower);
  if (!allowed) {
    throw new AppError(
      "FORBIDDEN",
      429,
      "Too many password reset requests. Please try again later."
    );
  }

  const successResponse = {
    success: true,
    message: GENERIC_RESET_REQUEST_SUCCESS,
  };

  const user = await findUserByEmail(emailLower);
  if (!user) {
    return successResponse;
  }

  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const recentDbTokens = await countRecentResetTokens(user.id, oneHourAgo);
  if (recentDbTokens >= 3) {
    throw new AppError(
      "FORBIDDEN",
      429,
      "Too many password reset requests. Please try again later."
    );
  }

  // Invalidate older unused tokens for that user
  await invalidateUnusedResetTokensForUser(user.id);

  // Create token of 32 random bytes (base64url)
  const token = generateResetToken();
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes

  await createPasswordResetToken({
    userId: user.id,
    tokenHash,
    expiresAt,
  });

  const resetLink = `${env.APP_URL}/reset-password?token=${token}`;
  await sendEmail({
    to: user.email,
    subject: "Reset your BrightLoop password",
    text: `Follow this link to reset your BrightLoop password: ${resetLink}. This link will expire in 30 minutes.`,
  });

  return successResponse;
}

export async function resetPassword(rawInput: unknown) {
  const input = resetPasswordSchema.parse(rawInput);

  // Enforce password policy
  passwordSchema.parse(input.password);

  const tokenHash = hashToken(input.token);
  const resetToken = await findPasswordResetToken(tokenHash);

  if (
    !resetToken ||
    resetToken.usedAt !== null ||
    resetToken.expiresAt < new Date()
  ) {
    throw new AppError("VALIDATION", 400, GENERIC_RESET_REJECTION);
  }

  const passwordHash = await bcrypt.hash(input.password, 12);

  await completePasswordReset(resetToken.id, resetToken.userId, passwordHash);

  return {
    success: true,
    message: "Your password has been reset successfully. You can now sign in.",
  };
}
