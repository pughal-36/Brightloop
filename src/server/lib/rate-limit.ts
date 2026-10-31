import "server-only";

interface RateLimitEntry {
  timestamps: number[];
}

const emailResetRequestMap = new Map<string, RateLimitEntry>();

/**
 * Checks and records a password reset request attempt for the given email.
 * Limits to 3 requests per hour per email.
 * Returns true if allowed, false if limit exceeded.
 */
export function checkPasswordResetRateLimit(email: string): boolean {
  const normalized = email.trim().toLowerCase();
  const now = Date.now();
  const windowMs = 60 * 60 * 1000; // 1 hour
  const windowStart = now - windowMs;

  const entry = emailResetRequestMap.get(normalized) ?? { timestamps: [] };
  entry.timestamps = entry.timestamps.filter((ts) => ts > windowStart);

  if (entry.timestamps.length >= 3) {
    emailResetRequestMap.set(normalized, entry);
    return false;
  }

  entry.timestamps.push(now);
  emailResetRequestMap.set(normalized, entry);
  return true;
}

/**
 * Resets the in-memory rate limits (primarily for tests).
 */
export function clearRateLimitsForTesting(): void {
  emailResetRequestMap.clear();
}
