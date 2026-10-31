# Database Schema Notes & Custom Constraints

The following custom CHECK constraints must be appended to the initial database migration (`migration.sql`):

```sql
ALTER TABLE "Discount"
ADD CONSTRAINT discount_usage_chk
CHECK ("usedCount" >= 0 AND "usedCount" <= "usageLimit");

ALTER TABLE "Discount"
ADD CONSTRAINT discount_value_chk
CHECK ("value" >= 0);

ALTER TABLE "Invoice"
ADD CONSTRAINT invoice_paid_chk
CHECK ("amountPaid" >= 0 AND "amountPaid" <= "total");

ALTER TABLE "Plan"
ADD CONSTRAINT plan_minqty_chk
CHECK ("minQty" >= 1);

ALTER TABLE "Payment"
ADD CONSTRAINT payment_amount_chk
CHECK ("amount" > 0);
```

