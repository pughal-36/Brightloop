import "server-only";
import { AppError } from "@/server/errors";
import { requireRole, type Session } from "@/server/lib/session";
import { Role } from "@/generated/prisma/enums";
import { findTaxById } from "@/server/modules/catalog/repo";
import {
  createPlanRecord,
  updatePlanRecord,
  findPlanById,
  listPlanRecords,
} from "./repo";
import {
  createPlanSchema,
  updatePlanSchema,
  listPlansSchema,
} from "./schema";

export function isPlanSelectable(
  plan: {
    isActive: boolean;
    availableFrom: Date | string;
    availableTo?: Date | string | null;
  },
  asOfDate: Date = new Date()
): boolean {
  if (!plan.isActive) {
    return false;
  }

  const asOf = new Date(asOfDate);
  const from = new Date(plan.availableFrom);

  // Compare dates (from start of day in UTC/local)
  const asOfTime = new Date(asOf.getFullYear(), asOf.getMonth(), asOf.getDate()).getTime();
  const fromTime = new Date(from.getFullYear(), from.getMonth(), from.getDate()).getTime();

  if (asOfTime < fromTime) {
    return false;
  }

  if (plan.availableTo) {
    const to = new Date(plan.availableTo);
    const toTime = new Date(to.getFullYear(), to.getMonth(), to.getDate()).getTime();
    if (asOfTime > toTime) {
      return false;
    }
  }

  return true;
}

export async function createPlan(session: Session, rawInput: unknown) {
  requireRole(session, Role.ADMIN);

  const input = createPlanSchema.parse(rawInput);

  if (input.taxId) {
    const tax = await findTaxById(input.taxId);
    if (!tax) {
      throw new AppError("VALIDATION", 422, "Referenced tax does not exist");
    }
  }

  return createPlanRecord({
    name: input.name.trim(),
    price: input.price,
    billingPeriod: input.billingPeriod,
    minQty: input.minQty,
    availableFrom: input.availableFrom,
    availableTo: input.availableTo,
    autoClose: input.autoClose,
    closable: input.closable,
    pausable: input.pausable,
    renewable: input.renewable,
    taxId: input.taxId?.trim() || null,
  });
}

export async function updatePlan(
  session: Session,
  id: string,
  rawInput: unknown
) {
  requireRole(session, Role.ADMIN);

  const input = updatePlanSchema.parse(rawInput);

  const existing = await findPlanById(id);
  if (!existing) {
    throw new AppError("NOT_FOUND", 404, "Plan not found");
  }

  if (input.taxId) {
    const tax = await findTaxById(input.taxId);
    if (!tax) {
      throw new AppError("VALIDATION", 422, "Referenced tax does not exist");
    }
  }

  return updatePlanRecord(id, {
    name: input.name ? input.name.trim() : undefined,
    price: input.price,
    billingPeriod: input.billingPeriod,
    minQty: input.minQty,
    availableFrom: input.availableFrom,
    availableTo: input.availableTo,
    autoClose: input.autoClose,
    closable: input.closable,
    pausable: input.pausable,
    renewable: input.renewable,
    taxId: input.taxId !== undefined ? (input.taxId?.trim() || null) : undefined,
    isActive: input.isActive,
  });
}

export async function deactivatePlan(session: Session, id: string) {
  requireRole(session, Role.ADMIN);

  const existing = await findPlanById(id);
  if (!existing) {
    throw new AppError("NOT_FOUND", 404, "Plan not found");
  }

  return updatePlanRecord(id, { isActive: false });
}

export async function getPlan(session: Session, id: string) {
  requireRole(session, Role.ADMIN, Role.STAFF);

  const plan = await findPlanById(id);
  if (!plan) {
    throw new AppError("NOT_FOUND", 404, "Plan not found");
  }
  return plan;
}

export async function listPlans(session: Session, rawInput?: unknown) {
  requireRole(session, Role.ADMIN, Role.STAFF);

  const input = listPlansSchema.parse(rawInput ?? {});
  const { items, total } = await listPlanRecords(input);

  const totalPages = Math.ceil(total / input.pageSize);

  return {
    items,
    total,
    page: input.page,
    pageSize: input.pageSize,
    totalPages,
  };
}

