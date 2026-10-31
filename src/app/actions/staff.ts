"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/server/lib/session";
import { AppError } from "@/server/errors";
import * as staffService from "@/server/modules/staff/service";
import { createStaffSchema, deactivateStaffSchema } from "@/server/modules/staff/schema";

export interface ActionState<T = unknown> {
  success?: boolean;
  data?: T;
  error?: string;
  fieldErrors?: Record<string, string>;
}

export async function createStaffAction(
  _prevState: ActionState | null,
  formData: FormData
): Promise<ActionState> {
  const session = await requireSession();
  const rawData = Object.fromEntries(formData.entries());
  const parsed = createStaffSchema.safeParse(rawData);

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
    const result = await staffService.createStaff(session, parsed.data);
    revalidatePath("/admin/staff");
    return {
      success: true,
      data: result,
    };
  } catch (err) {
    if (err instanceof AppError) {
      return { success: false, error: err.message };
    }
    return { success: false, error: "An unexpected error occurred." };
  }
}

export async function deactivateStaffAction(
  _prevState: ActionState | null,
  formData: FormData
): Promise<ActionState> {
  const session = await requireSession();
  const rawData = Object.fromEntries(formData.entries());
  const parsed = deactivateStaffSchema.safeParse(rawData);

  if (!parsed.success) {
    return { success: false, error: "Invalid user ID" };
  }

  try {
    await staffService.deactivateStaff(session, parsed.data);
    revalidatePath("/admin/staff");
    return { success: true };
  } catch (err) {
    if (err instanceof AppError) {
      return { success: false, error: err.message };
    }
    return { success: false, error: "An unexpected error occurred." };
  }
}

