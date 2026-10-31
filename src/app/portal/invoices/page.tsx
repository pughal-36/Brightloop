import Link from "next/link";
import { requireSession } from "@/server/lib/session";
import { listMyInvoices } from "@/server/modules/portal";
import { InvoiceStatus } from "@/generated/prisma/enums";
import { formatDate } from "@/lib/dates";
import { formatINR } from "@/lib/money";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { ChevronLeft, ChevronRight, Eye, Printer } from "lucide-react";

interface PageProps {
  searchParams: Promise<{
    page?: string;
    status?: string;
  }>;
}

export default async function PortalInvoicesPage({ searchParams }: PageProps) {
  const session = await requireSession();
  const params = await searchParams;
  const page = params.page ? parseInt(params.page, 10) : 1;
  const statusFilter = Object.values(InvoiceStatus).includes(params.status as InvoiceStatus)
    ? (params.status as InvoiceStatus)
    : undefined;

  const result = await listMyInvoices(session, {
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
    return `/portal/invoices?${p.toString()}`;
  }

  const tabs = [
    { label: "All", value: "" },
    { label: "Confirmed", value: InvoiceStatus.CONFIRMED },
    { label: "Paid", value: InvoiceStatus.PAID },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">My Invoices</h1>
        <p className="text-sm text-muted-foreground">
          Review your billing statements, check outstanding balances, and print copies.
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
                  <TableHead className="text-xs">Invoice #</TableHead>
                  <TableHead className="text-xs">Issue Date</TableHead>
                  <TableHead className="text-xs">Due Date</TableHead>
                  <TableHead className="text-xs">Status</TableHead>
                  <TableHead className="text-xs text-right">Total</TableHead>
                  <TableHead className="text-xs text-right">Paid</TableHead>
                  <TableHead className="text-xs text-right">Balance</TableHead>
                  <TableHead className="text-xs text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {result.invoices.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="p-8 text-center">
                      <EmptyState
                        title="No invoices found"
                        description="You have no billing statements matching this filter."
                      />
                    </TableCell>
                  </TableRow>
                ) : (
                  result.invoices.map((inv) => (
                    <TableRow key={inv.id}>
                      <TableCell className="font-mono text-xs font-semibold">
                        {inv.number}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        {formatDate(inv.issueDate)}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        {formatDate(inv.dueDate)}
                      </TableCell>
                      <TableCell className="text-xs">
                        <StatusBadge status={inv.status} isOverdue={inv.isOverdue} />
                      </TableCell>
                      <TableCell className="text-xs font-semibold text-right">
                        {formatINR(inv.total)}
                      </TableCell>
                      <TableCell className="text-xs text-right text-muted-foreground">
                        {formatINR(inv.amountPaid)}
                      </TableCell>
                      <TableCell className={`text-xs font-bold text-right ${inv.balance > 0 ? "text-amber-600" : "text-muted-foreground"}`}>
                        {formatINR(inv.balance)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Link href={`/portal/invoices/${inv.id}`}>
                            <Button variant="outline" size="sm" className="h-7 text-xs">
                              <Eye className="mr-1 h-3.5 w-3.5" />
                              View
                            </Button>
                          </Link>
                          <Link href={`/portal/invoices/${inv.id}/print`} target="_blank">
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground">
                              <Printer className="h-3.5 w-3.5" />
                            </Button>
                          </Link>
                        </div>
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
              Showing {result.totalCount === 0 ? 0 : (page - 1) * result.pageSize + 1} to{" "}
              {Math.min(page * result.pageSize, result.totalCount)} of {result.totalCount} invoices
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
