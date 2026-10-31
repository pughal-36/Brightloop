import { z } from "zod";

export interface PasswordRulesResult {
  minLength: boolean;
  hasUppercase: boolean;
  hasLowercase: boolean;
  hasSpecialChar: boolean;
  isValid: boolean;
}

export function checkPasswordRules(password: string): PasswordRulesResult {
  const minLength = password.length >= 9;
  const hasUppercase = /[A-Z]/.test(password);
  const hasLowercase = /[a-z]/.test(password);
  const hasSpecialChar = /[^A-Za-z0-9]/.test(password);

  return {
    minLength,
    hasUppercase,
    hasLowercase,
    hasSpecialChar,
    isValid: minLength && hasUppercase && hasLowercase && hasSpecialChar,
  };
}

export const passwordSchema = z
  .string()
  .min(9, "Password must be at least 9 characters long")
  .refine((val) => /[A-Z]/.test(val), {
    message: "Password must contain at least one uppercase letter",
  })
  .refine((val) => /[a-z]/.test(val), {
    message: "Password must contain at least one lowercase letter",
  })
  .refine((val) => /[^A-Za-z0-9]/.test(val), {
    message: "Password must contain at least one special character",
  });

