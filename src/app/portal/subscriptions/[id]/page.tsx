import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSession } from "@/server/lib/session";
import { getMySubscription } from "@/server/modules/portal";
import { acceptQuotationAction } from "@/app/actions/portal";
import { formatINR } from "@/lib/money";
import { formatDate } from "@/lib/dates";
import { computeSubscriptionTotals } from "@/server/modules/subscriptions/service";
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
import { ArrowLeft, CheckCircle2, Clock, AlertCircle } from "lucide-react";
import { AppError } from "@/server/errors";

interface PageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function PortalSubscriptionDetailPage({ params }: PageProps) {
  const session = await requireSession();
  const { id } = await params;

  let data;
  try {
    data = await getMySubscription(session, id);
  } catch (err) {
    if (err instanceof AppError && (err.status === 404 || err.code === "NOT_FOUND")) {
      notFound();
    }
    throw err;
  }

  const { subscription, timeline } = data;
  const isQuotation = subscription.status === "QUOTATION";
  const now = new Date();
  const isExpired = subscription.validUntil ? now > new Date(subscription.validUntil) : false;

  // Calculate clean server totals
  const totals = computeSubscriptionTotals(
    subscription.lines,
    subscription.planFee,
    subscription.planTaxRateBps
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link href="/portal/subscriptions">
            <Button variant="outline" size="sm" className="h-8 w-8 p-0">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight font-mono">
                {subscription.number}
              </h1>
              <Badge
                variant={
                  subscription.status === "ACTIVE"
                    ? "default"
                    : subscription.status === "QUOTATION"
                    ? "secondary"
                    : "outline"
                }
              >
                {subscription.status}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Plan: {subscription.plan.name} • Cadence: {subscription.plan.billingPeriod.toLowerCase()}
            </p>
          </div>
        </div>

        {/* Accept Quotation Action (Only if status is QUOTATION) */}
        {isQuotation && (
          <div>
            {isExpired ? (
              <div className="flex items-center gap-2 text-destructive text-xs font-semibold bg-destructive/10 px-3 py-2 rounded-md">
                <AlertCircle className="h-4 w-4" />
                This quotation expired on {subscription.validUntil ? formatDate(subscription.validUntil) : "N/A"}.
              </div>
            ) : (
              <form
                action={async () => {
                  "use server";
                  await acceptQuotationAction(subscription.id);
                }}
              >
                <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700 text-white">
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  Accept Quotation
                </Button>
              </form>
            )}
          </div>
        )}
      </div>

      {/* Subscription Info Card */}
      <div className="grid gap-6 md:grid-cols-3">
        <Card className="md:col-span-2 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base font-semibold">Subscription Details</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-xs">
              <div>
                <dt className="text-muted-foreground">Start Date</dt>
                <dd className="font-medium text-foreground mt-0.5">
                  {formatDate(subscription.startDate)}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Expiry Date</dt>
                <dd className="font-medium text-foreground mt-0.5">
                  {formatDate(subscription.expiryDate)}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Payment Terms</dt>
                <dd className="font-medium text-foreground mt-0.5">
                  {subscription.paymentTerms}
                </dd>
              </div>
              {subscription.validUntil && (
                <div>
                  <dt className="text-muted-foreground">Quotation Valid Until</dt>
                  <dd className="font-medium text-foreground mt-0.5">
                    {formatDate(subscription.validUntil)}
                  </dd>
                </div>
              )}
            </dl>
          </CardContent>
        </Card>

        {/* Financial Summary */}
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-base font-semibold">Recurring Summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Plan Recurring Fee</span>
              <span>{formatINR(totals.planFee)}</span>
            </div>
            {totals.linesSubtotal > 0 && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Products Subtotal</span>
                <span>{formatINR(totals.linesSubtotal)}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-muted-foreground">Subtotal (Pre-tax)</span>
              <span>{formatINR(totals.subtotal)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Tax Total</span>
              <span>{formatINR(totals.taxTotal)}</span>
            </div>
            <div className="border-t pt-2 flex justify-between font-bold text-sm text-foreground">
              <span>Total / Period</span>
              <span>{formatINR(totals.total)}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Subscription Line Items Snapshot */}
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="text-base font-semibold">Included Items & Services</CardTitle>
          <CardDescription className="text-xs">
            Snapshot of products, software tiers, and services included in this subscription.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Item Description</TableHead>
                  <TableHead className="text-xs text-center">Qty</TableHead>
                  <TableHead className="text-xs text-right">Unit Price</TableHead>
                  <TableHead className="text-xs text-right">Tax Rate</TableHead>
                  <TableHead className="text-xs text-right">Pre-tax Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {subscription.lines.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="h-20 text-center text-xs text-muted-foreground">
                      Only base plan fee included (no add-on line items).
                    </TableCell>
                  </TableRow>
                ) : (
                  subscription.lines.map((line) => (
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
                        {(line.taxRateBps / 100).toFixed(2)}%
                      </TableCell>
                      <TableCell className="text-xs font-semibold text-right">
                        {formatINR(line.amount)}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Status History Timeline */}
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Clock className="h-4 w-4 text-primary" />
            Status Timeline
          </CardTitle>
          <CardDescription className="text-xs">
            Chronological audit of status updates and lifecycle transitions.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {timeline.length === 0 ? (
            <p className="text-xs text-muted-foreground">No history recorded yet.</p>
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
