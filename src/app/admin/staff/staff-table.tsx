"use client";

import { DataTable, type ColumnDef } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/dates";
import { DeactivateStaffButton } from "./staff-actions-client";
import { Role } from "@/generated/prisma/enums";

export interface StaffRow {
  id: string;
  name: string;
  email: string;
  role: Role;
  isActive: boolean;
  createdAt: Date | string;
}

interface StaffTableProps {
  data: StaffRow[];
  total: number;
  page: number;
  pageSize: number;
  currentUserId: string;
}

export function StaffTable({
  data,
  total,
  page,
  pageSize,
  currentUserId,
}: StaffTableProps) {
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
          {formatDate(row.createdAt)}
        </span>
      ),
    },
    {
      header: "Actions",
      cell: (row) => (
        <DeactivateStaffButton
          userId={row.id}
          isSelf={row.id === currentUserId}
          isActive={row.isActive}
        />
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
      searchPlaceholder="Search staff by name or email..."
      emptyMessage="No staff members found."
    />
  );
}

