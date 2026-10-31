import "server-only";
import { requireRole, type Session } from "@/server/lib/session";
import { Role } from "@/generated/prisma/enums";
import { AppError } from "@/server/errors";
import { getToday } from "@/lib/dates";
import {
  listPortalSubscriptionsSchema,
  listPortalInvoicesSchema,
  listPortalPaymentsSchema,
} from "./schema";
import { getPortalDashboardRepo, listPortalPaymentsRepo } from "./repo";
import {
  getSubscription,
  listSubscriptions,
  getSubscriptionTimeline,
  transitionSubscription,
} from "@/server/modules/subscriptions/service";
import {
  getInvoice,
  listInvoices,
  getInvoiceTimeline,
} from "@/server/modules/invoices/service";

function getCustomerId(session: Session): string {
  requireRole(session, Role.CUSTOMER);
  const customerId = session.user.customerId;
  if (!customerId) {
    throw new AppError("UNAUTHENTICATED", 401, "No linked customer account found");
  }
  return customerId;
}

export async function getPortalDashboard(session: Session) {
  const customerId = getCustomerId(session);
  const today = getToday();
  return getPortalDashboardRepo(customerId, today);
}

export async function listMySubscriptions(session: Session, rawInput?: unknown) {
  getCustomerId(session);
  const input = listPortalSubscriptionsSchema.parse(rawInput ?? {});
  return listSubscriptions(session, input);
}

export async function getMySubscription(session: Session, id: string) {
  getCustomerId(session);
  const subscription = await getSubscription(session, id);
  const timeline = await getSubscriptionTimeline(session, id);
  return {
    subscription,
    timeline,
  };
}

export async function acceptQuotation(session: Session, id: string) {
  getCustomerId(session);
  return transitionSubscription(session, {
    subscriptionId: id,
    action: "CONFIRM",
    note: "Accepted by customer via portal",
  });
}

export async function listMyInvoices(session: Session, rawInput?: unknown) {
  getCustomerId(session);
  const input = listPortalInvoicesSchema.parse(rawInput ?? {});
  return listInvoices(session, input);
}

export async function getMyInvoice(session: Session, id: string) {
  getCustomerId(session);
  const invoice = await getInvoice(session, id);
  const timeline = await getInvoiceTimeline(session, id);
  return {
    invoice,
    timeline,
  };
}

export async function listMyPayments(session: Session, rawInput?: unknown) {
  const customerId = getCustomerId(session);
  const input = listPortalPaymentsSchema.parse(rawInput ?? {});
  return listPortalPaymentsRepo(customerId, input.page, input.pageSize);
}

