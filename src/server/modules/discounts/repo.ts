import "server-only";
import { db } from "@/server/db";
import {
  DiscountType,
  DiscountScope,
  type Prisma,
} from "@/generated/prisma/client";

export interface CreateDiscountRepoInput {
  name: string;
  type: DiscountType;
  value: number;
  minPurchase?: number | null;
  minQty?: number | null;
  startDate: Date;
  endDate: Date;
  usageLimit: number;
  scope: DiscountScope;
  productIds?: string[];
}

export interface UpdateDiscountRepoInput {
  name?: string;
  type?: DiscountType;
  value?: number;
  minPurchase?: number | null;
  minQty?: number | null;
  startDate?: Date;
  endDate?: Date;
  usageLimit?: number;
  scope?: DiscountScope;
  isActive?: boolean;
  productIds?: string[];
}

export interface ListDiscountsRepoInput {
  search?: string;
  isActive?: boolean;
  page: number;
  pageSize: number;
}

export async function createDiscountRecord(input: CreateDiscountRepoInput) {
  return db.discount.create({
    data: {
      name: input.name,
      type: input.type,
      value: input.value,
      minPurchase: input.minPurchase ?? null,
      minQty: input.minQty ?? null,
      startDate: input.startDate,
      endDate: input.endDate,
      usageLimit: input.usageLimit,
      scope: input.scope,
      products:
        input.productIds && input.productIds.length > 0
          ? {
              create: input.productIds.map((productId) => ({
                productId,
              })),
            }
          : undefined,
    },
    include: {
      products: { include: { product: true } },
    },
  });
}

export async function updateDiscountRecord(id: string, input: UpdateDiscountRepoInput) {
  return db.$transaction(async (tx) => {
    if (input.productIds !== undefined) {
      await tx.discountProduct.deleteMany({
        where: { discountId: id },
      });
      if (input.productIds.length > 0) {
        await tx.discountProduct.createMany({
          data: input.productIds.map((productId) => ({
            discountId: id,
            productId,
          })),
        });
      }
    }

    return tx.discount.update({
      where: { id },
      data: {
        name: input.name,
        type: input.type,
        value: input.value,
        minPurchase: input.minPurchase,
        minQty: input.minQty,
        startDate: input.startDate,
        endDate: input.endDate,
        usageLimit: input.usageLimit,
        scope: input.scope,
        isActive: input.isActive,
      },
      include: {
        products: { include: { product: true } },
      },
    });
  });
}

export async function deactivateDiscountRecord(id: string) {
  return db.discount.update({
    where: { id },
    data: { isActive: false },
    include: {
      products: { include: { product: true } },
    },
  });
}

export async function findDiscountById(id: string) {
  return db.discount.findUnique({
    where: { id },
    include: {
      products: { include: { product: true } },
      _count: { select: { applications: true } },
    },
  });
}

export async function listDiscountRecords(input: ListDiscountsRepoInput) {
  const where: Prisma.DiscountWhereInput = {};

  if (input.search?.trim()) {
    where.name = {
      contains: input.search.trim(),
      mode: "insensitive",
    };
  }

  if (input.isActive !== undefined) {
    where.isActive = input.isActive;
  }

  const [items, total] = await Promise.all([
    db.discount.findMany({
      where,
      include: {
        products: { include: { product: true } },
        _count: { select: { applications: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (input.page - 1) * input.pageSize,
      take: input.pageSize,
    }),
    db.discount.count({ where }),
  ]);

  return { items, total };
}

export async function listActiveDiscountsForEvaluation() {
  return db.discount.findMany({
    where: { isActive: true },
    include: {
      products: true,
    },
  });
}

