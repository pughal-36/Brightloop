import "server-only";
import { db } from "@/server/db";
import type { Prisma } from "@/generated/prisma/client";

export async function createCustomerRecord(data: {
  name: string;
  email: string;
  phone?: string | null;
  billingAddress?: string | null;
  createdById?: string | null;
}) {
  return db.customer.create({
    data: {
      name: data.name,
      email: data.email,
      phone: data.phone,
      billingAddress: data.billingAddress,
      createdById: data.createdById,
      isActive: true,
    },
  });
}

export async function updateCustomerRecord(
  id: string,
  data: {
    name?: string;
    email?: string;
    phone?: string | null;
    billingAddress?: string | null;
    isActive?: boolean;
  }
) {
  return db.customer.update({
    where: { id },
    data,
  });
}

export async function findCustomerById(id: string) {
  return db.customer.findUnique({
    where: { id },
  });
}

export async function listCustomersRecords(options: {
  search?: string;
  page: number;
  pageSize: number;
}) {
  const { search, page, pageSize } = options;
  const where: Prisma.CustomerWhereInput = {};

  if (search && search.trim() !== "") {
    where.OR = [
      { name: { contains: search.trim(), mode: "insensitive" } },
      { email: { contains: search.trim(), mode: "insensitive" } },
      { phone: { contains: search.trim(), mode: "insensitive" } },
    ];
  }

  const [items, total] = await Promise.all([
    db.customer.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    db.customer.count({ where }),
  ]);

  return { items, total };
}
