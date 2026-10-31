import "server-only";

import { db } from "@/server/db";
import {
  SubscriptionStatus,
  InvoiceStatus,
  StatusEntity,
} from "@/generated/prisma/enums";
import { Prisma } from "@/generated/prisma/client";
import type { DiscountCandidate } from "@/server/modules/discounts/schema";
import { getMissedPeriods } from "./periods";
import { computeInvoice } from "./compute";
import type { BillingRunError } from "./schema";

/**
 * Creates a BillingRun log row.
 */
export async function createBillingRunRecord(data: {
  asOfDate: Date;
  startedById?: string | null;
}) {
  return db.billingRun.create({
    data: {
      asOfDate: data.asOfDate,
      startedById: data.startedById,
      startedAt: new Date(),
    },
  });
}

/**
 * Updates a BillingRun log row on completion.
 */
export async function updateBillingRunRecord(
  id: string,
  data: {
    finishedAt: Date;
    created: number;
    skipped: number;
    failed: number;
    errors?: BillingRunError[] | null;
  }
) {
  return db.billingRun.update({
    where: { id },
    data: {
      finishedAt: data.finishedAt,
      created: data.created,
      skipped: data.skipped,
      failed: data.failed,
      errors: data.errors ? (data.errors as unknown as Prisma.InputJsonValue) : Prisma.JsonNull,
    },
  });
}

/**
 * Retrieves past billing runs for history display.
 */
export async function listBillingRunsRecord(limit = 20) {
  return db.billingRun.findMany({
    orderBy: { startedAt: "desc" },
    take: limit,
  });
}

/**
 * Housekeeping 1: Activates CONFIRMED subscriptions whose startDate <= asOfDate.
 * Sets status to ACTIVE, nextPeriodStart to startDate, and logs StatusHistory.
 */
export async function housekeepingActivateConfirmed(
  asOfDate: Date,
  byUserId?: string | null
): Promise<number> {
  const confirmedSubs = await db.subscription.findMany({
    where: {
      status: SubscriptionStatus.CONFIRMED,
      startDate: { lte: asOfDate },
    },
    select: { id: true, startDate: true },
  });

  if (confirmedSubs.length === 0) {
    return 0;
  }

  for (const sub of confirmedSubs) {
    await db.$transaction(async (tx) => {
      await tx.subscription.update({
        where: { id: sub.id },
        data: {
          status: SubscriptionStatus.ACTIVE,
          nextPeriodStart: sub.startDate,
        },
      });

      await tx.statusHistory.create({
        data: {
          entity: StatusEntity.SUBSCRIPTION,
          entityId: sub.id,
          from: SubscriptionStatus.CONFIRMED,
          to: SubscriptionStatus.ACTIVE,
          byUserId,
          note: "Activated by billing run housekeeping at startDate",
        },
      });
    });
  }

  return confirmedSubs.length;
}

/**
 * Housekeeping 2: Closes expired ACTIVE subscriptions with plan.autoClose = true.
 */
export async function housekeepingAutoCloseExpired(
  asOfDate: Date,
  byUserId?: string | null
): Promise<number> {
  const expiredSubs = await db.subscription.findMany({
    where: {
      status: SubscriptionStatus.ACTIVE,
      expiryDate: { lte: asOfDate },
      plan: { autoClose: true },
    },
    select: { id: true },
  });

  if (expiredSubs.length === 0) {
    return 0;
  }

  for (const sub of expiredSubs) {
    await db.$transaction(async (tx) => {
      await tx.subscription.update({
        where: { id: sub.id },
        data: {
          status: SubscriptionStatus.CLOSED,
          closedAt: new Date(),
          closeReason: "Auto-closed after plan expiry",
        },
      });

      await tx.statusHistory.create({
        data: {
          entity: StatusEntity.SUBSCRIPTION,
          entityId: sub.id,
          from: SubscriptionStatus.ACTIVE,
          to: SubscriptionStatus.CLOSED,
          byUserId,
          note: "Auto-closed by billing run housekeeping past plan expiry",
        },
      });
    });
  }

  return expiredSubs.length;
}

/**
 * Finds all active candidate discounts available as of the date.
 */
export async function findActiveCandidateDiscountsRecord(
  asOfDate: Date
): Promise<DiscountCandidate[]> {
  const records = await db.discount.findMany({
    where: {
      isActive: true,
      startDate: { lte: asOfDate },
      endDate: { gte: asOfDate },
    },
    include: {
      products: {
        select: { productId: true },
      },
    },
  });

  return records.filter((d) => d.usedCount < d.usageLimit);
}

/**
 * Finds candidate subscription IDs eligible for billing:
 * ACTIVE, not paused, nextPeriodStart <= asOfDate and < expiryDate.
 */
export async function findCandidateSubscriptionIdsRecord(
  asOfDate: Date
): Promise<string[]> {
  const subs = await db.subscription.findMany({
    where: {
      status: SubscriptionStatus.ACTIVE,
      pausedAt: null,
      nextPeriodStart: {
        not: null,
        lte: asOfDate,
      },
    },
    select: {
      id: true,
      nextPeriodStart: true,
      expiryDate: true,
    },
  });

  // Filter nextPeriodStart < expiryDate
  return subs
    .filter((s) => s.nextPeriodStart !== null && s.nextPeriodStart.getTime() < s.expiryDate.getTime())
    .map((s) => s.id);
}

/**
 * Processes billing for a single subscription in its own transaction using FOR UPDATE SKIP LOCKED.
 * Advance nextPeriodStart in the same transaction.
 * UNIQUE(subscriptionId, periodStart) conflict counts as skipped, not as an error.
 */
export async function processSubscriptionBillingRecord(
  subscriptionId: string,
  asOfDate: Date,
  billingRunId: string,
  candidateDiscounts: DiscountCandidate[]
): Promise<{ created: number; skipped: number }> {
  return db.$transaction(async (tx) => {
    // 1. Lock subscription row using FOR UPDATE SKIP LOCKED
    const lockedRows = await tx.$queryRaw<Array<{ id: string }>>`
      SELECT "id" FROM "Subscription"
      WHERE "id" = ${subscriptionId}
        AND "status" = ${SubscriptionStatus.ACTIVE}::"SubscriptionStatus"
        AND "pausedAt" IS NULL
      FOR UPDATE SKIP LOCKED
    `;

    if (lockedRows.length === 0) {
      // Skipped because locked by another runner or no longer eligible
      return { created: 0, skipped: 0 };
    }

    // 2. Fetch full subscription details inside transaction
    const sub = await tx.subscription.findUnique({
      where: { id: subscriptionId },
      include: {
        plan: true,
        lines: true,
      },
    });

    if (
      !sub ||
      sub.status !== SubscriptionStatus.ACTIVE ||
      sub.pausedAt !== null ||
      !sub.nextPeriodStart ||
      sub.nextPeriodStart.getTime() >= sub.expiryDate.getTime()
    ) {
      return { created: 0, skipped: 0 };
    }

    // 3. Compute missed periods
    const missedSpans = getMissedPeriods(
      sub.startDate,
      sub.plan.billingPeriod,
      sub.nextPeriodStart,
      asOfDate,
      sub.expiryDate
    );

    if (missedSpans.length === 0) {
      return { created: 0, skipped: 0 };
    }

    let created = 0;
    let skipped = 0;

    // 4. Create one invoice per missed period, oldest first
    for (const span of missedSpans) {
      // Check UNIQUE(subscriptionId, periodStart)
      const existing = await tx.invoice.findUnique({
        where: {
          subscriptionId_periodStart: {
            subscriptionId: sub.id,
            periodStart: span.periodStart,
          },
        },
      });

      if (existing) {
        skipped++;
        continue;
      }

      // Compute pure invoice lines and totals
      const computed = computeInvoice(
        {
          id: sub.id,
          customerId: sub.customerId,
          planFee: sub.planFee,
          planTaxRateBps: sub.planTaxRateBps,
          planName: sub.plan.name,
          paymentTerms: sub.paymentTerms,
          lines: sub.lines,
        },
        span.periodStart,
        span.periodEnd,
        candidateDiscounts
      );

      try {
        await tx.invoice.create({
          data: {
            subscriptionId: sub.id,
            customerId: sub.customerId,
            billingRunId,
            periodStart: span.periodStart,
            periodEnd: span.periodEnd,
            status: InvoiceStatus.DRAFT,
            issueDate: computed.issueDate,
            dueDate: computed.dueDate,
            subtotal: computed.subtotal,
            discountTotal: computed.discountTotal,
            taxTotal: computed.taxTotal,
            total: computed.total,
            amountPaid: 0,
            lines: {
              create: computed.lines.map((l) => ({
                kind: l.kind,
                sortOrder: l.sortOrder,
                description: l.description,
                productId: l.productId,
                variantId: l.variantId,
                discountId: l.discountId,
                qty: l.qty,
                unitPrice: l.unitPrice,
                taxRateBps: l.taxRateBps,
                amount: l.amount,
                taxAmount: l.taxAmount,
              })),
            },
          },
        });
        created++;
      } catch (err: unknown) {
        // If unique constraint violation occurs concurrently, count as skipped
        if (
          err instanceof Prisma.PrismaClientKnownRequestError &&
          err.code === "P2002"
        ) {
          skipped++;
        } else {
          throw err;
        }
      }
    }

    // 5. Advance nextPeriodStart in the same transaction
    const finalNextPeriod = missedSpans[missedSpans.length - 1].nextPeriodStart;
    await tx.subscription.update({
      where: { id: sub.id },
      data: { nextPeriodStart: finalNextPeriod },
    });

    return { created, skipped };
  });
}

/**
 * Dry-run preview calculation: counts eligible subscriptions and invoices without modifying the DB.
 */
export async function previewBillingRecord(asOfDate: Date): Promise<{
  eligibleSubscriptions: number;
  invoicesToCreate: number;
  skippedPeriods: number;
  housekeeping: {
    confirmedToActive: number;
    autoClosed: number;
  };
}> {
  // Count housekeeping candidates
  const confirmedToActive = await db.subscription.count({
    where: {
      status: SubscriptionStatus.CONFIRMED,
      startDate: { lte: asOfDate },
    },
  });

  const autoClosed = await db.subscription.count({
    where: {
      status: SubscriptionStatus.ACTIVE,
      expiryDate: { lte: asOfDate },
      plan: { autoClose: true },
    },
  });

  // Fetch active subscriptions
  const activeSubs = await db.subscription.findMany({
    where: {
      status: SubscriptionStatus.ACTIVE,
      pausedAt: null,
      nextPeriodStart: {
        not: null,
        lte: asOfDate,
      },
    },
    include: {
      plan: true,
      invoices: {
        select: { periodStart: true },
      },
    },
  });

  let eligibleSubscriptions = 0;
  let invoicesToCreate = 0;
  let skippedPeriods = 0;

  for (const sub of activeSubs) {
    if (!sub.nextPeriodStart || sub.nextPeriodStart.getTime() >= sub.expiryDate.getTime()) {
      continue;
    }

    const missedSpans = getMissedPeriods(
      sub.startDate,
      sub.plan.billingPeriod,
      sub.nextPeriodStart,
      asOfDate,
      sub.expiryDate
    );

    if (missedSpans.length === 0) {
      continue;
    }

    eligibleSubscriptions++;
    const existingStarts = new Set(
      sub.invoices.map((inv) => inv.periodStart.toISOString().split("T")[0])
    );

    for (const span of missedSpans) {
      const spanKey = span.periodStart.toISOString().split("T")[0];
      if (existingStarts.has(spanKey)) {
        skippedPeriods++;
      } else {
        invoicesToCreate++;
      }
    }
  }

  return {
    eligibleSubscriptions,
    invoicesToCreate,
    skippedPeriods,
    housekeeping: {
      confirmedToActive,
      autoClosed,
    },
  };
}
