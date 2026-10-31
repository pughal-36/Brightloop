/**
 * Pure invoice computation for BrightLoop Billing Engine.
 *
 * Rules:
 * - PLAN_FEE line first, then product lines, then the DISCOUNT line from evaluateBestDiscount().
 * - Tax per line on the discounted base, half-up via lib/money.ts.
 * - Totals: subtotal (pre-tax before discount), discountTotal, taxTotal, total.
 * - dueDate from payment terms.
 * - No DB access.
 */

import {
  PaymentTerms,
  InvoiceLineKind,
  DiscountScope,
  DiscountType,
} from "@/generated/prisma/enums";
import { addDays } from "@/lib/dates";
import { percentOf, add, sub } from "@/lib/money";
import { evaluateBestDiscount } from "@/server/modules/discounts";
import type { DiscountCandidate } from "@/server/modules/discounts/schema";

export interface SubscriptionLineForCompute {
  id?: string;
  productId: string;
  variantId?: string | null;
  description: string;
  qty: number;
  unitPrice: number; // paise
  taxRateBps: number;
  amount: number; // paise (qty * unitPrice)
}

export interface SubscriptionForCompute {
  id: string;
  customerId: string;
  planFee: number; // paise
  planTaxRateBps: number;
  planName: string;
  paymentTerms: PaymentTerms;
  lines: SubscriptionLineForCompute[];
}

export interface ComputedInvoiceLine {
  kind: InvoiceLineKind;
  sortOrder: number;
  description: string;
  productId?: string | null;
  variantId?: string | null;
  discountId?: string | null;
  qty: number;
  unitPrice: number; // paise
  taxRateBps: number;
  amount: number; // paise (pre-tax, negative for DISCOUNT)
  taxAmount: number; // paise
}

export interface ComputedInvoice {
  subscriptionId: string;
  customerId: string;
  periodStart: Date;
  periodEnd: Date;
  issueDate: Date;
  dueDate: Date;
  subtotal: number;
  discountTotal: number;
  taxTotal: number;
  total: number;
  lines: ComputedInvoiceLine[];
  appliedDiscountId?: string | null;
  appliedDiscountAmount: number;
}

/**
 * Computes due date from issue date based on payment terms.
 * - IMMEDIATE: due on issue
 * - NET_15: +15 days
 * - NET_30: +30 days
 */
export function computeDueDate(issueDate: Date, terms: PaymentTerms): Date {
  switch (terms) {
    case PaymentTerms.IMMEDIATE:
      return new Date(issueDate.getTime());
    case PaymentTerms.NET_15:
      return addDays(issueDate, 15);
    case PaymentTerms.NET_30:
      return addDays(issueDate, 30);
    default:
      return new Date(issueDate.getTime());
  }
}

/**
 * Pure function to compute complete invoice details, lines, and totals.
 */
export function computeInvoice(
  subscription: SubscriptionForCompute,
  periodStart: Date,
  periodEnd: Date,
  candidateDiscounts: DiscountCandidate[] = []
): ComputedInvoice {
  const issueDate = new Date(periodStart.getTime());
  const dueDate = computeDueDate(issueDate, subscription.paymentTerms);

  // 1. Calculate pre-tax subtotal (plan fee + product lines)
  const planFeeAmount = subscription.planFee;
  const productLinesSubtotal = subscription.lines.reduce((sum, l) => add(sum, l.amount), 0);
  const subtotal = add(planFeeAmount, productLinesSubtotal);

  // 2. Evaluate best discount
  const linesForDiscount = subscription.lines.map((l) => ({
    productId: l.productId,
    qty: l.qty,
    unitPrice: l.unitPrice,
    amount: l.amount,
  }));

  const bestDiscountResult = evaluateBestDiscount(
    linesForDiscount,
    subscription.planFee,
    periodStart,
    candidateDiscounts
  );

  const discountTotal = bestDiscountResult ? bestDiscountResult.amount : 0;
  const appliedDiscountId = bestDiscountResult ? bestDiscountResult.discountId : null;

  // 3. Allocate discount per line to compute tax on the discounted base
  let planFeeDiscount = 0;
  const productLineDiscounts: number[] = new Array(subscription.lines.length).fill(0);

  if (bestDiscountResult && discountTotal > 0) {
    const disc = bestDiscountResult.discount;

    if (bestDiscountResult.scope === DiscountScope.SUBSCRIPTION) {
      if (disc.type === DiscountType.PERCENT) {
        const ratePercent = disc.value / 100;
        planFeeDiscount = percentOf(subscription.planFee, ratePercent);
        for (let i = 0; i < subscription.lines.length; i++) {
          productLineDiscounts[i] = percentOf(subscription.lines[i].amount, ratePercent);
        }
      } else {
        // FIXED discount allocated proportionally across all lines
        const totalBase = subtotal;
        if (totalBase > 0) {
          planFeeDiscount = Math.floor((subscription.planFee * discountTotal) / totalBase);
          let allocated = planFeeDiscount;

          for (let i = 0; i < subscription.lines.length; i++) {
            if (i === subscription.lines.length - 1) {
              productLineDiscounts[i] = sub(discountTotal, allocated);
            } else {
              const share = Math.floor((subscription.lines[i].amount * discountTotal) / totalBase);
              productLineDiscounts[i] = share;
              allocated = add(allocated, share);
            }
          }
        }
      }
    } else if (bestDiscountResult.scope === DiscountScope.PRODUCTS) {
      // PLAN_FEE gets 0 discount
      planFeeDiscount = 0;

      const allowedProductIds =
        disc.productIds ||
        (disc.products ? disc.products.map((p) => p.productId) : []);

      const matchingIndices: number[] = [];
      let matchingBase = 0;

      for (let i = 0; i < subscription.lines.length; i++) {
        if (allowedProductIds.includes(subscription.lines[i].productId)) {
          matchingIndices.push(i);
          matchingBase = add(matchingBase, subscription.lines[i].amount);
        }
      }

      if (disc.type === DiscountType.PERCENT) {
        const ratePercent = disc.value / 100;
        for (const idx of matchingIndices) {
          productLineDiscounts[idx] = percentOf(subscription.lines[idx].amount, ratePercent);
        }
      } else {
        // FIXED discount allocated proportionally across matching lines
        if (matchingBase > 0) {
          let allocated = 0;
          for (let m = 0; m < matchingIndices.length; m++) {
            const idx = matchingIndices[m];
            if (m === matchingIndices.length - 1) {
              productLineDiscounts[idx] = sub(discountTotal, allocated);
            } else {
              const share = Math.floor(
                (subscription.lines[idx].amount * discountTotal) / matchingBase
              );
              productLineDiscounts[idx] = share;
              allocated = add(allocated, share);
            }
          }
        }
      }
    }
  }

  // 4. Compute line taxes on discounted base
  const planFeeDiscountedBase = Math.max(0, sub(subscription.planFee, planFeeDiscount));
  const planFeeTax = percentOf(planFeeDiscountedBase, subscription.planTaxRateBps / 100);

  const productTaxes: number[] = [];
  for (let i = 0; i < subscription.lines.length; i++) {
    const discountedBase = Math.max(
      0,
      sub(subscription.lines[i].amount, productLineDiscounts[i])
    );
    const tax = percentOf(discountedBase, subscription.lines[i].taxRateBps / 100);
    productTaxes.push(tax);
  }

  // 5. Construct lines
  const lines: ComputedInvoiceLine[] = [];
  let sortOrder = 0;

  // PLAN_FEE line first
  lines.push({
    kind: InvoiceLineKind.PLAN_FEE,
    sortOrder: sortOrder++,
    description: `Plan Fee: ${subscription.planName}`,
    productId: null,
    variantId: null,
    discountId: null,
    qty: 1,
    unitPrice: subscription.planFee,
    taxRateBps: subscription.planTaxRateBps,
    amount: subscription.planFee,
    taxAmount: planFeeTax,
  });

  // Product lines
  for (let i = 0; i < subscription.lines.length; i++) {
    const l = subscription.lines[i];
    lines.push({
      kind: InvoiceLineKind.PRODUCT,
      sortOrder: sortOrder++,
      description: l.description,
      productId: l.productId,
      variantId: l.variantId ?? null,
      discountId: null,
      qty: l.qty,
      unitPrice: l.unitPrice,
      taxRateBps: l.taxRateBps,
      amount: l.amount,
      taxAmount: productTaxes[i],
    });
  }

  // DISCOUNT line (if discount applied)
  if (bestDiscountResult && discountTotal > 0) {
    lines.push({
      kind: InvoiceLineKind.DISCOUNT,
      sortOrder: sortOrder++,
      description: `Discount: ${bestDiscountResult.discount.name}`,
      productId: null,
      variantId: null,
      discountId: bestDiscountResult.discountId,
      qty: 1,
      unitPrice: -discountTotal,
      taxRateBps: 0,
      amount: -discountTotal, // pre-tax, negative for DISCOUNT
      taxAmount: 0,
    });
  }

  // 6. Calculate invoice totals
  const taxTotal = lines.reduce((sum, l) => add(sum, l.taxAmount), 0);
  const total = add(sub(subtotal, discountTotal), taxTotal);

  return {
    subscriptionId: subscription.id,
    customerId: subscription.customerId,
    periodStart,
    periodEnd,
    issueDate,
    dueDate,
    subtotal,
    discountTotal,
    taxTotal,
    total,
    lines,
    appliedDiscountId,
    appliedDiscountAmount: discountTotal,
  };
}

