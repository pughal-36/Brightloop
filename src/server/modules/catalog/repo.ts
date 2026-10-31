import "server-only";
import { db } from "@/server/db";
import type { Prisma } from "@/generated/prisma/client";
import type { ProductType } from "@/generated/prisma/enums";

// ───────── Tax Repo ─────────

export async function createTaxRecord(data: { name: string; rateBps: number }) {
  return db.tax.create({
    data: {
      name: data.name,
      rateBps: data.rateBps,
      isActive: true,
    },
  });
}

export async function updateTaxRecord(
  id: string,
  data: { name?: string; rateBps?: number; isActive?: boolean }
) {
  return db.tax.update({
    where: { id },
    data,
  });
}

export async function findTaxById(id: string) {
  return db.tax.findUnique({
    where: { id },
  });
}

export async function listTaxRecords(options: {
  search?: string;
  page: number;
  pageSize: number;
  isActive?: boolean;
}) {
  const { search, page, pageSize, isActive } = options;
  const where: Prisma.TaxWhereInput = {};

  if (isActive !== undefined) {
    where.isActive = isActive;
  }
  if (search && search.trim() !== "") {
    where.name = { contains: search.trim(), mode: "insensitive" };
  }

  const [items, total] = await Promise.all([
    db.tax.findMany({
      where,
      orderBy: { name: "asc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    db.tax.count({ where }),
  ]);

  return { items, total };
}

// ───────── Product & Variant Repo ─────────

export async function createProductRecord(data: {
  name: string;
  type: ProductType;
  salesPrice: number;
  costPrice: number;
  notes?: string | null;
  taxId?: string | null;
}) {
  return db.product.create({
    data: {
      name: data.name,
      type: data.type,
      salesPrice: data.salesPrice,
      costPrice: data.costPrice,
      notes: data.notes,
      taxId: data.taxId,
      isActive: true,
    },
    include: {
      tax: true,
      variants: true,
    },
  });
}

export async function updateProductRecord(
  id: string,
  data: {
    name?: string;
    type?: ProductType;
    salesPrice?: number;
    costPrice?: number;
    notes?: string | null;
    taxId?: string | null;
    isActive?: boolean;
  }
) {
  return db.product.update({
    where: { id },
    data,
    include: {
      tax: true,
      variants: true,
    },
  });
}

export async function findProductById(id: string) {
  return db.product.findUnique({
    where: { id },
    include: {
      tax: true,
      variants: {
        orderBy: [{ attribute: "asc" }, { value: "asc" }],
      },
    },
  });
}

export async function listProductRecords(options: {
  search?: string;
  type?: ProductType;
  page: number;
  pageSize: number;
  isActive?: boolean;
}) {
  const { search, type, page, pageSize, isActive } = options;
  const where: Prisma.ProductWhereInput = {};

  if (isActive !== undefined) {
    where.isActive = isActive;
  }
  if (type) {
    where.type = type;
  }
  if (search && search.trim() !== "") {
    where.OR = [
      { name: { contains: search.trim(), mode: "insensitive" } },
      { notes: { contains: search.trim(), mode: "insensitive" } },
    ];
  }

  const [items, total] = await Promise.all([
    db.product.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        tax: true,
        variants: true,
      },
    }),
    db.product.count({ where }),
  ]);

  return { items, total };
}

export async function createVariantRecord(data: {
  productId: string;
  attribute: string;
  value: string;
  extraPrice: number;
}) {
  return db.productVariant.create({
    data: {
      productId: data.productId,
      attribute: data.attribute,
      value: data.value,
      extraPrice: data.extraPrice,
    },
  });
}

export async function updateVariantRecord(
  id: string,
  data: {
    attribute?: string;
    value?: string;
    extraPrice?: number;
  }
) {
  return db.productVariant.update({
    where: { id },
    data,
  });
}

export async function deleteVariantRecord(id: string) {
  return db.productVariant.delete({
    where: { id },
  });
}

export async function findVariantById(id: string) {
  return db.productVariant.findUnique({
    where: { id },
  });
}
