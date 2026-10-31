# 10 Dashboard and reports
Purpose: one place for the finance lead to see the business.
Roles: ADMIN and STAFF (read only).
Rules:
- KPIs: active subscriptions (paused counted separately), MRR, ARR (MRR x 12), revenue collected, outstanding balance, overdue count and amount.
- MRR normalizes each active subscription's recurring total to monthly: yearly / 12, weekly x 52/12, daily x 365/12.
- Revenue collected = sum of non-voided payments in range. Outstanding = sum of balances on Confirmed invoices. Overdue as in 08.
- Sections: KPI strip, revenue by month chart, subscriptions by status, overdue invoices table, recent payments.
- Filters: date range, plan, customer, status. Summary view plus detail tables with server-side pagination and sorting.
- Every aggregate is a SQL query. No loading full tables into JS.
- Indexes at minimum: invoices(status, dueDate), invoices(customerId), invoices(subscriptionId, periodStart) unique,
  payments(invoiceId), payments(paidOn), subscriptions(status), subscriptions(customerId), subscriptions(nextPeriodStart).
- Show the page's server time in the footer during demo mode.
Done when: with the full seed (11) each page responds in < 2s; numbers match a hand-checked small dataset; filters change results correctly.