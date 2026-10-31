"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
import { toast } from "sonner";
import { runBillingAction, previewBillingAction } from "@/app/actions/billing";
import type { BillingRunSummary, BillingPreviewSummary } from "@/server/modules/billing/schema";
import { Play, Eye, Clock, CheckCircle2, AlertTriangle, AlertCircle } from "lucide-react";

interface BillingClientProps {
  demoMode: boolean;
  initialRuns: BillingRunSummary[];
  defaultDate: string;
}

export function BillingClient({
  demoMode,
  initialRuns,
  defaultDate,
}: BillingClientProps) {
  const [asOfDate, setAsOfDate] = useState(defaultDate);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [previewResult, setPreviewResult] = useState<BillingPreviewSummary | null>(null);
  const [lastRunResult, setLastRunResult] = useState<BillingRunSummary | null>(null);
  const [runs, setRuns] = useState<BillingRunSummary[]>(initialRuns);

  const handlePreview = async () => {
    setIsPreviewing(true);
    setLastRunResult(null);
    try {
      const res = await previewBillingAction(asOfDate);
      if (res.ok && res.data) {
        setPreviewResult(res.data);
        toast.info("Billing preview completed");
      } else {
        toast.error(res.error || "Preview failed");
      }
    } catch {
      toast.error("Failed to run preview");
    } finally {
      setIsPreviewing(false);
    }
  };

  const handleRun = async () => {
    setIsRunning(true);
    try {
      const formData = new FormData();
      formData.set("asOfDate", asOfDate);
      const res = await runBillingAction(formData);
      if (res.ok && res.data) {
        setLastRunResult(res.data);
        setRuns((prev) => [res.data, ...prev]);
        toast.success(`Billing run completed: ${res.data.created} invoices created`);
      } else {
        toast.error(res.error || "Billing run failed");
      }
    } catch {
      toast.error("Failed to run billing engine");
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Control Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-xl">Execute Billing Engine</CardTitle>
              <CardDescription>
                Process recurring subscription periods and generate invoices in advance.
              </CardDescription>
            </div>
            {demoMode && (
              <Badge variant="outline" className="bg-amber-50 text-amber-900 border-amber-300">
                <Clock className="w-3 h-3 mr-1" />
                Demo Clock Active
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row items-end gap-4 max-w-xl">
            <div className="space-y-2 flex-1 w-full">
              <Label htmlFor="asOfDate" className="font-semibold">
                {demoMode ? "Demo Clock (As-Of Date)" : "As-Of Date"}
              </Label>
              <Input
                id="asOfDate"
                type="date"
                value={asOfDate}
                onChange={(e) => setAsOfDate(e.target.value)}
              />
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={handlePreview}
                disabled={isPreviewing || isRunning}
              >
                <Eye className="w-4 h-4 mr-2" />
                {isPreviewing ? "Checking..." : "Preview"}
              </Button>
              <Button
                type="button"
                onClick={handleRun}
                disabled={isPreviewing || isRunning}
              >
                <Play className="w-4 h-4 mr-2" />
                {isRunning ? "Running..." : "Run Billing"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Preview Result Card */}
      {previewResult && (
        <Card className="border-blue-200 bg-blue-50/30">
          <CardHeader className="pb-3">
            <CardTitle className="text-base text-blue-900 flex items-center gap-2">
              <Eye className="w-4 h-4" />
              Preview Results as of {new Date(previewResult.asOfDate).toISOString().split("T")[0]}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground text-xs">Eligible Subscriptions</p>
                <p className="text-xl font-bold">{previewResult.eligibleSubscriptions}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Invoices to Create</p>
                <p className="text-xl font-bold text-green-700">{previewResult.invoicesToCreate}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Periods Already Billed</p>
                <p className="text-xl font-bold text-amber-700">{previewResult.skippedPeriods}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Housekeeping Activations</p>
                <p className="text-xl font-bold">{previewResult.housekeeping.confirmedToActive}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Last Run Result Card */}
      {lastRunResult && (
        <Card className="border-green-200 bg-green-50/30">
          <CardHeader className="pb-3">
            <CardTitle className="text-base text-green-900 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" />
              Billing Run Completed
            </CardTitle>
            <CardDescription>
              Run ID: <span className="font-mono">{lastRunResult.id}</span>
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground text-xs">Invoices Created</p>
                <p className="text-xl font-bold text-green-700">{lastRunResult.created}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Periods Skipped</p>
                <p className="text-xl font-bold text-amber-700">{lastRunResult.skipped}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Failed Subscriptions</p>
                <p className="text-xl font-bold text-red-700">{lastRunResult.failed}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Status</p>
                <Badge variant={lastRunResult.failed > 0 ? "destructive" : "default"}>
                  {lastRunResult.failed > 0 ? "Completed with Errors" : "Success"}
                </Badge>
              </div>
            </div>

            {lastRunResult.errors && lastRunResult.errors.length > 0 && (
              <div className="rounded-md bg-red-50 p-3 border border-red-200">
                <p className="text-xs font-semibold text-red-800 flex items-center gap-1.5 mb-2">
                  <AlertCircle className="w-3.5 h-3.5" />
                  Errors encountered ({lastRunResult.errors.length}):
                </p>
                <ul className="text-xs text-red-700 space-y-1">
                  {lastRunResult.errors.map((err, i) => (
                    <li key={i}>
                      Subscription <span className="font-mono">{err.subscriptionId}</span>: {err.error}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* History Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Billing Runs History</CardTitle>
          <CardDescription>Audit log of past manual and scheduled billing runs.</CardDescription>
        </CardHeader>
        <CardContent>
          {runs.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">
              No billing runs recorded yet. Click &quot;Run Billing&quot; above to execute the first run.
            </div>
          ) : (
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Run ID / Date</TableHead>
                    <TableHead>As-Of Date</TableHead>
                    <TableHead>Started At</TableHead>
                    <TableHead className="text-right">Created</TableHead>
                    <TableHead className="text-right">Skipped</TableHead>
                    <TableHead className="text-right">Failed</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {runs.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-mono text-xs">
                        {r.id.slice(0, 8)}...
                      </TableCell>
                      <TableCell className="text-sm">
                        {new Date(r.asOfDate).toISOString().split("T")[0]}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {new Date(r.startedAt).toLocaleString("en-IN", {
                          timeZone: "Asia/Kolkata",
                        })}
                      </TableCell>
                      <TableCell className="text-right font-semibold text-green-700">
                        {r.created}
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {r.skipped}
                      </TableCell>
                      <TableCell className="text-right text-red-600">
                        {r.failed}
                      </TableCell>
                      <TableCell>
                        {r.failed > 0 ? (
                          <Badge variant="destructive" className="text-xs">
                            <AlertTriangle className="w-3 h-3 mr-1" />
                            Failed ({r.failed})
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="text-xs">
                            Success
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

