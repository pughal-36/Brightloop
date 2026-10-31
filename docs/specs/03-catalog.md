# 03 Catalog: products, variants, taxes
Purpose: admin-managed sellable products, variants and tax rates.
Roles: ADMIN writes. STAFF reads. CUSTOMER never sees cost price.
Data: Product(name, type, salesPrice, costPrice, notes, taxId, isActive),
  ProductVariant(productId, attribute e.g. "Brand", value e.g. "Odoo", extraPrice),
  Tax(name, ratePercent, isActive). Money in paise.
Rules:
- Effective unit price = salesPrice + variant.extraPrice (Odoo brand adds 560 INR).
- Prices >= 0. ratePercent between 0 and 100. Variant (productId, attribute, value) unique.
- Products or taxes referenced by subscriptions are deactivated, never hard-deleted.
- Changing prices or taxes never alters existing subscription lines or invoices (they are snapshots).
- Product.type values: see OPEN-B in the open questions.
Actions: create/update/deactivate product, variant CRUD, tax CRUD, list with search and pagination.
UI: /admin/products (list, detail with variants and margin = sales - cost), /admin/taxes.
Done when: variant price math shown correctly; STAFF write attempts return 403; cost price absent from every
  customer-facing response.