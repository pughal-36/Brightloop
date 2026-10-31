import "server-only";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import { AppError } from "@/server/errors";
import { env } from "@/server/env";
import { sendEmail } from "@/server/lib/email";
import { generateResetToken, hashToken } from "@/server/lib/tokens";
import { requireRole, type Session } from "@/server/lib/session";
import { Role } from "@/generated/prisma/enums";
import {
  findUserByEmail,
  findStaffById,
  createStaffUser,
  createStaffResetToken,
  deactivateStaffUser,
  listStaffUsers,
} from "./repo";
import {
  createStaffSchema,
  deactivateStaffSchema,
  listStaffSchema,
} from "./schema";

export async function createStaff(session: Session, rawInput: unknown) {
  requireRole(session, Role.ADMIN);

  const input = createStaffSchema.parse(rawInput);
  const emailLower = input.email.trim().toLowerCase();

  const existing = await findUserByEmail(emailLower);
  if (existing) {
    throw new AppError("CONFLICT", 409, "A user with this email already exists");
  }

  // Generate a random 32-character initial password hash
  const initialRandomPassword = crypto.randomBytes(24).toString("hex");
  const passwordHash = await bcrypt.hash(initialRandomPassword, 12);

  const staffUser = await createStaffUser({
    name: input.name.trim(),
    emailLower,
    passwordHash,
  });

  // Reuse the reset token flow to send a set-password link
  const token = generateResetToken();
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

  await createStaffResetToken({
    userId: staffUser.id,
    tokenHash,
    expiresAt,
  });

  const resetLink = `${env.APP_URL}/reset-password?token=${token}`;
  await sendEmail({
    to: staffUser.email,
    subject: "Set your BrightLoop staff password",
    text: `You have been added as a staff member on BrightLoop. Follow this link to set your password: ${resetLink}. This link will expire in 24 hours.`,
  });

  return {
    staff: staffUser,
    resetLink,
  };
}

export async function deactivateStaff(session: Session, rawInput: unknown) {
  requireRole(session, Role.ADMIN);

  const input = deactivateStaffSchema.parse(rawInput);

  if (input.userId === session.user.id) {
    throw new AppError("FORBIDDEN", 403, "Cannot deactivate yourself");
  }

  const staff = await findStaffById(input.userId);
  if (!staff) {
    throw new AppError("NOT_FOUND", 404, "Staff user not found");
  }

  if (staff.role !== Role.STAFF && staff.role !== Role.ADMIN) {
    throw new AppError("VALIDATION", 400, "User is not a staff member");
  }

  const updated = await deactivateStaffUser(input.userId);
  return {
    success: true,
    user: updated,
  };
}

export async function listStaff(session: Session, rawInput?: unknown) {
  requireRole(session, Role.ADMIN);

  const input = listStaffSchema.parse(rawInput ?? {});
  const { items, total } = await listStaffUsers(input);

  const totalPages = Math.ceil(total / input.pageSize);

  return {
    items,
    total,
    page: input.page,
    pageSize: input.pageSize,
    totalPages,
  };
}

