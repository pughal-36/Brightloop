# Domain rules (source of truth. Code must match this.)

## Money
- Currency INR. Store integers in paise. Only lib/money.ts may convert or format.
- Tax = percentage rate attached to a product, overridable per subscription line.
- Line amount = qty × unit price (base price + variant extra). Totals computed server-side only.

## Roles
- ADMIN: everything. Only role that creates staff, discounts, taxes, products, plans.
- STAFF: customers, quotations, subscriptions, invoices, payments. No catalog/discount/tax/staff admin.
- CUSTOMER: own subscriptions, invoices, payments only. Every query scoped by customerId.

## Auth
- Email unique. Password length >= 9, with upper, lower, special char.
- Reset token: random, stored hashed, expires, single use. Same response whether or not the email exists.

## Plan
- Fields: price, period (DAILY|WEEKLY|MONTHLY|YEARLY), minQty, availableFrom/To.
- Per-plan flags (admin sets): autoClose, closable, pausable, renewable.
- autoClose: subscription closes itself when expiry passes.
- Plan is selectable only inside its availability window.

## Subscription states
Draft → Quotation → Confirmed → Active → Closed
- Paused = Active with pausedAt set (only if plan.pausable). Billing skips paused subscriptions.
- Early close only if plan.closable. Renew only if plan.renewable.
- Every transition goes through one function and writes a status_history row (from, to, by, at).
- Quotation created from a template copies plan + lines and sets validUntil = now + template.validityDays.

## Invoice states
Draft → Confirmed → Paid  (+ Cancelled from Draft/Confirmed)
- Lines are snapshots (name, unit price, tax rate, discount) taken at creation. Immutable after Confirmed.
- Paid is set automatically when sum(payments) >= total. Partial payments leave it Confirmed.
- Overdue is derived, never stored: Confirmed AND dueDate < today AND balance > 0.

## Billing engine
- runBilling(asOfDate) selects Active, non-paused subscriptions whose next period starts <= asOfDate.
- Idempotent: UNIQUE(subscriptionId, periodStart) on invoices. Running twice creates nothing new.
- Catch-up: if periods were missed, create one invoice per missed period, in order.
- Runs per subscription in a transaction; batches use FOR UPDATE SKIP LOCKED.
- Admin "as of" date control exists for demos.

## Discounts (admin only)
- Fixed or percentage; minPurchase and/or minQty; start/end dates; usageLimit.
- Scope: specific products, or whole subscription.
- Applied automatically at invoice creation when all conditions hold. Appears as its own invoice line.
- usedCount incremented atomically (UPDATE ... WHERE usedCount < usageLimit). Stops at expiry or limit.

## Payments
- Fields: invoiceId, method, amount, date, note, source (MANUAL|RAZORPAY).
- Razorpay: order created server-side; verify payment signature and webhook signature (raw body).
- payment_attempts: CREATED → FAILED | SUCCEEDED. Failure leaves invoice Confirmed and allows retry.
- Webhooks idempotent by event id.

## Reports
- Active subscriptions = status Active (including Paused, shown separately).
- Revenue collected = sum of payments. Outstanding = sum of balances on Confirmed invoices.
- MRR = sum of active subscription recurring totals normalized to monthly:
  yearly ÷ 12, weekly × 52/12, daily × 365/12. ARR = MRR × 12.
- All aggregates in SQL. Server-side pagination. Target < 2s with thousands of rows.

## Decisions (final)
- Payment terms: IMMEDIATE (due on issue), NET_15, NET_30. dueDate = issueDate + terms.
- Money rates are basis points (e.g. 1800 = 18.00%, 0..10000).
- APP_TZ = Asia/Kolkata for all "today" calculations.
- Tax rounds half-up per line (tax exclusive, added on top of the discounted line amount).
- Billing in advance: the invoice for a period is issued when that period starts.
- Discounts: only the single best discount (largest amount) applies per invoice.
- Discount usedCount increments when an invoice is finalized (Confirmed), not when Draft.
- Renew: expiry extends by one billing period. Allowed regardless of payment status. Needs plan.renewable.
- Customer portal: view, accept quotations, pay invoices. No pause/close/renew by customers.
- Unsent Draft subscriptions can be deleted. Once a quotation is sent it is never deleted.
  A sent quotation that is declined or expires goes to Closed with a reason (history kept).
- Numbers: SUB-000001 and INV-000001, from Postgres sequences, assigned at creation. Gaps allowed.
- Pause: periods that fall inside a pause are skipped, not caught up. On resume the billing
  cursor moves to the first period start on or after the resume date.
