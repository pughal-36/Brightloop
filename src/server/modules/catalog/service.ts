import "server-only";
import { AppError } from "@/server/errors";
import { requireRole, type Session } from "@/server/lib/session";
import { Role, ProductType } from "@/generated/prisma/enums";
import { add, sub } from "@/lib/money";
import {
  createTaxRecord,
  updateTaxRecord,
  findTaxById,
  listTaxRecords,
  createProductRecord,
  updateProductRecord,
  findProductById,
  listProductRecords,
  createVariantRecord,
  updateVariantRecord,
  deleteVariantRecord,
  findVariantById,
} from "./repo";
import {
  createTaxSchema,
  updateTaxSchema,
  listTaxesSchema,
  createProductSchema,
  updateProductSchema,
  listProductsSchema,
  createVariantSchema,
  updateVariantSchema,
} from "./schema";

// ───────── Price Calculation Helpers ─────────

export function calculateEffectiveUnitPrice(
  salesPrice: number,
  extraPrice: number = 0
): number {
  return add(salesPrice, extraPrice);
}

export function calculateMargin(salesPrice: number, costPrice: number): number {
  return sub(salesPrice, costPrice);
}

// ───────── Tax Service ─────────

export async function createTax(session: Session, rawInput: unknown) {
  requireRole(session, Role.ADMIN);

  const input = createTaxSchema.parse(rawInput);
  return createTaxRecord({
    name: input.name.trim(),
    rateBps: input.rateBps,
  });
}

export async function updateTax(
  session: Session,
  id: string,
  rawInput: unknown
) {
  requireRole(session, Role.ADMIN);

  const input = updateTaxSchema.parse(rawInput);
  const existing = await findTaxById(id);
  if (!existing) {
    throw new AppError("NOT_FOUND", 404, "Tax not found");
  }

  return updateTaxRecord(id, {
    name: input.name ? input.name.trim() : undefined,
    rateBps: input.rateBps,
    isActive: input.isActive,
  });
}

export async function deactivateTax(session: Session, id: string) {
  requireRole(session, Role.ADMIN);

  const existing = await findTaxById(id);
  if (!existing) {
    throw new AppError("NOT_FOUND", 404, "Tax not found");
  }

  return updateTaxRecord(id, { isActive: false });
}

export async function getTax(session: Session, id: string) {
  requireRole(session, Role.ADMIN, Role.STAFF);

  const tax = await findTaxById(id);
  if (!tax) {
    throw new AppError("NOT_FOUND", 404, "Tax not found");
  }
  return tax;
}

export async function listTaxes(session: Session, rawInput?: unknown) {
  requireRole(session, Role.ADMIN, Role.STAFF);

  const input = listTaxesSchema.parse(rawInput ?? {});
  const { items, total } = await listTaxRecords(input);

  const totalPages = Math.ceil(total / input.pageSize);
  return {
    items,
    total,
    page: input.page,
    pageSize: input.pageSize,
    totalPages,
  };
}

// ───────── Product Service ─────────

export async function createProduct(session: Session, rawInput: unknown) {
  requireRole(session, Role.ADMIN);

  const input = createProductSchema.parse(rawInput);

  if (input.taxId) {
    const tax = await findTaxById(input.taxId);
    if (!tax) {
      throw new AppError("VALIDATION", 422, "Referenced tax does not exist");
    }
  }

  return createProductRecord({
    name: input.name.trim(),
    type: input.type,
    salesPrice: input.salesPrice,
    costPrice: input.costPrice,
    notes: input.notes?.trim() || null,
    taxId: input.taxId?.trim() || null,
  });
}

export async function updateProduct(
  session: Session,
  id: string,
  rawInput: unknown
) {
  requireRole(session, Role.ADMIN);

  const input = updateProductSchema.parse(rawInput);

  const existing = await findProductById(id);
  if (!existing) {
    throw new AppError("NOT_FOUND", 404, "Product not found");
  }

  if (input.taxId) {
    const tax = await findTaxById(input.taxId);
    if (!tax) {
      throw new AppError("VALIDATION", 422, "Referenced tax does not exist");
    }
  }

  return updateProductRecord(id, {
    name: input.name ? input.name.trim() : undefined,
    type: input.type,
    salesPrice: input.salesPrice,
    costPrice: input.costPrice,
    notes: input.notes !== undefined ? (input.notes?.trim() || null) : undefined,
    taxId: input.taxId !== undefined ? (input.taxId?.trim() || null) : undefined,
    isActive: input.isActive,
  });
}

export async function deactivateProduct(session: Session, id: string) {
  requireRole(session, Role.ADMIN);

  const existing = await findProductById(id);
  if (!existing) {
    throw new AppError("NOT_FOUND", 404, "Product not found");
  }

  return updateProductRecord(id, { isActive: false });
}

export interface VariantWithEffectivePrice {
  id: string;
  productId: string;
  attribute: string;
  value: string;
  extraPrice: number;
  effectivePrice: number;
}

export interface ProductDetailResult {
  id: string;
  name: string;
  type: ProductType;
  salesPrice: number;
  costPrice?: number;
  margin?: number;
  notes: string | null;
  taxId: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  tax: { id: string; name: string; rateBps: number; isActive: boolean } | null;
  variants: VariantWithEffectivePrice[];
}

export async function getProduct(
  session: Session,
  id: string
): Promise<ProductDetailResult> {
  requireRole(session, Role.ADMIN, Role.STAFF);

  const product = await findProductById(id);
  if (!product) {
    throw new AppError("NOT_FOUND", 404, "Product not found");
  }

  const isAdmin = session.user.role === Role.ADMIN;
  const margin = isAdmin ? calculateMargin(product.salesPrice, product.costPrice) : undefined;

  const variantsWithEffectivePrices: VariantWithEffectivePrice[] = product.variants.map((v) => ({
    ...v,
    effectivePrice: calculateEffectiveUnitPrice(product.salesPrice, v.extraPrice),
  }));

  return {
    id: product.id,
    name: product.name,
    type: product.type,
    salesPrice: product.salesPrice,
    costPrice: isAdmin ? product.costPrice : undefined,
    margin,
    notes: product.notes,
    taxId: product.taxId,
    isActive: product.isActive,
    createdAt: product.createdAt,
    updatedAt: product.updatedAt,
    tax: product.tax,
    variants: variantsWithEffectivePrices,
  };
}

export async function listProducts(
  session: Session,
  rawInput?: unknown
): Promise<{
  items: ProductDetailResult[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}> {
  requireRole(session, Role.ADMIN, Role.STAFF);

  const input = listProductsSchema.parse(rawInput ?? {});
  const { items, total } = await listProductRecords(input);

  const isAdmin = session.user.role === Role.ADMIN;
  const totalPages = Math.ceil(total / input.pageSize);

  const formattedItems: ProductDetailResult[] = items.map((product) => {
    const margin = isAdmin ? calculateMargin(product.salesPrice, product.costPrice) : undefined;
    const variantsWithEffectivePrices: VariantWithEffectivePrice[] = product.variants.map((v) => ({
      ...v,
      effectivePrice: calculateEffectiveUnitPrice(product.salesPrice, v.extraPrice),
    }));

    return {
      id: product.id,
      name: product.name,
      type: product.type,
      salesPrice: product.salesPrice,
      costPrice: isAdmin ? product.costPrice : undefined,
      margin,
      notes: product.notes,
      taxId: product.taxId,
      isActive: product.isActive,
      createdAt: product.createdAt,
      updatedAt: product.updatedAt,
      tax: product.tax,
      variants: variantsWithEffectivePrices,
    };
  });

  return {
    items: formattedItems,
    total,
    page: input.page,
    pageSize: input.pageSize,
    totalPages,
  };
}

// ───────── Variant Service ─────────

export async function createVariant(
  session: Session,
  productId: string,
  rawInput: unknown
) {
  requireRole(session, Role.ADMIN);

  const input = createVariantSchema.parse(rawInput);

  const product = await findProductById(productId);
  if (!product) {
    throw new AppError("NOT_FOUND", 404, "Product not found");
  }

  const existingVariant = product.variants.find(
    (v) =>
      v.attribute.toLowerCase() === input.attribute.trim().toLowerCase() &&
      v.value.toLowerCase() === input.value.trim().toLowerCase()
  );

  if (existingVariant) {
    throw new AppError(
      "CONFLICT",
      409,
      `Variant '${input.attribute}: ${input.value}' already exists for this product`
    );
  }

  const variant = await createVariantRecord({
    productId,
    attribute: input.attribute.trim(),
    value: input.value.trim(),
    extraPrice: input.extraPrice,
  });

  return {
    ...variant,
    effectivePrice: calculateEffectiveUnitPrice(product.salesPrice, variant.extraPrice),
  };
}

export async function updateVariant(
  session: Session,
  id: string,
  rawInput: unknown
) {
  requireRole(session, Role.ADMIN);

  const input = updateVariantSchema.parse(rawInput);
  const existing = await findVariantById(id);
  if (!existing) {
    throw new AppError("NOT_FOUND", 404, "Variant not found");
  }

  const updated = await updateVariantRecord(id, {
    attribute: input.attribute ? input.attribute.trim() : undefined,
    value: input.value ? input.value.trim() : undefined,
    extraPrice: input.extraPrice,
  });

  const product = await findProductById(updated.productId);
  const salesPrice = product?.salesPrice ?? 0;

  return {
    ...updated,
    effectivePrice: calculateEffectiveUnitPrice(salesPrice, updated.extraPrice),
  };
}

export async function deleteVariant(session: Session, id: string) {
  requireRole(session, Role.ADMIN);

  const existing = await findVariantById(id);
  if (!existing) {
    throw new AppError("NOT_FOUND", 404, "Variant not found");
  }

  await deleteVariantRecord(id);
  return { success: true };
}
