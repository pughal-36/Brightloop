import Link from "next/link";
import { requireSession } from "@/server/lib/session";
import {
  getDashboardData,
  type OverdueInvoiceRow,
  type RecentPaymentRow,
  type StatusCount,
} from "@/server/modules/dashboard";
import { listPlans } from "@/server/modules/plans/service";
import { listCustomers } from "@/server/modules/customers/service";
import { formatINR } from "@/lib/money";
import { formatDate } from "@/lib/dates";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import {
  FileCheck2,
  TrendingUp,
  DollarSign,
  CreditCard,
  Clock,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { DashboardFilters } from "./dashboard-filters";
import { RevenueChart } from "./revenue-chart";

interface PageProps {
  searchParams: Promise<{
    startDate?: string;
    endDate?: string;
    planId?: string;
    customerId?: string;
    status?: string;
    overduePage?: string;
    paymentsPage?: string;
  }>;
}

export default async function AdminDashboardPage({ searchParams }: PageProps) {
  const session = await requireSession();
  const params = await searchParams;

  const [dashboard, plansData, customersData] = await Promise.all([
    getDashboardData(session, {
      startDate: params.startDate,
      endDate: params.endDate,
      planId: params.planId,
      customerId: params.customerId,
      status: params.status,
      overduePage: params.overduePage ? parseInt(params.overduePage, 10) : 1,
      paymentsPage: params.paymentsPage ? parseInt(params.paymentsPage, 10) : 1,
    }),
    listPlans(session, { pageSize: 100 }),
    listCustomers(session, { pageSize: 100 }),
  ]);

  const { kpis, revenueByMonth, subscriptionsByStatus, overdueInvoices, recentPayments } = dashboard;

  function buildUrlWithParam(key: string, value: number) {
    const p = new URLSearchParams(params as Record<string, string>);
    p.set(key, value.toString());
    return `/admin?${p.toString()}`;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Finance Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Real-time business performance, recurring revenue run-rate, and financial health.
          </p>
        </div>
      </div>

      {/* Filter Bar */}
      <DashboardFilters
        plans={plansData.items.map((p: { id: string; name: string }) => ({ id: p.id, name: p.name }))}
        customers={customersData.items.map((c: { id: string; name: string }) => ({ id: c.id, name: c.name }))}
      />

      {/* KPI Strip */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {/* Active Subscriptions */}
        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-medium text-muted-foreground">
              Active Subscriptions
            </CardTitle>
            <FileCheck2 className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{kpis.activeTotal}</div>
            <p className="text-xs text-muted-foreground mt-1">
              <span className="font-medium text-foreground">{kpis.activeNonPaused}</span> active,{" "}
              <span className="font-medium text-amber-600">{kpis.activePaused}</span> paused
            </p>
          </CardContent>
        </Card>

        {/* MRR */}
        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-medium text-muted-foreground">
              MRR (Run Rate)
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-emerald-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600">
              {formatINR(kpis.mrr)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Normalized monthly</p>
          </CardContent>
        </Card>

        {/* ARR */}
        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-medium text-muted-foreground">
              ARR
            </CardTitle>
            <DollarSign className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {formatINR(kpis.arr)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">MRR × 12 annualized</p>
          </CardContent>
        </Card>

        {/* Revenue Collected */}
        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-medium text-muted-foreground">
              Collected
            </CardTitle>
            <CreditCard className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatINR(kpis.collected)}</div>
            <p className="text-xs text-muted-foreground mt-1">Non-voided payments</p>
          </CardContent>
        </Card>

        {/* Outstanding Balance */}
        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-medium text-muted-foreground">
              Outstanding
            </CardTitle>
            <Clock className="h-4 w-4 text-amber-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatINR(kpis.outstanding)}</div>
            <p className="text-xs text-muted-foreground mt-1">Confirmed unpaid</p>
          </CardContent>
        </Card>

        {/* Overdue */}
        <Card className={`shadow-sm ${kpis.overdueCount > 0 ? "border-destructive/40 bg-destructive/5" : ""}`}>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-medium text-destructive">
              Overdue
            </CardTitle>
            <AlertTriangle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">
              {kpis.overdueCount}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              <span className="font-semibold text-destructive">{formatINR(kpis.overdueAmount)}</span> past due
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Middle Grid: Revenue by Month Chart & Subscriptions by Status */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Revenue by Month Chart (2 cols) */}
        <Card className="lg:col-span-2 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base font-semibold">Revenue by Month</CardTitle>
            <CardDescription className="text-xs">
              Historical recognized cash collections across billing cycles.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <RevenueChart data={revenueByMonth} />
          </CardContent>
        </Card>

        {/* Subscriptions by Status (1 col) */}
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-base font-semibold">Subscriptions by Status</CardTitle>
            <CardDescription className="text-xs">
              Lifecycle status breakdown across all customers.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {subscriptionsByStatus.length === 0 ? (
                <p className="text-xs text-muted-foreground py-4 text-center">No subscriptions found</p>
              ) : (
                subscriptionsByStatus.map((row: StatusCount) => (
                  <div
                    key={row.status}
                    className="flex items-center justify-between rounded-md border p-2.5 text-sm"
                  >
                    <div className="flex items-center gap-2">
                      <Badge
                        variant={
                          row.status === "ACTIVE"
                            ? "default"
                            : row.status === "QUOTATION"
                            ? "secondary"
                            : "outline"
                        }
                        className="text-xs"
                      >
                        {row.status}
                      </Badge>
                      {row.status === "ACTIVE" && row.pausedCount > 0 && (
                        <span className="text-xs text-muted-foreground">
                          ({row.pausedCount} paused)
                        </span>
                      )}
                    </div>
                    <span className="font-bold text-base">{row.count}</span>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Detail Tables: Overdue Invoices and Recent Payments */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Overdue Invoices Table */}
        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div>
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-destructive" />
                Overdue Invoices
              </CardTitle>
              <CardDescription className="text-xs">
                Invoices with past-due dates requiring collection follow-up.
              </CardDescription>
            </div>
            <Badge variant="destructive" className="text-xs">
              {overdueInvoices.total} Total
            </Badge>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Invoice #</TableHead>
                    <TableHead className="text-xs">Customer</TableHead>
                    <TableHead className="text-xs">Due Date</TableHead>
                    <TableHead className="text-xs text-right">Balance</TableHead>
                    <TableHead className="text-xs text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {overdueInvoices.items.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="h-24 text-center text-xs text-muted-foreground">
                        No overdue invoices found.
                      </TableCell>
                    </TableRow>
                  ) : (
                    overdueInvoices.items.map((inv: OverdueInvoiceRow) => (
                      <TableRow key={inv.id}>
                        <TableCell className="font-mono text-xs font-semibold">
                          {inv.number}
                        </TableCell>
                        <TableCell className="text-xs truncate max-w-[140px]">
                          {inv.customerName}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                          {formatDate(inv.dueDate)}
                          <span className="block text-[10px] text-destructive font-medium">
                            {inv.daysOverdue}d overdue
                          </span>
                        </TableCell>
                        <TableCell className="text-xs font-semibold text-right text-destructive">
                          {formatINR(inv.balance)}
                        </TableCell>
                        <TableCell className="text-right">
                          <Link href={`/admin/invoices/${inv.id}`}>
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                              <ExternalLink className="h-3.5 w-3.5" />
                            </Button>
                          </Link>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Overdue Pagination */}
            {overdueInvoices.totalPages > 1 && (
              <div className="flex items-center justify-between pt-3 text-xs text-muted-foreground">
                <span>
                  Page {overdueInvoices.page} of {overdueInvoices.totalPages}
                </span>
                <div className="flex gap-1">
                  <Link
                    href={buildUrlWithParam("overduePage", overdueInvoices.page - 1)}
                    className={overdueInvoices.page <= 1 ? "pointer-events-none opacity-50" : ""}
                  >
                    <Button variant="outline" size="sm" className="h-7 px-2">
                      <ChevronLeft className="h-3.5 w-3.5" />
                    </Button>
                  </Link>
                  <Link
                    href={buildUrlWithParam("overduePage", overdueInvoices.page + 1)}
                    className={overdueInvoices.page >= overdueInvoices.totalPages ? "pointer-events-none opacity-50" : ""}
                  >
                    <Button variant="outline" size="sm" className="h-7 px-2">
                      <ChevronRight className="h-3.5 w-3.5" />
                    </Button>
                  </Link>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Payments Table */}
        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div>
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <CreditCard className="h-4 w-4 text-primary" />
                Recent Payments
              </CardTitle>
              <CardDescription className="text-xs">
                Latest settlement activity and payment transactions.
              </CardDescription>
            </div>
            <Badge variant="outline" className="text-xs">
              {recentPayments.total} Total
            </Badge>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Date</TableHead>
                    <TableHead className="text-xs">Invoice #</TableHead>
                    <TableHead className="text-xs">Customer</TableHead>
                    <TableHead className="text-xs">Method</TableHead>
                    <TableHead className="text-xs text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentPayments.items.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="h-24 text-center text-xs text-muted-foreground">
                        No payments recorded yet.
                      </TableCell>
                    </TableRow>
                  ) : (
                    recentPayments.items.map((p: RecentPaymentRow) => (
                      <TableRow key={p.id}>
                        <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                          {formatDate(p.paidOn)}
                        </TableCell>
                        <TableCell className="font-mono text-xs font-semibold">
                          <Link
                            href={`/admin/invoices/${p.invoiceId}`}
                            className="hover:underline text-primary"
                          >
                            {p.invoiceNumber}
                          </Link>
                        </TableCell>
                        <TableCell className="text-xs truncate max-w-[130px]">
                          {p.customerName}
                        </TableCell>
                        <TableCell className="text-xs">
                          <Badge variant="outline" className="text-[10px]">
                            {p.method}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs font-semibold text-right text-emerald-600">
                          {formatINR(p.amount)}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Payments Pagination */}
            {recentPayments.totalPages > 1 && (
              <div className="flex items-center justify-between pt-3 text-xs text-muted-foreground">
                <span>
                  Page {recentPayments.page} of {recentPayments.totalPages}
                </span>
                <div className="flex gap-1">
                  <Link
                    href={buildUrlWithParam("paymentsPage", recentPayments.page - 1)}
                    className={recentPayments.page <= 1 ? "pointer-events-none opacity-50" : ""}
                  >
                    <Button variant="outline" size="sm" className="h-7 px-2">
                      <ChevronLeft className="h-3.5 w-3.5" />
                    </Button>
                  </Link>
                  <Link
                    href={buildUrlWithParam("paymentsPage", recentPayments.page + 1)}
                    className={recentPayments.page >= recentPayments.totalPages ? "pointer-events-none opacity-50" : ""}
                  >
                    <Button variant="outline" size="sm" className="h-7 px-2">
                      <ChevronRight className="h-3.5 w-3.5" />
                    </Button>
                  </Link>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
