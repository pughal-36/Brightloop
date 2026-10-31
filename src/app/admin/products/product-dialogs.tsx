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
import { Plus, Trash2 } from "lucide-react";
import {
  createProductAction,
  createVariantAction,
  deleteVariantAction,
  type ActionState,
} from "@/app/actions/catalog";
import { ProductType } from "@/generated/prisma/enums";

interface TaxOption {
  id: string;
  name: string;
  rateBps: number;
}

export function AddProductDialog({ taxes }: { taxes: TaxOption[] }) {
  const [open, setOpen] = React.useState(false);
  const [state, formAction, isPending] = useActionState<ActionState | null, FormData>(
    async (prev, formData) => {
      const res = await createProductAction(prev, formData);
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
            Add Product
          </Button>
        }
      />
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add Product</DialogTitle>
          <DialogDescription>
            Create a catalog product with sales price, cost price, and tax category.
          </DialogDescription>
        </DialogHeader>

        <form action={formAction} className="space-y-4">
          {state?.error && (
            <div className="rounded-md bg-destructive/15 p-3 text-sm text-destructive font-medium">
              {state.error}
            </div>
          )}

          <div className="space-y-1">
            <Label htmlFor="name">Product Name</Label>
            <Input id="name" name="name" required placeholder="e.g. Accounting ERP License" />
            {state?.fieldErrors?.name && (
              <p className="text-xs text-destructive">{state.fieldErrors.name}</p>
            )}
          </div>

          <div className="space-y-1">
            <Label htmlFor="type">Product Type</Label>
            <select
              id="type"
              name="type"
              required
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              {Object.values(ProductType).map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="salesPriceRupees">Sales Price (₹)</Label>
              <Input
                id="salesPriceRupees"
                name="salesPriceRupees"
                type="number"
                step="0.01"
                min="0"
                required
                placeholder="2500.00"
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="costPriceRupees">Cost Price (₹)</Label>
              <Input
                id="costPriceRupees"
                name="costPriceRupees"
                type="number"
                step="0.01"
                min="0"
                required
                placeholder="1000.00"
              />
            </div>
          </div>

          <div className="space-y-1">
            <Label htmlFor="taxId">Tax Category (Optional)</Label>
            <select
              id="taxId"
              name="taxId"
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <option value="">None (Untaxed)</option>
              {taxes.map((tax) => (
                <option key={tax.id} value={tax.id}>
                  {tax.name} ({(tax.rateBps / 100).toFixed(2)}%)
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <Label htmlFor="notes">Internal Notes (Optional)</Label>
            <Input id="notes" name="notes" placeholder="e.g. Standard package for SMBs" />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Creating..." : "Create Product"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function AddVariantDialog({ productId }: { productId: string }) {
  const [open, setOpen] = React.useState(false);
  const [state, formAction, isPending] = useActionState<ActionState | null, FormData>(
    async (prev, formData) => {
      const res = await createVariantAction(prev, formData);
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
          <Button size="sm" variant="outline" className="h-8">
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            Add Variant
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Product Variant</DialogTitle>
          <DialogDescription>
            Specify variant attributes and extra price (e.g. Brand = Odoo, Extra Price = ₹560).
          </DialogDescription>
        </DialogHeader>

        <form action={formAction} className="space-y-4">
          <input type="hidden" name="productId" value={productId} />

          {state?.error && (
            <div className="rounded-md bg-destructive/15 p-3 text-sm text-destructive font-medium">
              {state.error}
            </div>
          )}

          <div className="space-y-1">
            <Label htmlFor="attribute">Attribute</Label>
            <Input id="attribute" name="attribute" required placeholder="e.g. Brand, Tier, Storage" />
          </div>

          <div className="space-y-1">
            <Label htmlFor="value">Value</Label>
            <Input id="value" name="value" required placeholder="e.g. Odoo, Pro, 50GB" />
          </div>

          <div className="space-y-1">
            <Label htmlFor="extraPriceRupees">Extra Price (₹)</Label>
            <Input
              id="extraPriceRupees"
              name="extraPriceRupees"
              type="number"
              step="0.01"
              defaultValue="0"
              required
              placeholder="560.00"
            />
            <p className="text-[11px] text-muted-foreground">
              Added on top of product base price to yield the effective unit price.
            </p>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Adding..." : "Add Variant"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function DeleteVariantButton({
  id,
  productId,
}: {
  id: string;
  productId: string;
}) {
  const [, formAction, isPending] = useActionState<ActionState | null, FormData>(deleteVariantAction, null);

  return (
    <form action={formAction}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="productId" value={productId} />
      <Button
        type="submit"
        variant="ghost"
        size="sm"
        disabled={isPending}
        className="h-8 w-8 p-0 text-destructive hover:bg-destructive/10 hover:text-destructive"
      >
        <Trash2 className="h-4 w-4" />
        <span className="sr-only">Delete Variant</span>
      </Button>
    </form>
  );
}
