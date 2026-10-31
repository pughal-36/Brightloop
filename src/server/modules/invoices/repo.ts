import "server-only";

import { db } from "@/server/db";
import {
  InvoiceStatus,
  StatusEntity,
  InvoiceLineKind,
  PaymentProvider,
} from "@/generated/prisma/enums";
import { Prisma } from "@/generated/prisma/client";
import type {
  ListInvoicesInput,
  RecordPaymentInput,
  ConfirmInvoiceResult,
  InvoiceTotals,
} from "./schema";
import { percentOf, add, sub } from "@/lib/money";
import { getToday } from "@/lib/dates";

/**
 * Retrieves a full invoice record with lines, payments, and relations.
 */
export async function findInvoiceByIdRecord(id: string) {
  return db.invoice.findUnique({
    where: { id },
    include: {
      customer: true,
      subscription: {
        include: {
          plan: true,
        },
      },
      lines: {
        orderBy: { sortOrder: "asc" },
        include: {
          product: true,
          variant: true,
          discount: true,
        },
      },
      payments: {
        orderBy: { createdAt: "desc" },
      },
      discountApplication: {
        include: {
          discount: true,
        },
      },
    },
  });
}

/**
 * Lists invoices with server-side pagination, filters, and derived views.
 */
export async function listInvoicesRecord(params: ListInvoicesInput) {
  const { page, pageSize, status, view, customerId, dateFrom, dateTo, search } = params;
  const skip = (page - 1) * pageSize;
  const todayDate = getToday();

  const where: Prisma.InvoiceWhereInput = {};

  if (customerId) {
    where.customerId = customerId;
  }

  if (status) {
    where.status = status;
  }

  if (dateFrom || dateTo) {
    where.issueDate = {};
    if (dateFrom) where.issueDate.gte = dateFrom;
    if (dateTo) where.issueDate.lte = dateTo;
  }

  if (search) {
    const trimmed = search.trim();
    where.OR = [
      { number: { contains: trimmed, mode: "insensitive" } },
      { customer: { name: { contains: trimmed, mode: "insensitive" } } },
      { customer: { email: { contains: trimmed, mode: "insensitive" } } },
    ];
  }

  // Handle derived views
  if (view === "outstanding") {
    where.status = InvoiceStatus.CONFIRMED;
  } else if (view === "overdue") {
    where.status = InvoiceStatus.CONFIRMED;
    where.dueDate = { lt: todayDate };
  }

  const [invoices, totalCount] = await Promise.all([
    db.invoice.findMany({
      where,
      skip,
      take: pageSize,
      orderBy: { createdAt: "desc" },
      include: {
        customer: true,
        subscription: {
          include: { plan: true },
        },
      },
    }),
    db.invoice.count({ where }),
  ]);

  // If view is outstanding or overdue, filter out any fully paid edge cases
  const filteredInvoices =
    view === "outstanding" || view === "overdue"
      ? invoices.filter((inv) => inv.amountPaid < inv.total)
      : invoices;

  return {
    invoices: filteredInvoices,
    totalCount:
      view === "outstanding" || view === "overdue"
        ? filteredInvoices.length
        : totalCount,
    page,
    pageSize,
    totalPages: Math.ceil(
      (view === "outstanding" || view === "overdue"
        ? filteredInvoices.length
        : totalCount) / pageSize
    ),
  };
}

/**
 * Atomically attempts to increment usedCount of a discount.
 * Returns number of affected rows (1 if successful, 0 if limit reached or inactive).
 */
export async function atomicIncrementDiscountUsage(
  discountId: string,
  tx: Prisma.TransactionClient
): Promise<number> {
  const result = await tx.$executeRaw`
    UPDATE "Discount"
    SET "usedCount" = "usedCount" + 1
    WHERE "id" = ${discountId}
      AND "isActive" = true
      AND "usedCount" < "usageLimit"
  `;
  return Number(result);
}

/**
 * Decrements usedCount of a discount when releasing a discount use.
 */
export async function decrementDiscountUsage(
  discountId: string,
  tx: Prisma.TransactionClient
): Promise<void> {
  await tx.$executeRaw`
    UPDATE "Discount"
    SET "usedCount" = GREATEST("usedCount" - 1, 0)
    WHERE "id" = ${discountId}
  `;
}

/**
 * Confirms an invoice transactionally:
 * - Re-validates discount atomically (UPDATE ... WHERE usedCount < usageLimit)
 * - If invalid, removes discount line, recalculates taxes, keeps in Draft, returns RECONFIRM_REQUIRED
 * - If valid or no discount, sets status CONFIRMED, creates DiscountApplication, writes StatusHistory
 */
export async function confirmInvoiceTxRecord(
  invoiceId: string,
  byUserId?: string | null
): Promise<ConfirmInvoiceResult> {
  return db.$transaction(async (tx) => {
    // 1. Lock invoice row
    const lockedRows = await tx.$queryRaw<Array<{ id: string }>>`
      SELECT "id" FROM "Invoice"
      WHERE "id" = ${invoiceId}
      FOR UPDATE
    `;

    if (lockedRows.length === 0) {
      throw new Error("Invoice not found");
    }

    const invoice = await tx.invoice.findUnique({
      where: { id: invoiceId },
      include: {
        lines: { orderBy: { sortOrder: "asc" } },
      },
    });

    if (!invoice) {
      throw new Error("Invoice not found");
    }

    if (invoice.status !== InvoiceStatus.DRAFT) {
      throw new Error(`Invoice cannot be confirmed from status ${invoice.status}`);
    }

    const oldTotals: InvoiceTotals = {
      subtotal: invoice.subtotal,
      discountTotal: invoice.discountTotal,
      taxTotal: invoice.taxTotal,
      total: invoice.total,
    };

    // Check if invoice has a discount line
    const discountLine = invoice.lines.find(
      (l) => l.kind === InvoiceLineKind.DISCOUNT && l.discountId !== null
    );

    if (discountLine && discountLine.discountId) {
      const discountId = discountLine.discountId;

      // Check discount record
      const discount = await tx.discount.findUnique({
        where: { id: discountId },
      });

      let isValid = true;
      const asOfDate = invoice.periodStart || getToday();

      if (
        !discount ||
        !discount.isActive ||
        discount.startDate > asOfDate ||
        discount.endDate < asOfDate ||
        discount.usedCount >= discount.usageLimit
      ) {
        isValid = false;
      }

      let atomicSuccess = false;
      if (isValid) {
        const rowsUpdated = await atomicIncrementDiscountUsage(discountId, tx);
        atomicSuccess = rowsUpdated === 1;
      }

      // If invalid or atomic increment failed: RECONFIRM_REQUIRED flow
      if (!isValid || !atomicSuccess) {
        // 1. Remove discount line
        await tx.invoiceLine.deleteMany({
          where: {
            invoiceId: invoice.id,
            kind: InvoiceLineKind.DISCOUNT,
          },
        });

        // 2. Recalculate line taxes without discount
        const remainingLines = invoice.lines.filter(
          (l) => l.kind !== InvoiceLineKind.DISCOUNT
        );
        let newTaxTotal = 0;

        for (const line of remainingLines) {
          const lineTax = percentOf(line.amount, line.taxRateBps / 100);
          await tx.invoiceLine.update({
            where: { id: line.id },
            data: { taxAmount: lineTax },
          });
          newTaxTotal = add(newTaxTotal, lineTax);
        }

        // 3. Update invoice totals in DRAFT
        const newTotal = add(invoice.subtotal, newTaxTotal);
        await tx.invoice.update({
          where: { id: invoice.id },
          data: {
            discountTotal: 0,
            taxTotal: newTaxTotal,
            total: newTotal,
          },
        });

        const newTotals: InvoiceTotals = {
          subtotal: invoice.subtotal,
          discountTotal: 0,
          taxTotal: newTaxTotal,
          total: newTotal,
        };

        return {
          status: "RECONFIRM_REQUIRED",
          invoiceId: invoice.id,
          message:
            "Discount is exhausted or no longer applicable. Totals have been recalculated without the discount.",
          oldTotals,
          newTotals,
        };
      }

      // Discount is valid and atomic increment succeeded: create DiscountApplication
      await tx.discountApplication.create({
        data: {
          discountId,
          invoiceId: invoice.id,
          amount: invoice.discountTotal,
        },
      });
    }

    // Freeze lines & transition invoice to CONFIRMED
    const now = new Date();
    await tx.invoice.update({
      where: { id: invoice.id },
      data: {
        status: InvoiceStatus.CONFIRMED,
        confirmedAt: now,
      },
    });

    // Write StatusHistory
    await tx.statusHistory.create({
      data: {
        entity: StatusEntity.INVOICE,
        entityId: invoice.id,
        from: InvoiceStatus.DRAFT,
        to: InvoiceStatus.CONFIRMED,
        byUserId,
        note: discountLine ? "Invoice confirmed with discount applied" : "Invoice confirmed",
        at: now,
      },
    });

    return {
      status: "CONFIRMED",
      invoiceId: invoice.id,
    };
  });
}

/**
 * Cancels an invoice and releases any applied discount.
 */
export async function cancelInvoiceTxRecord(
  invoiceId: string,
  reason?: string,
  byUserId?: string | null
) {
  return db.$transaction(async (tx) => {
    const invoice = await tx.invoice.findUnique({
      where: { id: invoiceId },
      include: {
        payments: { where: { voidedAt: null } },
        discountApplication: true,
      },
    });

    if (!invoice) {
      throw new Error("Invoice not found");
    }

    if (
      invoice.status !== InvoiceStatus.DRAFT &&
      invoice.status !== InvoiceStatus.CONFIRMED
    ) {
      throw new Error(`Cannot cancel invoice with status ${invoice.status}`);
    }

    if (invoice.payments.length > 0 || invoice.amountPaid > 0) {
      throw new Error("Cannot cancel invoice with recorded payments");
    }

    // Release discount use if confirmed
    if (invoice.discountApplication) {
      await decrementDiscountUsage(invoice.discountApplication.discountId, tx);
      await tx.discountApplication.delete({
        where: { id: invoice.discountApplication.id },
      });
    }

    const now = new Date();
    const updated = await tx.invoice.update({
      where: { id: invoice.id },
      data: {
        status: InvoiceStatus.CANCELLED,
        cancelledAt: now,
      },
    });

    await tx.statusHistory.create({
      data: {
        entity: StatusEntity.INVOICE,
        entityId: invoice.id,
        from: invoice.status,
        to: InvoiceStatus.CANCELLED,
        byUserId,
        note: reason || "Invoice cancelled",
        at: now,
      },
    });

    return updated;
  });
}

/**
 * Records a manual payment on a CONFIRMED invoice and flips to PAID when fully paid.
 */
export async function recordPaymentTxRecord(
  input: RecordPaymentInput,
  byUserId?: string | null
) {
  return db.$transaction(async (tx) => {
    // 1. Lock invoice row
    const locked = await tx.$queryRaw<Array<{ id: string }>>`
      SELECT "id" FROM "Invoice"
      WHERE "id" = ${input.invoiceId}
      FOR UPDATE
    `;

    if (locked.length === 0) {
      throw new Error("Invoice not found");
    }

    const invoice = await tx.invoice.findUnique({
      where: { id: input.invoiceId },
      include: {
        payments: { where: { voidedAt: null } },
      },
    });

    if (!invoice) {
      throw new Error("Invoice not found");
    }

    if (invoice.status !== InvoiceStatus.CONFIRMED) {
      throw new Error(`Payments can only be recorded on CONFIRMED invoices (current: ${invoice.status})`);
    }

    const currentPaid = invoice.payments.reduce((sum, p) => add(sum, p.amount), 0);
    const balance = sub(invoice.total, currentPaid);

    if (input.amount <= 0) {
      throw new Error("Payment amount must be greater than 0");
    }

    if (input.amount > balance) {
      throw new Error(`Payment amount (${input.amount}) exceeds invoice balance (${balance})`);
    }

    const paidOn = input.paidOn || getToday();
    const now = new Date();

    const payment = await tx.payment.create({
      data: {
        invoiceId: invoice.id,
        method: input.method,
        provider: PaymentProvider.MANUAL,
        amount: input.amount,
        paidOn,
        note: input.note,
        recordedById: byUserId,
      },
    });

    const newAmountPaid = add(currentPaid, input.amount);
    const isFullyPaid = newAmountPaid >= invoice.total;

    if (isFullyPaid) {
      await tx.invoice.update({
        where: { id: invoice.id },
        data: {
          amountPaid: newAmountPaid,
          status: InvoiceStatus.PAID,
          paidAt: now,
        },
      });

      await tx.statusHistory.create({
        data: {
          entity: StatusEntity.INVOICE,
          entityId: invoice.id,
          from: InvoiceStatus.CONFIRMED,
          to: InvoiceStatus.PAID,
          byUserId,
          note: "Invoice fully paid",
          at: now,
        },
      });
    } else {
      await tx.invoice.update({
        where: { id: invoice.id },
        data: {
          amountPaid: newAmountPaid,
        },
      });
    }

    return { payment, newAmountPaid, isFullyPaid };
  });
}

/**
 * Voids a payment (ADMIN only) and recalculates invoice balance and status.
 */
export async function voidPaymentTxRecord(
  paymentId: string,
  voidNote: string,
  byUserId?: string | null
) {
  return db.$transaction(async (tx) => {
    const payment = await tx.payment.findUnique({
      where: { id: paymentId },
      include: { invoice: true },
    });

    if (!payment) {
      throw new Error("Payment not found");
    }

    if (payment.voidedAt !== null) {
      throw new Error("Payment has already been voided");
    }

    const now = new Date();
    const updatedPayment = await tx.payment.update({
      where: { id: payment.id },
      data: {
        voidedAt: now,
        voidedById: byUserId,
        voidNote,
      },
    });

    // Recalculate remaining active payments
    const activePayments = await tx.payment.findMany({
      where: { invoiceId: payment.invoiceId, voidedAt: null },
    });

    const newAmountPaid = activePayments.reduce((sum, p) => add(sum, p.amount), 0);
    const invoice = payment.invoice;

    if (invoice.status === InvoiceStatus.PAID && newAmountPaid < invoice.total) {
      // Revert status to CONFIRMED
      await tx.invoice.update({
        where: { id: invoice.id },
        data: {
          amountPaid: newAmountPaid,
          status: InvoiceStatus.CONFIRMED,
          paidAt: null,
        },
      });

      await tx.statusHistory.create({
        data: {
          entity: StatusEntity.INVOICE,
          entityId: invoice.id,
          from: InvoiceStatus.PAID,
          to: InvoiceStatus.CONFIRMED,
          byUserId,
          note: `Payment voided (${voidNote}) - reverted to CONFIRMED`,
          at: now,
        },
      });
    } else {
      await tx.invoice.update({
        where: { id: invoice.id },
        data: {
          amountPaid: newAmountPaid,
        },
      });
    }

    return { voidedPayment: updatedPayment, newAmountPaid };
  });
}

/**
 * Updates sentAt timestamp on an invoice.
 */
export async function updateInvoiceSentAtRecord(id: string) {
  return db.invoice.update({
    where: { id },
    data: { sentAt: new Date() },
  });
}

/**
 * Retrieves invoice StatusHistory chronological timeline.
 */
export async function getInvoiceTimelineRecord(invoiceId: string) {
  return db.statusHistory.findMany({
    where: {
      entity: StatusEntity.INVOICE,
      entityId: invoiceId,
    },
    orderBy: { at: "asc" },
  });
}
