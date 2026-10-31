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
import { UserPlus, Pencil } from "lucide-react";
import {
  createCustomerAction,
  updateCustomerAction,
  type ActionState,
} from "@/app/actions/customers";

export function AddCustomerDialog() {
  const [open, setOpen] = React.useState(false);
  const [state, formAction, isPending] = useActionState<ActionState | null, FormData>(
    async (prev, formData) => {
      const res = await createCustomerAction(prev, formData);
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
            Add Customer
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Customer</DialogTitle>
          <DialogDescription>
            Create a new client profile. A customer can be created without a portal login.
          </DialogDescription>
        </DialogHeader>

        <form action={formAction} className="space-y-4">
          {state?.error && (
            <div className="rounded-md bg-destructive/15 p-3 text-sm text-destructive font-medium">
              {state.error}
            </div>
          )}

          <div className="space-y-1">
            <Label htmlFor="name">Customer / Company Name</Label>
            <Input id="name" name="name" required placeholder="Acme Corp" />
            {state?.fieldErrors?.name && (
              <p className="text-xs text-destructive">{state.fieldErrors.name}</p>
            )}
          </div>

          <div className="space-y-1">
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" required placeholder="contact@acme.com" />
            {state?.fieldErrors?.email && (
              <p className="text-xs text-destructive">{state.fieldErrors.email}</p>
            )}
          </div>

          <div className="space-y-1">
            <Label htmlFor="phone">Phone Number (Optional)</Label>
            <Input id="phone" name="phone" placeholder="+91 98765 43210" />
          </div>

          <div className="space-y-1">
            <Label htmlFor="billingAddress">Billing Address (Optional)</Label>
            <Input
              id="billingAddress"
              name="billingAddress"
              placeholder="123 Business Hub, MG Road, Bengaluru"
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Creating..." : "Create Customer"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

interface CustomerData {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  billingAddress?: string | null;
  isActive: boolean;
}

export function EditCustomerDialog({ customer }: { customer: CustomerData }) {
  const [open, setOpen] = React.useState(false);
  const [state, formAction, isPending] = useActionState<ActionState | null, FormData>(
    async (prev, formData) => {
      const res = await updateCustomerAction(prev, formData);
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
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
            <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="sr-only">Edit Customer</span>
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Customer</DialogTitle>
          <DialogDescription>Update contact information or customer status.</DialogDescription>
        </DialogHeader>

        <form action={formAction} className="space-y-4">
          <input type="hidden" name="id" value={customer.id} />

          {state?.error && (
            <div className="rounded-md bg-destructive/15 p-3 text-sm text-destructive font-medium">
              {state.error}
            </div>
          )}

          <div className="space-y-1">
            <Label htmlFor="edit-name">Customer / Company Name</Label>
            <Input id="edit-name" name="name" defaultValue={customer.name} required />
            {state?.fieldErrors?.name && (
              <p className="text-xs text-destructive">{state.fieldErrors.name}</p>
            )}
          </div>

          <div className="space-y-1">
            <Label htmlFor="edit-email">Email</Label>
            <Input
              id="edit-email"
              name="email"
              type="email"
              defaultValue={customer.email}
              required
            />
            {state?.fieldErrors?.email && (
              <p className="text-xs text-destructive">{state.fieldErrors.email}</p>
            )}
          </div>

          <div className="space-y-1">
            <Label htmlFor="edit-phone">Phone Number</Label>
            <Input
              id="edit-phone"
              name="phone"
              defaultValue={customer.phone || ""}
              placeholder="+91 98765 43210"
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="edit-billingAddress">Billing Address</Label>
            <Input
              id="edit-billingAddress"
              name="billingAddress"
              defaultValue={customer.billingAddress || ""}
              placeholder="123 Business Hub, MG Road, Bengaluru"
            />
          </div>

          <div className="flex items-center space-x-2 pt-2">
            <input
              type="checkbox"
              id="edit-isActive"
              name="isActive"
              value="true"
              defaultChecked={customer.isActive}
              className="h-4 w-4 rounded border-gray-300"
            />
            <Label htmlFor="edit-isActive" className="text-sm font-normal cursor-pointer">
              Account Active
            </Label>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
