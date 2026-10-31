import { requireSession } from "@/server/lib/session";
import { Role } from "@/generated/prisma/enums";
import * as customerService from "@/server/modules/customers/service";
import { DataTable, type ColumnDef } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { AddCustomerDialog, EditCustomerDialog } from "./customer-dialogs";

interface PageProps {
  searchParams: Promise<{
    search?: string;
    page?: string;
  }>;
}

interface CustomerRow {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  billingAddress?: string | null;
  isActive: boolean;
  createdAt: Date;
}

export default async function CustomersPage({ searchParams }: PageProps) {
  const session = await requireSession();
  // Role check: ADMIN and STAFF
  if (session.user.role !== Role.ADMIN && session.user.role !== Role.STAFF) {
    throw new Error("Access forbidden");
  }

  const resolvedParams = await searchParams;
  const search = resolvedParams.search || "";
  const page = parseInt(resolvedParams.page || "1", 10) || 1;
  const pageSize = 10;

  const result = await customerService.listCustomers(session, {
    search,
    page,
    pageSize,
  });

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
          {new Date(row.createdAt).toLocaleDateString()}
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
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Customers</h1>
          <p className="text-sm text-muted-foreground">
            Manage customer directories, contacts, and billing records.
          </p>
        </div>
        <AddCustomerDialog />
      </div>

      <DataTable
        columns={columns}
        data={result.items}
        total={result.total}
        page={result.page}
        pageSize={result.pageSize}
        searchPlaceholder="Search customers by name, email or phone..."
        emptyMessage="No customers found."
      />
    </div>
  );
}

