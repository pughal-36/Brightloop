import { z } from "zod";
import { ProductType } from "@/generated/prisma/enums";

export const createTaxSchema = z.object({
  name: z.string().trim().min(1, "Tax name is required"),
  rateBps: z.coerce
    .number()
    .int("Rate basis points must be an integer")
    .min(0, "Rate cannot be negative")
    .max(10000, "Rate cannot exceed 10000 basis points (100%)"),
});

export type CreateTaxInput = z.infer<typeof createTaxSchema>;

export const updateTaxSchema = z.object({
  name: z.string().trim().min(1, "Tax name cannot be empty").optional(),
  rateBps: z.coerce
    .number()
    .int("Rate basis points must be an integer")
    .min(0, "Rate cannot be negative")
    .max(10000, "Rate cannot exceed 10000 basis points (100%)")
    .optional(),
  isActive: z.boolean().optional(),
});

export type UpdateTaxInput = z.infer<typeof updateTaxSchema>;

export const listTaxesSchema = z.object({
  search: z.string().trim().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  isActive: z.coerce.boolean().optional(),
});

export type ListTaxesInput = z.infer<typeof listTaxesSchema>;

export const createProductSchema = z.object({
  name: z.string().trim().min(1, "Product name is required"),
  type: z.nativeEnum(ProductType, {
    message: "Invalid product type",
  }),
  salesPrice: z.coerce
    .number()
    .int("Sales price must be an integer in paise")
    .min(0, "Sales price cannot be negative"),
  costPrice: z.coerce
    .number()
    .int("Cost price must be an integer in paise")
    .min(0, "Cost price cannot be negative"),
  notes: z.string().trim().optional().nullable(),
  taxId: z.string().trim().optional().nullable(),
});

export type CreateProductInput = z.infer<typeof createProductSchema>;

export const updateProductSchema = z.object({
  name: z.string().trim().min(1, "Product name cannot be empty").optional(),
  type: z.nativeEnum(ProductType).optional(),
  salesPrice: z.coerce
    .number()
    .int("Sales price must be an integer in paise")
    .min(0, "Sales price cannot be negative")
    .optional(),
  costPrice: z.coerce
    .number()
    .int("Cost price must be an integer in paise")
    .min(0, "Cost price cannot be negative")
    .optional(),
  notes: z.string().trim().optional().nullable(),
  taxId: z.string().trim().optional().nullable(),
  isActive: z.boolean().optional(),
});

export type UpdateProductInput = z.infer<typeof updateProductSchema>;

export const createVariantSchema = z.object({
  attribute: z.string().trim().min(1, "Attribute name is required (e.g. Brand)"),
  value: z.string().trim().min(1, "Variant value is required (e.g. Odoo)"),
  extraPrice: z.coerce
    .number()
    .int("Extra price must be an integer in paise")
    .default(0),
});

export type CreateVariantInput = z.infer<typeof createVariantSchema>;

export const updateVariantSchema = z.object({
  attribute: z.string().trim().min(1, "Attribute name cannot be empty").optional(),
  value: z.string().trim().min(1, "Variant value cannot be empty").optional(),
  extraPrice: z.coerce
    .number()
    .int("Extra price must be an integer in paise")
    .optional(),
});

export type UpdateVariantInput = z.infer<typeof updateVariantSchema>;

export const listProductsSchema = z.object({
  search: z.string().trim().optional(),
  type: z.nativeEnum(ProductType).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(10),
  isActive: z.coerce.boolean().optional(),
});

export type ListProductsInput = z.infer<typeof listProductsSchema>;
