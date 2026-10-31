"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Role } from "@/generated/prisma/enums";
import { AppError } from "@/server/errors";
import { setSessionCookie, clearSessionCookie } from "@/server/lib/session";
import { sanitizeReturnTo } from "@/lib/urls";
import * as authService from "@/server/modules/auth/service";
import {
  signupSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} from "@/server/modules/auth/schema";

export interface ActionState<T = unknown> {
  success?: boolean;
  data?: T;
  error?: string;
  fieldErrors?: Record<string, string>;
  locked?: boolean;
}

export async function signupAction(
  _prevState: ActionState | null,
  formData: FormData
): Promise<ActionState> {
  const rawData = Object.fromEntries(formData.entries());
  const parsed = signupSchema.safeParse(rawData);

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
      error: "Please fix the errors below.",
      fieldErrors,
    };
  }

  try {
    await authService.signup(parsed.data);
    return { success: true };
  } catch (err) {
    if (err instanceof AppError) {
      if (err.code === "CONFLICT") {
        return {
          success: false,
          error: err.message,
          fieldErrors: { email: err.message },
        };
      }
      return { success: false, error: err.message };
    }
    return { success: false, error: "An unexpected error occurred." };
  }
}

export async function loginAction(
  _prevState: ActionState | null,
  formData: FormData
): Promise<ActionState> {
  const rawData = Object.fromEntries(formData.entries());
  const parsed = loginSchema.safeParse(rawData);

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
      error: "Please enter a valid email and password.",
      fieldErrors,
    };
  }

  const headerList = await headers();
  const ip =
    headerList.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    headerList.get("x-real-ip") ||
    "127.0.0.1";

  let destination = "/login";
  try {
    const { user, token } = await authService.login(parsed.data, ip);
    await setSessionCookie(token);

    const safeReturnTo = sanitizeReturnTo(parsed.data.returnTo);
    destination =
      safeReturnTo || (user.role === Role.CUSTOMER ? "/portal" : "/admin");
  } catch (err) {
    if (err instanceof AppError) {
      if (err.status === 429) {
        return {
          success: false,
          error: err.message,
          locked: true,
        };
      }
      return { success: false, error: err.message };
    }
    return { success: false, error: "An unexpected error occurred." };
  }

  redirect(destination);
}

export async function logoutAction(): Promise<void> {
  await clearSessionCookie();
  redirect("/login");
}

export async function forgotPasswordAction(
  _prevState: ActionState | null,
  formData: FormData
): Promise<ActionState<{ message: string }>> {
  const rawData = Object.fromEntries(formData.entries());
  const parsed = forgotPasswordSchema.safeParse(rawData);

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
      error: "Please provide a valid email address.",
      fieldErrors,
    };
  }

  try {
    const result = await authService.requestPasswordReset(parsed.data);
    return {
      success: true,
      data: { message: result.message },
    };
  } catch (err) {
    if (err instanceof AppError) {
      return { success: false, error: err.message };
    }
    return { success: false, error: "An unexpected error occurred." };
  }
}

export async function resetPasswordAction(
  _prevState: ActionState | null,
  formData: FormData
): Promise<ActionState<{ message: string }>> {
  const rawData = Object.fromEntries(formData.entries());
  const parsed = resetPasswordSchema.safeParse(rawData);

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
      error: "Please provide a valid token and password meeting all rules.",
      fieldErrors,
    };
  }

  try {
    const result = await authService.resetPassword(parsed.data);
    return {
      success: true,
      data: { message: result.message },
    };
  } catch (err) {
    if (err instanceof AppError) {
      return { success: false, error: err.message };
    }
    return { success: false, error: "An unexpected error occurred." };
  }
}
