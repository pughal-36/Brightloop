import { z } from "zod";
import { InvoiceStatus, PaymentMethod } from "@/generated/prisma/enums";

export const listInvoicesSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  status: z.nativeEnum(InvoiceStatus).optional(),
  view: z.enum(["all", "outstanding", "overdue"]).default("all"),
  customerId: z.string().min(1).optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
  search: z.string().optional(),
});

export type ListInvoicesInput = z.infer<typeof listInvoicesSchema>;

export const confirmInvoiceSchema = z.object({
  invoiceId: z.string().min(1),
});

export type ConfirmInvoiceInput = z.infer<typeof confirmInvoiceSchema>;

export const bulkConfirmSchema = z.object({
  invoiceIds: z.array(z.string().min(1)).min(1),
});

export type BulkConfirmInput = z.infer<typeof bulkConfirmSchema>;

export const cancelInvoiceSchema = z.object({
  invoiceId: z.string().min(1),
  reason: z.string().optional(),
});

export type CancelInvoiceInput = z.infer<typeof cancelInvoiceSchema>;

export const recordPaymentSchema = z.object({
  invoiceId: z.string().min(1),
  method: z.nativeEnum(PaymentMethod),
  amount: z.number().int().positive("Payment amount must be greater than 0"),
  paidOn: z.coerce.date().optional(),
  note: z.string().optional(),
});

export type RecordPaymentInput = z.infer<typeof recordPaymentSchema>;

export const voidPaymentSchema = z.object({
  paymentId: z.string().min(1),
  note: z.string().min(1, "Void reason note is required"),
});

export type VoidPaymentInput = z.infer<typeof voidPaymentSchema>;

export const sendInvoiceSchema = z.object({
  invoiceId: z.string().min(1),
});

export type SendInvoiceInput = z.infer<typeof sendInvoiceSchema>;

export interface InvoiceTotals {
  subtotal: number;
  discountTotal: number;
  taxTotal: number;
  total: number;
}

export interface ConfirmInvoiceResult {
  status: "CONFIRMED" | "RECONFIRM_REQUIRED";
  invoiceId: string;
  message?: string;
  oldTotals?: InvoiceTotals;
  newTotals?: InvoiceTotals;
}

export interface BulkConfirmResult {
  confirmed: string[];
  reconfirmRequired: Array<{
    invoiceId: string;
    oldTotals: InvoiceTotals;
    newTotals: InvoiceTotals;
  }>;
  failed: Array<{
    invoiceId: string;
    error: string;
  }>;
}

