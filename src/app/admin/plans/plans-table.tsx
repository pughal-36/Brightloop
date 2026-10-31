"use client";

import { DataTable, type ColumnDef } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { formatINR } from "@/lib/money";
import { formatDate } from "@/lib/dates";
import { DeactivatePlanButton } from "./plan-dialogs";
import { BillingPeriod } from "@/generated/prisma/enums";

export interface PlanRow {
  id: string;
  name: string;
  price: number;
  billingPeriod: BillingPeriod;
  minQty: number;
  availableFrom: Date | string;
  availableTo?: Date | string | null;
  autoClose: boolean;
  closable: boolean;
  pausable: boolean;
  renewable: boolean;
  tax?: { name: string; rateBps: number } | null;
  isActive: boolean;
}

interface PlansTableProps {
  data: PlanRow[];
  total: number;
  page: number;
  pageSize: number;
  isAdmin: boolean;
}

export function PlansTable({
  data,
  total,
  page,
  pageSize,
  isAdmin,
}: PlansTableProps) {
  const columns: ColumnDef<PlanRow>[] = [
    {
      header: "Plan Name",
      accessorKey: "name",
      cell: (row) => (
        <div>
          <span className="font-semibold text-foreground text-sm">{row.name}</span>
          <div className="text-xs text-muted-foreground">
            Min Qty: {row.minQty}
          </div>
        </div>
      ),
    },
    {
      header: "Billing Period",
      accessorKey: "billingPeriod",
      cell: (row) => (
        <Badge variant="outline" className="text-xs font-mono uppercase">
          {row.billingPeriod}
        </Badge>
      ),
    },
    {
      header: "Recurring Fee",
      accessorKey: "price",
      cell: (row) => (
        <span className="font-semibold text-foreground text-sm">
          {formatINR(row.price)}
        </span>
      ),
    },
    {
      header: "Availability Window",
      cell: (row) => (
        <div className="text-xs text-muted-foreground">
          <span>{formatDate(row.availableFrom)}</span>
          {" → "}
          <span>
            {row.availableTo ? formatDate(row.availableTo) : "Open-ended"}
          </span>
        </div>
      ),
    },
    {
      header: "Lifecycle Flags",
      cell: (row) => (
        <div className="flex flex-wrap gap-1 max-w-xs">
          {row.autoClose && (
            <Badge variant="secondary" className="text-[10px] py-0 px-1.5 font-normal">
              autoClose
            </Badge>
          )}
          {row.closable && (
            <Badge variant="secondary" className="text-[10px] py-0 px-1.5 font-normal">
              closable
            </Badge>
          )}
          {row.pausable && (
            <Badge variant="secondary" className="text-[10px] py-0 px-1.5 font-normal">
              pausable
            </Badge>
          )}
          {row.renewable && (
            <Badge variant="secondary" className="text-[10px] py-0 px-1.5 font-normal">
              renewable
            </Badge>
          )}
          {!row.autoClose && !row.closable && !row.pausable && !row.renewable && (
            <span className="text-xs text-muted-foreground italic">None</span>
          )}
        </div>
      ),
    },
    {
      header: "Tax",
      cell: (row) => (
        <span className="text-xs text-muted-foreground">
          {row.tax ? `${row.tax.name} (${(row.tax.rateBps / 100).toFixed(2)}%)` : "Untaxed"}
        </span>
      ),
    },
    {
      header: "Status",
      accessorKey: "isActive",
      cell: (row) => (
        <Badge variant={row.isActive ? "outline" : "destructive"} className="text-xs">
          {row.isActive ? "Active" : "Inactive"}
        </Badge>
      ),
    },
    ...(isAdmin
      ? [
          {
            header: "Actions",
            cell: (row: PlanRow) => (
              <DeactivatePlanButton id={row.id} isActive={row.isActive} />
            ),
            className: "text-right",
          },
        ]
      : []),
  ];

  return (
    <DataTable
      columns={columns}
      data={data}
      total={total}
      page={page}
      pageSize={pageSize}
      searchPlaceholder="Search plans by name..."
      emptyMessage="No plans configured."
    />
  );
}

