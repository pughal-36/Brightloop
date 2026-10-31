import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSession } from "@/server/lib/session";
import { SubscriptionStatus } from "@/generated/prisma/enums";
import * as subService from "@/server/modules/subscriptions/service";
import { formatINR } from "@/lib/money";
import { getToday } from "@/lib/dates";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { SubscriptionActionsClient } from "./subscription-actions-client";
import {
  ArrowLeft,
  Calendar,
  User,
  Layers,
  History,
} from "lucide-react";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function SubscriptionDetailPage({ params }: PageProps) {
  const session = await requireSession();
  const { id } = await params;

  let subscription;
  let timeline;
  try {
    [subscription, timeline] = await Promise.all([
      subService.getSubscription(session, id),
      subService.getSubscriptionTimeline(session, id),
    ]);
  } catch {
    notFound();
  }

  const totals = subService.computeSubscriptionTotals(
    subscription.lines,
    subscription.planFee,
    subscription.planTaxRateBps
  );

  const today = getToday();
  const isExpired = new Date(subscription.expiryDate).getTime() <= today.getTime();
  const isPaused = subscription.pausedAt !== null;

  return (
    <div className="space-y-6">
      {/* Header and back link */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Link
              href="/admin/subscriptions"
              className="text-muted-foreground hover:text-foreground text-sm flex items-center"
            >
              <ArrowLeft className="mr-1 h-4 w-4" />
              Back to Subscriptions
            </Link>
          </div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold font-mono tracking-tight">
              {subscription.number}
            </h1>
            {subscription.status === SubscriptionStatus.DRAFT && (
              <Badge variant="outline">DRAFT</Badge>
            )}
            {subscription.status === SubscriptionStatus.QUOTATION && (
              <Badge className="bg-blue-600 hover:bg-blue-700">QUOTATION</Badge>
            )}
            {subscription.status === SubscriptionStatus.CONFIRMED && (
              <Badge className="bg-purple-600 hover:bg-purple-700">CONFIRMED</Badge>
            )}
            {subscription.status === SubscriptionStatus.ACTIVE && (
              <>
                {isPaused ? (
                  <Badge className="bg-amber-600 hover:bg-amber-700">PAUSED</Badge>
                ) : (
                  <Badge className="bg-emerald-600 hover:bg-emerald-700">ACTIVE</Badge>
                )}
              </>
            )}
            {subscription.status === SubscriptionStatus.CLOSED && (
              <Badge variant="secondary">CLOSED</Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            Created on {new Date(subscription.createdAt).toLocaleString()}
          </p>
        </div>

        {/* Action Buttons */}
        <SubscriptionActionsClient
          subscriptionId={subscription.id}
          status={subscription.status}
          isPaused={isPaused}
          plan={{
            closable: subscription.plan.closable,
            pausable: subscription.plan.pausable,
            renewable: subscription.plan.renewable,
          }}
          isExpired={isExpired}
        />
      </div>

      {/* Subscription Info Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center text-muted-foreground">
              <User className="mr-2 h-4 w-4" /> Customer Details
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-1">
            <div className="font-bold text-base">{subscription.customer.name}</div>
            <div className="text-muted-foreground">{subscription.customer.email}</div>
            {subscription.customer.phone && (
              <div className="text-xs text-muted-foreground">
                Phone: {subscription.customer.phone}
              </div>
            )}
            {subscription.customer.billingAddress && (
              <div className="text-xs text-muted-foreground mt-2">
                Address: {subscription.customer.billingAddress}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center text-muted-foreground">
              <Layers className="mr-2 h-4 w-4" /> Plan & Schedule
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-1.5">
            <div className="font-bold text-base">{subscription.plan.name}</div>
            <div className="text-xs text-muted-foreground flex justify-between">
              <span>Billing Period:</span>
              <span className="font-medium text-foreground">
                {subscription.plan.billingPeriod}
              </span>
            </div>
            <div className="text-xs text-muted-foreground flex justify-between">
              <span>Plan Fee (snapshot):</span>
              <span className="font-medium text-foreground">
                {formatINR(subscription.planFee)}
              </span>
            </div>
            <div className="text-xs text-muted-foreground flex justify-between">
              <span>Plan Tax Rate:</span>
              <span className="font-medium text-foreground">
                {(subscription.planTaxRateBps / 100).toFixed(2)}%
              </span>
            </div>
            <div className="text-xs text-muted-foreground flex justify-between">
              <span>Payment Terms:</span>
              <span className="font-medium text-foreground">
                {subscription.paymentTerms}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center text-muted-foreground">
              <Calendar className="mr-2 h-4 w-4" /> Lifecycle Dates
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-1.5">
            <div className="text-xs flex justify-between">
              <span className="text-muted-foreground">Start Date:</span>
              <span className="font-medium">
                {new Date(subscription.startDate).toLocaleDateString()}
              </span>
            </div>
            <div className="text-xs flex justify-between">
              <span className="text-muted-foreground">Expiry Date:</span>
              <span className="font-medium">
                {new Date(subscription.expiryDate).toLocaleDateString()}
              </span>
            </div>
            {subscription.nextPeriodStart && (
              <div className="text-xs flex justify-between">
                <span className="text-muted-foreground">Next Period Start:</span>
                <span className="font-medium text-primary">
                  {new Date(subscription.nextPeriodStart).toLocaleDateString()}
                </span>
              </div>
            )}
            {subscription.validUntil && (
              <div className="text-xs flex justify-between">
                <span className="text-muted-foreground">Quote Valid Until:</span>
                <span className="font-medium">
                  {new Date(subscription.validUntil).toLocaleDateString()}
                </span>
              </div>
            )}
            {subscription.pausedAt && (
              <div className="text-xs flex justify-between text-amber-600 font-medium">
                <span>Paused On:</span>
                <span>{new Date(subscription.pausedAt).toLocaleDateString()}</span>
              </div>
            )}
            {subscription.closeReason && (
              <div className="text-xs text-destructive border-t pt-1 mt-1">
                <span className="font-medium">Close Reason:</span> {subscription.closeReason}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Line Items Table */}
      <Card>
        <CardHeader>
          <CardTitle>Line Items (Snapshotted)</CardTitle>
          <CardDescription>
            Snapshotted pricing and tax rates recorded at creation.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="border rounded-md overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 border-b text-xs font-semibold text-muted-foreground">
                <tr>
                  <th className="py-2.5 px-4 text-left">Description</th>
                  <th className="py-2.5 px-4 text-center">Qty</th>
                  <th className="py-2.5 px-4 text-right">Unit Price</th>
                  <th className="py-2.5 px-4 text-right">Tax Rate</th>
                  <th className="py-2.5 px-4 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {subscription.lines.map((line) => (
                  <tr key={line.id} className="hover:bg-muted/30">
                    <td className="py-3 px-4 font-medium">{line.description}</td>
                    <td className="py-3 px-4 text-center">{line.qty}</td>
                    <td className="py-3 px-4 text-right">{formatINR(line.unitPrice)}</td>
                    <td className="py-3 px-4 text-right">
                      {(line.taxRateBps / 100).toFixed(2)}%
                    </td>
                    <td className="py-3 px-4 text-right font-semibold">
                      {formatINR(line.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Totals Summary */}
          <div className="mt-4 flex justify-end">
            <div className="w-full sm:w-80 space-y-2 bg-muted/30 p-4 rounded-lg text-sm">
              <div className="flex justify-between text-muted-foreground">
                <span>Lines Subtotal</span>
                <span>{formatINR(totals.linesSubtotal)}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Plan Fee</span>
                <span>{formatINR(totals.planFee)}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Taxes</span>
                <span>{formatINR(totals.taxTotal)}</span>
              </div>
              <div className="border-t pt-2 flex justify-between font-bold text-base">
                <span>Grand Total</span>
                <span>{formatINR(totals.total)}</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Status Timeline */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <History className="mr-2 h-5 w-5" /> Status Timeline
          </CardTitle>
          <CardDescription>
            Chronological audit of status changes and transitions recorded in StatusHistory.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="relative pl-6 space-y-6 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-muted">
            {timeline.map((entry) => (
              <div key={entry.id} className="relative flex items-start group">
                <div className="absolute -left-6 mt-1 h-3 w-3 rounded-full border-2 border-background bg-primary" />
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    {entry.from ? (
                      <span className="text-xs font-mono text-muted-foreground">
                        {entry.from} →
                      </span>
                    ) : null}
                    <Badge variant="outline" className="font-mono text-xs font-bold">
                      {entry.to}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {new Date(entry.at).toLocaleString()}
                    </span>
                  </div>
                  {entry.note && (
                    <p className="text-sm text-foreground">{entry.note}</p>
                  )}
                  {entry.byUserId && (
                    <p className="text-xs text-muted-foreground font-mono">
                      User: {entry.byUserId}
                    </p>
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
