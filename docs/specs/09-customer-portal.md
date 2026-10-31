# 09 Customer portal
Purpose: customers see and act on their own account without emailing anyone.
Roles: CUSTOMER only.
Data: reads Subscription, Invoice, Payment scoped to session.customerId.
Rules:
- Every query filters by the customer behind the session. Another customer's record returns 404 (not 403) to avoid leaking existence.
- Allowed actions: view subscriptions and status timeline, accept a quotation (Quotation -> Confirmed, blocked after validUntil),
  view and print invoices, pay invoices via Razorpay, view payment history.
- Not allowed: pause, close, renew, edit anything. Those controls don't render and the actions reject customer sessions.
- Cost price, internal notes and staff names never appear in customer responses.
Actions: listMySubscriptions, getMySubscription, acceptQuotation, listMyInvoices, getMyInvoice, startPayment (08), listMyPayments.
UI: /portal dashboard (active subscriptions, amount due, overdue banner), subscriptions, quotations, invoices, payment result pages
  (success, failed with reason and retry).
Done when: changing an ID in the URL to another customer's record gives 404; accepting after validUntil is rejected;
  a customer session calling staff actions gets 403 server-side.