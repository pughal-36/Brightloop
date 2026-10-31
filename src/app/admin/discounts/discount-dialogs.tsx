"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Ban } from "lucide-react";
import {
  createDiscountAction,
  deactivateDiscountAction,
} from "@/app/actions/discounts";

interface ProductOption {
  id: string;
  name: string;
}

function getDefaultStartDate(): string {
  return new Date().toISOString().split("T")[0];
}

function getDefaultEndDate(): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() + 1);
  return d.toISOString().split("T")[0];
}

export function AddDiscountDialog({ products }: { products: ProductOption[] }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const [name, setName] = React.useState("");
  const [type, setType] = React.useState<"FIXED" | "PERCENT">("PERCENT");
  const [valuePercent, setValuePercent] = React.useState("10");
  const [valueRupees, setValueRupees] = React.useState("500");
  const [scope, setScope] = React.useState<"SUBSCRIPTION" | "PRODUCTS">("SUBSCRIPTION");
  const [minPurchaseRupees, setMinPurchaseRupees] = React.useState("");
  const [minQty, setMinQty] = React.useState("");
  const [startDate, setStartDate] = React.useState(getDefaultStartDate);
  const [endDate, setEndDate] = React.useState(getDefaultEndDate);
  const [usageLimit, setUsageLimit] = React.useState("100");
  const [selectedProductIds, setSelectedProductIds] = React.useState<string[]>([]);

  const handleProductToggle = (productId: string) => {
    setSelectedProductIds((prev) =>
      prev.includes(productId)
        ? prev.filter((id) => id !== productId)
        : [...prev, productId]
    );
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    const formData = new FormData(e.currentTarget);
    if (scope === "PRODUCTS") {
      formData.delete("productIds");
      selectedProductIds.forEach((pid) => formData.append("productIds", pid));
    }

    try {
      const res = await createDiscountAction(null, formData);
      if (!res.success) {
        setError(res.error || "Failed to create discount");
        setIsSubmitting(false);
        return;
      }
      setOpen(false);
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Add Discount
          </Button>
        }
      />
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Discount Rule</DialogTitle>
        </DialogHeader>

        {error && (
          <div className="p-3 text-sm text-destructive bg-destructive/10 rounded-md">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="discName">Discount Name</Label>
            <Input
              id="discName"
              name="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Volume Subscription 10% Off"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="discType">Discount Type</Label>
              <select
                id="discType"
                name="type"
                value={type}
                onChange={(e) => setType(e.target.value as "FIXED" | "PERCENT")}
                className="w-full mt-1 px-3 py-2 border rounded-md text-sm bg-background"
              >
                <option value="PERCENT">Percentage (%)</option>
                <option value="FIXED">Fixed Amount (₹)</option>
              </select>
            </div>

            <div>
              {type === "PERCENT" ? (
                <>
                  <Label htmlFor="discValuePercent">Percentage Rate (%)</Label>
                  <Input
                    id="discValuePercent"
                    name="valuePercent"
                    type="number"
                    step="0.01"
                    min="0.01"
                    max="100"
                    value={valuePercent}
                    onChange={(e) => setValuePercent(e.target.value)}
                    required
                  />
                </>
              ) : (
                <>
                  <Label htmlFor="discValueRupees">Fixed Amount (₹)</Label>
                  <Input
                    id="discValueRupees"
                    name="valueRupees"
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={valueRupees}
                    onChange={(e) => setValueRupees(e.target.value)}
                    required
                  />
                </>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="discScope">Scope</Label>
              <select
                id="discScope"
                name="scope"
                value={scope}
                onChange={(e) => setScope(e.target.value as "SUBSCRIPTION" | "PRODUCTS")}
                className="w-full mt-1 px-3 py-2 border rounded-md text-sm bg-background"
              >
                <option value="SUBSCRIPTION">Whole Subscription (Includes Plan Fee)</option>
                <option value="PRODUCTS">Specific Products Only</option>
              </select>
            </div>

            <div>
              <Label htmlFor="discUsageLimit">Usage Limit (Total uses)</Label>
              <Input
                id="discUsageLimit"
                name="usageLimit"
                type="number"
                min="1"
                value={usageLimit}
                onChange={(e) => setUsageLimit(e.target.value)}
                required
              />
            </div>
          </div>

          {scope === "PRODUCTS" && (
            <div className="space-y-2 border p-3 rounded-md">
              <Label className="font-semibold text-xs">Select Applicable Products</Label>
              <div className="max-h-36 overflow-y-auto space-y-1.5 pt-1">
                {products.map((p) => (
                  <label
                    key={p.id}
                    className="flex items-center space-x-2 text-sm cursor-pointer hover:bg-muted/50 p-1 rounded"
                  >
                    <input
                      type="checkbox"
                      checked={selectedProductIds.includes(p.id)}
                      onChange={() => handleProductToggle(p.id)}
                      className="rounded"
                    />
                    <span>{p.name}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="discMinPurchase">Min Purchase Subtotal (₹, optional)</Label>
              <Input
                id="discMinPurchase"
                name="minPurchaseRupees"
                type="number"
                step="0.01"
                placeholder="Optional"
                value={minPurchaseRupees}
                onChange={(e) => setMinPurchaseRupees(e.target.value)}
              />
            </div>

            <div>
              <Label htmlFor="discMinQty">Min Quantity (optional)</Label>
              <Input
                id="discMinQty"
                name="minQty"
                type="number"
                min="1"
                placeholder="Optional"
                value={minQty}
                onChange={(e) => setMinQty(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="discStartDate">Start Date</Label>
              <Input
                id="discStartDate"
                name="startDate"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                required
              />
            </div>

            <div>
              <Label htmlFor="discEndDate">End Date</Label>
              <Input
                id="discEndDate"
                name="endDate"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                required
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Creating..." : "Save Discount"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function DeactivateDiscountButton({ id, name }: { id: string; name: string }) {
  const router = useRouter();
  const [loading, setLoading] = React.useState(false);

  const handleDeactivate = async () => {
    if (!confirm(`Are you sure you want to deactivate discount "${name}"?`)) return;
    setLoading(true);
    const formData = new FormData();
    formData.append("id", id);
    await deactivateDiscountAction(null, formData);
    setLoading(false);
    router.refresh();
  };

  return (
    <Button
      variant="ghost"
      size="sm"
      className="text-destructive hover:bg-destructive/10 h-8 px-2"
      onClick={handleDeactivate}
      disabled={loading}
    >
      <Ban className="mr-1 h-3.5 w-3.5" />
      Deactivate
    </Button>
  );
}
