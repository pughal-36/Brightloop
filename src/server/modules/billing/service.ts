import "server-only";

import { Role } from "@/generated/prisma/enums";
import { requireRole } from "@/server/lib/session";
import type { Session } from "@/server/lib/session";
import { getToday } from "@/lib/dates";
import {
  runBillingSchema,
  previewBillingSchema,
  type BillingRunSummary,
  type BillingPreviewSummary,
  type BillingRunError,
} from "./schema";
import {
  createBillingRunRecord,
  updateBillingRunRecord,
  listBillingRunsRecord,
  housekeepingActivateConfirmed,
  housekeepingAutoCloseExpired,
  findActiveCandidateDiscountsRecord,
  findCandidateSubscriptionIdsRecord,
  processSubscriptionBillingRecord,
  previewBillingRecord,
} from "./repo";

/**
 * Runs the billing engine as of a given date (defaults to today in Asia/Kolkata).
 * Callable by ADMIN or STAFF, or by cron (session = null).
 */
export async function runBilling(
  session?: Session | null,
  rawInput?: unknown
): Promise<BillingRunSummary> {
  if (session) {
    requireRole(session, Role.ADMIN, Role.STAFF);
  }

  const input = runBillingSchema.parse(rawInput ?? {});
  const effectiveAsOfDate = input.asOfDate ? getToday(input.asOfDate) : getToday();
  const startedById = session?.user?.id ?? null;

  // 1. Create BillingRun log row
  const billingRun = await createBillingRunRecord({
    asOfDate: effectiveAsOfDate,
    startedById,
  });

  // 2. Housekeeping: activate confirmed subscriptions at startDate
  await housekeepingActivateConfirmed(effectiveAsOfDate, startedById);

  // 3. Find candidate discounts and eligible subscriptions
  const candidateDiscounts = await findActiveCandidateDiscountsRecord(effectiveAsOfDate);
  const candidateIds = await findCandidateSubscriptionIdsRecord(effectiveAsOfDate);

  let totalCreated = 0;
  let totalSkipped = 0;
  let totalFailed = 0;
  const errors: BillingRunError[] = [];

  // 4. Process each subscription in its own transaction
  for (const subId of candidateIds) {
    try {
      const { created, skipped } = await processSubscriptionBillingRecord(
        subId,
        effectiveAsOfDate,
        billingRun.id,
        candidateDiscounts
      );
      totalCreated += created;
      totalSkipped += skipped;
    } catch (err: unknown) {
      totalFailed++;
      const errorMessage = err instanceof Error ? err.message : String(err);
      errors.push({
        subscriptionId: subId,
        error: errorMessage,
      });
    }
  }

  // 5. Housekeeping: autoClose plans past expiry
  await housekeepingAutoCloseExpired(effectiveAsOfDate, startedById);

  // 6. Complete BillingRun record
  const finishedAt = new Date();
  const updatedRun = await updateBillingRunRecord(billingRun.id, {
    finishedAt,
    created: totalCreated,
    skipped: totalSkipped,
    failed: totalFailed,
    errors: errors.length > 0 ? errors : null,
  });

  return {
    id: updatedRun.id,
    asOfDate: updatedRun.asOfDate,
    startedById: updatedRun.startedById,
    startedAt: updatedRun.startedAt,
    finishedAt: updatedRun.finishedAt,
    created: updatedRun.created,
    skipped: updatedRun.skipped,
    failed: updatedRun.failed,
    errors: errors.length > 0 ? errors : null,
  };
}

/**
 * Previews billing execution without creating invoices or modifying the database.
 */
export async function previewBilling(
  session: Session,
  rawInput?: unknown
): Promise<BillingPreviewSummary> {
  requireRole(session, Role.ADMIN, Role.STAFF);

  const input = previewBillingSchema.parse(rawInput ?? {});
  const effectiveAsOfDate = input.asOfDate ? getToday(input.asOfDate) : getToday();

  const preview = await previewBillingRecord(effectiveAsOfDate);

  return {
    asOfDate: effectiveAsOfDate,
    eligibleSubscriptions: preview.eligibleSubscriptions,
    invoicesToCreate: preview.invoicesToCreate,
    skippedPeriods: preview.skippedPeriods,
    housekeeping: preview.housekeeping,
  };
}

/**
 * Lists past billing runs for history view.
 */
export async function listBillingRuns(
  session: Session,
  limit = 20
): Promise<BillingRunSummary[]> {
  requireRole(session, Role.ADMIN, Role.STAFF);

  const runs = await listBillingRunsRecord(limit);
  return runs.map((r) => ({
    id: r.id,
    asOfDate: r.asOfDate,
    startedById: r.startedById,
    startedAt: r.startedAt,
    finishedAt: r.finishedAt,
    created: r.created,
    skipped: r.skipped,
    failed: r.failed,
    errors: (r.errors as unknown as BillingRunError[]) || null,
  }));
}
