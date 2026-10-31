import Link from "next/link";
import { requireSession } from "@/server/lib/session";
import { getPortalDashboard } from "@/server/modules/portal";
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
import { Button } from "@/components/ui/button";
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
  FileText,
  AlertTriangle,
  Clock,
  ArrowRight,
  ExternalLink,
} from "lucide-react";

export default async function PortalDashboardPage() {
  const session = await requireSession();
  const data = await getPortalDashboard(session);

  return (
    <div className="space-y-6">
      {/* Welcome header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          Welcome, {data.customer?.name || session.user.name}
        </h1>
        <p className="text-sm text-muted-foreground">
          Manage your active subscriptions, review quotations, and track statements.
        </p>
      </div>

      {/* Overdue Alert Banner */}
      {data.overdueCount > 0 && (
        <div className="flex items-center justify-between rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-destructive">
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 shrink-0" />
            <div>
              <p className="text-sm font-semibold">
                Payment Attention Required
              </p>
              <p className="text-xs">
                You have {data.overdueCount} overdue invoice{data.overdueCount > 1 ? "s" : ""} totaling{" "}
                <span className="font-bold">{formatINR(data.overdueAmount)}</span>.
              </p>
            </div>
          </div>
          <Link href="/portal/invoices">
            <Button variant="destructive" size="sm" className="h-8 text-xs">
              View Invoices
            </Button>
          </Link>
        </div>
      )}

      {/* Summary KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Link href="/portal/subscriptions">
          <Card className="hover:bg-muted/40 transition-colors cursor-pointer h-full shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-xs font-medium text-muted-foreground">
                Active Subscriptions
              </CardTitle>
              <FileCheck2 className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{data.activeCount}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Currently running services
              </p>
            </CardContent>
          </Card>
        </Link>

        <Link href="/portal/subscriptions?status=QUOTATION">
          <Card className="hover:bg-muted/40 transition-colors cursor-pointer h-full shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-xs font-medium text-muted-foreground">
                Pending Quotations
              </CardTitle>
              <Clock className="h-4 w-4 text-amber-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-amber-600">
                {data.quotationCount}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Awaiting your approval
              </p>
            </CardContent>
          </Card>
        </Link>

        <Link href="/portal/invoices">
          <Card className="hover:bg-muted/40 transition-colors cursor-pointer h-full shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-xs font-medium text-muted-foreground">
                Amount Due
              </CardTitle>
              <FileText className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {formatINR(data.amountDue)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Total outstanding balance
              </p>
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* Recent Subscriptions and Recent Invoices */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Recent Subscriptions */}
        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div>
              <CardTitle className="text-base font-semibold">
                Recent Subscriptions
              </CardTitle>
              <CardDescription className="text-xs">
                Your latest recurring subscriptions and plans.
              </CardDescription>
            </div>
            <Link href="/portal/subscriptions">
              <Button variant="ghost" size="sm" className="h-8 text-xs text-muted-foreground">
                View All <ArrowRight className="ml-1 h-3.5 w-3.5" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Number</TableHead>
                    <TableHead className="text-xs">Plan</TableHead>
                    <TableHead className="text-xs">Status</TableHead>
                    <TableHead className="text-xs text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.recentSubscriptions.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="h-24 text-center text-xs text-muted-foreground">
                        No subscriptions found.
                      </TableCell>
                    </TableRow>
                  ) : (
                    data.recentSubscriptions.map((sub) => (
                      <TableRow key={sub.id}>
                        <TableCell className="font-mono text-xs font-semibold">
                          {sub.number}
                        </TableCell>
                        <TableCell className="text-xs">
                          {sub.plan.name}
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
                        <TableCell className="text-right">
                          <Link href={`/portal/subscriptions/${sub.id}`}>
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
          </CardContent>
        </Card>

        {/* Recent Invoices */}
        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div>
              <CardTitle className="text-base font-semibold">
                Recent Invoices
              </CardTitle>
              <CardDescription className="text-xs">
                Billing statements issued for your account.
              </CardDescription>
            </div>
            <Link href="/portal/invoices">
              <Button variant="ghost" size="sm" className="h-8 text-xs text-muted-foreground">
                View All <ArrowRight className="ml-1 h-3.5 w-3.5" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Invoice #</TableHead>
                    <TableHead className="text-xs">Due Date</TableHead>
                    <TableHead className="text-xs">Status</TableHead>
                    <TableHead className="text-xs text-right">Total</TableHead>
                    <TableHead className="text-xs text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.recentInvoices.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="h-24 text-center text-xs text-muted-foreground">
                        No invoices issued yet.
                      </TableCell>
                    </TableRow>
                  ) : (
                    data.recentInvoices.map((inv) => (
                      <TableRow key={inv.id}>
                        <TableCell className="font-mono text-xs font-semibold">
                          {inv.number}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                          {formatDate(inv.dueDate)}
                        </TableCell>
                        <TableCell className="text-xs">
                          <Badge
                            variant={
                              inv.status === "PAID"
                                ? "default"
                                : inv.status === "CONFIRMED"
                                ? "secondary"
                                : "outline"
                            }
                            className="text-[10px]"
                          >
                            {inv.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs font-semibold text-right">
                          {formatINR(inv.total)}
                        </TableCell>
                        <TableCell className="text-right">
                          <Link href={`/portal/invoices/${inv.id}`}>
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
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
