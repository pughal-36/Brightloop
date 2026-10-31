import "server-only";
import { AppError } from "@/server/errors";
import { requireRole, type Session } from "@/server/lib/session";
import { Role } from "@/generated/prisma/enums";
import {
  createCustomerRecord,
  updateCustomerRecord,
  findCustomerById,
  listCustomersRecords,
} from "./repo";
import {
  createCustomerSchema,
  updateCustomerSchema,
  listCustomersSchema,
} from "./schema";

export async function createCustomer(session: Session, rawInput: unknown) {
  requireRole(session, Role.ADMIN, Role.STAFF);

  const input = createCustomerSchema.parse(rawInput);

  const customer = await createCustomerRecord({
    name: input.name.trim(),
    email: input.email.trim().toLowerCase(),
    phone: input.phone?.trim() || null,
    billingAddress: input.billingAddress?.trim() || null,
    createdById: session.user.id,
  });

  return customer;
}

export async function updateCustomer(
  session: Session,
  id: string,
  rawInput: unknown
) {
  requireRole(session, Role.ADMIN, Role.STAFF);

  const input = updateCustomerSchema.parse(rawInput);

  const existing = await findCustomerById(id);
  if (!existing) {
    throw new AppError("NOT_FOUND", 404, "Customer not found");
  }

  const updated = await updateCustomerRecord(id, {
    name: input.name ? input.name.trim() : undefined,
    email: input.email ? input.email.trim().toLowerCase() : undefined,
    phone: input.phone !== undefined ? (input.phone?.trim() || null) : undefined,
    billingAddress: input.billingAddress !== undefined ? (input.billingAddress?.trim() || null) : undefined,
    isActive: input.isActive,
  });

  return updated;
}

export async function getCustomer(session: Session, id: string) {
  // If caller is CUSTOMER, enforce customerId scoping
  if (session.user.role === Role.CUSTOMER) {
    if (!session.user.customerId || session.user.customerId !== id) {
      throw new AppError("FORBIDDEN", 403, "Access forbidden");
    }
  } else {
    requireRole(session, Role.ADMIN, Role.STAFF);
  }

  const customer = await findCustomerById(id);
  if (!customer) {
    throw new AppError("NOT_FOUND", 404, "Customer not found");
  }

  return customer;
}

export async function listCustomers(session: Session, rawInput?: unknown) {
  requireRole(session, Role.ADMIN, Role.STAFF);

  const input = listCustomersSchema.parse(rawInput ?? {});
  const { items, total } = await listCustomersRecords(input);

  const totalPages = Math.ceil(total / input.pageSize);

  return {
    items,
    total,
    page: input.page,
    pageSize: input.pageSize,
    totalPages,
  };
}
