"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  transitionSubscriptionAction,
  deleteDraftSubscriptionAction,
} from "@/app/actions/subscriptions";
import { toast } from "sonner";
import {
  Send,
  CheckCircle2,
  Play,
  Pause,
  RotateCw,
  XCircle,
  Trash2,
} from "lucide-react";

interface SubscriptionActionsClientProps {
  subscriptionId: string;
  status: string;
  isPaused: boolean;
  plan: {
    closable: boolean;
    pausable: boolean;
    renewable: boolean;
  };
  isExpired: boolean;
}

export function SubscriptionActionsClient({
  subscriptionId,
  status,
  isPaused,
  plan,
  isExpired,
}: SubscriptionActionsClientProps) {
  const router = useRouter();
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Close dialog state
  const [closeDialogOpen, setCloseDialogOpen] = React.useState(false);
  const [closeReason, setCloseReason] = React.useState("");

  const handleAction = async (action: string, extra?: { closeReason?: string }) => {
    setLoading(true);
    setError(null);
    try {
      const res = await transitionSubscriptionAction({
        subscriptionId,
        action,
        closeReason: extra?.closeReason,
      });

      if (!res.success) {
        setError(res.error || "Action failed");
        toast.error(res.error || "Action failed");
        setLoading(false);
        return;
      }

      toast.success(`Subscription transition (${action}) succeeded`);
      setLoading(false);
      router.refresh();
    } catch (err) {
      const msg = (err as Error).message;
      setError(msg);
      toast.error(msg);
      setLoading(false);
    }
  };

  const handleDeleteDraft = async () => {
    if (!confirm("Are you sure you want to delete this draft subscription?")) return;
    setLoading(true);
    setError(null);
    try {
      const res = await deleteDraftSubscriptionAction(subscriptionId);
      if (!res.success) {
        setError(res.error || "Failed to delete draft");
        toast.error(res.error || "Failed to delete draft");
        setLoading(false);
        return;
      }
      toast.success("Draft subscription deleted");
      router.push("/admin/subscriptions");
    } catch (err) {
      const msg = (err as Error).message;
      setError(msg);
      toast.error(msg);
      setLoading(false);
    }
  };

  const handleCloseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!closeReason.trim()) {
      setError("Close reason is required");
      return;
    }
    await handleAction("CLOSE", { closeReason: closeReason.trim() });
    setCloseDialogOpen(false);
    setCloseReason("");
  };

  return (
    <div className="space-y-2">
      {error && (
        <div className="p-2.5 text-xs text-destructive bg-destructive/10 rounded-md">
          {error}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {status === "DRAFT" && (
          <>
            <Button
              onClick={() => handleAction("SEND_QUOTATION")}
              disabled={loading}
              className="bg-blue-600 hover:bg-blue-700"
            >
              <Send className="mr-2 h-4 w-4" />
              Send Quotation
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteDraft}
              disabled={loading}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete Draft
            </Button>
          </>
        )}

        {status === "QUOTATION" && (
          <>
            <Button
              onClick={() => handleAction("CONFIRM")}
              disabled={loading}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              <CheckCircle2 className="mr-2 h-4 w-4" />
              Confirm Quotation
            </Button>
            <Button
              variant="outline"
              className="text-destructive hover:bg-destructive/10"
              onClick={() => setCloseDialogOpen(true)}
              disabled={loading}
            >
              <XCircle className="mr-2 h-4 w-4" />
              Decline / Close
            </Button>
          </>
        )}

        {status === "CONFIRMED" && (
          <Button
            onClick={() => handleAction("ACTIVATE")}
            disabled={loading}
            className="bg-emerald-600 hover:bg-emerald-700"
          >
            <Play className="mr-2 h-4 w-4" />
            Activate Subscription
          </Button>
        )}

        {status === "ACTIVE" && (
          <>
            {!isPaused ? (
              <>
                {plan.pausable && (
                  <Button
                    variant="outline"
                    onClick={() => handleAction("PAUSE")}
                    disabled={loading}
                    className="text-amber-600 hover:bg-amber-50"
                  >
                    <Pause className="mr-2 h-4 w-4" />
                    Pause
                  </Button>
                )}

                {plan.renewable && (
                  <Button
                    variant="outline"
                    onClick={() => handleAction("RENEW")}
                    disabled={loading}
                  >
                    <RotateCw className="mr-2 h-4 w-4" />
                    Renew (+1 Period)
                  </Button>
                )}

                {(plan.closable || isExpired) && (
                  <Button
                    variant="outline"
                    className="text-destructive hover:bg-destructive/10"
                    onClick={() => setCloseDialogOpen(true)}
                    disabled={loading}
                  >
                    <XCircle className="mr-2 h-4 w-4" />
                    Close Subscription
                  </Button>
                )}
              </>
            ) : (
              <>
                {plan.pausable && (
                  <Button
                    onClick={() => handleAction("RESUME")}
                    disabled={loading}
                    className="bg-emerald-600 hover:bg-emerald-700"
                  >
                    <Play className="mr-2 h-4 w-4" />
                    Resume Subscription
                  </Button>
                )}

                {(plan.closable || isExpired) && (
                  <Button
                    variant="outline"
                    className="text-destructive hover:bg-destructive/10"
                    onClick={() => setCloseDialogOpen(true)}
                    disabled={loading}
                  >
                    <XCircle className="mr-2 h-4 w-4" />
                    Close Subscription
                  </Button>
                )}
              </>
            )}
          </>
        )}
      </div>

      {/* Close Reason Dialog */}
      <Dialog open={closeDialogOpen} onOpenChange={setCloseDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Close Subscription</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCloseSubmit} className="space-y-4">
            <div>
              <Label htmlFor="closeReasonInput">Reason for closing</Label>
              <Input
                id="closeReasonInput"
                placeholder="e.g. Customer requested cancellation / Quotation declined"
                value={closeReason}
                onChange={(e) => setCloseReason(e.target.value)}
                required
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setCloseDialogOpen(false)}
                disabled={loading}
              >
                Cancel
              </Button>
              <Button type="submit" variant="destructive" disabled={loading}>
                {loading ? "Closing..." : "Confirm Close"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

