import "server-only";
import { db } from "@/server/db";
import { Role } from "@/generated/prisma/enums";

export async function findUserByEmail(emailLower: string) {
  return db.user.findUnique({
    where: { email: emailLower },
    include: { customer: true },
  });
}

export async function findUserById(id: string) {
  return db.user.findUnique({
    where: { id },
    include: { customer: true },
  });
}

export async function createUserWithCustomer(data: {
  name: string;
  emailLower: string;
  passwordHash: string;
}) {
  return db.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        name: data.name,
        email: data.emailLower,
        passwordHash: data.passwordHash,
        role: Role.CUSTOMER,
        isActive: true,
        sessionVersion: 0,
      },
    });

    const customer = await tx.customer.create({
      data: {
        name: data.name,
        email: data.emailLower,
        userId: user.id,
        isActive: true,
      },
    });

    return { ...user, customer };
  });
}

export async function recordLoginAttempt(data: {
  email: string;
  ip: string;
  success: boolean;
}) {
  return db.loginAttempt.create({
    data: {
      email: data.email,
      ip: data.ip,
      success: data.success,
    },
  });
}

export async function countFailedLoginAttempts(
  email: string,
  ip: string,
  since: Date
): Promise<number> {
  return db.loginAttempt.count({
    where: {
      email,
      ip,
      success: false,
      createdAt: { gte: since },
    },
  });
}

export async function findPasswordResetToken(tokenHash: string) {
  return db.passwordResetToken.findUnique({
    where: { tokenHash },
    include: { user: true },
  });
}

export async function invalidateUnusedResetTokensForUser(userId: string): Promise<void> {
  await db.passwordResetToken.updateMany({
    where: {
      userId,
      usedAt: null,
    },
    data: {
      usedAt: new Date(),
    },
  });
}

export async function createPasswordResetToken(data: {
  userId: string;
  tokenHash: string;
  expiresAt: Date;
}) {
  return db.passwordResetToken.create({
    data: {
      userId: data.userId,
      tokenHash: data.tokenHash,
      expiresAt: data.expiresAt,
    },
  });
}

export async function countRecentResetTokens(
  userId: string,
  since: Date
): Promise<number> {
  return db.passwordResetToken.count({
    where: {
      userId,
      createdAt: { gte: since },
    },
  });
}

export async function completePasswordReset(
  tokenId: string,
  userId: string,
  passwordHash: string
) {
  return db.$transaction(async (tx) => {
    await tx.passwordResetToken.update({
      where: { id: tokenId },
      data: { usedAt: new Date() },
    });

    const updatedUser = await tx.user.update({
      where: { id: userId },
      data: {
        passwordHash,
        sessionVersion: { increment: 1 },
      },
    });

    return updatedUser;
  });
}
