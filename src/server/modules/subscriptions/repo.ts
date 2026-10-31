import "server-only";
import { db } from "@/server/db";
import {
  SubscriptionStatus,
  PaymentTerms,
  StatusEntity,
  type Prisma,
} from "@/generated/prisma/client";

export interface CreateTemplateRepoInput {
  name: string;
  planId: string;
  validityDays: number;
  lines: Array<{
    productId: string;
    variantId?: string | null;
    qty: number;
  }>;
}

export interface UpdateTemplateRepoInput {
  name?: string;
  planId?: string;
  validityDays?: number;
  isActive?: boolean;
  lines?: Array<{
    productId: string;
    variantId?: string | null;
    qty: number;
  }>;
}

export interface ListTemplatesRepoInput {
  search?: string;
  isActive?: boolean;
  page: number;
  pageSize: number;
}

export async function createQuotationTemplateRecord(input: CreateTemplateRepoInput) {
  return db.quotationTemplate.create({
    data: {
      name: input.name,
      planId: input.planId,
      validityDays: input.validityDays,
      lines: {
        create: input.lines.map((l) => ({
          productId: l.productId,
          variantId: l.variantId || null,
          qty: l.qty,
        })),
      },
    },
    include: {
      plan: { include: { tax: true } },
      lines: {
        include: {
          product: { include: { tax: true } },
          variant: true,
        },
      },
    },
  });
}

export async function updateQuotationTemplateRecord(
  id: string,
  input: UpdateTemplateRepoInput
) {
  return db.$transaction(async (tx) => {
    if (input.lines) {
      await tx.templateLine.deleteMany({
        where: { templateId: id },
      });
      await tx.templateLine.createMany({
        data: input.lines.map((l) => ({
          templateId: id,
          productId: l.productId,
          variantId: l.variantId || null,
          qty: l.qty,
        })),
      });
    }

    return tx.quotationTemplate.update({
      where: { id },
      data: {
        name: input.name,
        planId: input.planId,
        validityDays: input.validityDays,
        isActive: input.isActive,
      },
      include: {
        plan: { include: { tax: true } },
        lines: {
          include: {
            product: { include: { tax: true, variants: true } },
            variant: true,
          },
        },
      },
    });
  });
}

export async function findQuotationTemplateById(id: string) {
  return db.quotationTemplate.findUnique({
    where: { id },
    include: {
      plan: { include: { tax: true } },
      lines: {
        include: {
          product: { include: { tax: true } },
          variant: true,
        },
      },
    },
  });
}

export async function listQuotationTemplateRecords(input: ListTemplatesRepoInput) {
  const where: Prisma.QuotationTemplateWhereInput = {};

  if (input.search?.trim()) {
    where.name = {
      contains: input.search.trim(),
      mode: "insensitive",
    };
  }

  if (input.isActive !== undefined) {
    where.isActive = input.isActive;
  }

  const [items, total] = await Promise.all([
    db.quotationTemplate.findMany({
      where,
      include: {
        plan: { include: { tax: true } },
        lines: {
          include: {
            product: { include: { tax: true, variants: true } },
            variant: true,
          },
        },
        _count: { select: { lines: true } },
      },
      orderBy: { name: "asc" },
      skip: (input.page - 1) * input.pageSize,
      take: input.pageSize,
    }),
    db.quotationTemplate.count({ where }),
  ]);

  return { items, total };
}

// ──────────────────────────────────────────────
// Subscriptions
// ──────────────────────────────────────────────

export interface CreateSubscriptionRepoInput {
  customerId: string;
  planId: string;
  templateId?: string | null;
  startDate: Date;
  expiryDate: Date;
  paymentTerms: PaymentTerms;
  planFee: number;
  planTaxRateBps: number;
  nextPeriodStart?: Date | null;
  quotationSentAt?: Date | null;
  validUntil?: Date | null;
  createdById?: string | null;
  lines: Array<{
    productId: string;
    variantId?: string | null;
    description: string;
    qty: number;
    unitPrice: number;
    taxRateBps: number;
    amount: number;
  }>;
}

export async function createSubscriptionRecord(
  input: CreateSubscriptionRepoInput,
  byUserId?: string | null
) {
  return db.$transaction(async (tx) => {
    const sub = await tx.subscription.create({
      data: {
        customerId: input.customerId,
        planId: input.planId,
        templateId: input.templateId || null,
        status: SubscriptionStatus.DRAFT,
        startDate: input.startDate,
        expiryDate: input.expiryDate,
        paymentTerms: input.paymentTerms,
        planFee: input.planFee,
        planTaxRateBps: input.planTaxRateBps,
        nextPeriodStart: input.nextPeriodStart ?? input.startDate,
        quotationSentAt: input.quotationSentAt || null,
        validUntil: input.validUntil || null,
        createdById: input.createdById || null,
        lines: {
          create: input.lines.map((l) => ({
            productId: l.productId,
            variantId: l.variantId || null,
            description: l.description,
            qty: l.qty,
            unitPrice: l.unitPrice,
            taxRateBps: l.taxRateBps,
            amount: l.amount,
          })),
        },
      },
      include: {
        customer: true,
        plan: { include: { tax: true } },
        template: true,
        lines: {
          include: {
            product: { include: { tax: true, variants: true } },
            variant: true,
          },
        },
      },
    });

    await tx.statusHistory.create({
      data: {
        entity: StatusEntity.SUBSCRIPTION,
        entityId: sub.id,
        from: null,
        to: SubscriptionStatus.DRAFT,
        byUserId: byUserId || null,
        note: "Subscription draft created",
      },
    });

    return sub;
  });
}

export interface UpdateDraftSubscriptionRepoInput {
  customerId?: string;
  planId?: string;
  startDate?: Date;
  expiryDate?: Date;
  paymentTerms?: PaymentTerms;
  planFee?: number;
  planTaxRateBps?: number;
  nextPeriodStart?: Date | null;
  validUntil?: Date | null;
  lines?: Array<{
    productId: string;
    variantId?: string | null;
    description: string;
    qty: number;
    unitPrice: number;
    taxRateBps: number;
    amount: number;
  }>;
}

export async function updateDraftSubscriptionRecord(
  id: string,
  input: UpdateDraftSubscriptionRepoInput
) {
  return db.$transaction(async (tx) => {
    if (input.lines) {
      await tx.subscriptionLine.deleteMany({
        where: { subscriptionId: id },
      });
      await tx.subscriptionLine.createMany({
        data: input.lines.map((l) => ({
          subscriptionId: id,
          productId: l.productId,
          variantId: l.variantId || null,
          description: l.description,
          qty: l.qty,
          unitPrice: l.unitPrice,
          taxRateBps: l.taxRateBps,
          amount: l.amount,
        })),
      });
    }

    return tx.subscription.update({
      where: { id },
      data: {
        customerId: input.customerId,
        planId: input.planId,
        startDate: input.startDate,
        expiryDate: input.expiryDate,
        paymentTerms: input.paymentTerms,
        planFee: input.planFee,
        planTaxRateBps: input.planTaxRateBps,
        nextPeriodStart: input.nextPeriodStart,
        validUntil: input.validUntil,
      },
      include: {
        customer: true,
        plan: { include: { tax: true } },
        template: true,
        lines: {
          include: {
            product: { include: { tax: true, variants: true } },
            variant: true,
          },
        },
      },
    });
  });
}

export async function deleteSubscriptionRecord(id: string) {
  return db.subscription.delete({
    where: { id },
  });
}

export async function findSubscriptionById(id: string) {
  return db.subscription.findUnique({
    where: { id },
    include: {
      customer: true,
      plan: { include: { tax: true } },
      template: true,
      lines: {
        include: {
          product: { include: { tax: true } },
          variant: true,
        },
        orderBy: { id: "asc" },
      },
    },
  });
}

export interface ListSubscriptionsRepoInput {
  search?: string;
  status?: SubscriptionStatus;
  customerId?: string;
  planId?: string;
  page: number;
  pageSize: number;
}

export async function listSubscriptionRecords(input: ListSubscriptionsRepoInput) {
  const where: Prisma.SubscriptionWhereInput = {};

  if (input.status) {
    where.status = input.status;
  }

  if (input.customerId) {
    where.customerId = input.customerId;
  }

  if (input.planId) {
    where.planId = input.planId;
  }

  if (input.search?.trim()) {
    const term = input.search.trim();
    where.OR = [
      { number: { contains: term, mode: "insensitive" } },
      { customer: { name: { contains: term, mode: "insensitive" } } },
      { customer: { email: { contains: term, mode: "insensitive" } } },
    ];
  }

  const [items, total] = await Promise.all([
    db.subscription.findMany({
      where,
      include: {
        customer: true,
        plan: true,
        _count: { select: { lines: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (input.page - 1) * input.pageSize,
      take: input.pageSize,
    }),
    db.subscription.count({ where }),
  ]);

  return { items, total };
}

export interface StatusTransitionHistoryInput {
  from: string | null;
  to: string;
  byUserId?: string | null;
  note?: string | null;
  at?: Date;
}

export async function applySubscriptionTransitionRecord(
  id: string,
  subscriptionUpdates: Prisma.SubscriptionUpdateInput,
  history: StatusTransitionHistoryInput
) {
  return db.$transaction(async (tx) => {
    const updated = await tx.subscription.update({
      where: { id },
      data: subscriptionUpdates,
      include: {
        customer: true,
        plan: { include: { tax: true } },
        template: true,
        lines: {
          include: {
            product: { include: { tax: true, variants: true } },
            variant: true,
          },
        },
      },
    });

    const statusHistory = await tx.statusHistory.create({
      data: {
        entity: StatusEntity.SUBSCRIPTION,
        entityId: id,
        from: history.from,
        to: history.to,
        byUserId: history.byUserId || null,
        note: history.note || null,
        at: history.at || new Date(),
      },
    });

    return { subscription: updated, statusHistory };
  });
}

export async function findStatusHistoryByEntity(
  entity: StatusEntity,
  entityId: string
) {
  return db.statusHistory.findMany({
    where: { entity, entityId },
    orderBy: { at: "asc" },
  });
}
