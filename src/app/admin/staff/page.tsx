import { redirect } from "next/navigation";
import { requireSession } from "@/server/lib/session";
import { Role } from "@/generated/prisma/enums";
import * as staffService from "@/server/modules/staff/service";
import { StaffTable } from "./staff-table";
import { AddStaffDialog } from "./staff-actions-client";

interface PageProps {
  searchParams: Promise<{
    search?: string;
    page?: string;
  }>;
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

      <StaffTable
        data={result.items}
        total={result.total}
        page={result.page}
        pageSize={result.pageSize}
        currentUserId={session.user.id}
      />
    </div>
  );
}
