-- CreateIndex
CREATE INDEX "Invoice_customerId_idx" ON "Invoice"("customerId");

-- CreateIndex
CREATE INDEX "Subscription_nextPeriodStart_idx" ON "Subscription"("nextPeriodStart");
