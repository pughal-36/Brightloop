# 04 Plans
Purpose: recurring plan definitions.
Roles: ADMIN writes. STAFF reads.
Data: Plan(name, price, billingPeriod DAILY|WEEKLY|MONTHLY|YEARLY, minQty, availableFrom, availableTo,
  autoClose, closable, pausable, renewable, isActive).
Rules:
- minQty >= 1. availableTo >= availableFrom. Price in paise >= 0.
- Selectable on a new subscription only within the availability window and when isActive.
- Flags are decided per plan and enforced server-side by 05 and 07:
  autoClose = closes itself at expiry. closable = may be closed early. pausable. renewable.
- Editing a plan never changes existing subscriptions or invoices.
- How plan price relates to line prices: see OPEN-A.
Actions: create/update/deactivate plan, list.
UI: /admin/plans with flag toggles and a clear summary of what each flag allows.
Done when: unavailable or inactive plans can't be chosen; flags visible and enforced; validation tests.