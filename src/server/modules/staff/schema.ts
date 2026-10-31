import { z } from "zod";

export const createStaffSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  email: z.string().trim().email("Invalid email address").toLowerCase(),
});

export type CreateStaffInput = z.infer<typeof createStaffSchema>;

export const deactivateStaffSchema = z.object({
  userId: z.string().min(1, "User ID is required"),
});

export type DeactivateStaffInput = z.infer<typeof deactivateStaffSchema>;

export const listStaffSchema = z.object({
  search: z.string().trim().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export type ListStaffInput = z.infer<typeof listStaffSchema>;

