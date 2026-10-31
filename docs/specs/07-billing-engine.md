# 07 Billing engine
Purpose: create invoices from subscriptions with no manual typing, never twice, never skipped.
Roles: ADMIN and STAFF run it. Also callable by a scheduled route with a secret.
Data: uses Invoice and InvoiceLine from 08. BillingRun(asOfDate, startedBy, startedAt, finishedAt, created, skipped, failed, errors).
Rules:
- Selects Active, non-paused subscriptions with nextPeriodStart <= asOfDate and nextPeriodStart < expiryDate.
- Periods are computed from startDate + n periods (not from the previous end) so month-end dates don't drift.
  periodEnd = next period start - 1 day. Invoice issued in advance at period start.
- Catch-up: create one invoice per missed period, oldest first. Paused periods are skipped (see domain Decisions).
- Idempotent: UNIQUE(subscriptionId, periodStart). On conflict skip and count as skipped.
- Each subscription is processed in its own transaction using FOR UPDATE SKIP LOCKED. One failure is recorded and the batch continues.
- Invoice is created as Draft: lines snapshot product, qty, unit price, tax rate; best discount (06) added as a line; tax computed
  on the discounted base per line; totals; dueDate from payment terms; number from the INV sequence.
- Housekeeping in the same run: Confirmed -> Active when startDate arrives; autoClose plans close past expiry.
- Plan price handling: see OPEN-A.
- asOfDate defaults to today. Admin can set it to any date for demos (clearly labeled).
Actions: previewBilling(asOf) (dry run, counts only), runBilling(asOf), listBillingRuns.
UI: /admin/billing with date picker, Preview, Run, result summary, run history with errors.
Done when (Vitest): second run creates 0; a 3-month gap creates 3 invoices; paused subscription skipped and not caught up after resume;
  expired subscription gets no further invoice; month-end start dates correct; discount applied and tax math matches by hand; one bad
  subscription doesn't stop the batch.