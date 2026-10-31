import "server-only";
import { requireRole, type Session } from "@/server/lib/session";
import { Role, BillingPeriod } from "@/generated/prisma/enums";
import { dashboardFilterSchema } from "./schema";
import { getToday } from "@/lib/dates";
import {
  getKPIMetricsRecord,
  getRevenueByMonthRecord,
  getSubscriptionsByStatusRecord,
  getOverdueInvoicesRecord,
  getRecentPaymentsRecord,
} from "./repo";

/**
 * Normalizes recurring totals to monthly recurring revenue (MRR).
 * Formula:
 * - YEARLY: yearly / 12
 * - WEEKLY: weekly * 52 / 12
 * - DAILY: daily * 365 / 12
 * - MONTHLY: monthly
 */
export function normalizeToMRR(recurringTotalPaise: number, period: BillingPeriod): number {
  switch (period) {
    case BillingPeriod.YEARLY:
      return Math.round(recurringTotalPaise / 12);
    case BillingPeriod.WEEKLY:
      return Math.round((recurringTotalPaise * 52) / 12);
    case BillingPeriod.DAILY:
      return Math.round((recurringTotalPaise * 365) / 12);
    case BillingPeriod.MONTHLY:
    default:
      return recurringTotalPaise;
  }
}

/**
 * Computes ARR from MRR (MRR x 12).
 */
export function calculateARR(mrrPaise: number): number {
  return mrrPaise * 12;
}

export async function getDashboardData(session: Session, rawFilter?: unknown) {
  requireRole(session, Role.ADMIN, Role.STAFF);

  const filter = dashboardFilterSchema.parse(rawFilter ?? {});
  const today = getToday();

  const [kpisWithoutArr, revenueByMonth, subscriptionsByStatus, overdueInvoices, recentPayments] =
    await Promise.all([
      getKPIMetricsRecord(filter, today),
      getRevenueByMonthRecord(filter),
      getSubscriptionsByStatusRecord(filter),
      getOverdueInvoicesRecord(filter, today),
      getRecentPaymentsRecord(filter),
    ]);

  return {
    kpis: {
      ...kpisWithoutArr,
      arr: calculateARR(kpisWithoutArr.mrr),
    },
    revenueByMonth,
    subscriptionsByStatus,
    overdueInvoices,
    recentPayments,
    filter,
  };
}

