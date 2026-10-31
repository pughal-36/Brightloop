import "server-only";
import { z } from "zod";
import {
  passwordSchema,
  checkPasswordRules,
  type PasswordRulesResult,
} from "@/lib/password";

export { passwordSchema, checkPasswordRules, type PasswordRulesResult };

export const signupSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  email: z.string().trim().email("Invalid email address"),
  password: passwordSchema,
  role: z.any().optional(), // Ignored in service logic, always CUSTOMER
});

export type SignupInput = z.infer<typeof signupSchema>;

export const loginSchema = z.object({
  email: z.string().trim().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
  returnTo: z.string().optional().nullable(),
});

export type LoginInput = z.infer<typeof loginSchema>;

export const forgotPasswordSchema = z.object({
  email: z.string().trim().email("Invalid email address"),
});

export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

export const resetPasswordSchema = z.object({
  token: z.string().min(1, "Reset token is required"),
  password: passwordSchema,
});

export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

