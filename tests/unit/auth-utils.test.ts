import { describe, it, expect } from "vitest";
import { passwordSchema, checkPasswordRules } from "@/lib/password";
import { sanitizeReturnTo } from "@/lib/urls";

describe("Password policy schema & rules", () => {
  it("rejects passwords with length 8 and accepts length 9", () => {
    // 8 characters (fails)
    const eightChars = "Pass123!";
    expect(eightChars.length).toBe(8);
    const result8 = passwordSchema.safeParse(eightChars);
    expect(result8.success).toBe(false);

    // 9 characters (passes)
    const nineChars = "Pass1234!";
    expect(nineChars.length).toBe(9);
    const result9 = passwordSchema.safeParse(nineChars);
    expect(result9.success).toBe(true);
  });

  it("fails when each required class is missing", () => {
    // Missing uppercase
    const noUpper = "pass12345!";
    const resNoUpper = passwordSchema.safeParse(noUpper);
    expect(resNoUpper.success).toBe(false);

    // Missing lowercase
    const noLower = "PASS12345!";
    const resNoLower = passwordSchema.safeParse(noLower);
    expect(resNoLower.success).toBe(false);

    // Missing special character
    const noSpecial = "Pass123456";
    const resNoSpecial = passwordSchema.safeParse(noSpecial);
    expect(resNoSpecial.success).toBe(false);
  });

  it("returns individual rule status for live UI checklist", () => {
    const rules = checkPasswordRules("Pass1!");
    expect(rules.minLength).toBe(false);
    expect(rules.hasUppercase).toBe(true);
    expect(rules.hasLowercase).toBe(true);
    expect(rules.hasSpecialChar).toBe(true);
    expect(rules.isValid).toBe(false);

    const validRules = checkPasswordRules("ValidPass1!");
    expect(validRules.minLength).toBe(true);
    expect(validRules.hasUppercase).toBe(true);
    expect(validRules.hasLowercase).toBe(true);
    expect(validRules.hasSpecialChar).toBe(true);
    expect(validRules.isValid).toBe(true);
  });
});

describe("returnTo sanitizer", () => {
  it("rejects '//evil.com', 'https://evil.com', and 'javascript:' values", () => {
    expect(sanitizeReturnTo("//evil.com")).toBeNull();
    expect(sanitizeReturnTo("https://evil.com")).toBeNull();
    expect(sanitizeReturnTo("http://evil.com")).toBeNull();
    expect(sanitizeReturnTo("javascript:")).toBeNull();
    expect(sanitizeReturnTo("javascript:alert(1)")).toBeNull();
    expect(sanitizeReturnTo("/\\evil.com")).toBeNull();
    expect(sanitizeReturnTo("")).toBeNull();
    expect(sanitizeReturnTo(null)).toBeNull();
    expect(sanitizeReturnTo(undefined)).toBeNull();
  });

  it("accepts valid relative paths starting with a single '/'", () => {
    expect(sanitizeReturnTo("/admin")).toBe("/admin");
    expect(sanitizeReturnTo("/portal")).toBe("/portal");
    expect(sanitizeReturnTo("/portal?query=1#hash")).toBe("/portal?query=1#hash");
    expect(sanitizeReturnTo("/invoices/inv-001")).toBe("/invoices/inv-001");
  });
});

