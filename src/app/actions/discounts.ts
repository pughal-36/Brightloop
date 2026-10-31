"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/server/lib/session";
import { AppError } from "@/server/errors";
import { parseRupeesToPaise } from "@/lib/money";
import { DiscountType } from "@/generated/prisma/client";
import * as discountService from "@/server/modules/discounts/service";
import { createDiscountSchema } from "@/server/modules/discounts/schema";

export interface ActionState<T = unknown> {
  success?: boolean;
  data?: T;
  error?: string;
  fieldErrors?: Record<string, string>;
}

export async function createDiscountAction(
  _prevState: ActionState | null,
  formData: FormData
): Promise<ActionState> {
  const session = await requireSession();
  const rawData = Object.fromEntries(formData.entries());

  let value = 0;
  try {
    if (rawData.type === DiscountType.FIXED) {
      value = parseRupeesToPaise(rawData.valueRupees?.toString() || "0");
    } else {
      // Percentage input in percent (e.g. 10.5%), converted to basis points (1050)
      const pct = parseFloat(rawData.valuePercent?.toString() || "0");
      value = Math.round(pct * 100);
    }
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }

  let minPurchase: number | null = null;
  if (rawData.minPurchaseRupees && rawData.minPurchaseRupees.toString().trim() !== "") {
    try {
      minPurchase = parseRupeesToPaise(rawData.minPurchaseRupees.toString());
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  }

  let productIds: string[] | undefined;
  const productIdsRaw = formData.getAll("productIds");
  if (productIdsRaw.length > 0) {
    productIds = productIdsRaw.map((p) => p.toString());
  }

  const parsed = createDiscountSchema.safeParse({
    name: rawData.name,
    type: rawData.type,
    value,
    minPurchase,
    minQty: rawData.minQty ? parseInt(rawData.minQty.toString(), 10) : null,
    startDate: rawData.startDate,
    endDate: rawData.endDate,
    usageLimit: rawData.usageLimit ? parseInt(rawData.usageLimit.toString(), 10) : undefined,
    scope: rawData.scope,
    productIds,
  });

  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const fieldName = issue.path[0]?.toString() || "form";
      fieldErrors[fieldName] = issue.message;
    }
    return { success: false, error: "Validation failed", fieldErrors };
  }

  try {
    const disc = await discountService.createDiscount(session, parsed.data);
    revalidatePath("/admin/discounts");
    return { success: true, data: disc };
  } catch (err) {
    if (err instanceof AppError) {
      return { success: false, error: err.message };
    }
    return { success: false, error: "An unexpected error occurred." };
  }
}

export async function deactivateDiscountAction(
  _prevState: ActionState | null,
  formData: FormData
): Promise<ActionState> {
  const session = await requireSession();
  const id = formData.get("id")?.toString();
  if (!id) {
    return { success: false, error: "Discount ID is required" };
  }

  try {
    await discountService.deactivateDiscount(session, id);
    revalidatePath("/admin/discounts");
    return { success: true };
  } catch (err) {
    if (err instanceof AppError) {
      return { success: false, error: err.message };
    }
    return { success: false, error: "An unexpected error occurred." };
  }
}
