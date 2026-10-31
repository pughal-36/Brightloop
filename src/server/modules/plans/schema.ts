import { z } from "zod";
import { BillingPeriod } from "@/generated/prisma/enums";

export const createPlanSchema = z
  .object({
    name: z.string().trim().min(1, "Plan name is required"),
    price: z.coerce
      .number()
      .int("Plan price must be an integer in paise")
      .min(0, "Plan price cannot be negative"),
    billingPeriod: z.nativeEnum(BillingPeriod, {
      message: "Invalid billing period",
    }),
    minQty: z.coerce
      .number()
      .int("Minimum quantity must be an integer")
      .min(1, "Minimum quantity must be at least 1")
      .default(1),
    availableFrom: z.coerce.date({
      message: "Invalid start date",
    }),
    availableTo: z.coerce
      .date()
      .nullable()
      .optional(),
    autoClose: z.coerce.boolean().default(false),
    closable: z.coerce.boolean().default(false),
    pausable: z.coerce.boolean().default(false),
    renewable: z.coerce.boolean().default(false),
    taxId: z.string().trim().nullable().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.availableTo && data.availableTo < data.availableFrom) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "availableTo must be greater than or equal to availableFrom",
        path: ["availableTo"],
      });
    }
  });

export type CreatePlanInput = z.infer<typeof createPlanSchema>;

export const updatePlanSchema = z
  .object({
    name: z.string().trim().min(1, "Plan name cannot be empty").optional(),
    price: z.coerce
      .number()
      .int("Plan price must be an integer in paise")
      .min(0, "Plan price cannot be negative")
      .optional(),
    billingPeriod: z.nativeEnum(BillingPeriod).optional(),
    minQty: z.coerce
      .number()
      .int("Minimum quantity must be an integer")
      .min(1, "Minimum quantity must be at least 1")
      .optional(),
    availableFrom: z.coerce.date().optional(),
    availableTo: z.coerce.date().nullable().optional(),
    autoClose: z.coerce.boolean().optional(),
    closable: z.coerce.boolean().optional(),
    pausable: z.coerce.boolean().optional(),
    renewable: z.coerce.boolean().optional(),
    taxId: z.string().trim().nullable().optional(),
    isActive: z.boolean().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.availableFrom && data.availableTo && data.availableTo < data.availableFrom) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "availableTo must be greater than or equal to availableFrom",
        path: ["availableTo"],
      });
    }
  });

export type UpdatePlanInput = z.infer<typeof updatePlanSchema>;

export const listPlansSchema = z.object({
  search: z.string().trim().optional(),
  billingPeriod: z.nativeEnum(BillingPeriod).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(10),
  isActive: z.coerce.boolean().optional(),
});

export type ListPlansInput = z.infer<typeof listPlansSchema>;
