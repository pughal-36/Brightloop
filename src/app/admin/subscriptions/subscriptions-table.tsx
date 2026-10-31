"use client";

import Link from "next/link";
import { DataTable, type ColumnDef } from "@/components/ui/data-table";
import { StatusBadge } from "@/components/ui/status-badge";
import { formatDate } from "@/lib/dates";
import { SubscriptionStatus } from "@/generated/prisma/enums";

export interface SubscriptionRow {
  id: string;
  number: string;
  customerId: string;
  customer: { name: string; email: string };
  plan: { name: string };
  status: SubscriptionStatus;
  pausedAt: Date | string | null;
  startDate: Date | string;
  expiryDate: Date | string;
  createdAt: Date | string;
  _count: { lines: number };
}

interface SubscriptionsTableProps {
  data: SubscriptionRow[];
  total: number;
  page: number;
  pageSize: number;
}

export function SubscriptionsTable({
  data,
  total,
  page,
  pageSize,
}: SubscriptionsTableProps) {
  const columns: ColumnDef<SubscriptionRow>[] = [
    {
      header: "Number",
      accessorKey: "number",
      cell: (row) => (
        <Link
          href={`/admin/subscriptions/${row.id}`}
          className="font-mono font-bold text-primary hover:underline text-sm"
        >
          {row.number}
        </Link>
      ),
    },
    {
      header: "Customer",
      accessorKey: "customer.name",
      cell: (row) => (
        <div>
          <div className="font-semibold text-foreground text-sm">{row.customer.name}</div>
          <div className="text-xs text-muted-foreground">{row.customer.email}</div>
        </div>
      ),
    },
    {
      header: "Plan",
      accessorKey: "plan.name",
      cell: (row) => <span className="text-sm font-medium">{row.plan.name}</span>,
    },
    {
      header: "Status",
      accessorKey: "status",
      cell: (row) => (
        <StatusBadge status={row.status} isPaused={row.pausedAt !== null} />
      ),
    },
    {
      header: "Dates",
      accessorKey: "startDate",
      cell: (row) => (
        <div className="text-xs space-y-0.5">
          <div>Start: {formatDate(row.startDate)}</div>
          <div className="text-muted-foreground">
            Expiry: {formatDate(row.expiryDate)}
          </div>
        </div>
      ),
    },
    {
      header: "Items",
      accessorKey: "_count.lines",
      cell: (row) => (
        <span className="text-xs text-muted-foreground">
          {row._count.lines} {row._count.lines === 1 ? "line" : "lines"}
        </span>
      ),
    },
  ];

  return (
    <DataTable
      columns={columns}
      data={data}
      total={total}
      page={page}
      pageSize={pageSize}
      searchPlaceholder="Search by SUB- number or customer..."
      emptyMessage="No subscriptions found. Create your first subscription or quotation."
    />
  );
}
