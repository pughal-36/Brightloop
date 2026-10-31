import "server-only";
import { db } from "@/server/db";
import { Role } from "@/generated/prisma/enums";
import type { Prisma } from "@/generated/prisma/client";

export async function findUserByEmail(emailLower: string) {
  return db.user.findUnique({
    where: { email: emailLower },
  });
}

export async function findStaffById(id: string) {
  return db.user.findUnique({
    where: { id },
  });
}

export async function createStaffUser(data: {
  name: string;
  emailLower: string;
  passwordHash: string;
}) {
  return db.user.create({
    data: {
      name: data.name,
      email: data.emailLower,
      passwordHash: data.passwordHash,
      role: Role.STAFF,
      isActive: true,
      sessionVersion: 0,
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      isActive: true,
      createdAt: true,
    },
  });
}

export async function createStaffResetToken(data: {
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

export async function deactivateStaffUser(id: string) {
  return db.user.update({
    where: { id },
    data: {
      isActive: false,
      sessionVersion: { increment: 1 },
    },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      isActive: true,
    },
  });
}

export async function listStaffUsers(options: {
  search?: string;
  page: number;
  pageSize: number;
}) {
  const { search, page, pageSize } = options;
  const where: Prisma.UserWhereInput = {
    role: { in: [Role.STAFF, Role.ADMIN] },
  };

  if (search && search.trim() !== "") {
    where.OR = [
      { name: { contains: search.trim(), mode: "insensitive" } },
      { email: { contains: search.trim(), mode: "insensitive" } },
    ];
  }

  const [items, total] = await Promise.all([
    db.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
    }),
    db.user.count({ where }),
  ]);

  return { items, total };
}

