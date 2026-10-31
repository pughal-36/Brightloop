import { z } from "zod";

export const dashboardFilterSchema = z.object({
  startDate: z.string().optional().nullable(),
  endDate: z.string().optional().nullable(),
  planId: z.string().optional().nullable(),
  customerId: z.string().optional().nullable(),
  status: z.string().optional().nullable(),
  overduePage: z.coerce.number().int().min(1).default(1),
  overduePageSize: z.coerce.number().int().min(1).max(50).default(10),
  paymentsPage: z.coerce.number().int().min(1).default(1),
  paymentsPageSize: z.coerce.number().int().min(1).max(50).default(10),
});

export type DashboardFilter = z.infer<typeof dashboardFilterSchema>;

export interface KPIMetrics {
  activeTotal: number;
  activePaused: number;
  activeNonPaused: number;
  mrr: number;
  arr: number;
  collected: number;
  outstanding: number;
  overdueCount: number;
  overdueAmount: number;
}

export interface MonthlyRevenue {
  month: string;
  revenue: number;
}

export interface StatusCount {
  status: string;
  count: number;
  pausedCount: number;
}

export interface OverdueInvoiceRow {
  id: string;
  number: string;
  dueDate: Date;
  total: number;
  amountPaid: number;
  balance: number;
  daysOverdue: number;
  customerName: string;
  customerId: string;
}

export interface RecentPaymentRow {
  id: string;
  amount: number;
  paidOn: Date;
  method: string;
  provider: string;
  invoiceId: string;
  invoiceNumber: string;
  customerName: string;
  customerId: string;
}

