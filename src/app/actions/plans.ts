"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/server/lib/session";
import { AppError } from "@/server/errors";
import { parseRupeesToPaise } from "@/lib/money";
import * as planService from "@/server/modules/plans/service";
import { createPlanSchema } from "@/server/modules/plans/schema";

export interface ActionState<T = unknown> {
  success?: boolean;
  data?: T;
  error?: string;
  fieldErrors?: Record<string, string>;
}

export async function createPlanAction(
  _prevState: ActionState | null,
  formData: FormData
): Promise<ActionState> {
  const session = await requireSession();
  const rawData = Object.fromEntries(formData.entries());

  let price = 0;
  try {
    price = parseRupeesToPaise(rawData.priceRupees?.toString() || "0");
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }

  const parsed = createPlanSchema.safeParse({
    name: rawData.name,
    price,
    billingPeriod: rawData.billingPeriod,
    minQty: rawData.minQty,
    availableFrom: rawData.availableFrom,
    availableTo: rawData.availableTo || null,
    autoClose: rawData.autoClose === "on" || rawData.autoClose === "true",
    closable: rawData.closable === "on" || rawData.closable === "true",
    pausable: rawData.pausable === "on" || rawData.pausable === "true",
    renewable: rawData.renewable === "on" || rawData.renewable === "true",
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
    const plan = await planService.createPlan(session, parsed.data);
    revalidatePath("/admin/plans");
    return { success: true, data: plan };
  } catch (err) {
    if (err instanceof AppError) {
      return { success: false, error: err.message };
    }
    return { success: false, error: "An unexpected error occurred." };
  }
}

export async function deactivatePlanAction(
  _prevState: ActionState | null,
  formData: FormData
): Promise<ActionState> {
  const session = await requireSession();
  const id = formData.get("id")?.toString();

  if (!id) {
    return { success: false, error: "Plan ID is required" };
  }

  try {
    await planService.deactivatePlan(session, id);
    revalidatePath("/admin/plans");
    return { success: true };
  } catch (err) {
    if (err instanceof AppError) {
      return { success: false, error: err.message };
    }
    return { success: false, error: "An unexpected error occurred." };
  }
}
