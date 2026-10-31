import Link from "next/link";
import { requireSession } from "@/server/lib/session";
import { listMyPayments } from "@/server/modules/portal";
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
import { ChevronLeft, ChevronRight, ExternalLink } from "lucide-react";

interface PageProps {
  searchParams: Promise<{
    page?: string;
  }>;
}

export default async function PortalPaymentsPage({ searchParams }: PageProps) {
  const session = await requireSession();
  const params = await searchParams;
  const page = params.page ? parseInt(params.page, 10) : 1;

  const result = await listMyPayments(session, {
    page,
    pageSize: 10,
  });

  function buildUrl(newPage: number) {
    const p = new URLSearchParams();
    p.set("page", newPage.toString());
    return `/portal/payments?${p.toString()}`;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Payment History</h1>
        <p className="text-sm text-muted-foreground">
          View all payment transactions recorded toward your account invoices.
        </p>
      </div>

      <Card className="shadow-sm">
        <CardContent className="pt-6">
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Payment Date</TableHead>
                  <TableHead className="text-xs">Invoice #</TableHead>
                  <TableHead className="text-xs">Method</TableHead>
                  <TableHead className="text-xs">Provider</TableHead>
                  <TableHead className="text-xs text-right">Amount Paid</TableHead>
                  <TableHead className="text-xs text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {result.items.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-32 text-center text-xs text-muted-foreground">
                      No payment records found.
                    </TableCell>
                  </TableRow>
                ) : (
                  result.items.map((pmt) => (
                    <TableRow key={pmt.id}>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        {formatDate(pmt.paidOn)}
                      </TableCell>
                      <TableCell className="font-mono text-xs font-semibold">
                        <Link
                          href={`/portal/invoices/${pmt.invoice.id}`}
                          className="hover:underline text-primary"
                        >
                          {pmt.invoice.number}
                        </Link>
                      </TableCell>
                      <TableCell className="text-xs">
                        <Badge variant="outline" className="text-[10px]">
                          {pmt.method}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {pmt.provider}
                      </TableCell>
                      <TableCell className="text-xs font-semibold text-right text-emerald-600">
                        {formatINR(pmt.amount)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Link href={`/portal/invoices/${pmt.invoice.id}`}>
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

          {/* Pagination */}
          <div className="flex items-center justify-between pt-4 text-xs text-muted-foreground">
            <div>
              Showing {result.total === 0 ? 0 : (page - 1) * result.pageSize + 1} to{" "}
              {Math.min(page * result.pageSize, result.total)} of {result.total} transactions
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
