"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatINR, parseRupeesToPaise } from "@/lib/money";
import { InvoiceStatus, PaymentMethod, Role } from "@/generated/prisma/enums";
import {
  confirmInvoiceAction,
  cancelInvoiceAction,
  recordPaymentAction,
  voidPaymentAction,
  sendInvoiceAction,
} from "@/app/actions/invoices";
import { toast } from "sonner";
import type { InvoiceTotals } from "@/server/modules/invoices/schema";
import {
  CheckCircle2,
  XCircle,
  CreditCard,
  Mail,
  Printer,
  AlertTriangle,
  Ban,
} from "lucide-react";

interface InvoiceActionsClientProps {
  invoiceId: string;
  invoiceStatus: InvoiceStatus;
  userRole: Role;
  balancePaise: number;
  amountPaidPaise: number;
  hasPayments: boolean;
}

export function InvoiceActionsClient({
  invoiceId,
  invoiceStatus,
  balancePaise,
  amountPaidPaise,
  hasPayments,
}: InvoiceActionsClientProps) {
  const router = useRouter();

  // Action loading states
  const [isConfirming, setIsConfirming] = useState(false);
  const [isSending, setIsSending] = useState(false);

  // Reconfirm Required Modal State
  const [reconfirmModalOpen, setReconfirmModalOpen] = useState(false);
  const [reconfirmOldTotals, setReconfirmOldTotals] = useState<InvoiceTotals | null>(null);
  const [reconfirmNewTotals, setReconfirmNewTotals] = useState<InvoiceTotals | null>(null);

  // Record Payment Dialog State
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(PaymentMethod.BANK_TRANSFER);
  const [paymentAmountRupees, setPaymentAmountRupees] = useState((balancePaise / 100).toFixed(2));
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split("T")[0]);
  const [paymentNote, setPaymentNote] = useState("");
  const [isRecordingPayment, setIsRecordingPayment] = useState(false);

  // Cancel Dialog State
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [isCancelling, setIsCancelling] = useState(false);

  const handleConfirm = async () => {
    setIsConfirming(true);
    try {
      const res = await confirmInvoiceAction(invoiceId);
      if (res.ok && res.data) {
        if (res.data.status === "CONFIRMED") {
          toast.success("Invoice confirmed successfully");
          setReconfirmModalOpen(false);
          router.refresh();
        } else if (res.data.status === "RECONFIRM_REQUIRED") {
          setReconfirmOldTotals(res.data.oldTotals || null);
          setReconfirmNewTotals(res.data.newTotals || null);
          setReconfirmModalOpen(true);
          toast.warning("Discount no longer valid. Totals recalculated.");
          router.refresh();
        }
      } else {
        toast.error(res.error || "Failed to confirm invoice");
      }
    } catch {
      toast.error("Confirmation error");
    } finally {
      setIsConfirming(false);
    }
  };

  const handleCancel = async () => {
    setIsCancelling(true);
    try {
      const res = await cancelInvoiceAction(invoiceId, cancelReason);
      if (res.ok) {
        toast.success("Invoice cancelled");
        setCancelOpen(false);
        router.refresh();
      } else {
        toast.error(res.error || "Failed to cancel invoice");
      }
    } catch {
      toast.error("Failed to cancel invoice");
    } finally {
      setIsCancelling(false);
    }
  };

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsRecordingPayment(true);
    try {
      const amountPaise = parseRupeesToPaise(paymentAmountRupees);
      if (amountPaise <= 0) {
        toast.error("Amount must be greater than 0");
        setIsRecordingPayment(false);
        return;
      }
      if (amountPaise > balancePaise) {
        toast.error(`Amount exceeds remaining balance of ${formatINR(balancePaise)}`);
        setIsRecordingPayment(false);
        return;
      }

      const formData = new FormData();
      formData.set("invoiceId", invoiceId);
      formData.set("method", paymentMethod);
      formData.set("amount", String(amountPaise));
      formData.set("paidOn", paymentDate);
      if (paymentNote.trim()) formData.set("note", paymentNote.trim());

      const res = await recordPaymentAction(formData);
      if (res.ok) {
        toast.success("Payment recorded successfully");
        setPaymentOpen(false);
        router.refresh();
      } else {
        toast.error(res.error || "Failed to record payment");
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Payment error");
    } finally {
      setIsRecordingPayment(false);
    }
  };

  const handleSend = async () => {
    setIsSending(true);
    try {
      const res = await sendInvoiceAction(invoiceId);
      if (res.ok) {
        toast.success("Invoice sent to customer email");
        router.refresh();
      } else {
        toast.error(res.error || "Failed to send invoice");
      }
    } catch {
      toast.error("Failed to send email");
    } finally {
      setIsSending(false);
    }
  };

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        {/* DRAFT Actions */}
        {invoiceStatus === InvoiceStatus.DRAFT && (
          <>
            <Button
              type="button"
              size="sm"
              onClick={handleConfirm}
              disabled={isConfirming}
            >
              <CheckCircle2 className="w-4 h-4 mr-1.5" />
              {isConfirming ? "Confirming..." : "Confirm Invoice"}
            </Button>

            <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
              <DialogTrigger
                render={
                  <Button type="button" size="sm" variant="destructive">
                    <XCircle className="w-4 h-4 mr-1.5" />
                    Cancel Invoice
                  </Button>
                }
              />
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Cancel Draft Invoice</DialogTitle>
                  <DialogDescription>
                    Are you sure you want to cancel this invoice? This action marks the invoice as Cancelled.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-2 py-3">
                  <Label htmlFor="cancelReason">Reason (Optional)</Label>
                  <Input
                    id="cancelReason"
                    value={cancelReason}
                    onChange={(e) => setCancelReason(e.target.value)}
                    placeholder="e.g. Quotation updated or customer requested revision"
                  />
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setCancelOpen(false)}>
                    Keep Invoice
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={handleCancel}
                    disabled={isCancelling}
                  >
                    {isCancelling ? "Cancelling..." : "Confirm Cancellation"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </>
        )}

        {/* CONFIRMED Actions */}
        {invoiceStatus === InvoiceStatus.CONFIRMED && (
          <>
            <Dialog open={paymentOpen} onOpenChange={setPaymentOpen}>
              <DialogTrigger
                render={
                  <Button type="button" size="sm">
                    <CreditCard className="w-4 h-4 mr-1.5" />
                    Record Payment
                  </Button>
                }
              />
              <DialogContent>
                <form onSubmit={handleRecordPayment} className="space-y-4">
                  <DialogHeader>
                    <DialogTitle>Record Payment</DialogTitle>
                    <DialogDescription>
                      Manual payment entry for confirmed invoice. Balance remaining:{" "}
                      <span className="font-semibold text-foreground">
                        {formatINR(balancePaise)}
                      </span>
                    </DialogDescription>
                  </DialogHeader>

                  <div className="space-y-3 py-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="method">Payment Method</Label>
                      <Select
                        value={paymentMethod}
                        onValueChange={(val) => setPaymentMethod(val as PaymentMethod)}
                      >
                        <SelectTrigger id="method">
                          <SelectValue placeholder="Select method" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={PaymentMethod.BANK_TRANSFER}>Bank Transfer</SelectItem>
                          <SelectItem value={PaymentMethod.UPI}>UPI</SelectItem>
                          <SelectItem value={PaymentMethod.CARD}>Card</SelectItem>
                          <SelectItem value={PaymentMethod.NETBANKING}>Net Banking</SelectItem>
                          <SelectItem value={PaymentMethod.CASH}>Cash</SelectItem>
                          <SelectItem value={PaymentMethod.CHEQUE}>Cheque</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="amount">Amount (INR)</Label>
                      <Input
                        id="amount"
                        type="number"
                        step="0.01"
                        max={(balancePaise / 100).toFixed(2)}
                        value={paymentAmountRupees}
                        onChange={(e) => setPaymentAmountRupees(e.target.value)}
                        required
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="paidOn">Payment Date</Label>
                      <Input
                        id="paidOn"
                        type="date"
                        value={paymentDate}
                        onChange={(e) => setPaymentDate(e.target.value)}
                        required
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="note">Transaction Note / Ref</Label>
                      <Input
                        id="note"
                        value={paymentNote}
                        onChange={(e) => setPaymentNote(e.target.value)}
                        placeholder="e.g. UTR / Cheque #123456"
                      />
                    </div>
                  </div>

                  <DialogFooter>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setPaymentOpen(false)}
                    >
                      Cancel
                    </Button>
                    <Button type="submit" disabled={isRecordingPayment}>
                      {isRecordingPayment ? "Recording..." : "Save Payment"}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>

            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={handleSend}
              disabled={isSending}
            >
              <Mail className="w-4 h-4 mr-1.5" />
              {isSending ? "Sending..." : "Send Email"}
            </Button>

            <Link href={`/admin/invoices/${invoiceId}/print`} target="_blank">
              <Button type="button" size="sm" variant="outline">
                <Printer className="w-4 h-4 mr-1.5" />
                Print
              </Button>
            </Link>

            {!hasPayments && amountPaidPaise === 0 && (
              <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
                <DialogTrigger
                  render={
                    <Button type="button" size="sm" variant="ghost" className="text-destructive">
                      <XCircle className="w-4 h-4 mr-1.5" />
                      Cancel
                    </Button>
                  }
                />
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Cancel Confirmed Invoice</DialogTitle>
                    <DialogDescription>
                      This invoice has no recorded payments. Cancelling will release any reserved discounts.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-2 py-3">
                    <Label htmlFor="cancelReasonConf">Reason</Label>
                    <Input
                      id="cancelReasonConf"
                      value={cancelReason}
                      onChange={(e) => setCancelReason(e.target.value)}
                      placeholder="e.g. Order cancelled before payment"
                    />
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setCancelOpen(false)}>
                      Back
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={handleCancel}
                      disabled={isCancelling}
                    >
                      {isCancelling ? "Cancelling..." : "Cancel Invoice"}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            )}
          </>
        )}

        {/* PAID Actions */}
        {invoiceStatus === InvoiceStatus.PAID && (
          <>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={handleSend}
              disabled={isSending}
            >
              <Mail className="w-4 h-4 mr-1.5" />
              {isSending ? "Sending..." : "Send Email"}
            </Button>

            <Link href={`/admin/invoices/${invoiceId}/print`} target="_blank">
              <Button type="button" size="sm" variant="outline">
                <Printer className="w-4 h-4 mr-1.5" />
                Print
              </Button>
            </Link>
          </>
        )}
      </div>

      {/* RECONFIRM_REQUIRED Dialog */}
      <Dialog open={reconfirmModalOpen} onOpenChange={setReconfirmModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-700">
              <AlertTriangle className="w-5 h-5" />
              Re-Confirmation Required
            </DialogTitle>
            <DialogDescription>
              The discount applied to this invoice is exhausted, expired, or inactive. The discount line has been removed and totals recalculated.
            </DialogDescription>
          </DialogHeader>

          {reconfirmOldTotals && reconfirmNewTotals && (
            <div className="space-y-3 py-2 text-sm border-y my-2">
              <div className="flex justify-between text-muted-foreground line-through">
                <span>Previous Total:</span>
                <span>{formatINR(reconfirmOldTotals.total)}</span>
              </div>
              <div className="flex justify-between font-bold text-base text-foreground">
                <span>New Recalculated Total:</span>
                <span>{formatINR(reconfirmNewTotals.total)}</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Tax has been recomputed across full undiscounted line bases. The invoice remains in Draft.
              </p>
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setReconfirmModalOpen(false)}
            >
              Close
            </Button>
            <Button
              type="button"
              onClick={handleConfirm}
              disabled={isConfirming}
            >
              {isConfirming ? "Confirming..." : "Confirm with New Totals"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

/**
 * Separate button trigger for voiding an individual payment row (ADMIN only).
 */
export function VoidPaymentButton({
  paymentId,
  userRole,
  isVoided,
}: {
  paymentId: string;
  userRole: Role;
  isVoided: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [voidNote, setVoidNote] = useState("");
  const [isVoiding, setIsVoiding] = useState(false);

  if (userRole !== Role.ADMIN || isVoided) {
    return null;
  }

  const handleVoid = async () => {
    if (!voidNote.trim()) {
      toast.error("Void note is required");
      return;
    }
    setIsVoiding(true);
    try {
      const res = await voidPaymentAction(paymentId, voidNote.trim());
      if (res.ok) {
        toast.success("Payment voided and invoice balance adjusted");
        setOpen(false);
        router.refresh();
      } else {
        toast.error(res.error || "Failed to void payment");
      }
    } catch {
      toast.error("Void error");
    } finally {
      setIsVoiding(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button type="button" size="sm" variant="ghost" className="text-destructive h-7 px-2">
            <Ban className="w-3.5 h-3.5 mr-1" />
            Void
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Void Payment</DialogTitle>
          <DialogDescription>
            Voiding marks this payment record as void and recalculates the invoice balance. If the invoice was marked Paid, it will revert to Confirmed.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 py-2">
          <Label htmlFor="voidReason">Reason for Voiding (Required)</Label>
          <Input
            id="voidReason"
            value={voidNote}
            onChange={(e) => setVoidNote(e.target.value)}
            placeholder="e.g. Payment bounced / entered in error"
            required
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={handleVoid} disabled={isVoiding}>
            {isVoiding ? "Voiding..." : "Confirm Void"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
