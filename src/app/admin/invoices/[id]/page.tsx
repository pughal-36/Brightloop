import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSession } from "@/server/lib/session";
import { getInvoice, getInvoiceTimeline } from "@/server/modules/invoices";
import { formatINR } from "@/lib/money";
import { InvoiceStatus, InvoiceLineKind } from "@/generated/prisma/enums";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { InvoiceActionsClient, VoidPaymentButton } from "./invoice-actions-client";
import { ArrowLeft } from "lucide-react";

interface AdminInvoiceDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function AdminInvoiceDetailPage({ params }: AdminInvoiceDetailPageProps) {
  const session = await requireSession();
  const { id } = await params;

  let invoice;
  let timeline;
  try {
    invoice = await getInvoice(session, id);
    timeline = await getInvoiceTimeline(session, id);
  } catch {
    notFound();
  }

  const hasPayments = invoice.payments.some((p) => p.voidedAt === null);

  return (
    <div className="space-y-6">
      {/* Header with Navigation and Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link href="/admin/invoices">
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
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
                  invoice.status === InvoiceStatus.PAID
                    ? "default"
                    : invoice.status === InvoiceStatus.CONFIRMED
                    ? "secondary"
                    : invoice.status === InvoiceStatus.CANCELLED
                    ? "destructive"
                    : "outline"
                }
              >
                {invoice.status}
              </Badge>
              {invoice.isOverdue && (
                <Badge variant="destructive" className="font-semibold text-xs">
                  OVERDUE
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Customer: <span className="font-medium text-foreground">{invoice.customer.name}</span> ({invoice.customer.email})
            </p>
          </div>
        </div>

        <InvoiceActionsClient
          invoiceId={invoice.id}
          invoiceStatus={invoice.status}
          userRole={session.user.role}
          balancePaise={invoice.balance}
          amountPaidPaise={invoice.amountPaid}
          hasPayments={hasPayments}
        />
      </div>

      {/* Invoice Meta Grid */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="text-xs">Issue Date</CardDescription>
            <CardTitle className="text-sm font-semibold">
              {new Date(invoice.issueDate).toISOString().split("T")[0]}
            </CardTitle>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="text-xs">Due Date</CardDescription>
            <CardTitle className="text-sm font-semibold">
              {new Date(invoice.dueDate).toISOString().split("T")[0]}
            </CardTitle>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="text-xs">Billing Period</CardDescription>
            <CardTitle className="text-sm font-semibold">
              {new Date(invoice.periodStart).toISOString().split("T")[0]} to{" "}
              {new Date(invoice.periodEnd).toISOString().split("T")[0]}
            </CardTitle>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="text-xs">Subscription</CardDescription>
            <CardTitle className="text-sm font-semibold font-mono text-primary">
              <Link href={`/admin/subscriptions/${invoice.subscriptionId}`}>
                {invoice.subscription.number}
              </Link>
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Snapshotted Line Items Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Line Items</CardTitle>
          <CardDescription>
            Snapshotted pricing and tax rates frozen upon invoice generation and confirmation.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead className="text-right">Unit Price</TableHead>
                  <TableHead className="text-right">Tax Rate</TableHead>
                  <TableHead className="text-right">Tax Amount</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoice.lines.map((line) => (
                  <TableRow key={line.id}>
                    <TableCell>
                      <Badge
                        variant={
                          line.kind === InvoiceLineKind.PLAN_FEE
                            ? "default"
                            : line.kind === InvoiceLineKind.DISCOUNT
                            ? "secondary"
                            : "outline"
                        }
                        className="text-[10px]"
                      >
                        {line.kind}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-medium text-sm">
                      {line.description}
                    </TableCell>
                    <TableCell className="text-right text-sm">{line.qty}</TableCell>
                    <TableCell className="text-right text-sm">
                      {line.kind === InvoiceLineKind.DISCOUNT ? "-" : formatINR(line.unitPrice)}
                    </TableCell>
                    <TableCell className="text-right text-xs text-muted-foreground">
                      {(line.taxRateBps / 100).toFixed(2)}%
                    </TableCell>
                    <TableCell className="text-right text-sm">
                      {formatINR(line.taxAmount)}
                    </TableCell>
                    <TableCell className="text-right font-medium text-sm">
                      <span className={line.amount < 0 ? "text-green-700" : ""}>
                        {formatINR(line.amount)}
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Totals Summary */}
          <div className="mt-6 flex flex-col items-end space-y-1.5 text-sm">
            <div className="flex justify-between w-64 text-muted-foreground">
              <span>Subtotal:</span>
              <span>{formatINR(invoice.subtotal)}</span>
            </div>
            {invoice.discountTotal > 0 && (
              <div className="flex justify-between w-64 text-green-700 font-medium">
                <span>Discount:</span>
                <span>-{formatINR(invoice.discountTotal)}</span>
              </div>
            )}
            <div className="flex justify-between w-64 text-muted-foreground">
              <span>Tax Total:</span>
              <span>{formatINR(invoice.taxTotal)}</span>
            </div>
            <div className="flex justify-between w-64 font-bold text-base border-t pt-2 mt-1">
              <span>Grand Total:</span>
              <span>{formatINR(invoice.total)}</span>
            </div>
            <div className="flex justify-between w-64 text-muted-foreground text-xs">
              <span>Amount Paid:</span>
              <span>{formatINR(invoice.amountPaid)}</span>
            </div>
            <div className="flex justify-between w-64 font-bold text-sm border-t border-dashed pt-1">
              <span>Balance Due:</span>
              <span className={invoice.balance > 0 ? "text-red-600" : "text-green-700"}>
                {formatINR(invoice.balance)}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Payments Section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Recorded Payments</CardTitle>
          <CardDescription>
            History of manual payments and settlements recorded for this statement.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {invoice.payments.length === 0 ? (
            <p className="text-center py-6 text-sm text-muted-foreground">
              No payments have been recorded for this invoice yet.
            </p>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Method</TableHead>
                    <TableHead>Provider</TableHead>
                    <TableHead>Note / Ref</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invoice.payments.map((p) => {
                    const isVoided = p.voidedAt !== null;
                    return (
                      <TableRow key={p.id} className={isVoided ? "opacity-60 bg-muted/20" : ""}>
                        <TableCell className="text-xs">
                          {new Date(p.paidOn).toISOString().split("T")[0]}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-[11px]">
                            {p.method}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {p.provider}
                        </TableCell>
                        <TableCell className="text-xs max-w-xs truncate">
                          {p.note || "-"}
                        </TableCell>
                        <TableCell className="text-right font-semibold text-sm">
                          <span className={isVoided ? "line-through text-muted-foreground" : "text-green-700"}>
                            {formatINR(p.amount)}
                          </span>
                        </TableCell>
                        <TableCell>
                          {isVoided ? (
                            <Badge variant="destructive" className="text-[10px]">
                              Voided: {p.voidNote || "Void"}
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="text-[10px]">
                              Valid
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <VoidPaymentButton
                            paymentId={p.id}
                            userRole={session.user.role}
                            isVoided={isVoided}
                          />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Status History Timeline */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Status History Timeline</CardTitle>
          <CardDescription>Audit trail of state transitions for this invoice.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="relative border-l border-muted-foreground/20 ml-3 space-y-6 py-2">
            {timeline.map((entry, idx) => (
              <div key={entry.id || idx} className="relative pl-6">
                <div className="absolute -left-1.5 top-1.5 h-3 w-3 rounded-full border-2 border-background bg-primary" />
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs font-semibold">
                      {entry.from ? `${entry.from} → ${entry.to}` : entry.to}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {new Date(entry.at).toLocaleString("en-IN", {
                        timeZone: "Asia/Kolkata",
                      })}
                    </span>
                  </div>
                  {entry.note && (
                    <p className="text-xs text-muted-foreground">{entry.note}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
