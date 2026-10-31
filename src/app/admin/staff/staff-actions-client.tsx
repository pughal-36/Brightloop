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
import { UserPlus } from "lucide-react";
import { createStaffAction, deactivateStaffAction, type ActionState } from "@/app/actions/staff";

export function AddStaffDialog() {
  const [open, setOpen] = React.useState(false);
  const [state, formAction, isPending] = useActionState<ActionState | null, FormData>(
    async (prev, formData) => {
      const res = await createStaffAction(prev, formData);
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
            <UserPlus className="mr-2 h-4 w-4" />
            Add Staff
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Staff Member</DialogTitle>
          <DialogDescription>
            Enter the details of the staff member. A secure set-password link will be generated and emailed to them.
          </DialogDescription>
        </DialogHeader>

        <form action={formAction} className="space-y-4">
          {state?.error && (
            <div className="rounded-md bg-destructive/15 p-3 text-sm text-destructive font-medium">
              {state.error}
            </div>
          )}

          <div className="space-y-1">
            <Label htmlFor="name">Full Name</Label>
            <Input id="name" name="name" required placeholder="e.g. Rahul Sharma" />
            {state?.fieldErrors?.name && (
              <p className="text-xs text-destructive">{state.fieldErrors.name}</p>
            )}
          </div>

          <div className="space-y-1">
            <Label htmlFor="email">Email Address</Label>
            <Input
              id="email"
              name="email"
              type="email"
              required
              placeholder="e.g. rahul@brightloop.io"
            />
            {state?.fieldErrors?.email && (
              <p className="text-xs text-destructive">{state.fieldErrors.email}</p>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Adding..." : "Add Staff Member"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function DeactivateStaffButton({
  userId,
  isSelf,
  isActive,
}: {
  userId: string;
  isSelf: boolean;
  isActive: boolean;
}) {
  const [, formAction, isPending] = useActionState<ActionState | null, FormData>(deactivateStaffAction, null);

  if (!isActive) {
    return (
      <span className="text-xs text-muted-foreground italic">
        Deactivated
      </span>
    );
  }

  if (isSelf) {
    return (
      <span className="text-xs text-muted-foreground">
        (Current User)
      </span>
    );
  }

  return (
    <form action={formAction}>
      <input type="hidden" name="userId" value={userId} />
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
