# 03 Catalog: products, variants, taxes
Purpose: admin-managed sellable products, variants and tax rates.
Roles: ADMIN writes. STAFF reads. CUSTOMER never sees cost price.
Data: Product(name, type, salesPrice, costPrice, notes, taxId, isActive),
  ProductVariant(productId, attribute e.g. "Brand", value e.g. "Odoo", extraPrice),
  Tax(name, rateBps, isActive). Money in paise.
Rules:
- Product.type is the enum SERVICE, SOFTWARE, ADD_ON, PHYSICAL, OTHER.
- Effective unit price = salesPrice + variant.extraPrice (Odoo brand adds 560 INR).
- Prices >= 0. Tax rateBps between 0 and 10000 (basis points, 1800 = 18%). Variant (productId, attribute, value) unique.
- Products or taxes referenced by subscriptions are deactivated, never hard-deleted.
- Changing prices or taxes never alters existing subscription lines or invoices (they are snapshots).
Actions: create/update/deactivate product, variant CRUD, tax CRUD, list with search and pagination.
UI: /admin/products (list, detail with variants and margin = sales - cost), /admin/taxes.
Done when: variant price math shown correctly; STAFF write attempts return 403; cost price absent from every
  customer-facing response.
