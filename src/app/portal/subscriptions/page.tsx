import Link from "next/link";
import { requireSession } from "@/server/lib/session";
import { listMySubscriptions } from "@/server/modules/portal";
import { SubscriptionStatus } from "@/generated/prisma/enums";
import { formatDate } from "@/lib/dates";
import { formatINR } from "@/lib/money";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { ChevronLeft, ChevronRight, Eye } from "lucide-react";

interface PageProps {
  searchParams: Promise<{
    page?: string;
    status?: string;
  }>;
}

export default async function PortalSubscriptionsPage({ searchParams }: PageProps) {
  const session = await requireSession();
  const params = await searchParams;
  const page = params.page ? parseInt(params.page, 10) : 1;
  const statusFilter = Object.values(SubscriptionStatus).includes(params.status as SubscriptionStatus)
    ? (params.status as SubscriptionStatus)
    : undefined;

  const result = await listMySubscriptions(session, {
    page,
    pageSize: 10,
    status: statusFilter,
  });

  function buildUrl(newPage: number, newStatus?: string) {
    const p = new URLSearchParams();
    p.set("page", newPage.toString());
    const stat = newStatus !== undefined ? newStatus : (statusFilter || "");
    if (stat) {
      p.set("status", stat);
    }
    return `/portal/subscriptions?${p.toString()}`;
  }

  const tabs = [
    { label: "All", value: "" },
    { label: "Active", value: SubscriptionStatus.ACTIVE },
    { label: "Quotations", value: SubscriptionStatus.QUOTATION },
    { label: "Confirmed", value: SubscriptionStatus.CONFIRMED },
    { label: "Closed", value: SubscriptionStatus.CLOSED },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">My Subscriptions</h1>
        <p className="text-sm text-muted-foreground">
          View your recurring plans, status lifecycles, and quotation offers.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {tabs.map((tab) => {
          const isActive = (tab.value === "" && !statusFilter) || statusFilter === tab.value;
          return (
            <Link key={tab.label} href={buildUrl(1, tab.value)}>
              <Button
                variant={isActive ? "default" : "outline"}
                size="sm"
                className="text-xs h-8"
              >
                {tab.label}
              </Button>
            </Link>
          );
        })}
      </div>

      {/* Table */}
      <Card className="shadow-sm">
        <CardContent className="pt-6">
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Number</TableHead>
                  <TableHead className="text-xs">Plan</TableHead>
                  <TableHead className="text-xs">Billing Period</TableHead>
                  <TableHead className="text-xs">Plan Fee</TableHead>
                  <TableHead className="text-xs">Status</TableHead>
                  <TableHead className="text-xs">Start Date</TableHead>
                  <TableHead className="text-xs">Expiry Date</TableHead>
                  <TableHead className="text-xs text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {result.items.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="h-32 text-center text-xs text-muted-foreground">
                      No subscriptions found.
                    </TableCell>
                  </TableRow>
                ) : (
                  result.items.map((sub) => (
                    <TableRow key={sub.id}>
                      <TableCell className="font-mono text-xs font-semibold">
                        {sub.number}
                      </TableCell>
                      <TableCell className="text-xs font-medium">
                        {sub.plan.name}
                      </TableCell>
                      <TableCell className="text-xs capitalize">
                        {sub.plan.billingPeriod.toLowerCase()}
                      </TableCell>
                      <TableCell className="text-xs">
                        {formatINR(sub.planFee)}
                      </TableCell>
                      <TableCell className="text-xs">
                        <Badge
                          variant={
                            sub.status === "ACTIVE"
                              ? "default"
                              : sub.status === "QUOTATION"
                              ? "secondary"
                              : "outline"
                          }
                          className="text-[10px]"
                        >
                          {sub.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        {formatDate(sub.startDate)}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        {formatDate(sub.expiryDate)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Link href={`/portal/subscriptions/${sub.id}`}>
                          <Button variant="outline" size="sm" className="h-7 text-xs">
                            <Eye className="mr-1 h-3.5 w-3.5" />
                            View
                          </Button>
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between pt-4 text-xs text-muted-foreground">
            <div>
              Showing {result.total === 0 ? 0 : (page - 1) * result.pageSize + 1} to{" "}
              {Math.min(page * result.pageSize, result.total)} of {result.total} subscriptions
            </div>
            {result.totalPages > 1 && (
              <div className="flex items-center space-x-2">
                <span>
                  Page {result.page} of {result.totalPages}
                </span>
                <Link
                  href={buildUrl(page - 1)}
                  className={page <= 1 ? "pointer-events-none opacity-50" : ""}
                >
                  <Button variant="outline" size="sm" className="h-8 px-2">
                    <ChevronLeft className="h-4 w-4 mr-1" />
                    Previous
                  </Button>
                </Link>
                <Link
                  href={buildUrl(page + 1)}
                  className={page >= result.totalPages ? "pointer-events-none opacity-50" : ""}
                >
                  <Button variant="outline" size="sm" className="h-8 px-2">
                    Next
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </Link>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
