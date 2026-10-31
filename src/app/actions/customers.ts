"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/server/lib/session";
import { AppError } from "@/server/errors";
import * as customerService from "@/server/modules/customers/service";
import {
  createCustomerSchema,
  updateCustomerSchema,
} from "@/server/modules/customers/schema";

export interface ActionState<T = unknown> {
  success?: boolean;
  data?: T;
  error?: string;
  fieldErrors?: Record<string, string>;
}

export async function createCustomerAction(
  _prevState: ActionState | null,
  formData: FormData
): Promise<ActionState> {
  const session = await requireSession();
  const rawData = Object.fromEntries(formData.entries());
  const parsed = createCustomerSchema.safeParse(rawData);

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
    const customer = await customerService.createCustomer(session, parsed.data);
    revalidatePath("/admin/customers");
    return { success: true, data: customer };
  } catch (err) {
    if (err instanceof AppError) {
      return { success: false, error: err.message };
    }
    return { success: false, error: "An unexpected error occurred." };
  }
}

export async function updateCustomerAction(
  _prevState: ActionState | null,
  formData: FormData
): Promise<ActionState> {
  const session = await requireSession();
  const rawData = Object.fromEntries(formData.entries());
  const id = rawData.id?.toString();

  if (!id) {
    return { success: false, error: "Customer ID is required" };
  }

  const parsed = updateCustomerSchema.safeParse({
    name: rawData.name,
    email: rawData.email,
    phone: rawData.phone,
    billingAddress: rawData.billingAddress,
    isActive: rawData.isActive === "true" ? true : rawData.isActive === "false" ? false : undefined,
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
    const updated = await customerService.updateCustomer(session, id, parsed.data);
    revalidatePath("/admin/customers");
    return { success: true, data: updated };
  } catch (err) {
    if (err instanceof AppError) {
      return { success: false, error: err.message };
    }
    return { success: false, error: "An unexpected error occurred." };
  }
}
