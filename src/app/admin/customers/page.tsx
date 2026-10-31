import { requireSession } from "@/server/lib/session";
import { Role } from "@/generated/prisma/enums";
import * as customerService from "@/server/modules/customers/service";
import { CustomersTable } from "./customers-table";
import { AddCustomerDialog } from "./customer-dialogs";

interface PageProps {
  searchParams: Promise<{
    search?: string;
    page?: string;
  }>;
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

      <CustomersTable
        data={result.items}
        total={result.total}
        page={result.page}
        pageSize={result.pageSize}
      />
    </div>
  );
}
