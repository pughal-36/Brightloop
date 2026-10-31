import Link from "next/link";
import { requireSession } from "@/server/lib/session";
import { Role, SubscriptionStatus } from "@/generated/prisma/enums";
import * as subService from "@/server/modules/subscriptions/service";
import * as customerService from "@/server/modules/customers/service";
import * as catalogService from "@/server/modules/catalog/service";
import * as planService from "@/server/modules/plans/service";
import { DataTable, type ColumnDef } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
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

interface SubscriptionRow {
  id: string;
  number: string;
  customerId: string;
  customer: { name: string; email: string };
  plan: { name: string };
  status: SubscriptionStatus;
  pausedAt: Date | null;
  startDate: Date;
  expiryDate: Date;
  createdAt: Date;
  _count: { lines: number };
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

  const columns: ColumnDef<SubscriptionRow>[] = [
    {
      header: "Number",
      accessorKey: "number",
      cell: (row) => (
        <Link
          href={`/admin/subscriptions/${row.id}`}
          className="font-mono font-bold text-primary hover:underline text-sm"
        >
          {row.number}
        </Link>
      ),
    },
    {
      header: "Customer",
      accessorKey: "customer.name",
      cell: (row) => (
        <div>
          <div className="font-semibold text-foreground text-sm">{row.customer.name}</div>
          <div className="text-xs text-muted-foreground">{row.customer.email}</div>
        </div>
      ),
    },
    {
      header: "Plan",
      accessorKey: "plan.name",
      cell: (row) => <span className="text-sm font-medium">{row.plan.name}</span>,
    },
    {
      header: "Status",
      accessorKey: "status",
      cell: (row) => {
        if (row.status === SubscriptionStatus.DRAFT) {
          return <Badge variant="outline">DRAFT</Badge>;
        }
        if (row.status === SubscriptionStatus.QUOTATION) {
          return <Badge className="bg-blue-600 hover:bg-blue-700">QUOTATION</Badge>;
        }
        if (row.status === SubscriptionStatus.CONFIRMED) {
          return <Badge className="bg-purple-600 hover:bg-purple-700">CONFIRMED</Badge>;
        }
        if (row.status === SubscriptionStatus.ACTIVE) {
          if (row.pausedAt) {
            return <Badge className="bg-amber-600 hover:bg-amber-700">PAUSED</Badge>;
          }
          return <Badge className="bg-emerald-600 hover:bg-emerald-700">ACTIVE</Badge>;
        }
        if (row.status === SubscriptionStatus.CLOSED) {
          return <Badge variant="secondary">CLOSED</Badge>;
        }
        return <Badge variant="outline">{row.status}</Badge>;
      },
    },
    {
      header: "Dates",
      accessorKey: "startDate",
      cell: (row) => (
        <div className="text-xs space-y-0.5">
          <div>Start: {new Date(row.startDate).toLocaleDateString()}</div>
          <div className="text-muted-foreground">
            Expiry: {new Date(row.expiryDate).toLocaleDateString()}
          </div>
        </div>
      ),
    },
    {
      header: "Items",
      accessorKey: "_count.lines",
      cell: (row) => (
        <span className="text-xs text-muted-foreground">
          {row._count.lines} {row._count.lines === 1 ? "line" : "lines"}
        </span>
      ),
    },
  ];

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
          <DataTable
            columns={columns}
            data={subscriptionsResult.items}
            total={subscriptionsResult.total}
            page={subscriptionsResult.page}
            pageSize={subscriptionsResult.pageSize}
            searchPlaceholder="Search by SUB- number or customer..."
            emptyMessage="No subscriptions found. Create your first subscription or quotation."
          />
        </CardContent>
      </Card>
    </div>
  );
}
