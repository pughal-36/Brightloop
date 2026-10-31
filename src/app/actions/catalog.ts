"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/server/lib/session";
import { AppError } from "@/server/errors";
import { parseRupeesToPaise } from "@/lib/money";
import * as catalogService from "@/server/modules/catalog/service";
import {
  createTaxSchema,
  createProductSchema,
  updateProductSchema,
  createVariantSchema,
} from "@/server/modules/catalog/schema";

export interface ActionState<T = unknown> {
  success?: boolean;
  data?: T;
  error?: string;
  fieldErrors?: Record<string, string>;
}

// ───────── Tax Actions ─────────

export async function createTaxAction(
  _prevState: ActionState | null,
  formData: FormData
): Promise<ActionState> {
  const session = await requireSession();
  const rawData = Object.fromEntries(formData.entries());

  // Support rate input either as rateBps (1800) or percentage (18)
  let rateBps = Number(rawData.rateBps);
  if (rawData.ratePercent) {
    rateBps = Math.round(Number(rawData.ratePercent) * 100);
  }

  const parsed = createTaxSchema.safeParse({
    name: rawData.name,
    rateBps,
  });

  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const fieldName = issue.path[0]?.toString() || "form";
      if (!fieldErrors[fieldName]) {
        fieldErrors[fieldName] = issue.message;
      }
    }
    return {
      success: false,
      error: "Please fix the validation errors.",
      fieldErrors,
    };
  }

  try {
    const tax = await catalogService.createTax(session, parsed.data);
    revalidatePath("/admin/taxes");
    return { success: true, data: tax };
  } catch (err) {
    if (err instanceof AppError) {
      return { success: false, error: err.message };
    }
    return { success: false, error: "An unexpected error occurred." };
  }
}

export async function deactivateTaxAction(
  _prevState: ActionState | null,
  formData: FormData
): Promise<ActionState> {
  const session = await requireSession();
  const id = formData.get("id")?.toString();

  if (!id) {
    return { success: false, error: "Tax ID is required" };
  }

  try {
    await catalogService.deactivateTax(session, id);
    revalidatePath("/admin/taxes");
    return { success: true };
  } catch (err) {
    if (err instanceof AppError) {
      return { success: false, error: err.message };
    }
    return { success: false, error: "An unexpected error occurred." };
  }
}

// ───────── Product Actions ─────────

export async function createProductAction(
  _prevState: ActionState | null,
  formData: FormData
): Promise<ActionState> {
  const session = await requireSession();
  const rawData = Object.fromEntries(formData.entries());

  let salesPrice = 0;
  let costPrice = 0;
  try {
    salesPrice = parseRupeesToPaise(rawData.salesPriceRupees?.toString() || "0");
    costPrice = parseRupeesToPaise(rawData.costPriceRupees?.toString() || "0");
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }

  const parsed = createProductSchema.safeParse({
    name: rawData.name,
    type: rawData.type,
    salesPrice,
    costPrice,
    notes: rawData.notes,
    taxId: rawData.taxId || null,
  });

  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const fieldName = issue.path[0]?.toString() || "form";
      if (!fieldErrors[fieldName]) {
        fieldErrors[fieldName] = issue.message;
      }
    }
    return {
      success: false,
      error: "Please fix the validation errors.",
      fieldErrors,
    };
  }

  try {
    const product = await catalogService.createProduct(session, parsed.data);
    revalidatePath("/admin/products");
    return { success: true, data: product };
  } catch (err) {
    if (err instanceof AppError) {
      return { success: false, error: err.message };
    }
    return { success: false, error: "An unexpected error occurred." };
  }
}

export async function updateProductAction(
  _prevState: ActionState | null,
  formData: FormData
): Promise<ActionState> {
  const session = await requireSession();
  const rawData = Object.fromEntries(formData.entries());
  const id = rawData.id?.toString();

  if (!id) {
    return { success: false, error: "Product ID is required" };
  }

  let salesPrice: number | undefined;
  let costPrice: number | undefined;
  if (rawData.salesPriceRupees) {
    salesPrice = parseRupeesToPaise(rawData.salesPriceRupees.toString());
  }
  if (rawData.costPriceRupees) {
    costPrice = parseRupeesToPaise(rawData.costPriceRupees.toString());
  }

  const parsed = updateProductSchema.safeParse({
    name: rawData.name,
    type: rawData.type,
    salesPrice,
    costPrice,
    notes: rawData.notes,
    taxId: rawData.taxId || null,
    isActive: rawData.isActive === "true" ? true : rawData.isActive === "false" ? false : undefined,
  });

  if (!parsed.success) {
    return { success: false, error: "Invalid product update parameters." };
  }

  try {
    const updated = await catalogService.updateProduct(session, id, parsed.data);
    revalidatePath("/admin/products");
    revalidatePath(`/admin/products/${id}`);
    return { success: true, data: updated };
  } catch (err) {
    if (err instanceof AppError) {
      return { success: false, error: err.message };
    }
    return { success: false, error: "An unexpected error occurred." };
  }
}

export async function deactivateProductAction(
  _prevState: ActionState | null,
  formData: FormData
): Promise<ActionState> {
  const session = await requireSession();
  const id = formData.get("id")?.toString();

  if (!id) {
    return { success: false, error: "Product ID is required" };
  }

  try {
    await catalogService.deactivateProduct(session, id);
    revalidatePath("/admin/products");
    revalidatePath(`/admin/products/${id}`);
    return { success: true };
  } catch (err) {
    if (err instanceof AppError) {
      return { success: false, error: err.message };
    }
    return { success: false, error: "An unexpected error occurred." };
  }
}

// ───────── Variant Actions ─────────

export async function createVariantAction(
  _prevState: ActionState | null,
  formData: FormData
): Promise<ActionState> {
  const session = await requireSession();
  const rawData = Object.fromEntries(formData.entries());
  const productId = rawData.productId?.toString();

  if (!productId) {
    return { success: false, error: "Product ID is required" };
  }

  let extraPrice = 0;
  if (rawData.extraPriceRupees !== undefined && rawData.extraPriceRupees !== "") {
    try {
      extraPrice = parseRupeesToPaise(rawData.extraPriceRupees.toString());
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  }

  const parsed = createVariantSchema.safeParse({
    attribute: rawData.attribute,
    value: rawData.value,
    extraPrice,
  });

  if (!parsed.success) {
    return { success: false, error: "Attribute and value are required." };
  }

  try {
    const variant = await catalogService.createVariant(session, productId, parsed.data);
    revalidatePath("/admin/products");
    revalidatePath(`/admin/products/${productId}`);
    return { success: true, data: variant };
  } catch (err) {
    if (err instanceof AppError) {
      return { success: false, error: err.message };
    }
    return { success: false, error: "An unexpected error occurred." };
  }
}

export async function deleteVariantAction(
  _prevState: ActionState | null,
  formData: FormData
): Promise<ActionState> {
  const session = await requireSession();
  const id = formData.get("id")?.toString();
  const productId = formData.get("productId")?.toString();

  if (!id) {
    return { success: false, error: "Variant ID is required" };
  }

  try {
    await catalogService.deleteVariant(session, id);
    if (productId) {
      revalidatePath(`/admin/products/${productId}`);
    }
    revalidatePath("/admin/products");
    return { success: true };
  } catch (err) {
    if (err instanceof AppError) {
      return { success: false, error: err.message };
    }
    return { success: false, error: "An unexpected error occurred." };
  }
}
