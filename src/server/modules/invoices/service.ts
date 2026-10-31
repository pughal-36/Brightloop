import "server-only";

import { Role, InvoiceStatus } from "@/generated/prisma/enums";
import { requireRole } from "@/server/lib/session";
import type { Session } from "@/server/lib/session";
import { AppError } from "@/server/errors";
import { getToday } from "@/lib/dates";
import { sendEmail } from "@/server/lib/email";
import { formatINR, sub } from "@/lib/money";
import {
  listInvoicesSchema,
  confirmInvoiceSchema,
  bulkConfirmSchema,
  cancelInvoiceSchema,
  recordPaymentSchema,
  voidPaymentSchema,
  sendInvoiceSchema,
  type ConfirmInvoiceResult,
  type BulkConfirmResult,
} from "./schema";
import {
  findInvoiceByIdRecord,
  listInvoicesRecord,
  confirmInvoiceTxRecord,
  cancelInvoiceTxRecord,
  recordPaymentTxRecord,
  voidPaymentTxRecord,
  updateInvoiceSentAtRecord,
  getInvoiceTimelineRecord,
} from "./repo";

/**
 * Retrieves a single invoice, checking customer scoping if called by CUSTOMER.
 * Adds derived fields: balance, isOverdue.
 */
export async function getInvoice(session: Session, id: string) {
  requireRole(session, Role.ADMIN, Role.STAFF, Role.CUSTOMER);

  const invoice = await findInvoiceByIdRecord(id);
  if (!invoice) {
    throw new AppError("NOT_FOUND", 404, "Invoice not found");
  }

  if (session.user.role === Role.CUSTOMER) {
    if (invoice.customerId !== session.user.customerId) {
      throw new AppError("FORBIDDEN", 403, "Access to this invoice is forbidden");
    }
  }

  const todayDate = getToday();
  const balance = sub(invoice.total, invoice.amountPaid);
  const isOverdue =
    invoice.status === InvoiceStatus.CONFIRMED &&
    invoice.dueDate < todayDate &&
    balance > 0;

  return {
    ...invoice,
    balance,
    isOverdue,
  };
}

/**
 * Lists invoices with server-side pagination, filters, and derived metrics.
 */
export async function listInvoices(session: Session, rawInput: unknown) {
  requireRole(session, Role.ADMIN, Role.STAFF, Role.CUSTOMER);

  const input = listInvoicesSchema.parse(rawInput);

  // Scoping for CUSTOMER
  if (session.user.role === Role.CUSTOMER) {
    if (!session.user.customerId) {
      throw new AppError("FORBIDDEN", 403, "No linked customer account");
    }
    input.customerId = session.user.customerId;
  }

  const result = await listInvoicesRecord(input);
  const todayDate = getToday();

  const formattedInvoices = result.invoices.map((inv) => {
    const balance = sub(inv.total, inv.amountPaid);
    const isOverdue =
      inv.status === InvoiceStatus.CONFIRMED &&
      inv.dueDate < todayDate &&
      balance > 0;
    return {
      ...inv,
      balance,
      isOverdue,
    };
  });

  return {
    invoices: formattedInvoices,
    totalCount: result.totalCount,
    page: result.page,
    pageSize: result.pageSize,
    totalPages: result.totalPages,
  };
}

/**
 * Confirms a single draft invoice.
 */
export async function confirmInvoice(
  session: Session,
  rawInput: unknown
): Promise<ConfirmInvoiceResult> {
  requireRole(session, Role.ADMIN, Role.STAFF);

  const input = confirmInvoiceSchema.parse(rawInput);
  return confirmInvoiceTxRecord(input.invoiceId, session.user.id);
}

/**
 * Bulk confirms draft invoices. Skips those requiring reconfirmation and lists them.
 */
export async function bulkConfirm(
  session: Session,
  rawInput: unknown
): Promise<BulkConfirmResult> {
  requireRole(session, Role.ADMIN, Role.STAFF);

  const input = bulkConfirmSchema.parse(rawInput);
  const result: BulkConfirmResult = {
    confirmed: [],
    reconfirmRequired: [],
    failed: [],
  };

  for (const id of input.invoiceIds) {
    try {
      const confirmRes = await confirmInvoiceTxRecord(id, session.user.id);
      if (confirmRes.status === "CONFIRMED") {
        result.confirmed.push(id);
      } else if (confirmRes.status === "RECONFIRM_REQUIRED") {
        result.reconfirmRequired.push({
          invoiceId: id,
          oldTotals: confirmRes.oldTotals!,
          newTotals: confirmRes.newTotals!,
        });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      result.failed.push({
        invoiceId: id,
        error: msg,
      });
    }
  }

  return result;
}

/**
 * Cancels a draft or confirmed (unpaid) invoice.
 */
export async function cancelInvoice(session: Session, rawInput: unknown) {
  requireRole(session, Role.ADMIN, Role.STAFF);

  const input = cancelInvoiceSchema.parse(rawInput);
  return cancelInvoiceTxRecord(input.invoiceId, input.reason, session.user.id);
}

/**
 * Records a manual payment on a CONFIRMED invoice.
 */
export async function recordPayment(session: Session, rawInput: unknown) {
  requireRole(session, Role.ADMIN, Role.STAFF);

  const input = recordPaymentSchema.parse(rawInput);
  return recordPaymentTxRecord(input, session.user.id);
}

/**
 * Voids a payment (ADMIN only) and updates status and balance.
 */
export async function voidPayment(session: Session, rawInput: unknown) {
  requireRole(session, Role.ADMIN);

  const input = voidPaymentSchema.parse(rawInput);
  return voidPaymentTxRecord(input.paymentId, input.note, session.user.id);
}

/**
 * Sends an email representation of the invoice and updates sentAt timestamp.
 */
export async function sendInvoice(session: Session, rawInput: unknown) {
  requireRole(session, Role.ADMIN, Role.STAFF);

  const input = sendInvoiceSchema.parse(rawInput);
  const invoice = await findInvoiceByIdRecord(input.invoiceId);

  if (!invoice) {
    throw new AppError("NOT_FOUND", 404, "Invoice not found");
  }

  if (invoice.status === InvoiceStatus.DRAFT) {
    throw new AppError("CONFLICT", 409, "Cannot send an invoice in DRAFT status");
  }

  const formattedTotal = formatINR(invoice.total);
  const dueDateStr = invoice.dueDate.toISOString().split("T")[0];

  await sendEmail({
    to: invoice.customer.email,
    subject: `BrightLoop Invoice ${invoice.number}`,
    text: `Dear ${invoice.customer.name},\n\nPlease find your invoice ${invoice.number} for the total of ${formattedTotal}. It is due on ${dueDateStr}.\n\nThank you for your business,\nBrightLoop Team`,
  });

  return updateInvoiceSentAtRecord(invoice.id);
}

/**
 * Retrieves timeline history for an invoice.
 */
export async function getInvoiceTimeline(session: Session, id: string) {
  requireRole(session, Role.ADMIN, Role.STAFF, Role.CUSTOMER);

  // Validate customer access
  if (session.user.role === Role.CUSTOMER) {
    const invoice = await findInvoiceByIdRecord(id);
    if (!invoice || invoice.customerId !== session.user.customerId) {
      throw new AppError("FORBIDDEN", 403, "Access forbidden");
    }
  }

  return getInvoiceTimelineRecord(id);
}

