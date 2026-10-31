"use client";

import Link from "next/link";
import { DataTable, type ColumnDef } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatINR } from "@/lib/money";
import { ChevronRight } from "lucide-react";
import { ProductType } from "@/generated/prisma/enums";

export interface ProductRow {
  id: string;
  name: string;
  type: ProductType;
  salesPrice: number;
  costPrice?: number;
  margin?: number;
  notes?: string | null;
  tax?: { name: string; rateBps: number } | null;
  variants: { id: string }[];
  isActive: boolean;
}

interface ProductsTableProps {
  data: ProductRow[];
  total: number;
  page: number;
  pageSize: number;
  isAdmin: boolean;
}

export function ProductsTable({
  data,
  total,
  page,
  pageSize,
  isAdmin,
}: ProductsTableProps) {
  const columns: ColumnDef<ProductRow>[] = [
    {
      header: "Product",
      accessorKey: "name",
      cell: (row) => (
        <div>
          <div className="font-medium text-foreground">{row.name}</div>
          <div className="flex items-center gap-1.5 mt-0.5">
            <Badge variant="outline" className="text-[10px] uppercase font-mono py-0">
              {row.type}
            </Badge>
            {row.notes && (
              <span className="text-xs text-muted-foreground line-clamp-1 max-w-xs">
                {row.notes}
              </span>
            )}
          </div>
        </div>
      ),
    },
    {
      header: "Sales Price",
      accessorKey: "salesPrice",
      cell: (row) => (
        <span className="font-semibold text-foreground text-sm">
          {formatINR(row.salesPrice)}
        </span>
      ),
    },
    ...(isAdmin
      ? [
          {
            header: "Cost Price",
            accessorKey: "costPrice",
            cell: (row: ProductRow) => (
              <span className="text-sm text-muted-foreground">
                {row.costPrice !== undefined ? formatINR(row.costPrice) : "—"}
              </span>
            ),
          },
          {
            header: "Margin",
            accessorKey: "margin",
            cell: (row: ProductRow) => (
              <span
                className={`text-sm font-medium ${
                  (row.margin ?? 0) >= 0 ? "text-emerald-600" : "text-rose-600"
                }`}
              >
                {row.margin !== undefined ? formatINR(row.margin) : "—"}
              </span>
            ),
          },
        ]
      : []),
    {
      header: "Tax",
      cell: (row) => (
        <span className="text-xs text-muted-foreground">
          {row.tax ? `${row.tax.name} (${(row.tax.rateBps / 100).toFixed(2)}%)` : "Untaxed"}
        </span>
      ),
    },
    {
      header: "Variants",
      cell: (row) => (
        <span className="text-xs font-mono">
          {row.variants.length} variant{row.variants.length === 1 ? "" : "s"}
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
    {
      header: "Details",
      cell: (row) => (
        <Link href={`/admin/products/${row.id}`}>
          <Button variant="ghost" size="sm" className="h-8 px-2 text-xs">
            Manage
            <ChevronRight className="ml-1 h-3.5 w-3.5" />
          </Button>
        </Link>
      ),
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
      searchPlaceholder="Search products by name or notes..."
      emptyMessage="No products found in catalog."
    />
  );
}

