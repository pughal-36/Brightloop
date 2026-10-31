import "server-only";
import { db } from "@/server/db";
import type {
  DashboardFilter,
  KPIMetrics,
  MonthlyRevenue,
  StatusCount,
  OverdueInvoiceRow,
  RecentPaymentRow,
} from "./schema";

export async function getKPIMetricsRecord(
  filter: DashboardFilter,
  today: Date
): Promise<Omit<KPIMetrics, "arr">> {
  const custId = filter.customerId?.trim() || null;
  const pId = filter.planId?.trim() || null;
  const startD = filter.startDate?.trim() || null;
  const endD = filter.endDate?.trim() || null;

  const [subMetrics, paymentMetrics, invoiceMetrics, overdueMetrics] = await Promise.all([
    // Active subs, paused subs, and MRR
    db.$queryRaw<
      Array<{
        activeTotal: bigint | number;
        activePaused: bigint | number;
        activeNonPaused: bigint | number;
        mrr: bigint | number;
      }>
    >`
      SELECT
        COUNT(*) FILTER (WHERE s."status" = 'ACTIVE') as "activeTotal",
        COUNT(*) FILTER (WHERE s."status" = 'ACTIVE' AND s."pausedAt" IS NOT NULL) as "activePaused",
        COUNT(*) FILTER (WHERE s."status" = 'ACTIVE' AND s."pausedAt" IS NULL) as "activeNonPaused",
        COALESCE(SUM(
          CASE p."billingPeriod"
            WHEN 'YEARLY' THEN ROUND((s."planFee" + COALESCE(lines.subtotal, 0)) / 12.0)
            WHEN 'WEEKLY' THEN ROUND(((s."planFee" + COALESCE(lines.subtotal, 0)) * 52.0) / 12.0)
            WHEN 'DAILY' THEN ROUND(((s."planFee" + COALESCE(lines.subtotal, 0)) * 365.0) / 12.0)
            ELSE (s."planFee" + COALESCE(lines.subtotal, 0))
          END
        ) FILTER (WHERE s."status" = 'ACTIVE'), 0) as "mrr"
      FROM "Subscription" s
      JOIN "Plan" p ON s."planId" = p."id"
      LEFT JOIN (
        SELECT "subscriptionId", SUM("amount") as subtotal
        FROM "SubscriptionLine"
        GROUP BY "subscriptionId"
      ) lines ON lines."subscriptionId" = s."id"
      WHERE (${custId}::text IS NULL OR s."customerId" = ${custId}::text)
        AND (${pId}::text IS NULL OR s."planId" = ${pId}::text)
    `,

    // Revenue collected
    db.$queryRaw<Array<{ collected: bigint | number }>>`
      SELECT COALESCE(SUM(p."amount"), 0) as "collected"
      FROM "Payment" p
      JOIN "Invoice" i ON p."invoiceId" = i."id"
      LEFT JOIN "Subscription" s ON i."subscriptionId" = s."id"
      WHERE p."voidedAt" IS NULL
        AND (${startD}::date IS NULL OR p."paidOn" >= ${startD}::date)
        AND (${endD}::date IS NULL OR p."paidOn" <= ${endD}::date)
        AND (${custId}::text IS NULL OR i."customerId" = ${custId}::text)
        AND (${pId}::text IS NULL OR s."planId" = ${pId}::text)
    `,

    // Outstanding confirmed balances
    db.$queryRaw<Array<{ outstanding: bigint | number }>>`
      SELECT COALESCE(SUM(i."total" - i."amountPaid"), 0) as "outstanding"
      FROM "Invoice" i
      LEFT JOIN "Subscription" s ON i."subscriptionId" = s."id"
      WHERE i."status" = 'CONFIRMED'
        AND (${startD}::date IS NULL OR i."issueDate" >= ${startD}::date)
        AND (${endD}::date IS NULL OR i."issueDate" <= ${endD}::date)
        AND (${custId}::text IS NULL OR i."customerId" = ${custId}::text)
        AND (${pId}::text IS NULL OR s."planId" = ${pId}::text)
    `,

    // Overdue count and amount
    db.$queryRaw<Array<{ overdueCount: bigint | number; overdueAmount: bigint | number }>>`
      SELECT
        COUNT(*) as "overdueCount",
        COALESCE(SUM(i."total" - i."amountPaid"), 0) as "overdueAmount"
      FROM "Invoice" i
      LEFT JOIN "Subscription" s ON i."subscriptionId" = s."id"
      WHERE i."status" = 'CONFIRMED'
        AND i."dueDate" < ${today}::date
        AND (i."total" - i."amountPaid") > 0
        AND (${custId}::text IS NULL OR i."customerId" = ${custId}::text)
        AND (${pId}::text IS NULL OR s."planId" = ${pId}::text)
    `,
  ]);

  const sub = subMetrics[0] || { activeTotal: 0, activePaused: 0, activeNonPaused: 0, mrr: 0 };
  const pay = paymentMetrics[0] || { collected: 0 };
  const inv = invoiceMetrics[0] || { outstanding: 0 };
  const ovr = overdueMetrics[0] || { overdueCount: 0, overdueAmount: 0 };

  return {
    activeTotal: Number(sub.activeTotal),
    activePaused: Number(sub.activePaused),
    activeNonPaused: Number(sub.activeNonPaused),
    mrr: Number(sub.mrr),
    collected: Number(pay.collected),
    outstanding: Number(inv.outstanding),
    overdueCount: Number(ovr.overdueCount),
    overdueAmount: Number(ovr.overdueAmount),
  };
}

export async function getRevenueByMonthRecord(
  filter: DashboardFilter
): Promise<MonthlyRevenue[]> {
  const custId = filter.customerId?.trim() || null;
  const pId = filter.planId?.trim() || null;
  const startD = filter.startDate?.trim() || null;
  const endD = filter.endDate?.trim() || null;

  const rows = await db.$queryRaw<Array<{ month: string; revenue: bigint | number }>>`
    SELECT
      to_char(date_trunc('month', p."paidOn"), 'YYYY-MM') as "month",
      COALESCE(SUM(p."amount"), 0) as "revenue"
    FROM "Payment" p
    JOIN "Invoice" i ON p."invoiceId" = i."id"
    LEFT JOIN "Subscription" s ON i."subscriptionId" = s."id"
    WHERE p."voidedAt" IS NULL
      AND (${startD}::date IS NULL OR p."paidOn" >= ${startD}::date)
      AND (${endD}::date IS NULL OR p."paidOn" <= ${endD}::date)
      AND (${custId}::text IS NULL OR i."customerId" = ${custId}::text)
      AND (${pId}::text IS NULL OR s."planId" = ${pId}::text)
    GROUP BY date_trunc('month', p."paidOn")
    ORDER BY date_trunc('month', p."paidOn") ASC
  `;

  return rows.map((r) => ({
    month: r.month,
    revenue: Number(r.revenue),
  }));
}

export async function getSubscriptionsByStatusRecord(
  filter: DashboardFilter
): Promise<StatusCount[]> {
  const custId = filter.customerId?.trim() || null;
  const pId = filter.planId?.trim() || null;

  const rows = await db.$queryRaw<
    Array<{
      status: string;
      count: bigint | number;
      pausedCount: bigint | number;
    }>
  >`
    SELECT
      s."status"::text as "status",
      COUNT(*) as "count",
      COUNT(*) FILTER (WHERE s."pausedAt" IS NOT NULL) as "pausedCount"
    FROM "Subscription" s
    WHERE (${custId}::text IS NULL OR s."customerId" = ${custId}::text)
      AND (${pId}::text IS NULL OR s."planId" = ${pId}::text)
    GROUP BY s."status"
    ORDER BY s."status" ASC
  `;

  return rows.map((r) => ({
    status: r.status,
    count: Number(r.count),
    pausedCount: Number(r.pausedCount),
  }));
}

export async function getOverdueInvoicesRecord(
  filter: DashboardFilter,
  today: Date
): Promise<{ items: OverdueInvoiceRow[]; total: number; page: number; pageSize: number; totalPages: number }> {
  const custId = filter.customerId?.trim() || null;
  const pId = filter.planId?.trim() || null;
  const page = filter.overduePage || 1;
  const pageSize = filter.overduePageSize || 10;
  const offset = (page - 1) * pageSize;

  const [countResult, rows] = await Promise.all([
    db.$queryRaw<Array<{ total: bigint | number }>>`
      SELECT COUNT(*) as "total"
      FROM "Invoice" i
      LEFT JOIN "Subscription" s ON i."subscriptionId" = s."id"
      WHERE i."status" = 'CONFIRMED'
        AND i."dueDate" < ${today}::date
        AND (i."total" - i."amountPaid") > 0
        AND (${custId}::text IS NULL OR i."customerId" = ${custId}::text)
        AND (${pId}::text IS NULL OR s."planId" = ${pId}::text)
    `,
    db.$queryRaw<
      Array<{
        id: string;
        number: string;
        dueDate: Date;
        total: number;
        amountPaid: number;
        balance: number;
        daysOverdue: number;
        customerName: string;
        customerId: string;
      }>
    >`
      SELECT
        i."id",
        i."number",
        i."dueDate",
        i."total",
        i."amountPaid",
        (i."total" - i."amountPaid") as "balance",
        EXTRACT(DAY FROM (${today}::timestamp - i."dueDate"::timestamp))::int as "daysOverdue",
        c."name" as "customerName",
        c."id" as "customerId"
      FROM "Invoice" i
      JOIN "Customer" c ON i."customerId" = c."id"
      LEFT JOIN "Subscription" s ON i."subscriptionId" = s."id"
      WHERE i."status" = 'CONFIRMED'
        AND i."dueDate" < ${today}::date
        AND (i."total" - i."amountPaid") > 0
        AND (${custId}::text IS NULL OR i."customerId" = ${custId}::text)
        AND (${pId}::text IS NULL OR s."planId" = ${pId}::text)
      ORDER BY i."dueDate" ASC
      LIMIT ${pageSize} OFFSET ${offset}
    `,
  ]);

  const total = Number(countResult[0]?.total ?? 0);
  const items: OverdueInvoiceRow[] = rows.map((r) => ({
    id: r.id,
    number: r.number,
    dueDate: new Date(r.dueDate),
    total: Number(r.total),
    amountPaid: Number(r.amountPaid),
    balance: Number(r.balance),
    daysOverdue: Number(r.daysOverdue),
    customerName: r.customerName,
    customerId: r.customerId,
  }));

  return {
    items,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize) || 1,
  };
}

export async function getRecentPaymentsRecord(
  filter: DashboardFilter
): Promise<{ items: RecentPaymentRow[]; total: number; page: number; pageSize: number; totalPages: number }> {
  const custId = filter.customerId?.trim() || null;
  const pId = filter.planId?.trim() || null;
  const startD = filter.startDate?.trim() || null;
  const endD = filter.endDate?.trim() || null;
  const page = filter.paymentsPage || 1;
  const pageSize = filter.paymentsPageSize || 10;
  const offset = (page - 1) * pageSize;

  const [countResult, rows] = await Promise.all([
    db.$queryRaw<Array<{ total: bigint | number }>>`
      SELECT COUNT(*) as "total"
      FROM "Payment" p
      JOIN "Invoice" i ON p."invoiceId" = i."id"
      LEFT JOIN "Subscription" s ON i."subscriptionId" = s."id"
      WHERE p."voidedAt" IS NULL
        AND (${startD}::date IS NULL OR p."paidOn" >= ${startD}::date)
        AND (${endD}::date IS NULL OR p."paidOn" <= ${endD}::date)
        AND (${custId}::text IS NULL OR i."customerId" = ${custId}::text)
        AND (${pId}::text IS NULL OR s."planId" = ${pId}::text)
    `,
    db.$queryRaw<
      Array<{
        id: string;
        amount: number;
        paidOn: Date;
        method: string;
        provider: string;
        invoiceId: string;
        invoiceNumber: string;
        customerName: string;
        customerId: string;
      }>
    >`
      SELECT
        p."id",
        p."amount",
        p."paidOn",
        p."method"::text as "method",
        p."provider"::text as "provider",
        i."id" as "invoiceId",
        i."number" as "invoiceNumber",
        c."name" as "customerName",
        c."id" as "customerId"
      FROM "Payment" p
      JOIN "Invoice" i ON p."invoiceId" = i."id"
      JOIN "Customer" c ON i."customerId" = c."id"
      LEFT JOIN "Subscription" s ON i."subscriptionId" = s."id"
      WHERE p."voidedAt" IS NULL
        AND (${startD}::date IS NULL OR p."paidOn" >= ${startD}::date)
        AND (${endD}::date IS NULL OR p."paidOn" <= ${endD}::date)
        AND (${custId}::text IS NULL OR i."customerId" = ${custId}::text)
        AND (${pId}::text IS NULL OR s."planId" = ${pId}::text)
      ORDER BY p."paidOn" DESC, p."createdAt" DESC
      LIMIT ${pageSize} OFFSET ${offset}
    `,
  ]);

  const total = Number(countResult[0]?.total ?? 0);
  const items: RecentPaymentRow[] = rows.map((r) => ({
    id: r.id,
    amount: Number(r.amount),
    paidOn: new Date(r.paidOn),
    method: r.method,
    provider: r.provider,
    invoiceId: r.invoiceId,
    invoiceNumber: r.invoiceNumber,
    customerName: r.customerName,
    customerId: r.customerId,
  }));

  return {
    items,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize) || 1,
  };
}

