/**
 * Money utilities for BrightLoop.
 * Hard rule: Money is strictly integer paise. Never floats.
 */

function assertIntegerPaise(amount: number, paramName = "amount"): void {
  if (!Number.isSafeInteger(amount)) {
    throw new TypeError(`Expected ${paramName} to be a safe integer in paise, received: ${amount}`);
  }
}

/**
 * Adds integer paise amounts together.
 */
export function add(a: number, b: number, ...rest: number[]): number {
  assertIntegerPaise(a, "a");
  assertIntegerPaise(b, "b");
  let total = a + b;
  for (const extra of rest) {
    assertIntegerPaise(extra, "extra");
    total += extra;
  }
  if (!Number.isSafeInteger(total)) {
    throw new RangeError("Resulting sum exceeds safe integer range");
  }
  return total;
}

/**
 * Subtracts b from a (a - b) in integer paise.
 */
export function sub(a: number, b: number): number {
  assertIntegerPaise(a, "a");
  assertIntegerPaise(b, "b");
  const diff = a - b;
  if (!Number.isSafeInteger(diff)) {
    throw new RangeError("Resulting difference exceeds safe integer range");
  }
  return diff;
}

/**
 * Parses a rupee representation (e.g. "120.50", "₹1,23,456.78", 500) into integer paise.
 * Avoids floating-point math during parsing and rounds half-up if sub-paise decimals are provided.
 */
export function parseRupeesToPaise(input: string | number): number {
  if (typeof input !== "string" && typeof input !== "number") {
    throw new TypeError("Invalid rupee amount: input must be a string or number");
  }

  let str: string;
  if (typeof input === "number") {
    if (!Number.isFinite(input)) {
      throw new TypeError("Invalid rupee amount: number must be finite");
    }
    str = input.toString();
  } else {
    str = input.trim();
  }

  if (str === "") {
    throw new TypeError("Invalid rupee amount: string cannot be empty");
  }

  // Remove currency symbol, spaces, and grouping commas
  str = str.replace(/[₹\s,]/g, "");
  if (str.toLowerCase().startsWith("rs.")) {
    str = str.slice(3).trim();
  }

  let isNegative = false;
  if (str.startsWith("-")) {
    isNegative = true;
    str = str.slice(1).trim();
  } else if (str.startsWith("+")) {
    str = str.slice(1).trim();
  }

  if (!/^\d+(\.\d+)?$/.test(str)) {
    throw new TypeError(`Invalid rupee amount format: ${input}`);
  }

  const [intPart, decPart = ""] = str.split(".");
  const intBig = BigInt(intPart);
  let paiseBig = intBig * BigInt(100);

  if (decPart.length === 1) {
    paiseBig += BigInt(decPart) * BigInt(10);
  } else if (decPart.length === 2) {
    paiseBig += BigInt(decPart);
  } else if (decPart.length > 2) {
    const scale = BigInt(10) ** BigInt(decPart.length);
    const frac = BigInt(decPart);
    const fractionNumerator = frac * BigInt(100);
    const quotient = fractionNumerator / scale;
    const remainder = fractionNumerator % scale;
    const roundedFrac = remainder * BigInt(2) >= scale ? quotient + BigInt(1) : quotient;
    paiseBig += roundedFrac;
  }

  const result = Number(paiseBig);
  if (!Number.isSafeInteger(result)) {
    throw new RangeError("Rupee amount is too large for safe integer paise");
  }

  if (result === 0) {
    return 0;
  }

  return isNegative ? -result : result;
}

export interface FormatOptions {
  showSymbol?: boolean;
}

/**
 * Formats an integer paise amount into INR display format (e.g. ₹1,23,456.78).
 * Uses exact integer calculations and Indian numbering grouping.
 */
export function formatINR(amountPaise: number, options: FormatOptions = {}): string {
  assertIntegerPaise(amountPaise, "amountPaise");

  const { showSymbol = true } = options;
  const isNegative = amountPaise < 0;
  const abs = Math.abs(amountPaise);
  const rupeesBig = BigInt(Math.floor(abs / 100));
  const paiseStr = (abs % 100).toString().padStart(2, "0");

  const formattedRupees = new Intl.NumberFormat("en-IN").format(rupeesBig);
  const symbol = showSymbol ? "₹" : "";
  const sign = isNegative ? "-" : "";

  return `${sign}${symbol}${formattedRupees}.${paiseStr}`;
}

/**
 * Calculates a percentage of an amount in paise, rounding half-up.
 * Uses exact BigInt arithmetic without storing or returning floats.
 *
 * @param amountPaise The base amount in integer paise
 * @param ratePercent The percentage rate (e.g. 18 for 18%, 2.5 for 2.5%)
 */
export function percentOf(amountPaise: number, ratePercent: number): number {
  assertIntegerPaise(amountPaise, "amountPaise");

  if (!Number.isFinite(ratePercent)) {
    throw new TypeError("ratePercent must be a finite number");
  }

  if (amountPaise === 0 || ratePercent === 0) {
    return 0;
  }

  const isNegative = (amountPaise < 0) !== (ratePercent < 0);
  const absAmount = BigInt(Math.abs(amountPaise));

  const rateStr = Math.abs(ratePercent).toString();
  const [intPart, decPart = ""] = rateStr.split(".");
  const scale = BigInt(10) ** BigInt(decPart.length);
  const rateScaled = BigInt(intPart + decPart);

  const numerator = absAmount * rateScaled;
  const denominator = BigInt(100) * scale;

  const quotient = numerator / denominator;
  const remainder = numerator % denominator;

  // Round half-up (commercial rounding): >= 0.5 rounds up
  const rounded = remainder * BigInt(2) >= denominator ? quotient + BigInt(1) : quotient;
  const res = Number(rounded);

  if (!Number.isSafeInteger(res)) {
    throw new RangeError("Percentage result exceeds safe integer range");
  }

  if (res === 0) {
    return 0;
  }

  return isNegative ? -res : res;
}
