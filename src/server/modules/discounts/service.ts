import "server-only";
import { AppError } from "@/server/errors";
import { requireRole, type Session } from "@/server/lib/session";
import { Role, DiscountScope, DiscountType } from "@/generated/prisma/client";
import { percentOf } from "@/lib/money";
import { findProductById } from "@/server/modules/catalog/repo";
import {
  createDiscountRecord,
  updateDiscountRecord,
  deactivateDiscountRecord,
  findDiscountById,
  listDiscountRecords,
  listActiveDiscountsForEvaluation,
} from "./repo";
import {
  createDiscountSchema,
  updateDiscountSchema,
  listDiscountsSchema,
  type LineForDiscount,
  type DiscountCandidate,
  type BestDiscountResult,
} from "./schema";

/**
 * Normalizes a date or date string to YYYY-MM-DD for date-range comparison in Asia/Kolkata timezone.
 */
function toDateString(d: Date | string): string {
  if (typeof d === "string") {
    // If it's already YYYY-MM-DD, return it
    if (/^\d{4}-\d{2}-\d{2}$/.test(d)) return d;
    return new Date(d).toISOString().slice(0, 10);
  }
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

/**
 * Pure evaluation function for discounts.
 * ZERO database access. Pure synchronous function.
 * Follows spec 06:
 * - Best single discount: largest amount, never stacks.
 * - Dates: today within [startDate, endDate].
 * - Limit: usedCount < usageLimit.
 * - Thresholds: minPurchase and minQty.
 * - Scope: SUBSCRIPTION includes planFee and whole subtotal;
 *          PRODUCTS applies only to matching products and never to planFee.
 * - Fixed discounts never exceed the base amount.
 */
export function evaluateBestDiscount(
  arg1:
    | LineForDiscount[]
    | {
        subscriptionLines?: LineForDiscount[];
        lines?: LineForDiscount[];
        planFee?: number;
        date?: Date | string;
        candidateDiscounts?: DiscountCandidate[];
        discounts?: DiscountCandidate[];
      }
    | { planFee: number; lines?: LineForDiscount[] },
  arg2?: number | LineForDiscount[] | DiscountCandidate[],
  arg3?: Date | string | DiscountCandidate[],
  arg4?: DiscountCandidate[]
): BestDiscountResult | null {
  let lines: LineForDiscount[] = [];
  let planFee = 0;
  let date: Date | string = new Date();
  let candidateDiscounts: DiscountCandidate[] = [];

  // Parse polymorphic arguments
  if (Array.isArray(arg1)) {
    lines = arg1;
    if (typeof arg2 === "number") {
      planFee = arg2;
      if (arg3 instanceof Date || typeof arg3 === "string") {
        date = arg3;
        if (Array.isArray(arg4)) {
          candidateDiscounts = arg4;
        }
      } else if (Array.isArray(arg3)) {
        candidateDiscounts = arg3;
      }
    }
  } else if (arg1 && typeof arg1 === "object") {
    if ("subscriptionLines" in arg1 && Array.isArray(arg1.subscriptionLines)) {
      lines = arg1.subscriptionLines;
    } else if ("lines" in arg1 && Array.isArray(arg1.lines)) {
      lines = arg1.lines;
    }
    if ("planFee" in arg1 && typeof arg1.planFee === "number") {
      planFee = arg1.planFee;
    }
    if ("date" in arg1 && arg1.date) {
      date = arg1.date;
    }
    if ("candidateDiscounts" in arg1 && Array.isArray(arg1.candidateDiscounts)) {
      candidateDiscounts = arg1.candidateDiscounts;
    } else if ("discounts" in arg1 && Array.isArray(arg1.discounts)) {
      candidateDiscounts = arg1.discounts;
    }

    // Support evaluateBestDiscount(subscription, lines, date, discounts)
    if (Array.isArray(arg2)) {
      lines = arg2 as LineForDiscount[];
    }
    if (arg3 instanceof Date || typeof arg3 === "string") {
      date = arg3;
    }
    if (Array.isArray(arg4)) {
      candidateDiscounts = arg4;
    }
  }

  if (!candidateDiscounts || candidateDiscounts.length === 0) {
    return null;
  }

  const evalDateStr = toDateString(date);

  let bestResult: BestDiscountResult | null = null;

  for (const disc of candidateDiscounts) {
    if (!disc.isActive) {
      continue;
    }

    if (disc.usedCount >= disc.usageLimit) {
      continue;
    }

    const startStr = toDateString(disc.startDate);
    const endStr = toDateString(disc.endDate);
    if (evalDateStr < startStr || evalDateStr > endStr) {
      continue;
    }

    let baseAmount = 0;
    let applicableQty = 0;

    if (disc.scope === DiscountScope.SUBSCRIPTION) {
      const linesAmount = lines.reduce((sum, l) => sum + l.amount, 0);
      baseAmount = linesAmount + planFee;
      applicableQty = lines.reduce((sum, l) => sum + l.qty, 0);

      // Check minPurchase (pre-tax subtotal)
      if (disc.minPurchase !== null && disc.minPurchase !== undefined) {
        if (baseAmount < disc.minPurchase) {
          continue;
        }
      }

      // Check minQty
      if (disc.minQty !== null && disc.minQty !== undefined) {
        if (applicableQty < disc.minQty) {
          continue;
        }
      }
    } else if (disc.scope === DiscountScope.PRODUCTS) {
      const allowedProductIds =
        disc.productIds ||
        (disc.products ? disc.products.map((p) => p.productId) : []);

      const matchingLines = lines.filter((l) => allowedProductIds.includes(l.productId));
      if (matchingLines.length === 0) {
        continue;
      }

      baseAmount = matchingLines.reduce((sum, l) => sum + l.amount, 0);
      applicableQty = matchingLines.reduce((sum, l) => sum + l.qty, 0);

      // Check minPurchase (pre-tax product subtotal, excluding planFee)
      if (disc.minPurchase !== null && disc.minPurchase !== undefined) {
        if (baseAmount < disc.minPurchase) {
          continue;
        }
      }

      // Check minQty (matching product quantities only)
      if (disc.minQty !== null && disc.minQty !== undefined) {
        if (applicableQty < disc.minQty) {
          continue;
        }
      }
    } else {
      continue;
    }

    if (baseAmount <= 0) {
      continue;
    }

    // Calculate discount amount in paise
    let calculatedAmount = 0;
    if (disc.type === DiscountType.FIXED) {
      // Fixed discount in paise, never exceeds the base amount
      calculatedAmount = Math.min(disc.value, baseAmount);
    } else if (disc.type === DiscountType.PERCENT) {
      // Percent discount in basis points (e.g. 1000 = 10.00%)
      calculatedAmount = percentOf(baseAmount, disc.value / 100);
    }

    if (calculatedAmount <= 0) {
      continue;
    }

    // Pick single best (largest amount)
    if (!bestResult || calculatedAmount > bestResult.amount) {
      bestResult = {
        discount: disc,
        discountId: disc.id,
        amount: calculatedAmount,
        scope: disc.scope,
        baseAmount,
      };
    }
  }

  return bestResult;
}

// ──────────────────────────────────────────────
// Admin CRUD Operations
// ──────────────────────────────────────────────

export async function createDiscount(session: Session, rawInput: unknown) {
  requireRole(session, Role.ADMIN);

  const input = createDiscountSchema.parse(rawInput);

  if (input.scope === DiscountScope.PRODUCTS && input.productIds) {
    for (const pid of input.productIds) {
      const product = await findProductById(pid);
      if (!product) {
        throw new AppError("VALIDATION", 422, `Product ${pid} not found`);
      }
    }
  }

  return createDiscountRecord({
    name: input.name.trim(),
    type: input.type,
    value: input.value,
    minPurchase: input.minPurchase,
    minQty: input.minQty,
    startDate: input.startDate,
    endDate: input.endDate,
    usageLimit: input.usageLimit,
    scope: input.scope,
    productIds: input.productIds,
  });
}

export async function updateDiscount(
  session: Session,
  id: string,
  rawInput: unknown
) {
  requireRole(session, Role.ADMIN);

  const input = updateDiscountSchema.parse(rawInput);
  const existing = await findDiscountById(id);
  if (!existing) {
    throw new AppError("NOT_FOUND", 404, "Discount not found");
  }

  if (input.productIds) {
    for (const pid of input.productIds) {
      const product = await findProductById(pid);
      if (!product) {
        throw new AppError("VALIDATION", 422, `Product ${pid} not found`);
      }
    }
  }

  return updateDiscountRecord(id, {
    name: input.name ? input.name.trim() : undefined,
    type: input.type,
    value: input.value,
    minPurchase: input.minPurchase,
    minQty: input.minQty,
    startDate: input.startDate,
    endDate: input.endDate,
    usageLimit: input.usageLimit,
    scope: input.scope,
    isActive: input.isActive,
    productIds: input.productIds,
  });
}

export async function deactivateDiscount(session: Session, id: string) {
  requireRole(session, Role.ADMIN);

  const existing = await findDiscountById(id);
  if (!existing) {
    throw new AppError("NOT_FOUND", 404, "Discount not found");
  }

  return deactivateDiscountRecord(id);
}

export async function getDiscount(session: Session, id: string) {
  requireRole(session, Role.ADMIN, Role.STAFF);

  const discount = await findDiscountById(id);
  if (!discount) {
    throw new AppError("NOT_FOUND", 404, "Discount not found");
  }

  return discount;
}

export async function listDiscounts(session: Session, rawInput?: unknown) {
  requireRole(session, Role.ADMIN, Role.STAFF);

  const input = listDiscountsSchema.parse(rawInput ?? {});
  const { items, total } = await listDiscountRecords(input);

  return {
    items,
    total,
    page: input.page,
    pageSize: input.pageSize,
    totalPages: Math.ceil(total / input.pageSize),
  };
}

export async function evaluateDiscountsFromDb(
  session: Session,
  subscriptionLines: LineForDiscount[],
  planFee: number,
  date: Date = new Date()
) {
  requireRole(session, Role.ADMIN, Role.STAFF, Role.CUSTOMER);
  const activeDiscounts = await listActiveDiscountsForEvaluation();
  return evaluateBestDiscount(subscriptionLines, planFee, date, activeDiscounts);
}
