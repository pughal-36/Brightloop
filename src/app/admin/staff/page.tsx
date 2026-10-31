import { redirect } from "next/navigation";
import { requireSession } from "@/server/lib/session";
import { Role } from "@/generated/prisma/enums";
import * as staffService from "@/server/modules/staff/service";
import { DataTable, type ColumnDef } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { AddStaffDialog, DeactivateStaffButton } from "./staff-actions-client";

interface PageProps {
  searchParams: Promise<{
    search?: string;
    page?: string;
  }>;
}

interface StaffRow {
  id: string;
  name: string;
  email: string;
  role: Role;
  isActive: boolean;
  createdAt: Date;
}

export default async function StaffPage({ searchParams }: PageProps) {
  const session = await requireSession();

  if (session.user.role !== Role.ADMIN) {
    redirect("/forbidden");
  }

  const resolvedParams = await searchParams;
  const search = resolvedParams.search || "";
  const page = parseInt(resolvedParams.page || "1", 10) || 1;
  const pageSize = 10;

  const result = await staffService.listStaff(session, {
    search,
    page,
    pageSize,
  });

  const columns: ColumnDef<StaffRow>[] = [
    {
      header: "Name",
      accessorKey: "name",
      cell: (row) => <span className="font-medium text-foreground">{row.name}</span>,
    },
    {
      header: "Email",
      accessorKey: "email",
      cell: (row) => <span className="text-muted-foreground">{row.email}</span>,
    },
    {
      header: "Role",
      accessorKey: "role",
      cell: (row) => (
        <Badge
          variant={row.role === Role.ADMIN ? "default" : "secondary"}
          className="text-xs uppercase"
        >
          {row.role}
        </Badge>
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
      cell: (row) => (
        <DeactivateStaffButton
          userId={row.id}
          isSelf={row.id === session.user.id}
          isActive={row.isActive}
        />
      ),
      className: "text-right",
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Staff Management</h1>
          <p className="text-sm text-muted-foreground">
            Manage company administrators and operational staff.
          </p>
        </div>
        <AddStaffDialog />
      </div>

      <DataTable
        columns={columns}
        data={result.items}
        total={result.total}
        page={result.page}
        pageSize={result.pageSize}
        searchPlaceholder="Search staff by name or email..."
        emptyMessage="No staff members found."
      />
    </div>
  );
}
