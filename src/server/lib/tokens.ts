import "server-only";
import crypto from "node:crypto";

/**
 * Generates a cryptographically secure random token of 32 random bytes, base64url encoded.
 */
export function generateResetToken(): string {
  return crypto.randomBytes(32).toString("base64url");
}

/**
 * Computes the SHA-256 hash of a token in hex format.
 */
export function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}
