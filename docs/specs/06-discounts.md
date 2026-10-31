# 06 Discounts
Purpose: admin-defined discount rules applied automatically at billing.
Roles: ADMIN only (create/edit). STAFF read.
Data: Discount(name, type FIXED|PERCENT, value, minPurchase, minQty, startDate, endDate, usageLimit, usedCount,
  scope PRODUCTS|SUBSCRIPTION, isActive), DiscountProduct(discountId, productId), DiscountApplication(discountId, invoiceId, amount).
Rules:
- PERCENT value 0-100. FIXED amount in paise. A fixed discount never exceeds the base it applies to.
- Eligible when: today within dates, usedCount < usageLimit, and minPurchase (pre-tax subtotal) and minQty are met.
- Scope PRODUCTS: applies to matching lines only. Scope SUBSCRIPTION: applies to the whole subtotal.
- Best single discount: pick the eligible discount with the largest amount. Never stack.
- Applies automatically to every invoice while eligible. Appears as its own negative invoice line.
- usedCount increments atomically when the invoice is Confirmed: UPDATE ... WHERE usedCount < usageLimit.
  Re-validate at confirm. If exhausted by then, see OPEN-C.
- Cancelling a Confirmed invoice with no payments releases the use (decrement).
Actions: create/update/deactivate, list with usage, evaluateBestDiscount(subscription, lines, date) as a pure function.
UI: /admin/discounts with usage bar (used / limit) and status (active, expired, exhausted).
Done when: pure-function tests for dates, limits, min thresholds, scope, best-of-many; concurrent confirm never exceeds the limit.