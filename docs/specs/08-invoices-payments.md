# 08 Invoices and payments
Purpose: invoice lifecycle, manual payments, Razorpay with a proper failure flow.
Roles: ADMIN and STAFF manage. CUSTOMER views and pays own (09).
Data: Invoice(number INV-, subscriptionId, customerId, periodStart, periodEnd, status Draft|Confirmed|Paid|Cancelled, issueDate,
  dueDate, subtotal, discountTotal, taxTotal, total, amountPaid, sentAt), InvoiceLine(kind PRODUCT|PLAN_FEE|DISCOUNT, description, qty,
  unitPrice, taxRate, amount), Payment(invoiceId, method BANK_TRANSFER|UPI|CARD|NETBANKING|CASH|CHEQUE, provider MANUAL|RAZORPAY, amount, paidOn, note, recordedById, voidedAt),
  PaymentAttempt(invoiceId, razorpayOrderId, razorpayPaymentId?, status CREATED|FAILED|SUCCEEDED, failureReason, at), WebhookEvent(eventId unique).
Rules:
- Draft -> Confirmed (single or bulk). Confirm increments discount usage (06) and freezes lines. Draft or Confirmed (no payments) -> Cancelled.
- Send: email the invoice to the customer and set sentAt. Print: print-styled page. Both available for any non-draft invoice.
- Record payment: only on Confirmed invoices. amount > 0 and <= balance. Payment method is BANK_TRANSFER | UPI | CARD | NETBANKING | CASH | CHEQUE; provider is MANUAL | RAZORPAY, stored separately. For Razorpay, restrict checkout to card, UPI and netbanking and map the result to method. Payments are never deleted; ADMIN may void with a note.
- Paid is automatic when sum of non-voided payments >= total. Partial payments leave the invoice Confirmed.
- Overdue is derived: Confirmed, dueDate < today, balance > 0. Never stored.
- Razorpay: create order server-side for the invoice balance. Verify the payment signature on return. Webhook verifies HMAC over the raw body,
  dedupes by eventId, handles payment.captured (create Payment) and payment.failed (mark attempt FAILED with reason).
- Failure never changes invoice status. The customer sees the reason and a retry button. Staff can see failed attempts on the invoice.
- Amounts always come from the server, never from the client.
Actions: confirmInvoice, bulkConfirm, cancelInvoice, sendInvoice, recordPayment, voidPayment, createRazorpayOrder, verifyPayment, handleWebhook.
UI: /admin/invoices with filters (status, overdue, customer, date range), detail with lines, payments, attempts. Print page. Outstanding and overdue views.
Done when: partial then full payment flips to Paid; overpayment rejected; duplicate webhook records one payment; bad signature rejected;
  failure test (failure@razorpay UPI) shows reason and retry; confirmed invoice lines can't be edited.
