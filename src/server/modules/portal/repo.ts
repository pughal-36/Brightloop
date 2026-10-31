import "server-only";
import { db } from "@/server/db";
import { SubscriptionStatus, InvoiceStatus } from "@/generated/prisma/enums";

export async function getPortalDashboardRepo(customerId: string, today: Date) {
  const [
    customer,
    activeCount,
    quotationCount,
    confirmedInvoices,
    recentSubscriptions,
    recentInvoices,
  ] = await Promise.all([
    db.customer.findUnique({
      where: { id: customerId },
    }),
    db.subscription.count({
      where: { customerId, status: SubscriptionStatus.ACTIVE },
    }),
    db.subscription.count({
      where: { customerId, status: SubscriptionStatus.QUOTATION },
    }),
    db.invoice.findMany({
      where: { customerId, status: InvoiceStatus.CONFIRMED },
      select: {
        total: true,
        amountPaid: true,
        dueDate: true,
      },
    }),
    db.subscription.findMany({
      where: { customerId },
      orderBy: { createdAt: "desc" },
      take: 5,
      include: {
        plan: true,
      },
    }),
    db.invoice.findMany({
      where: { customerId },
      orderBy: { createdAt: "desc" },
      take: 5,
      include: {
        subscription: true,
      },
    }),
  ]);

  let amountDue = 0;
  let overdueCount = 0;
  let overdueAmount = 0;

  for (const inv of confirmedInvoices) {
    const bal = inv.total - inv.amountPaid;
    if (bal > 0) {
      amountDue += bal;
      if (inv.dueDate < today) {
        overdueCount += 1;
        overdueAmount += bal;
      }
    }
  }

  return {
    customer,
    activeCount,
    quotationCount,
    amountDue,
    overdueCount,
    overdueAmount,
    recentSubscriptions,
    recentInvoices,
  };
}

export async function listPortalPaymentsRepo(
  customerId: string,
  page: number,
  pageSize: number
) {
  const offset = (page - 1) * pageSize;

  const [total, items] = await Promise.all([
    db.payment.count({
      where: {
        invoice: { customerId },
        voidedAt: null,
      },
    }),
    db.payment.findMany({
      where: {
        invoice: { customerId },
        voidedAt: null,
      },
      orderBy: [{ paidOn: "desc" }, { createdAt: "desc" }],
      skip: offset,
      take: pageSize,
      include: {
        invoice: {
          select: {
            id: true,
            number: true,
            total: true,
          },
        },
      },
    }),
  ]);

  return {
    items,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize) || 1,
  };
}
