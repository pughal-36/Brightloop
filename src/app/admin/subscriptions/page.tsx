import { requireSession } from "@/server/lib/session";
import { Role, SubscriptionStatus } from "@/generated/prisma/enums";
import * as subService from "@/server/modules/subscriptions/service";
import * as customerService from "@/server/modules/customers/service";
import * as catalogService from "@/server/modules/catalog/service";
import * as planService from "@/server/modules/plans/service";
import { SubscriptionsTable } from "./subscriptions-table";
import {
  CreateSubscriptionDialog,
  CreateQuotationTemplateDialog,
} from "./subscription-dialogs";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";

interface PageProps {
  searchParams: Promise<{
    search?: string;
    status?: SubscriptionStatus;
    customerId?: string;
    planId?: string;
    page?: string;
  }>;
}

export default async function SubscriptionsPage({ searchParams }: PageProps) {
  const session = await requireSession();
  const isAdmin = session.user.role === Role.ADMIN;

  const resolvedParams = await searchParams;
  const search = resolvedParams.search || "";
  const status = resolvedParams.status;
  const customerId = resolvedParams.customerId;
  const planId = resolvedParams.planId;
  const page = parseInt(resolvedParams.page || "1", 10) || 1;
  const pageSize = 10;

  const [subscriptionsResult, customersResult, productsResult, plansResult, templatesResult] =
    await Promise.all([
      subService.listSubscriptions(session, {
        search,
        status,
        customerId,
        planId,
        page,
        pageSize,
      }),
      customerService.listCustomers(session, { pageSize: 100 }),
      catalogService.listProducts(session, { pageSize: 100, isActive: true }),
      planService.listPlans(session, { pageSize: 100, isActive: true }),
      subService.listQuotationTemplates(session, { pageSize: 100, isActive: true }),
    ]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Subscriptions & Quotations</h1>
          <p className="text-sm text-muted-foreground">
            Manage quotation templates, customer subscriptions, and the subscription lifecycle.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isAdmin && (
            <CreateQuotationTemplateDialog
              plans={plansResult.items}
              products={productsResult.items}
            />
          )}
          <CreateSubscriptionDialog
            customers={customersResult.items}
            products={productsResult.items}
            plans={plansResult.items}
            templates={templatesResult.items}
          />
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Subscriptions</CardTitle>
          <CardDescription>
            {subscriptionsResult.total}{" "}
            {subscriptionsResult.total === 1 ? "subscription" : "subscriptions"} recorded.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SubscriptionsTable
            data={subscriptionsResult.items}
            total={subscriptionsResult.total}
            page={subscriptionsResult.page}
            pageSize={subscriptionsResult.pageSize}
          />
        </CardContent>
      </Card>
    </div>
  );
}
