-- 1. Sequences
CREATE SEQUENCE subscription_number_seq START 1;
CREATE SEQUENCE invoice_number_seq START 1;

-- 2. Prisma-generated SQL
-- CREATE TABLE ...
-- CREATE INDEX ...
-- CREATE UNIQUE INDEX ...
-- ALTER TABLE ...

-- 3. Custom constraints
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