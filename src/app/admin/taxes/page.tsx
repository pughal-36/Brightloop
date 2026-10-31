import { requireSession } from "@/server/lib/session";
import { Role } from "@/generated/prisma/enums";
import * as catalogService from "@/server/modules/catalog/service";
import { TaxesTable } from "./taxes-table";
import { AddTaxDialog } from "./tax-dialogs";

interface PageProps {
  searchParams: Promise<{
    search?: string;
    page?: string;
  }>;
}

export default async function TaxesPage({ searchParams }: PageProps) {
  const session = await requireSession();
  const isAdmin = session.user.role === Role.ADMIN;

  const resolvedParams = await searchParams;
  const search = resolvedParams.search || "";
  const page = parseInt(resolvedParams.page || "1", 10) || 1;
  const pageSize = 10;

  const result = await catalogService.listTaxes(session, {
    search,
    page,
    pageSize,
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Tax Rates</h1>
          <p className="text-sm text-muted-foreground">
            Configure GST and sales tax rates in basis points (1800 = 18.00%).
          </p>
        </div>
        {isAdmin && <AddTaxDialog />}
      </div>

      <TaxesTable
        data={result.items}
        total={result.total}
        page={result.page}
        pageSize={result.pageSize}
        isAdmin={isAdmin}
      />
    </div>
  );
}
