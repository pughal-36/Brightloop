import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSession } from "@/server/lib/session";
import { getMyInvoice } from "@/server/modules/portal";
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
  ArrowLeft,
  CreditCard,
  Printer,
  Clock,
} from "lucide-react";
import { AppError } from "@/server/errors";

interface PageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function PortalInvoiceDetailPage({ params }: PageProps) {
  const session = await requireSession();
  const { id } = await params;

  let data;
  try {
    data = await getMyInvoice(session, id);
  } catch (err) {
    if (err instanceof AppError && (err.status === 404 || err.code === "NOT_FOUND")) {
      notFound();
    }
    throw err;
  }

  const { invoice, timeline } = data;

  return (
    <div className="space-y-6">
      {/* Header and Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link href="/portal/invoices">
            <Button variant="outline" size="sm" className="h-8 w-8 p-0">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight font-mono">
                {invoice.number}
              </h1>
              <Badge
                variant={
                  invoice.status === "PAID"
                    ? "default"
                    : invoice.status === "CONFIRMED"
                    ? "secondary"
                    : "outline"
                }
              >
                {invoice.status}
              </Badge>
              {invoice.isOverdue && (
                <Badge variant="destructive">Overdue</Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Issued: {formatDate(invoice.issueDate)} • Due: {formatDate(invoice.dueDate)}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Print Invoice Button */}
          <Link href={`/portal/invoices/${invoice.id}/print`} target="_blank">
            <Button variant="outline" size="sm">
              <Printer className="mr-2 h-4 w-4" />
              Print Invoice
            </Button>
          </Link>

          {/* Disabled Pay Now Button as instructed */}
          <Button
            size="sm"
            disabled
            className="cursor-not-allowed opacity-60"
            title="Online payment processing coming soon"
          >
            <CreditCard className="mr-2 h-4 w-4" />
            Pay now
          </Button>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid gap-6 md:grid-cols-3">
        <Card className="md:col-span-2 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base font-semibold">Invoice Information</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-xs">
              <div>
                <dt className="text-muted-foreground">Billed To</dt>
                <dd className="font-semibold text-foreground mt-0.5">
                  {invoice.customer.name}
                </dd>
                {invoice.customer.billingAddress && (
                  <dd className="text-muted-foreground whitespace-pre-line mt-0.5">
                    {invoice.customer.billingAddress}
                  </dd>
                )}
              </div>
              <div>
                <dt className="text-muted-foreground">Subscription Ref</dt>
                <dd className="font-mono font-medium text-foreground mt-0.5">
                  <Link
                    href={`/portal/subscriptions/${invoice.subscriptionId}`}
                    className="hover:underline text-primary"
                  >
                    {invoice.subscription.number}
                  </Link>
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Billing Period</dt>
                <dd className="font-medium text-foreground mt-0.5">
                  {formatDate(invoice.periodStart)} – {formatDate(invoice.periodEnd)}
                </dd>
              </div>
            </dl>
          </CardContent>
        </Card>

        {/* Financial Balance Summary */}
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-base font-semibold">Payment Summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Subtotal</span>
              <span>{formatINR(invoice.subtotal)}</span>
            </div>
            {invoice.discountTotal > 0 && (
              <div className="flex justify-between text-emerald-600 font-medium">
                <span>Discount</span>
                <span>-{formatINR(invoice.discountTotal)}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-muted-foreground">Taxes</span>
              <span>{formatINR(invoice.taxTotal)}</span>
            </div>
            <div className="border-t pt-2 flex justify-between font-bold text-sm">
              <span>Invoice Total</span>
              <span>{formatINR(invoice.total)}</span>
            </div>
            <div className="flex justify-between text-muted-foreground">
              <span>Amount Paid</span>
              <span>{formatINR(invoice.amountPaid)}</span>
            </div>
            <div className={`border-t pt-2 flex justify-between font-bold text-sm ${invoice.balance > 0 ? "text-amber-600" : "text-muted-foreground"}`}>
              <span>Balance Due</span>
              <span>{formatINR(invoice.balance)}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Line Items Snapshot */}
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="text-base font-semibold">Line Items</CardTitle>
          <CardDescription className="text-xs">
            Snapshot of charged plan fees and services for this billing period.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Description</TableHead>
                  <TableHead className="text-xs text-center">Qty</TableHead>
                  <TableHead className="text-xs text-right">Unit Price</TableHead>
                  <TableHead className="text-xs text-right">Tax</TableHead>
                  <TableHead className="text-xs text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoice.lines.map((line) => (
                  <TableRow key={line.id}>
                    <TableCell className="text-xs font-medium">
                      {line.description}
                    </TableCell>
                    <TableCell className="text-xs text-center font-mono">
                      {line.qty}
                    </TableCell>
                    <TableCell className="text-xs text-right">
                      {formatINR(line.unitPrice)}
                    </TableCell>
                    <TableCell className="text-xs text-right">
                      {formatINR(line.taxAmount)}
                    </TableCell>
                    <TableCell className="text-xs font-semibold text-right">
                      {formatINR(line.amount + line.taxAmount)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Payments Received on this Invoice */}
      {invoice.payments && invoice.payments.length > 0 && (
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-emerald-600" />
              Payments Recorded
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Date</TableHead>
                    <TableHead className="text-xs">Method</TableHead>
                    <TableHead className="text-xs">Provider</TableHead>
                    <TableHead className="text-xs text-right">Amount Paid</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invoice.payments.map((pmt) => (
                    <TableRow key={pmt.id}>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        {formatDate(pmt.paidOn)}
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
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Invoice Timeline */}
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Clock className="h-4 w-4 text-primary" />
            Invoice Timeline
          </CardTitle>
        </CardHeader>
        <CardContent>
          {timeline.length === 0 ? (
            <p className="text-xs text-muted-foreground">No events recorded.</p>
          ) : (
            <div className="space-y-4">
              {timeline.map((entry, idx) => (
                <div key={entry.id || idx} className="flex items-start gap-3 text-xs">
                  <div className="mt-1 h-2 w-2 rounded-full bg-primary shrink-0" />
                  <div className="flex-1 space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-foreground">
                        {entry.from ? `${entry.from} → ${entry.to}` : entry.to}
                      </span>
                      <span className="text-muted-foreground text-[10px]">
                        {formatDate(entry.at)}
                      </span>
                    </div>
                    {entry.note && (
                      <p className="text-muted-foreground">{entry.note}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
