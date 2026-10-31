import { requireSession } from "@/server/lib/session";
import { listInvoices } from "@/server/modules/invoices";
import { InvoicesTableClient } from "./invoices-table-client";
import { InvoiceStatus } from "@/generated/prisma/enums";

interface AdminInvoicesPageProps {
  searchParams: Promise<{
    page?: string;
    pageSize?: string;
    status?: string;
    view?: string;
    customerId?: string;
    search?: string;
  }>;
}

export default async function AdminInvoicesPage({ searchParams }: AdminInvoicesPageProps) {
  const session = await requireSession();
  const sp = await searchParams;

  const page = sp.page ? parseInt(sp.page, 10) : 1;
  const pageSize = sp.pageSize ? parseInt(sp.pageSize, 10) : 20;
  const status = sp.status as InvoiceStatus | undefined;
  const view = (sp.view as "all" | "outstanding" | "overdue") || "all";
  const search = sp.search;

  const result = await listInvoices(session, {
    page,
    pageSize,
    status,
    view,
    search,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Invoices</h1>
        <p className="text-sm text-muted-foreground">
          Track billing statements, confirmation freezing, payment collection, and overdue balances.
        </p>
      </div>

      <InvoicesTableClient
        invoices={result.invoices}
        totalCount={result.totalCount}
        page={result.page}
        pageSize={result.pageSize}
        totalPages={result.totalPages}
        currentView={view}
        currentStatus={status}
        searchQuery={search}
      />
    </div>
  );
}

