"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/server/lib/session";
import { AppError } from "@/server/errors";
import * as subService from "@/server/modules/subscriptions/service";
import {
  createBlankSubscriptionSchema,
  createFromTemplateSchema,
  updateDraftSubscriptionSchema,
  transitionSubscriptionSchema,
  createTemplateSchema,
  updateTemplateSchema,
} from "@/server/modules/subscriptions/schema";

export interface ActionState<T = unknown> {
  success?: boolean;
  data?: T;
  error?: string;
  fieldErrors?: Record<string, string>;
}

export async function createBlankSubscriptionAction(
  _prevState: ActionState | null,
  payload: unknown
): Promise<ActionState> {
  const session = await requireSession();
  const parsed = createBlankSubscriptionSchema.safeParse(payload);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const fieldName = issue.path.join(".") || "form";
      fieldErrors[fieldName] = issue.message;
    }
    return { success: false, error: "Validation failed", fieldErrors };
  }

  try {
    const sub = await subService.createSubscriptionBlank(session, parsed.data);
    revalidatePath("/admin/subscriptions");
    return { success: true, data: sub };
  } catch (err) {
    if (err instanceof AppError) {
      return { success: false, error: err.message };
    }
    return { success: false, error: "An unexpected error occurred." };
  }
}

export async function createFromTemplateAction(
  _prevState: ActionState | null,
  payload: unknown
): Promise<ActionState> {
  const session = await requireSession();
  const parsed = createFromTemplateSchema.safeParse(payload);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const fieldName = issue.path.join(".") || "form";
      fieldErrors[fieldName] = issue.message;
    }
    return { success: false, error: "Validation failed", fieldErrors };
  }

  try {
    const sub = await subService.createSubscriptionFromTemplate(session, parsed.data);
    revalidatePath("/admin/subscriptions");
    return { success: true, data: sub };
  } catch (err) {
    if (err instanceof AppError) {
      return { success: false, error: err.message };
    }
    return { success: false, error: "An unexpected error occurred." };
  }
}

export async function updateDraftSubscriptionAction(
  id: string,
  payload: unknown
): Promise<ActionState> {
  const session = await requireSession();
  const parsed = updateDraftSubscriptionSchema.safeParse(payload);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const fieldName = issue.path.join(".") || "form";
      fieldErrors[fieldName] = issue.message;
    }
    return { success: false, error: "Validation failed", fieldErrors };
  }

  try {
    const sub = await subService.updateDraftSubscription(session, id, parsed.data);
    revalidatePath(`/admin/subscriptions/${id}`);
    revalidatePath("/admin/subscriptions");
    return { success: true, data: sub };
  } catch (err) {
    if (err instanceof AppError) {
      return { success: false, error: err.message };
    }
    return { success: false, error: "An unexpected error occurred." };
  }
}

export async function deleteDraftSubscriptionAction(id: string): Promise<ActionState> {
  const session = await requireSession();
  try {
    await subService.deleteDraftSubscription(session, id);
    revalidatePath("/admin/subscriptions");
    return { success: true };
  } catch (err) {
    if (err instanceof AppError) {
      return { success: false, error: err.message };
    }
    return { success: false, error: "An unexpected error occurred." };
  }
}

export async function transitionSubscriptionAction(
  payload: unknown
): Promise<ActionState> {
  const session = await requireSession();
  const parsed = transitionSubscriptionSchema.safeParse(payload);
  if (!parsed.success) {
    return { success: false, error: "Invalid transition parameters" };
  }

  try {
    const sub = await subService.transitionSubscription(session, parsed.data);
    revalidatePath(`/admin/subscriptions/${parsed.data.subscriptionId}`);
    revalidatePath("/admin/subscriptions");
    return { success: true, data: sub };
  } catch (err) {
    if (err instanceof AppError) {
      return { success: false, error: err.message };
    }
    return { success: false, error: "An unexpected error occurred." };
  }
}

export async function createQuotationTemplateAction(
  _prevState: ActionState | null,
  payload: unknown
): Promise<ActionState> {
  const session = await requireSession();
  const parsed = createTemplateSchema.safeParse(payload);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const fieldName = issue.path.join(".") || "form";
      fieldErrors[fieldName] = issue.message;
    }
    return { success: false, error: "Validation failed", fieldErrors };
  }

  try {
    const tmpl = await subService.createQuotationTemplate(session, parsed.data);
    revalidatePath("/admin/subscriptions");
    return { success: true, data: tmpl };
  } catch (err) {
    if (err instanceof AppError) {
      return { success: false, error: err.message };
    }
    return { success: false, error: "An unexpected error occurred." };
  }
}

export async function updateQuotationTemplateAction(
  id: string,
  payload: unknown
): Promise<ActionState> {
  const session = await requireSession();
  const parsed = updateTemplateSchema.safeParse(payload);
  if (!parsed.success) {
    return { success: false, error: "Validation failed" };
  }

  try {
    const tmpl = await subService.updateQuotationTemplate(session, id, parsed.data);
    revalidatePath("/admin/subscriptions");
    return { success: true, data: tmpl };
  } catch (err) {
    if (err instanceof AppError) {
      return { success: false, error: err.message };
    }
    return { success: false, error: "An unexpected error occurred." };
  }
}

