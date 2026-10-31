"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { formatINR } from "@/lib/money";
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
import { Plus, Trash2, Layers } from "lucide-react";
import {
  createBlankSubscriptionAction,
  createFromTemplateAction,
  createQuotationTemplateAction,
} from "@/app/actions/subscriptions";

interface CustomerOption {
  id: string;
  name: string;
  email: string;
}

interface ProductOption {
  id: string;
  name: string;
  salesPrice: number;
  tax?: { rateBps: number } | null;
  variants: Array<{ id: string; attribute: string; value: string; extraPrice: number }>;
}

interface PlanOption {
  id: string;
  name: string;
  price: number;
  billingPeriod: string;
  minQty: number;
  tax?: { rateBps: number } | null;
}

interface TemplateOption {
  id: string;
  name: string;
  validityDays: number;
  planId: string;
  plan: PlanOption;
  lines: Array<{
    productId: string;
    variantId?: string | null;
    qty: number;
    product: ProductOption;
    variant?: { id: string; attribute: string; value: string; extraPrice: number } | null;
  }>;
}



interface EditorLine {
  productId: string;
  variantId: string;
  qty: number;
}

function getDefaultStartDate(): string {
  return new Date().toISOString().split("T")[0];
}

function getDefaultExpiryDate(): string {
  const d = new Date();
  d.setDate(d.getDate() + 30);
  return d.toISOString().split("T")[0];
}

export function CreateSubscriptionDialog({
  customers,
  products,
  plans,
  templates,
}: {
  customers: CustomerOption[];
  products: ProductOption[];
  plans: PlanOption[];
  templates: TemplateOption[];
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [mode, setMode] = React.useState<"template" | "blank">("template");
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Common fields
  const [customerId, setCustomerId] = React.useState(customers[0]?.id || "");
  const [startDate, setStartDate] = React.useState(getDefaultStartDate);
  const [paymentTerms, setPaymentTerms] = React.useState("IMMEDIATE");

  // Template mode
  const [templateId, setTemplateId] = React.useState(templates[0]?.id || "");

  // Blank mode
  const [planId, setPlanId] = React.useState(plans[0]?.id || "");
  const [expiryDate, setExpiryDate] = React.useState(getDefaultExpiryDate);
  const [lines, setLines] = React.useState<EditorLine[]>([
    {
      productId: products[0]?.id || "",
      variantId: "",
      qty: plans[0]?.minQty || 1,
    },
  ]);

  const selectedPlan = plans.find((p) => p.id === planId) || plans[0];
  const selectedTemplate = templates.find((t) => t.id === templateId) || templates[0];

  // Calculate live server-accurate preview totals
  const activePlan = mode === "template" ? selectedTemplate?.plan : selectedPlan;
  const activeLines =
    mode === "template"
      ? (selectedTemplate?.lines || []).map((tl) => {
          const prod = products.find((p) => p.id === tl.productId) || tl.product;
          const variant = prod?.variants.find((v) => v.id === tl.variantId);
          const unitPrice = (prod?.salesPrice || 0) + (variant?.extraPrice || 0);
          const taxRateBps = prod?.tax?.rateBps || 0;
          const amount = tl.qty * unitPrice;
          const taxAmount = Math.round((amount * taxRateBps) / 10000);
          return {
            description: prod ? `${prod.name}${variant ? ` - ${variant.attribute}: ${variant.value}` : ""}` : "",
            qty: tl.qty,
            unitPrice,
            taxRateBps,
            amount,
            taxAmount,
          };
        })
      : lines.map((line) => {
          const prod = products.find((p) => p.id === line.productId);
          const variant = prod?.variants.find((v) => v.id === line.variantId);
          const unitPrice = (prod?.salesPrice || 0) + (variant?.extraPrice || 0);
          const taxRateBps = prod?.tax?.rateBps || 0;
          const amount = line.qty * unitPrice;
          const taxAmount = Math.round((amount * taxRateBps) / 10000);
          return {
            description: prod ? `${prod.name}${variant ? ` - ${variant.attribute}: ${variant.value}` : ""}` : "",
            qty: line.qty,
            unitPrice,
            taxRateBps,
            amount,
            taxAmount,
          };
        });

  const linesSubtotal = activeLines.reduce((sum, l) => sum + l.amount, 0);
  const linesTaxTotal = activeLines.reduce((sum, l) => sum + l.taxAmount, 0);
  const planFee = activePlan?.price || 0;
  const planTaxRateBps = activePlan?.tax?.rateBps || 0;
  const planTaxAmount = Math.round((planFee * planTaxRateBps) / 10000);
  const grandTotal = linesSubtotal + planFee + linesTaxTotal + planTaxAmount;

  const handleAddLine = () => {
    setLines((prev) => [
      ...prev,
      {
        productId: products[0]?.id || "",
        variantId: "",
        qty: selectedPlan?.minQty || 1,
      },
    ]);
  };

  const handleRemoveLine = (index: number) => {
    setLines((prev) => prev.filter((_, i) => i !== index));
  };

  const handleLineChange = (index: number, field: keyof EditorLine, value: unknown) => {
    setLines((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      if (field === "productId") {
        copy[index].variantId = "";
      }
      return copy;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      if (mode === "template") {
        const res = await createFromTemplateAction(null, {
          customerId,
          templateId,
          startDate: new Date(startDate),
          paymentTerms,
        });
        if (!res.success) {
          setError(res.error || "Failed to create subscription");
          setIsSubmitting(false);
          return;
        }
        setOpen(false);
        router.refresh();
      } else {
        const res = await createBlankSubscriptionAction(null, {
          customerId,
          planId,
          startDate: new Date(startDate),
          expiryDate: new Date(expiryDate),
          paymentTerms,
          lines: lines.map((l) => ({
            productId: l.productId,
            variantId: l.variantId || null,
            qty: l.qty,
          })),
        });
        if (!res.success) {
          setError(res.error || "Failed to create subscription");
          setIsSubmitting(false);
          return;
        }
        setOpen(false);
        router.refresh();
      }
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
            New Subscription
          </Button>
        }
      />
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create New Subscription</DialogTitle>
        </DialogHeader>

        <div className="flex border-b mb-4">
          <button
            type="button"
            onClick={() => setMode("template")}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              mode === "template"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            From Quotation Template
          </button>
          <button
            type="button"
            onClick={() => setMode("blank")}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              mode === "blank"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            From Scratch (Blank)
          </button>
        </div>

        {error && (
          <div className="p-3 text-sm text-destructive bg-destructive/10 rounded-md">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="customerSelect">Customer</Label>
              <select
                id="customerSelect"
                value={customerId}
                onChange={(e) => setCustomerId(e.target.value)}
                className="w-full mt-1 px-3 py-2 border rounded-md text-sm bg-background"
                required
              >
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.email})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <Label htmlFor="termsSelect">Payment Terms</Label>
              <select
                id="termsSelect"
                value={paymentTerms}
                onChange={(e) => setPaymentTerms(e.target.value)}
                className="w-full mt-1 px-3 py-2 border rounded-md text-sm bg-background"
              >
                <option value="IMMEDIATE">Immediate</option>
                <option value="NET_15">Net 15</option>
                <option value="NET_30">Net 30</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="startDateInput">Start Date</Label>
              <Input
                id="startDateInput"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                required
              />
            </div>

            {mode === "blank" && (
              <div>
                <Label htmlFor="expiryDateInput">Expiry Date</Label>
                <Input
                  id="expiryDateInput"
                  type="date"
                  value={expiryDate}
                  onChange={(e) => setExpiryDate(e.target.value)}
                  required
                />
              </div>
            )}
          </div>

          {mode === "template" ? (
            <div>
              <Label htmlFor="templateSelect">Select Template</Label>
              <select
                id="templateSelect"
                value={templateId}
                onChange={(e) => setTemplateId(e.target.value)}
                className="w-full mt-1 px-3 py-2 border rounded-md text-sm bg-background"
              >
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({t.plan.name} - Validity: {t.validityDays} days)
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div>
              <Label htmlFor="planSelect">Select Plan</Label>
              <select
                id="planSelect"
                value={planId}
                onChange={(e) => {
                  setPlanId(e.target.value);
                  const p = plans.find((x) => x.id === e.target.value);
                  if (p) {
                    setLines((prev) =>
                      prev.map((l) => ({ ...l, qty: Math.max(l.qty, p.minQty) }))
                    );
                  }
                }}
                className="w-full mt-1 px-3 py-2 border rounded-md text-sm bg-background"
              >
                {plans.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({formatINR(p.price)} / {p.billingPeriod.toLowerCase()}, min qty: {p.minQty})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Line Editor */}
          <div className="space-y-3 pt-2 border-t">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold">Subscription Lines</h4>
              {mode === "blank" && (
                <Button type="button" variant="outline" size="sm" onClick={handleAddLine}>
                  <Plus className="mr-1 h-3 w-3" /> Add Item
                </Button>
              )}
            </div>

            {mode === "template" ? (
              <div className="border rounded-md divide-y text-sm">
                {activeLines.map((line, idx) => (
                  <div key={idx} className="p-2.5 flex items-center justify-between">
                    <div>
                      <div className="font-medium">{line.description}</div>
                      <div className="text-xs text-muted-foreground">
                        Qty: {line.qty} × {formatINR(line.unitPrice)}
                      </div>
                    </div>
                    <div className="font-semibold">{formatINR(line.amount)}</div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-2">
                {lines.map((line, idx) => {
                  const product = products.find((p) => p.id === line.productId);
                  const variants = product?.variants || [];
                  return (
                    <div
                      key={idx}
                      className="grid grid-cols-12 gap-2 p-2 border rounded-md items-center bg-muted/20"
                    >
                      <div className="col-span-5">
                        <select
                          value={line.productId}
                          onChange={(e) => handleLineChange(idx, "productId", e.target.value)}
                          className="w-full px-2 py-1.5 border rounded text-xs bg-background"
                        >
                          {products.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name} ({formatINR(p.salesPrice)})
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="col-span-3">
                        <select
                          value={line.variantId}
                          onChange={(e) => handleLineChange(idx, "variantId", e.target.value)}
                          className="w-full px-2 py-1.5 border rounded text-xs bg-background"
                          disabled={variants.length === 0}
                        >
                          <option value="">No Variant</option>
                          {variants.map((v) => (
                            <option key={v.id} value={v.id}>
                              {v.attribute}: {v.value} (+{formatINR(v.extraPrice)})
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="col-span-2">
                        <Input
                          type="number"
                          min={selectedPlan?.minQty || 1}
                          value={line.qty}
                          onChange={(e) =>
                            handleLineChange(idx, "qty", parseInt(e.target.value, 10) || 1)
                          }
                          className="h-8 text-xs"
                        />
                      </div>

                      <div className="col-span-1 text-right text-xs font-semibold">
                        {formatINR(activeLines[idx]?.amount || 0)}
                      </div>

                      <div className="col-span-1 text-center">
                        {lines.length > 1 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 text-destructive"
                            onClick={() => handleRemoveLine(idx)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Live Server Computed Totals */}
          <div className="bg-muted/40 p-4 rounded-lg space-y-1.5 text-sm">
            <div className="flex justify-between text-muted-foreground">
              <span>Lines Subtotal</span>
              <span>{formatINR(linesSubtotal)}</span>
            </div>
            <div className="flex justify-between text-muted-foreground">
              <span>Plan Fee ({activePlan?.name})</span>
              <span>{formatINR(planFee)}</span>
            </div>
            <div className="flex justify-between text-muted-foreground">
              <span>Estimated Tax</span>
              <span>{formatINR(linesTaxTotal + planTaxAmount)}</span>
            </div>
            <div className="border-t pt-1.5 flex justify-between font-bold text-foreground text-base">
              <span>Grand Total</span>
              <span>{formatINR(grandTotal)}</span>
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
              {isSubmitting ? "Creating..." : "Create Subscription (Draft)"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function CreateQuotationTemplateDialog({
  plans,
  products,
}: {
  plans: PlanOption[];
  products: ProductOption[];
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const [name, setName] = React.useState("");
  const [planId, setPlanId] = React.useState(plans[0]?.id || "");
  const [validityDays, setValidityDays] = React.useState(30);
  const [lines, setLines] = React.useState<EditorLine[]>([
    {
      productId: products[0]?.id || "",
      variantId: "",
      qty: plans[0]?.minQty || 1,
    },
  ]);

  const selectedPlan = plans.find((p) => p.id === planId) || plans[0];

  const handleAddLine = () => {
    setLines((prev) => [
      ...prev,
      {
        productId: products[0]?.id || "",
        variantId: "",
        qty: selectedPlan?.minQty || 1,
      },
    ]);
  };

  const handleRemoveLine = (index: number) => {
    setLines((prev) => prev.filter((_, i) => i !== index));
  };

  const handleLineChange = (index: number, field: keyof EditorLine, value: unknown) => {
    setLines((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      if (field === "productId") copy[index].variantId = "";
      return copy;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    const res = await createQuotationTemplateAction(null, {
      name,
      planId,
      validityDays,
      lines: lines.map((l) => ({
        productId: l.productId,
        variantId: l.variantId || null,
        qty: l.qty,
      })),
    });

    if (!res.success) {
      setError(res.error || "Failed to create template");
      setIsSubmitting(false);
      return;
    }

    setOpen(false);
    setIsSubmitting(false);
    router.refresh();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button variant="outline">
            <Layers className="mr-2 h-4 w-4" />
            New Template
          </Button>
        }
      />
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Quotation Template</DialogTitle>
        </DialogHeader>

        {error && (
          <div className="p-3 text-sm text-destructive bg-destructive/10 rounded-md">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="templateName">Template Name</Label>
            <Input
              id="templateName"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Standard SaaS Monthly Package"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="templatePlan">Plan</Label>
              <select
                id="templatePlan"
                value={planId}
                onChange={(e) => {
                  setPlanId(e.target.value);
                  const p = plans.find((x) => x.id === e.target.value);
                  if (p) {
                    setLines((prev) =>
                      prev.map((l) => ({ ...l, qty: Math.max(l.qty, p.minQty) }))
                    );
                  }
                }}
                className="w-full mt-1 px-3 py-2 border rounded-md text-sm bg-background"
              >
                {plans.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} (min qty: {p.minQty})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <Label htmlFor="templateValidity">Validity (Days)</Label>
              <Input
                id="templateValidity"
                type="number"
                min={1}
                max={365}
                value={validityDays}
                onChange={(e) => setValidityDays(parseInt(e.target.value, 10) || 1)}
                required
              />
            </div>
          </div>

          <div className="space-y-3 pt-2 border-t">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold">Template Line Items</h4>
              <Button type="button" variant="outline" size="sm" onClick={handleAddLine}>
                <Plus className="mr-1 h-3 w-3" /> Add Item
              </Button>
            </div>

            <div className="space-y-2">
              {lines.map((line, idx) => {
                const product = products.find((p) => p.id === line.productId);
                const variants = product?.variants || [];
                return (
                  <div
                    key={idx}
                    className="grid grid-cols-12 gap-2 p-2 border rounded-md items-center bg-muted/20"
                  >
                    <div className="col-span-6">
                      <select
                        value={line.productId}
                        onChange={(e) => handleLineChange(idx, "productId", e.target.value)}
                        className="w-full px-2 py-1.5 border rounded text-xs bg-background"
                      >
                        {products.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="col-span-3">
                      <select
                        value={line.variantId}
                        onChange={(e) => handleLineChange(idx, "variantId", e.target.value)}
                        className="w-full px-2 py-1.5 border rounded text-xs bg-background"
                        disabled={variants.length === 0}
                      >
                        <option value="">No Variant</option>
                        {variants.map((v) => (
                          <option key={v.id} value={v.id}>
                            {v.attribute}: {v.value}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="col-span-2">
                      <Input
                        type="number"
                        min={selectedPlan?.minQty || 1}
                        value={line.qty}
                        onChange={(e) =>
                          handleLineChange(idx, "qty", parseInt(e.target.value, 10) || 1)
                        }
                        className="h-8 text-xs"
                      />
                    </div>

                    <div className="col-span-1 text-center">
                      {lines.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 text-destructive"
                          onClick={() => handleRemoveLine(idx)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
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
              {isSubmitting ? "Saving..." : "Create Template"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
