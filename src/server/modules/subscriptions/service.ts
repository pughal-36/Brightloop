import "server-only";
import { AppError } from "@/server/errors";
import { requireRole, type Session } from "@/server/lib/session";
import {
  Role,
  SubscriptionStatus,
  StatusEntity,
  type Prisma,
} from "@/generated/prisma/client";
import { getToday, addDays, addBillingPeriod, getNextPeriodStartOnOrAfter } from "@/lib/dates";
import { percentOf } from "@/lib/money";
import { isPlanSelectable } from "@/server/modules/plans/service";
import { findCustomerById } from "@/server/modules/customers/repo";
import { findPlanById } from "@/server/modules/plans/repo";
import { findProductById } from "@/server/modules/catalog/repo";
import {
  createQuotationTemplateRecord,
  updateQuotationTemplateRecord,
  findQuotationTemplateById,
  listQuotationTemplateRecords,
  createSubscriptionRecord,
  updateDraftSubscriptionRecord,
  deleteSubscriptionRecord,
  findSubscriptionById,
  listSubscriptionRecords,
  applySubscriptionTransitionRecord,
  findStatusHistoryByEntity,
} from "./repo";
import {
  createTemplateSchema,
  updateTemplateSchema,
  listTemplatesSchema,
  createBlankSubscriptionSchema,
  createFromTemplateSchema,
  updateDraftSubscriptionSchema,
  transitionSubscriptionSchema,
  listSubscriptionsSchema,
  type ComputedSubscriptionTotals,
  type ComputedLineTotal,
  type SubscriptionLineInput,
} from "./schema";

/**
 * Pure helper to compute server-side totals for subscription lines and plan fee.
 */
export function computeSubscriptionTotals(
  lines: Array<{
    productId: string;
    variantId?: string | null;
    description: string;
    qty: number;
    unitPrice: number;
    taxRateBps: number;
  }>,
  planFee: number,
  planTaxRateBps: number
): ComputedSubscriptionTotals {
  let linesSubtotal = 0;
  let linesTaxTotal = 0;

  const computedLines: ComputedLineTotal[] = lines.map((line) => {
    const amount = line.qty * line.unitPrice;
    const taxAmount = percentOf(amount, line.taxRateBps / 100);
    linesSubtotal += amount;
    linesTaxTotal += taxAmount;
    return {
      productId: line.productId,
      variantId: line.variantId || null,
      description: line.description,
      qty: line.qty,
      unitPrice: line.unitPrice,
      taxRateBps: line.taxRateBps,
      amount,
      taxAmount,
    };
  });

  const planTaxAmount = percentOf(planFee, planTaxRateBps / 100);
  const subtotal = linesSubtotal + planFee;
  const taxTotal = linesTaxTotal + planTaxAmount;
  const total = subtotal + taxTotal;

  return {
    lines: computedLines,
    planFee,
    planTaxRateBps,
    planTaxAmount,
    linesSubtotal,
    subtotal,
    taxTotal,
    total,
  };
}

// ──────────────────────────────────────────────
// Quotation Templates
// ──────────────────────────────────────────────

export async function createQuotationTemplate(session: Session, rawInput: unknown) {
  requireRole(session, Role.ADMIN);

  const input = createTemplateSchema.parse(rawInput);

  const plan = await findPlanById(input.planId);
  if (!plan) {
    throw new AppError("VALIDATION", 422, "Referenced plan does not exist");
  }

  // Validate line items
  for (const line of input.lines) {
    const product = await findProductById(line.productId);
    if (!product || !product.isActive) {
      throw new AppError("VALIDATION", 422, `Product ${line.productId} does not exist or is inactive`);
    }
    if (line.variantId) {
      const variant = product.variants.find((v) => v.id === line.variantId);
      if (!variant) {
        throw new AppError("VALIDATION", 422, `Variant ${line.variantId} does not belong to product`);
      }
    }
    if (line.qty < plan.minQty) {
      throw new AppError(
        "VALIDATION",
        422,
        `Line quantity (${line.qty}) must be at least plan minimum quantity (${plan.minQty})`
      );
    }
  }

  return createQuotationTemplateRecord(input);
}

export async function updateQuotationTemplate(
  session: Session,
  id: string,
  rawInput: unknown
) {
  requireRole(session, Role.ADMIN);

  const input = updateTemplateSchema.parse(rawInput);
  const existing = await findQuotationTemplateById(id);
  if (!existing) {
    throw new AppError("NOT_FOUND", 404, "Quotation template not found");
  }

  const planId = input.planId || existing.planId;
  const plan = await findPlanById(planId);
  if (!plan) {
    throw new AppError("VALIDATION", 422, "Referenced plan does not exist");
  }

  if (input.lines) {
    for (const line of input.lines) {
      const product = await findProductById(line.productId);
      if (!product || !product.isActive) {
        throw new AppError("VALIDATION", 422, `Product ${line.productId} does not exist or is inactive`);
      }
      if (line.variantId) {
        const variant = product.variants.find((v) => v.id === line.variantId);
        if (!variant) {
          throw new AppError("VALIDATION", 422, `Variant ${line.variantId} does not belong to product`);
        }
      }
      if (line.qty < plan.minQty) {
        throw new AppError(
          "VALIDATION",
          422,
          `Line quantity (${line.qty}) must be at least plan minimum quantity (${plan.minQty})`
        );
      }
    }
  }

  return updateQuotationTemplateRecord(id, input);
}

export async function getQuotationTemplate(session: Session, id: string) {
  requireRole(session, Role.ADMIN, Role.STAFF);

  const template = await findQuotationTemplateById(id);
  if (!template) {
    throw new AppError("NOT_FOUND", 404, "Quotation template not found");
  }
  return template;
}

export async function listQuotationTemplates(session: Session, rawInput?: unknown) {
  requireRole(session, Role.ADMIN, Role.STAFF);

  const input = listTemplatesSchema.parse(rawInput ?? {});
  const { items, total } = await listQuotationTemplateRecords(input);
  return {
    items,
    total,
    page: input.page,
    pageSize: input.pageSize,
    totalPages: Math.ceil(total / input.pageSize),
  };
}

// ──────────────────────────────────────────────
// Subscriptions
// ──────────────────────────────────────────────

async function snapshotLine(
  line: SubscriptionLineInput,
  minQty: number
): Promise<{
  productId: string;
  variantId: string | null;
  description: string;
  qty: number;
  unitPrice: number;
  taxRateBps: number;
  amount: number;
}> {
  if (line.qty < minQty) {
    throw new AppError(
      "VALIDATION",
      422,
      `Line quantity (${line.qty}) must be at least plan minimum quantity (${minQty})`
    );
  }

  const product = await findProductById(line.productId);
  if (!product || !product.isActive) {
    throw new AppError("VALIDATION", 422, `Product ${line.productId} does not exist or is inactive`);
  }

  let unitPrice = product.salesPrice;
  let description = product.name;
  let variantId: string | null = null;

  if (line.variantId) {
    const variant = product.variants.find((v) => v.id === line.variantId);
    if (!variant) {
      throw new AppError("VALIDATION", 422, `Variant ${line.variantId} does not belong to product`);
    }
    unitPrice += variant.extraPrice;
    description = `${product.name} - ${variant.attribute}: ${variant.value}`;
    variantId = variant.id;
  }

  const taxRateBps = line.taxRateBps !== undefined ? line.taxRateBps : (product.tax?.rateBps ?? 0);
  const amount = line.qty * unitPrice;

  return {
    productId: product.id,
    variantId,
    description,
    qty: line.qty,
    unitPrice,
    taxRateBps,
    amount,
  };
}

export async function createSubscriptionBlank(session: Session, rawInput: unknown) {
  requireRole(session, Role.ADMIN, Role.STAFF);

  const input = createBlankSubscriptionSchema.parse(rawInput);

  const customer = await findCustomerById(input.customerId);
  if (!customer || !customer.isActive) {
    throw new AppError("VALIDATION", 422, "Customer not found or inactive");
  }

  const plan = await findPlanById(input.planId);
  if (!plan) {
    throw new AppError("VALIDATION", 422, "Plan not found");
  }

  if (!isPlanSelectable(plan, input.startDate)) {
    throw new AppError("VALIDATION", 422, "Plan is not available on the chosen start date");
  }

  const snapshottedLines = await Promise.all(
    input.lines.map((l) => snapshotLine(l, plan.minQty))
  );

  const planFee = plan.price;
  const planTaxRateBps = plan.tax?.rateBps ?? 0;

  return createSubscriptionRecord(
    {
      customerId: input.customerId,
      planId: input.planId,
      templateId: null,
      startDate: input.startDate,
      expiryDate: input.expiryDate,
      paymentTerms: input.paymentTerms,
      planFee,
      planTaxRateBps,
      validUntil: input.validUntil || null,
      createdById: session.user.id,
      lines: snapshottedLines,
    },
    session.user.id
  );
}

export async function createSubscriptionFromTemplate(session: Session, rawInput: unknown) {
  requireRole(session, Role.ADMIN, Role.STAFF);

  const input = createFromTemplateSchema.parse(rawInput);

  const customer = await findCustomerById(input.customerId);
  if (!customer || !customer.isActive) {
    throw new AppError("VALIDATION", 422, "Customer not found or inactive");
  }

  const template = await findQuotationTemplateById(input.templateId);
  if (!template || !template.isActive) {
    throw new AppError("VALIDATION", 422, "Quotation template not found or inactive");
  }

  const plan = template.plan;
  if (!plan || !isPlanSelectable(plan, input.startDate)) {
    throw new AppError("VALIDATION", 422, "Template plan is not available on the chosen start date");
  }

  // Calculate default expiry date: startDate + 1 period of the plan if not explicitly passed
  const expiryDate = input.expiryDate || addBillingPeriod(input.startDate, plan.billingPeriod, 1);

  // Line source: if explicit lines provided, use them; otherwise copy template lines
  const linesToSnapshot: SubscriptionLineInput[] =
    input.lines && input.lines.length > 0
      ? input.lines
      : template.lines.map((tl) => ({
          productId: tl.productId,
          variantId: tl.variantId,
          qty: tl.qty,
        }));

  if (linesToSnapshot.length === 0) {
    throw new AppError("VALIDATION", 422, "Subscription must have at least one line item");
  }

  const snapshottedLines = await Promise.all(
    linesToSnapshot.map((l) => snapshotLine(l, plan.minQty))
  );

  const planFee = plan.price;
  const planTaxRateBps = plan.tax?.rateBps ?? 0;

  return createSubscriptionRecord(
    {
      customerId: input.customerId,
      planId: plan.id,
      templateId: template.id,
      startDate: input.startDate,
      expiryDate,
      paymentTerms: input.paymentTerms,
      planFee,
      planTaxRateBps,
      createdById: session.user.id,
      lines: snapshottedLines,
    },
    session.user.id
  );
}

export async function updateDraftSubscription(
  session: Session,
  id: string,
  rawInput: unknown
) {
  requireRole(session, Role.ADMIN, Role.STAFF);

  const input = updateDraftSubscriptionSchema.parse(rawInput);
  const subscription = await findSubscriptionById(id);
  if (!subscription) {
    throw new AppError("NOT_FOUND", 404, "Subscription not found");
  }

  if (subscription.status !== SubscriptionStatus.DRAFT) {
    throw new AppError("CONFLICT", 409, `Cannot edit subscription in status ${subscription.status}`);
  }

  let plan = subscription.plan;
  let planFee = subscription.planFee;
  let planTaxRateBps = subscription.planTaxRateBps;

  if (input.planId && input.planId !== subscription.planId) {
    const newPlan = await findPlanById(input.planId);
    if (!newPlan) {
      throw new AppError("VALIDATION", 422, "Plan not found");
    }
    const checkDate = input.startDate || subscription.startDate;
    if (!isPlanSelectable(newPlan, checkDate)) {
      throw new AppError("VALIDATION", 422, "Plan is not available on chosen start date");
    }
    plan = newPlan;
    planFee = newPlan.price;
    planTaxRateBps = newPlan.tax?.rateBps ?? 0;
  }

  let lines;
  if (input.lines) {
    lines = await Promise.all(input.lines.map((l) => snapshotLine(l, plan.minQty)));
  }

  return updateDraftSubscriptionRecord(id, {
    customerId: input.customerId,
    planId: input.planId,
    startDate: input.startDate,
    expiryDate: input.expiryDate,
    paymentTerms: input.paymentTerms,
    planFee,
    planTaxRateBps,
    validUntil: input.validUntil !== undefined ? input.validUntil : undefined,
    lines,
  });
}

export async function deleteDraftSubscription(session: Session, id: string) {
  requireRole(session, Role.ADMIN, Role.STAFF);

  const subscription = await findSubscriptionById(id);
  if (!subscription) {
    throw new AppError("NOT_FOUND", 404, "Subscription not found");
  }

  if (subscription.status !== SubscriptionStatus.DRAFT) {
    throw new AppError("CONFLICT", 409, `Cannot delete subscription in status ${subscription.status}`);
  }

  await deleteSubscriptionRecord(id);
  return { success: true };
}

// ──────────────────────────────────────────────
// Central Transition Function
// ──────────────────────────────────────────────

export async function transitionSubscription(session: Session, rawInput: unknown) {
  const input = transitionSubscriptionSchema.parse(rawInput);
  const subscription = await findSubscriptionById(input.subscriptionId);
  if (!subscription) {
    throw new AppError("NOT_FOUND", 404, "Subscription not found");
  }

  // Role validation
  if (input.action === "CONFIRM") {
    // Staff/admin can confirm, customer can accept their own quotation
    if (session.user.role === Role.CUSTOMER) {
      if (subscription.customerId !== session.user.customerId) {
        throw new AppError("NOT_FOUND", 404, "Subscription not found");
      }
    } else {
      requireRole(session, Role.ADMIN, Role.STAFF);
    }
  } else {
    requireRole(session, Role.ADMIN, Role.STAFF);
  }

  const currentStatus = subscription.status;
  const isPaused = subscription.pausedAt !== null;
  const plan = subscription.plan;
  const referenceDate = input.asOfDate || getToday();

  const updates: Prisma.SubscriptionUpdateInput = {};
  let historyFrom: string | null = currentStatus;
  let historyTo: string = currentStatus;
  let historyNote = input.note || null;

  switch (input.action) {
    case "SEND_QUOTATION": {
      if (currentStatus !== SubscriptionStatus.DRAFT) {
        throw new AppError("CONFLICT", 409, `Cannot send quotation from status ${currentStatus}`);
      }
      const sentAt = input.asOfDate || new Date();
      updates.status = SubscriptionStatus.QUOTATION;
      updates.quotationSentAt = sentAt;

      // validUntil = sentAt + template.validityDays (or default 30 days) if not already set
      if (!subscription.validUntil) {
        const days = subscription.template?.validityDays || 30;
        updates.validUntil = addDays(sentAt, days);
      }

      historyFrom = SubscriptionStatus.DRAFT;
      historyTo = SubscriptionStatus.QUOTATION;
      historyNote = historyNote || "Quotation sent";
      break;
    }

    case "CONFIRM": {
      if (currentStatus !== SubscriptionStatus.QUOTATION) {
        throw new AppError("CONFLICT", 409, `Cannot confirm quotation from status ${currentStatus}`);
      }

      // Blocked after validUntil
      if (subscription.validUntil) {
        const checkTime = referenceDate.getTime();
        const validTime = new Date(subscription.validUntil).getTime();
        if (checkTime > validTime) {
          throw new AppError("CONFLICT", 409, "Quotation has expired");
        }
      }

      updates.status = SubscriptionStatus.CONFIRMED;
      historyFrom = SubscriptionStatus.QUOTATION;
      historyTo = SubscriptionStatus.CONFIRMED;
      historyNote = historyNote || "Quotation confirmed";
      break;
    }

    case "ACTIVATE": {
      if (currentStatus !== SubscriptionStatus.CONFIRMED) {
        throw new AppError("CONFLICT", 409, `Cannot activate subscription from status ${currentStatus}`);
      }

      updates.status = SubscriptionStatus.ACTIVE;
      if (!subscription.nextPeriodStart) {
        updates.nextPeriodStart = subscription.startDate;
      }

      historyFrom = SubscriptionStatus.CONFIRMED;
      historyTo = SubscriptionStatus.ACTIVE;
      historyNote = historyNote || "Subscription activated";
      break;
    }

    case "PAUSE": {
      if (currentStatus !== SubscriptionStatus.ACTIVE) {
        throw new AppError("CONFLICT", 409, `Cannot pause subscription in status ${currentStatus}`);
      }
      if (isPaused) {
        throw new AppError("CONFLICT", 409, "Subscription is already paused");
      }
      if (!plan.pausable) {
        throw new AppError("CONFLICT", 409, "Plan does not allow pausing");
      }

      updates.pausedAt = input.asOfDate || new Date();
      historyFrom = "ACTIVE";
      historyTo = "PAUSED";
      historyNote = historyNote || "Subscription paused";
      break;
    }

    case "RESUME": {
      if (currentStatus !== SubscriptionStatus.ACTIVE) {
        throw new AppError("CONFLICT", 409, `Cannot resume subscription in status ${currentStatus}`);
      }
      if (!isPaused) {
        throw new AppError("CONFLICT", 409, "Subscription is not paused");
      }
      if (!plan.pausable) {
        throw new AppError("CONFLICT", 409, "Plan does not allow pausing");
      }

      const resumeDate = input.resumeDate || input.asOfDate || getToday();
      const initialPeriod = subscription.nextPeriodStart || subscription.startDate;
      const newNextPeriod = getNextPeriodStartOnOrAfter(initialPeriod, plan.billingPeriod, resumeDate);

      updates.pausedAt = null;
      updates.nextPeriodStart = newNextPeriod;

      historyFrom = "PAUSED";
      historyTo = "ACTIVE";
      historyNote = historyNote || "Subscription resumed";
      break;
    }

    case "RENEW": {
      if (currentStatus !== SubscriptionStatus.ACTIVE) {
        throw new AppError("CONFLICT", 409, `Cannot renew subscription in status ${currentStatus}`);
      }
      if (!plan.renewable) {
        throw new AppError("CONFLICT", 409, "Plan does not allow renewal");
      }

      const newExpiry = addBillingPeriod(subscription.expiryDate, plan.billingPeriod, 1);
      updates.expiryDate = newExpiry;

      historyFrom = "ACTIVE";
      historyTo = "ACTIVE";
      historyNote = historyNote || `Renewed until ${newExpiry.toISOString().slice(0, 10)}`;
      break;
    }

    case "CLOSE": {
      if (
        currentStatus !== SubscriptionStatus.QUOTATION &&
        currentStatus !== SubscriptionStatus.ACTIVE
      ) {
        throw new AppError("CONFLICT", 409, `Cannot close subscription from status ${currentStatus}`);
      }

      if (!input.closeReason || input.closeReason.trim().length === 0) {
        throw new AppError("VALIDATION", 422, "Close reason is required");
      }

      if (currentStatus === SubscriptionStatus.ACTIVE) {
        const expiryTime = new Date(subscription.expiryDate).getTime();
        const refTime = referenceDate.getTime();
        const isEarlyClose = refTime < expiryTime;

        if (isEarlyClose && !plan.closable) {
          throw new AppError("CONFLICT", 409, "Plan does not allow early close");
        }
      }

      updates.status = SubscriptionStatus.CLOSED;
      updates.closeReason = input.closeReason.trim();
      updates.closedAt = input.asOfDate || new Date();

      historyFrom = isPaused ? "PAUSED" : currentStatus;
      historyTo = SubscriptionStatus.CLOSED;
      historyNote = input.closeReason.trim();
      break;
    }

    default:
      throw new AppError("CONFLICT", 409, `Unsupported transition action ${input.action}`);
  }

  const result = await applySubscriptionTransitionRecord(subscription.id, updates, {
    from: historyFrom,
    to: historyTo,
    byUserId: session.user.id,
    note: historyNote,
    at: input.asOfDate || new Date(),
  });

  return result.subscription;
}

// ──────────────────────────────────────────────
// Named Transition Action Wrappers
// ──────────────────────────────────────────────

export async function sendQuotation(session: Session, id: string, options?: { note?: string; asOfDate?: Date }) {
  return transitionSubscription(session, {
    subscriptionId: id,
    action: "SEND_QUOTATION",
    note: options?.note,
    asOfDate: options?.asOfDate,
  });
}

export async function confirmSubscription(session: Session, id: string, options?: { note?: string; asOfDate?: Date }) {
  return transitionSubscription(session, {
    subscriptionId: id,
    action: "CONFIRM",
    note: options?.note,
    asOfDate: options?.asOfDate,
  });
}

export async function activateSubscription(session: Session, id: string, options?: { note?: string; asOfDate?: Date }) {
  return transitionSubscription(session, {
    subscriptionId: id,
    action: "ACTIVATE",
    note: options?.note,
    asOfDate: options?.asOfDate,
  });
}

export async function pauseSubscription(session: Session, id: string, options?: { note?: string; asOfDate?: Date }) {
  return transitionSubscription(session, {
    subscriptionId: id,
    action: "PAUSE",
    note: options?.note,
    asOfDate: options?.asOfDate,
  });
}

export async function resumeSubscription(
  session: Session,
  id: string,
  options?: { resumeDate?: Date; note?: string; asOfDate?: Date }
) {
  return transitionSubscription(session, {
    subscriptionId: id,
    action: "RESUME",
    resumeDate: options?.resumeDate,
    note: options?.note,
    asOfDate: options?.asOfDate,
  });
}

export async function renewSubscription(session: Session, id: string, options?: { note?: string; asOfDate?: Date }) {
  return transitionSubscription(session, {
    subscriptionId: id,
    action: "RENEW",
    note: options?.note,
    asOfDate: options?.asOfDate,
  });
}

export async function closeSubscription(
  session: Session,
  id: string,
  closeReason: string,
  options?: { asOfDate?: Date }
) {
  return transitionSubscription(session, {
    subscriptionId: id,
    action: "CLOSE",
    closeReason,
    asOfDate: options?.asOfDate,
  });
}

// ──────────────────────────────────────────────
// Queries
// ──────────────────────────────────────────────

export async function getSubscription(session: Session, id: string) {
  const subscription = await findSubscriptionById(id);
  if (!subscription) {
    throw new AppError("NOT_FOUND", 404, "Subscription not found");
  }

  if (session.user.role === Role.CUSTOMER) {
    if (subscription.customerId !== session.user.customerId) {
      throw new AppError("NOT_FOUND", 404, "Subscription not found");
    }
    const sanitized = {
      ...subscription,
      createdById: null,
      lines: subscription.lines.map((line) => ({
        ...line,
        product: line.product
          ? {
              ...line.product,
              costPrice: undefined,
              notes: null,
            }
          : line.product,
      })),
    };
    return sanitized;
  } else {
    requireRole(session, Role.ADMIN, Role.STAFF);
  }

  return subscription;
}

export async function listSubscriptions(session: Session, rawInput?: unknown) {
  const input = listSubscriptionsSchema.parse(rawInput ?? {});

  if (session.user.role === Role.CUSTOMER) {
    if (!session.user.customerId) {
      return { items: [], total: 0, page: input.page, pageSize: input.pageSize, totalPages: 0 };
    }
    input.customerId = session.user.customerId;
  } else {
    requireRole(session, Role.ADMIN, Role.STAFF);
  }

  const { items, total } = await listSubscriptionRecords(input);
  return {
    items,
    total,
    page: input.page,
    pageSize: input.pageSize,
    totalPages: Math.ceil(total / input.pageSize),
  };
}

export async function getSubscriptionTimeline(session: Session, id: string) {
  // Check access to subscription first
  await getSubscription(session, id);
  const timeline = await findStatusHistoryByEntity(StatusEntity.SUBSCRIPTION, id);
  if (session.user.role === Role.CUSTOMER) {
    return timeline.map((entry) => ({
      ...entry,
      byUserId: null,
    }));
  }
  return timeline;
}

