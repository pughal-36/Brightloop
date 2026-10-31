"use client";

import { DataTable, type ColumnDef } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/dates";
import { EditCustomerDialog } from "./customer-dialogs";

export interface CustomerRow {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  billingAddress?: string | null;
  isActive: boolean;
  createdAt: Date | string;
}

interface CustomersTableProps {
  data: CustomerRow[];
  total: number;
  page: number;
  pageSize: number;
}

export function CustomersTable({
  data,
  total,
  page,
  pageSize,
}: CustomersTableProps) {
  const columns: ColumnDef<CustomerRow>[] = [
    {
      header: "Customer",
      accessorKey: "name",
      cell: (row) => (
        <div>
          <div className="font-medium text-foreground">{row.name}</div>
          <div className="text-xs text-muted-foreground">{row.email}</div>
        </div>
      ),
    },
    {
      header: "Phone",
      accessorKey: "phone",
      cell: (row) => (
        <span className="text-sm text-muted-foreground">
          {row.phone || "—"}
        </span>
      ),
    },
    {
      header: "Billing Address",
      accessorKey: "billingAddress",
      cell: (row) => (
        <span className="text-xs text-muted-foreground line-clamp-1 max-w-xs">
          {row.billingAddress || "—"}
        </span>
      ),
    },
    {
      header: "Status",
      accessorKey: "isActive",
      cell: (row) => (
        <Badge
          variant={row.isActive ? "outline" : "destructive"}
          className="text-xs"
        >
          {row.isActive ? "Active" : "Inactive"}
        </Badge>
      ),
    },
    {
      header: "Created",
      accessorKey: "createdAt",
      cell: (row) => (
        <span className="text-xs text-muted-foreground">
          {formatDate(row.createdAt)}
        </span>
      ),
    },
    {
      header: "Actions",
      cell: (row) => <EditCustomerDialog customer={row} />,
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
      searchPlaceholder="Search customers by name, email or phone..."
      emptyMessage="No customers found."
    />
  );
}
