"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/server/lib/session";
import {
  confirmInvoice,
  bulkConfirm,
  cancelInvoice,
  recordPayment,
  voidPayment,
  sendInvoice,
} from "@/server/modules/invoices";
import { PaymentMethod } from "@/generated/prisma/enums";

export async function confirmInvoiceAction(invoiceId: string) {
  const session = await requireSession();
  try {
    const result = await confirmInvoice(session, { invoiceId });
    revalidatePath("/admin/invoices");
    revalidatePath(`/admin/invoices/${invoiceId}`);
    return { ok: true, data: result };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to confirm invoice";
    return { ok: false, error: message };
  }
}

export async function bulkConfirmAction(invoiceIds: string[]) {
  const session = await requireSession();
  try {
    const result = await bulkConfirm(session, { invoiceIds });
    revalidatePath("/admin/invoices");
    return { ok: true, data: result };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Bulk confirm failed";
    return { ok: false, error: message };
  }
}

export async function cancelInvoiceAction(invoiceId: string, reason?: string) {
  const session = await requireSession();
  try {
    const result = await cancelInvoice(session, { invoiceId, reason });
    revalidatePath("/admin/invoices");
    revalidatePath(`/admin/invoices/${invoiceId}`);
    return { ok: true, data: result };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to cancel invoice";
    return { ok: false, error: message };
  }
}

export async function recordPaymentAction(formData: FormData) {
  const session = await requireSession();
  const invoiceId = formData.get("invoiceId")?.toString() || "";
  const method = formData.get("method")?.toString() as PaymentMethod;
  const amountStr = formData.get("amount")?.toString() || "0";
  const amount = parseInt(amountStr, 10);
  const paidOnStr = formData.get("paidOn")?.toString();
  const paidOn = paidOnStr ? new Date(`${paidOnStr}T00:00:00.000Z`) : undefined;
  const note = formData.get("note")?.toString();

  try {
    const result = await recordPayment(session, {
      invoiceId,
      method,
      amount,
      paidOn,
      note,
    });
    revalidatePath("/admin/invoices");
    revalidatePath(`/admin/invoices/${invoiceId}`);
    return { ok: true, data: result };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to record payment";
    return { ok: false, error: message };
  }
}

export async function voidPaymentAction(paymentId: string, note: string) {
  const session = await requireSession();
  try {
    const result = await voidPayment(session, { paymentId, note });
    revalidatePath("/admin/invoices");
    return { ok: true, data: result };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to void payment";
    return { ok: false, error: message };
  }
}

export async function sendInvoiceAction(invoiceId: string) {
  const session = await requireSession();
  try {
    const result = await sendInvoice(session, { invoiceId });
    revalidatePath("/admin/invoices");
    revalidatePath(`/admin/invoices/${invoiceId}`);
    return { ok: true, data: result };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to send invoice";
    return { ok: false, error: message };
  }
}

