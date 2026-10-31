import { z } from "zod";
import { SubscriptionStatus, InvoiceStatus } from "@/generated/prisma/enums";

export const listPortalSubscriptionsSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(10),
  status: z.nativeEnum(SubscriptionStatus).optional(),
});

export const listPortalInvoicesSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(10),
  status: z.nativeEnum(InvoiceStatus).optional(),
});

export const listPortalPaymentsSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(10),
});

export type ListPortalSubscriptionsInput = z.infer<typeof listPortalSubscriptionsSchema>;
export type ListPortalInvoicesInput = z.infer<typeof listPortalInvoicesSchema>;
export type ListPortalPaymentsInput = z.infer<typeof listPortalPaymentsSchema>;

