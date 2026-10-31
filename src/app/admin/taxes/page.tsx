import { requireSession } from "@/server/lib/session";
import { Role } from "@/generated/prisma/enums";
import * as catalogService from "@/server/modules/catalog/service";
import { DataTable, type ColumnDef } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { AddTaxDialog, DeactivateTaxButton } from "./tax-dialogs";

interface PageProps {
  searchParams: Promise<{
    search?: string;
    page?: string;
  }>;
}

interface TaxRow {
  id: string;
  name: string;
  rateBps: number;
  isActive: boolean;
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

      <DataTable
        columns={columns}
        data={result.items}
        total={result.total}
        page={result.page}
        pageSize={result.pageSize}
        searchPlaceholder="Search taxes..."
        emptyMessage="No tax rates configured."
      />
    </div>
  );
}

