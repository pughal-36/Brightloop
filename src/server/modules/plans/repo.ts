import "server-only";
import { db } from "@/server/db";
import type { Prisma } from "@/generated/prisma/client";
import type { BillingPeriod } from "@/generated/prisma/enums";

export async function createPlanRecord(data: {
  name: string;
  price: number;
  billingPeriod: BillingPeriod;
  minQty: number;
  availableFrom: Date;
  availableTo?: Date | null;
  autoClose: boolean;
  closable: boolean;
  pausable: boolean;
  renewable: boolean;
  taxId?: string | null;
}) {
  return db.plan.create({
    data: {
      name: data.name,
      price: data.price,
      billingPeriod: data.billingPeriod,
      minQty: data.minQty,
      availableFrom: data.availableFrom,
      availableTo: data.availableTo,
      autoClose: data.autoClose,
      closable: data.closable,
      pausable: data.pausable,
      renewable: data.renewable,
      taxId: data.taxId,
      isActive: true,
    },
    include: {
      tax: true,
    },
  });
}

export async function updatePlanRecord(
  id: string,
  data: {
    name?: string;
    price?: number;
    billingPeriod?: BillingPeriod;
    minQty?: number;
    availableFrom?: Date;
    availableTo?: Date | null;
    autoClose?: boolean;
    closable?: boolean;
    pausable?: boolean;
    renewable?: boolean;
    taxId?: string | null;
    isActive?: boolean;
  }
) {
  return db.plan.update({
    where: { id },
    data,
    include: {
      tax: true,
    },
  });
}

export async function findPlanById(id: string) {
  return db.plan.findUnique({
    where: { id },
    include: {
      tax: true,
    },
  });
}

export async function listPlanRecords(options: {
  search?: string;
  billingPeriod?: BillingPeriod;
  page: number;
  pageSize: number;
  isActive?: boolean;
}) {
  const { search, billingPeriod, page, pageSize, isActive } = options;
  const where: Prisma.PlanWhereInput = {};

  if (isActive !== undefined) {
    where.isActive = isActive;
  }
  if (billingPeriod) {
    where.billingPeriod = billingPeriod;
  }
  if (search && search.trim() !== "") {
    where.name = { contains: search.trim(), mode: "insensitive" };
  }

  const [items, total] = await Promise.all([
    db.plan.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        tax: true,
      },
    }),
    db.plan.count({ where }),
  ]);

  return { items, total };
}
