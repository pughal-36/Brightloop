"use client";

import { DataTable, type ColumnDef } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { DeactivateTaxButton } from "./tax-dialogs";

export interface TaxRow {
  id: string;
  name: string;
  rateBps: number;
  isActive: boolean;
}

interface TaxesTableProps {
  data: TaxRow[];
  total: number;
  page: number;
  pageSize: number;
  isAdmin: boolean;
}

export function TaxesTable({
  data,
  total,
  page,
  pageSize,
  isAdmin,
}: TaxesTableProps) {
  const columns: ColumnDef<TaxRow>[] = [
    {
      header: "Tax Name",
      accessorKey: "name",
      cell: (row) => <span className="font-medium text-foreground">{row.name}</span>,
    },
    {
      header: "Rate (Bps)",
      accessorKey: "rateBps",
      cell: (row) => (
        <span className="font-mono text-sm text-foreground">
          {row.rateBps} bps
        </span>
      ),
    },
    {
      header: "Percentage",
      cell: (row) => (
        <span className="font-semibold text-sm text-foreground">
          {(row.rateBps / 100).toFixed(2)}%
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
            cell: (row: TaxRow) => (
              <DeactivateTaxButton id={row.id} isActive={row.isActive} />
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
      searchPlaceholder="Search taxes..."
      emptyMessage="No tax rates configured."
    />
  );
}

