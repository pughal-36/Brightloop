"use client";

import * as React from "react";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Plus } from "lucide-react";
import { createPlanAction, deactivatePlanAction, type ActionState } from "@/app/actions/plans";
import { BillingPeriod } from "@/generated/prisma/enums";

interface TaxOption {
  id: string;
  name: string;
  rateBps: number;
}

export function AddPlanDialog({ taxes }: { taxes: TaxOption[] }) {
  const [open, setOpen] = React.useState(false);
  const [state, formAction, isPending] = useActionState<ActionState | null, FormData>(
    async (prev, formData) => {
      const res = await createPlanAction(prev, formData);
      if (res.success) {
        setOpen(false);
      }
      return res;
    },
    null
  );

  const todayStr = new Date().toISOString().split("T")[0];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button size="sm" className="h-9">
            <Plus className="mr-2 h-4 w-4" />
            Add Plan
          </Button>
        }
      />
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Create Subscription Plan</DialogTitle>
          <DialogDescription>
            Configure recurring plan price, billing schedule, and lifecycle flags.
          </DialogDescription>
        </DialogHeader>

        <form action={formAction} className="space-y-4">
          {state?.error && (
            <div className="rounded-md bg-destructive/15 p-3 text-sm text-destructive font-medium">
              {state.error}
            </div>
          )}

          <div className="space-y-1">
            <Label htmlFor="name">Plan Name</Label>
            <Input id="name" name="name" required placeholder="e.g. Enterprise Monthly" />
            {state?.fieldErrors?.name && (
              <p className="text-xs text-destructive">{state.fieldErrors.name}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="priceRupees">Recurring Price (₹)</Label>
              <Input
                id="priceRupees"
                name="priceRupees"
                type="number"
                step="0.01"
                min="0"
                required
                placeholder="4999.00"
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="billingPeriod">Billing Period</Label>
              <select
                id="billingPeriod"
                name="billingPeriod"
                required
                defaultValue={BillingPeriod.MONTHLY}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                {Object.values(BillingPeriod).map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="minQty">Minimum Quantity</Label>
              <Input id="minQty" name="minQty" type="number" min="1" defaultValue="1" required />
            </div>

            <div className="space-y-1">
              <Label htmlFor="taxId">Plan Fee Tax</Label>
              <select
                id="taxId"
                name="taxId"
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="">Untaxed</option>
                {taxes.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({(t.rateBps / 100).toFixed(2)}%)
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="availableFrom">Available From</Label>
              <Input
                id="availableFrom"
                name="availableFrom"
                type="date"
                defaultValue={todayStr}
                required
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="availableTo">Available To (Optional)</Label>
              <Input id="availableTo" name="availableTo" type="date" />
              {state?.fieldErrors?.availableTo && (
                <p className="text-xs text-destructive">{state.fieldErrors.availableTo}</p>
              )}
            </div>
          </div>

          {/* Lifecycle Flags */}
          <div className="rounded-md border p-3 space-y-3 bg-muted/20">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Plan Lifecycle Flags
            </h4>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <label className="flex items-start space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  name="autoClose"
                  className="mt-0.5 h-4 w-4 rounded border-gray-300"
                />
                <div>
                  <span className="font-medium text-foreground block">autoClose</span>
                  <span className="text-[11px] text-muted-foreground">
                    Subscription closes automatically when expiry date passes.
                  </span>
                </div>
              </label>

              <label className="flex items-start space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  name="closable"
                  className="mt-0.5 h-4 w-4 rounded border-gray-300"
                />
                <div>
                  <span className="font-medium text-foreground block">closable</span>
                  <span className="text-[11px] text-muted-foreground">
                    Allows staff or customer early cancellation before period ends.
                  </span>
                </div>
              </label>

              <label className="flex items-start space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  name="pausable"
                  className="mt-0.5 h-4 w-4 rounded border-gray-300"
                />
                <div>
                  <span className="font-medium text-foreground block">pausable</span>
                  <span className="text-[11px] text-muted-foreground">
                    Can be temporarily paused; billing engine skips paused periods.
                  </span>
                </div>
              </label>

              <label className="flex items-start space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  name="renewable"
                  className="mt-0.5 h-4 w-4 rounded border-gray-300"
                />
                <div>
                  <span className="font-medium text-foreground block">renewable</span>
                  <span className="text-[11px] text-muted-foreground">
                    Allows extension of subscription term by one billing cycle.
                  </span>
                </div>
              </label>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Creating..." : "Create Plan"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function DeactivatePlanButton({ id, isActive }: { id: string; isActive: boolean }) {
  const [, formAction, isPending] = useActionState<ActionState | null, FormData>(deactivatePlanAction, null);

  if (!isActive) {
    return <span className="text-xs text-muted-foreground italic">Inactive</span>;
  }

  return (
    <form action={formAction}>
      <input type="hidden" name="id" value={id} />
      <Button
        type="submit"
        variant="ghost"
        size="sm"
        disabled={isPending}
        className="text-xs text-destructive hover:bg-destructive/10 hover:text-destructive h-7 px-2"
      >
        {isPending ? "Deactivating..." : "Deactivate"}
      </Button>
    </form>
  );
}
