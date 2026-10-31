import { z } from "zod";

export const createCustomerSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  email: z.string().trim().email("Invalid email address").toLowerCase(),
  phone: z.string().trim().optional().nullable(),
  billingAddress: z.string().trim().optional().nullable(),
});

export type CreateCustomerInput = z.infer<typeof createCustomerSchema>;

export const updateCustomerSchema = z.object({
  name: z.string().trim().min(1, "Name cannot be empty").optional(),
  email: z.string().trim().email("Invalid email address").toLowerCase().optional(),
  phone: z.string().trim().optional().nullable(),
  billingAddress: z.string().trim().optional().nullable(),
  isActive: z.boolean().optional(),
});

export type UpdateCustomerInput = z.infer<typeof updateCustomerSchema>;

export const listCustomersSchema = z.object({
  search: z.string().trim().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(10),
});

export type ListCustomersInput = z.infer<typeof listCustomersSchema>;

