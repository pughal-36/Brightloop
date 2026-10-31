/**
 * Date and timezone helpers for BrightLoop.
 * Domain rule: APP_TZ = Asia/Kolkata for all "today" calculations.
 */

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

