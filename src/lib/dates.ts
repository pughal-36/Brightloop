/**
 * Date and timezone helpers for BrightLoop.
 * Domain rule: APP_TZ = Asia/Kolkata for all "today" calculations.
 */

import { BillingPeriod } from "@/generated/prisma/enums";

export const APP_TZ = "Asia/Kolkata";

/**
 * Returns today's date formatted as YYYY-MM-DD in Asia/Kolkata timezone.
 */
export function getTodayDateString(referenceDate: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: APP_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(referenceDate);
}

/**
 * Returns a Date object representing midnight UTC for today's date in Asia/Kolkata timezone.
 * Suitable for Prisma @db.Date fields.
 */
export function getToday(referenceDate: Date = new Date()): Date {
  const dateStr = getTodayDateString(referenceDate);
  return new Date(`${dateStr}T00:00:00.000Z`);
}

/**
 * Alias for getToday().
 */
export const today = getToday;

/**
 * Adds days to a date, returning a new Date object at UTC midnight.
 */
export function addDays(date: Date, days: number): Date {
  const result = new Date(date.getTime());
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

/**
 * Subtracts days from a date, returning a new Date object at UTC midnight.
 */
export function subDays(date: Date, days: number): Date {
  return addDays(date, -days);
}

/**
 * Adds billing periods to a date, returning a new Date object at UTC midnight.
 * Preserves day of month where possible, clipping to the last day of the month if needed.
 */
export function addBillingPeriod(date: Date, period: BillingPeriod, count = 1): Date {
  const d = new Date(date.getTime());
  if (count === 0) return d;

  switch (period) {
    case BillingPeriod.DAILY:
      return addDays(d, count);
    case BillingPeriod.WEEKLY:
      return addDays(d, count * 7);
    case BillingPeriod.MONTHLY: {
      const year = d.getUTCFullYear();
      const month = d.getUTCMonth();
      const day = d.getUTCDate();
      const targetYear = year + Math.floor((month + count) / 12);
      const targetMonth = ((month + count) % 12 + 12) % 12;
      const lastDay = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate();
      return new Date(Date.UTC(targetYear, targetMonth, Math.min(day, lastDay)));
    }
    case BillingPeriod.YEARLY: {
      const year = d.getUTCFullYear() + count;
      const month = d.getUTCMonth();
      const day = d.getUTCDate();
      const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
      return new Date(Date.UTC(year, month, Math.min(day, lastDay)));
    }
    default:
      return addDays(d, count);
  }
}

/**
 * On resume, moves nextPeriodStart to the first period start on or after the resume date.
 */
export function getNextPeriodStartOnOrAfter(
  initialPeriodStart: Date,
  period: BillingPeriod,
  resumeDate: Date
): Date {
  let cursor = new Date(initialPeriodStart.getTime());
  // Normalize resumeDate to UTC midnight comparison
  const resumeTime = new Date(
    Date.UTC(resumeDate.getUTCFullYear(), resumeDate.getUTCMonth(), resumeDate.getUTCDate())
  ).getTime();

  while (cursor.getTime() < resumeTime) {
    cursor = addBillingPeriod(cursor, period, 1);
  }
  return cursor;
}

