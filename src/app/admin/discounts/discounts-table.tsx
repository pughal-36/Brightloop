"use client";

import { DataTable, type ColumnDef } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { formatINR } from "@/lib/money";
import { formatDate } from "@/lib/dates";
import { DeactivateDiscountButton } from "./discount-dialogs";
import { DiscountType, DiscountScope } from "@/generated/prisma/enums";

export interface DiscountRow {
  id: string;
  name: string;
  type: DiscountType;
  value: number;
  minPurchase: number | null;
  minQty: number | null;
  startDate: Date | string;
  endDate: Date | string;
  usageLimit: number;
  usedCount: number;
  scope: DiscountScope;
  isActive: boolean;
  products: Array<{ product: { id: string; name: string } }>;
  _count: { applications: number };
}

interface DiscountsTableProps {
  data: DiscountRow[];
  total: number;
  page: number;
  pageSize: number;
  isAdmin: boolean;
}

export function DiscountsTable({
  data,
  total,
  page,
  pageSize,
  isAdmin,
}: DiscountsTableProps) {
  const now = new Date();

  const columns: ColumnDef<DiscountRow>[] = [
    {
      header: "Discount Rule",
      accessorKey: "name",
      cell: (row) => (
        <div>
          <div className="font-semibold text-foreground text-sm">{row.name}</div>
          <div className="text-xs text-muted-foreground">
            {row.scope === DiscountScope.SUBSCRIPTION ? (
              <span>Whole Subscription (includes plan fee)</span>
            ) : (
              <span>
                {row.products.length} product{row.products.length === 1 ? "" : "s"}:{" "}
                {row.products.map((p) => p.product.name).join(", ") || "None"}
              </span>
            )}
          </div>
        </div>
      ),
    },
    {
      header: "Value",
      accessorKey: "value",
      cell: (row) => {
        if (row.type === DiscountType.PERCENT) {
          return (
            <Badge variant="outline" className="font-mono text-xs">
              {(row.value / 100).toFixed(2)}% OFF
            </Badge>
          );
        }
        return (
          <Badge variant="outline" className="font-mono text-xs font-semibold text-emerald-600">
            {formatINR(row.value)} OFF
          </Badge>
        );
      },
    },
    {
      header: "Status",
      accessorKey: "isActive",
      cell: (row) => {
        const isExpired = new Date(row.endDate).getTime() < now.getTime();
        const isExhausted = row.usedCount >= row.usageLimit;

        if (!row.isActive) {
          return <Badge variant="secondary">INACTIVE</Badge>;
        }
        if (isExpired) {
          return <Badge className="bg-red-600 hover:bg-red-700">EXPIRED</Badge>;
        }
        if (isExhausted) {
          return <Badge className="bg-amber-600 hover:bg-amber-700">EXHAUSTED</Badge>;
        }
        return <Badge className="bg-emerald-600 hover:bg-emerald-700">ACTIVE</Badge>;
      },
    },
    {
      header: "Usage",
      accessorKey: "usedCount",
      cell: (row) => {
        const pct = Math.min(100, Math.round((row.usedCount / row.usageLimit) * 100));
        return (
          <div className="w-36 space-y-1">
            <div className="flex justify-between text-xs">
              <span className="font-medium">
                {row.usedCount} / {row.usageLimit}
              </span>
              <span className="text-muted-foreground">{pct}%</span>
            </div>
            <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
              <div
                className={`h-full transition-all ${
                  pct >= 100
                    ? "bg-amber-500"
                    : pct >= 80
                    ? "bg-amber-400"
                    : "bg-primary"
                }`}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        );
      },
    },
    {
      header: "Validity",
      accessorKey: "startDate",
      cell: (row) => (
        <div className="text-xs space-y-0.5">
          <div>From: {formatDate(row.startDate)}</div>
          <div className="text-muted-foreground">
            To: {formatDate(row.endDate)}
          </div>
        </div>
      ),
    },
    {
      header: "Actions",
      cell: (row) => {
        if (!isAdmin || !row.isActive) return null;
        return <DeactivateDiscountButton id={row.id} name={row.name} />;
      },
      className: "text-right",
    },
  ];

  return (
    <DataTable
      columns={columns}
      data={data}
      total={total}
      page={page}
      pageSize={pageSize}
      searchPlaceholder="Search discounts by name..."
      emptyMessage="No discount rules found. Create your first promotional rule."
    />
  );
}

