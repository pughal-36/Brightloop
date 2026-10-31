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
import { createTaxAction, deactivateTaxAction, type ActionState } from "@/app/actions/catalog";

export function AddTaxDialog() {
  const [open, setOpen] = React.useState(false);
  const [state, formAction, isPending] = useActionState<ActionState | null, FormData>(
    async (prev, formData) => {
      const res = await createTaxAction(prev, formData);
      if (res.success) {
        setOpen(false);
      }
      return res;
    },
    null
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button size="sm" className="h-9">
            <Plus className="mr-2 h-4 w-4" />
            Add Tax Rate
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Tax Rate</DialogTitle>
          <DialogDescription>
            Specify a tax rule. Rates are defined in basis points (e.g. 1800 bps = 18.00%).
          </DialogDescription>
        </DialogHeader>

        <form action={formAction} className="space-y-4">
          {state?.error && (
            <div className="rounded-md bg-destructive/15 p-3 text-sm text-destructive font-medium">
              {state.error}
            </div>
          )}

          <div className="space-y-1">
            <Label htmlFor="name">Tax Name</Label>
            <Input id="name" name="name" required placeholder="GST 18%" />
            {state?.fieldErrors?.name && (
              <p className="text-xs text-destructive">{state.fieldErrors.name}</p>
            )}
          </div>

          <div className="space-y-1">
            <Label htmlFor="ratePercent">Rate (%)</Label>
            <Input
              id="ratePercent"
              name="ratePercent"
              type="number"
              step="0.01"
              min="0"
              max="100"
              required
              placeholder="18"
            />
            <p className="text-[11px] text-muted-foreground">
              Stored as integer basis points (e.g. 18% &rarr; 1800 bps, 5% &rarr; 500 bps).
            </p>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Adding..." : "Add Tax Rate"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function DeactivateTaxButton({ id, isActive }: { id: string; isActive: boolean }) {
  const [, formAction, isPending] = useActionState<ActionState | null, FormData>(deactivateTaxAction, null);

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
