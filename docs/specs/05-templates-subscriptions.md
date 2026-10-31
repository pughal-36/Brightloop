# 05 Quotation templates and subscriptions
Purpose: build quotes from templates, run the subscription lifecycle.
Roles: ADMIN and STAFF manage. CUSTOMER views own and accepts quotations (09).
Data: QuotationTemplate(name, planId, validityDays), TemplateLine(productId, variantId?, qty).
  Subscription(number SUB-, customerId, planId, planFee, planTaxRateBps, startDate, expiryDate, paymentTerms, status, pausedAt,
  nextPeriodStart, quotationSentAt, validUntil, closeReason, createdById).
  SubscriptionLine(productId, variantId?, qty, unitPrice, taxRate, amount) snapshotted.
  StatusHistory(entity, entityId, from, to, byUserId, at, note).
Rules:
- Subscription has planFee and planTaxRateBps snapshots taken from the plan at creation.
- Create from a template: copies plan and lines, validUntil = sentAt + validityDays. Creating from scratch is also allowed.
- Each line qty >= plan.minQty. Tax defaults from the product, overridable per line. All totals computed server-side.
- Transitions (single function, writes StatusHistory):
  Draft -> Quotation (send). Quotation -> Confirmed (staff or customer accepts; blocked after validUntil).
  Confirmed -> Active (startDate reached, automatic or manual by staff). Active -> Closed (early close needs plan.closable;
  autoClose plans close when expiry passes). Quotation -> Closed (declined or expired, with reason).
- Pause and resume only if plan.pausable. Renew only if plan.renewable: expiryDate += one billing period, any payment status.
- Draft can be edited and deleted. A sent quotation is immutable and never deleted.
- Invalid transitions return CONFLICT.
Actions: createFromTemplate, createBlank, updateDraft, deleteDraft, sendQuotation, confirm, activate, pause, resume, close, renew,
  list with filters (status, customer, plan), detail.
UI: list with status badges, detail page with a status timeline from StatusHistory, line editor with live server-computed totals,
  buttons shown only for allowed transitions.
Done when: every transition tested including illegal ones; flags enforced; sent quotation can't be deleted or edited;
  history shows who moved it and when.
