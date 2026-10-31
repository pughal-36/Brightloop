# 06 Discounts
Purpose: admin-defined discount rules applied automatically at billing.
Roles: ADMIN only (create/edit). STAFF read.
Data: Discount(name, type FIXED|PERCENT, value, minPurchase, minQty, startDate, endDate, usageLimit, usedCount,
  scope PRODUCTS|SUBSCRIPTION, isActive), DiscountProduct(discountId, productId), DiscountApplication(discountId, invoiceId, amount).
Rules:
- Percent discounts are stored in basis points (e.g. 1000 = 10.00%, 0..10000). FIXED amount in paise. A fixed discount never exceeds the base it applies to.
- Eligible when: today within dates, usedCount < usageLimit, and minPurchase (pre-tax subtotal) and minQty are met.
- Scope SUBSCRIPTION applies to the whole pre-tax subtotal including the plan fee; scope PRODUCTS applies to matching product lines only and never to the plan fee.
- Best single discount: pick the eligible discount with the largest amount. Never stack.
- Applies automatically to every invoice while eligible. Appears as its own negative invoice line.
- At confirm, re-validate the applied discount. If no longer valid (expired, exhausted, thresholds unmet): remove the DISCOUNT line, recalculate totals, leave the invoice in Draft, return RECONFIRM_REQUIRED with old and new totals; the user must confirm again. In bulk confirm these are skipped and listed.
- DiscountApplication is created at confirm (one counted use). Cancelling that invoice deletes it and decrements usedCount.
Actions: create/update/deactivate, list with usage, evaluateBestDiscount(subscription, lines, date) as a pure function.
UI: /admin/discounts with usage bar (used / limit) and status (active, expired, exhausted).
Done when: pure-function tests for dates, limits, min thresholds, scope, best-of-many; concurrent confirm never exceeds the limit.
