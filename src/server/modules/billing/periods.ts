/**
 * Pure period math for BrightLoop Billing Engine.
 *
 * Rules:
 * - Periods are computed from startDate + n periods (not from the previous end) so month-end dates don't drift.
 * - periodEnd = next period start - 1 day.
 * - Invoice issued in advance at period start.
 * - Daily, weekly, monthly, yearly.
 */

import { BillingPeriod } from "@/generated/prisma/enums";
import { addDays, addBillingPeriod } from "@/lib/dates";

export interface BillingPeriodSpan {
  periodIndex: number;
  periodStart: Date;
  periodEnd: Date;
  nextPeriodStart: Date;
}

/**
 * Computes the exact start date for the Nth billing period starting from startDate.
 * N = 0 is startDate itself.
 * Uses startDate + n periods directly to prevent month-end date drift.
 */
export function computeNthPeriodStart(startDate: Date, period: BillingPeriod, n: number): Date {
  if (n === 0) {
    return new Date(Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth(), startDate.getUTCDate()));
  }
  return addBillingPeriod(startDate, period, n);
}

/**
 * Computes the period span (periodStart, periodEnd, nextPeriodStart) for period N.
 * periodEnd = next period start - 1 day.
 */
export function computePeriodSpan(startDate: Date, period: BillingPeriod, n: number): BillingPeriodSpan {
  const periodStart = computeNthPeriodStart(startDate, period, n);
  const nextPeriodStart = computeNthPeriodStart(startDate, period, n + 1);
  const periodEnd = addDays(nextPeriodStart, -1);

  return {
    periodIndex: n,
    periodStart,
    periodEnd,
    nextPeriodStart,
  };
}

/**
 * Finds the period index n corresponding to a given cursor date.
 * If cursor matches computeNthPeriodStart(startDate, period, n), returns n.
 * If cursor is between periods, returns the index of the period starting on or before cursor.
 */
export function findPeriodIndex(startDate: Date, period: BillingPeriod, cursor: Date): number {
  const cursorTime = new Date(
    Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth(), cursor.getUTCDate())
  ).getTime();
  const startTime = new Date(
    Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth(), startDate.getUTCDate())
  ).getTime();

  if (cursorTime <= startTime) {
    return 0;
  }

  // Iterate forward to find matching or enclosing period
  let n = 0;
  while (true) {
    const nextStart = computeNthPeriodStart(startDate, period, n + 1);
    if (nextStart.getTime() > cursorTime) {
      return n;
    }
    n++;
    // Safety cap for astronomical iterations
    if (n > 10000) {
      return n;
    }
  }
}

/**
 * Computes all missed billing periods starting from currentCursor up to asOfDate.
 *
 * Rules:
 * - Active subscriptions with periodStart <= asOfDate and periodStart < expiryDate
 * - Evaluated oldest first
 */
export function getMissedPeriods(
  startDate: Date,
  period: BillingPeriod,
  currentCursor: Date,
  asOfDate: Date,
  expiryDate: Date
): BillingPeriodSpan[] {
  const asOfTime = new Date(
    Date.UTC(asOfDate.getUTCFullYear(), asOfDate.getUTCMonth(), asOfDate.getUTCDate())
  ).getTime();
  const expiryTime = new Date(
    Date.UTC(expiryDate.getUTCFullYear(), expiryDate.getUTCMonth(), expiryDate.getUTCDate())
  ).getTime();

  const periods: BillingPeriodSpan[] = [];
  let n = findPeriodIndex(startDate, period, currentCursor);

  // If currentCursor is past computeNthPeriodStart(startDate, period, n), advance to next
  const currentStart = computeNthPeriodStart(startDate, period, n);
  const cursorTime = new Date(
    Date.UTC(currentCursor.getUTCFullYear(), currentCursor.getUTCMonth(), currentCursor.getUTCDate())
  ).getTime();
  if (currentStart.getTime() < cursorTime) {
    n++;
  }

  while (true) {
    const span = computePeriodSpan(startDate, period, n);
    const pStartTime = span.periodStart.getTime();

    // Must be on or before asOfDate
    if (pStartTime > asOfTime) {
      break;
    }

    // Must be strictly before expiryDate
    if (pStartTime >= expiryTime) {
      break;
    }

    periods.push(span);
    n++;

    // Safety guard
    if (periods.length > 500) {
      break;
    }
  }

  return periods;
}

