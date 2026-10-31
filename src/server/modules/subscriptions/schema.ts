import { z } from "zod";
import {
  SubscriptionStatus,
  PaymentTerms,
} from "@/generated/prisma/enums";

export const templateLineInputSchema = z.object({
  productId: z.string().min(1, "Product ID is required"),
  variantId: z.string().min(1, "Variant ID is required").nullable().optional(),
  qty: z.coerce.number().int().min(1, "Quantity must be at least 1"),
});

export type TemplateLineInput = z.infer<typeof templateLineInputSchema>;

export const createTemplateSchema = z.object({
  name: z.string().min(1, "Template name is required").max(100),
  planId: z.string().min(1, "Plan ID is required"),
  validityDays: z.coerce.number().int().min(1, "Validity days must be at least 1").max(365),
  lines: z.array(templateLineInputSchema).min(1, "At least one line item is required"),
});

export type CreateTemplateInput = z.infer<typeof createTemplateSchema>;

export const updateTemplateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  planId: z.string().min(1).optional(),
  validityDays: z.coerce.number().int().min(1).max(365).optional(),
  isActive: z.boolean().optional(),
  lines: z.array(templateLineInputSchema).min(1).optional(),
});

export type UpdateTemplateInput = z.infer<typeof updateTemplateSchema>;

export const subscriptionLineInputSchema = z.object({
  productId: z.string().min(1, "Product ID is required"),
  variantId: z.string().min(1).nullable().optional(),
  qty: z.coerce.number().int().min(1, "Quantity must be at least 1"),
  taxRateBps: z.coerce.number().int().min(0).max(10000).optional(),
});

export type SubscriptionLineInput = z.infer<typeof subscriptionLineInputSchema>;

export const createBlankSubscriptionSchema = z.object({
  customerId: z.string().min(1, "Customer ID is required"),
  planId: z.string().min(1, "Plan ID is required"),
  startDate: z.coerce.date(),
  expiryDate: z.coerce.date(),
  paymentTerms: z.nativeEnum(PaymentTerms).default(PaymentTerms.IMMEDIATE),
  lines: z.array(subscriptionLineInputSchema).min(1, "At least one line item is required"),
  validUntil: z.coerce.date().optional(),
});

export type CreateBlankSubscriptionInput = z.infer<typeof createBlankSubscriptionSchema>;

export const createFromTemplateSchema = z.object({
  customerId: z.string().min(1, "Customer ID is required"),
  templateId: z.string().min(1, "Template ID is required"),
  startDate: z.coerce.date(),
  expiryDate: z.coerce.date().optional(),
  paymentTerms: z.nativeEnum(PaymentTerms).default(PaymentTerms.IMMEDIATE),
  lines: z.array(subscriptionLineInputSchema).optional(),
});

export type CreateFromTemplateInput = z.infer<typeof createFromTemplateSchema>;

export const updateDraftSubscriptionSchema = z.object({
  customerId: z.string().min(1).optional(),
  planId: z.string().min(1).optional(),
  startDate: z.coerce.date().optional(),
  expiryDate: z.coerce.date().optional(),
  paymentTerms: z.nativeEnum(PaymentTerms).optional(),
  validUntil: z.coerce.date().nullable().optional(),
  lines: z.array(subscriptionLineInputSchema).min(1).optional(),
});

export type UpdateDraftSubscriptionInput = z.infer<typeof updateDraftSubscriptionSchema>;

export const transitionActionSchema = z.enum([
  "SEND_QUOTATION",
  "CONFIRM",
  "ACTIVATE",
  "PAUSE",
  "RESUME",
  "CLOSE",
  "RENEW",
]);

export type TransitionAction = z.infer<typeof transitionActionSchema>;

export const transitionSubscriptionSchema = z.object({
  subscriptionId: z.string().min(1, "Subscription ID is required"),
  action: transitionActionSchema,
  closeReason: z.string().max(500).optional(),
  note: z.string().max(500).optional(),
  resumeDate: z.coerce.date().optional(),
  asOfDate: z.coerce.date().optional(),
});

export type TransitionSubscriptionInput = z.infer<typeof transitionSubscriptionSchema>;

export const listSubscriptionsSchema = z.object({
  search: z.string().optional(),
  status: z.nativeEnum(SubscriptionStatus).optional(),
  customerId: z.string().min(1).optional(),
  planId: z.string().min(1).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(10),
});

export type ListSubscriptionsInput = z.infer<typeof listSubscriptionsSchema>;

export const listTemplatesSchema = z.object({
  search: z.string().optional(),
  isActive: z.boolean().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(10),
});

export type ListTemplatesInput = z.infer<typeof listTemplatesSchema>;

export interface ComputedLineTotal {
  productId: string;
  variantId?: string | null;
  description: string;
  qty: number;
  unitPrice: number;
  taxRateBps: number;
  amount: number;
  taxAmount: number;
}

export interface ComputedSubscriptionTotals {
  lines: ComputedLineTotal[];
  planFee: number;
  planTaxRateBps: number;
  planTaxAmount: number;
  linesSubtotal: number;
  subtotal: number; // linesSubtotal + planFee
  taxTotal: number; // linesTax + planTax
  total: number;    // subtotal + taxTotal
}
