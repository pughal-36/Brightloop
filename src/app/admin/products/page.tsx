import { requireSession } from "@/server/lib/session";
import { Role } from "@/generated/prisma/enums";
import * as catalogService from "@/server/modules/catalog/service";
import { ProductsTable } from "./products-table";
import { AddProductDialog } from "./product-dialogs";

interface PageProps {
  searchParams: Promise<{
    search?: string;
    page?: string;
  }>;
}

export default async function ProductsPage({ searchParams }: PageProps) {
  const session = await requireSession();
  const isAdmin = session.user.role === Role.ADMIN;

  const resolvedParams = await searchParams;
  const search = resolvedParams.search || "";
  const page = parseInt(resolvedParams.page || "1", 10) || 1;
  const pageSize = 10;

  const [productsResult, taxesResult] = await Promise.all([
    catalogService.listProducts(session, {
      search,
      page,
      pageSize,
    }),
    catalogService.listTaxes(session, { pageSize: 100, isActive: true }),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Products Catalog</h1>
          <p className="text-sm text-muted-foreground">
            Manage services, software, licenses, physical goods, and product variants.
          </p>
        </div>
        {isAdmin && <AddProductDialog taxes={taxesResult.items} />}
      </div>

      <ProductsTable
        data={productsResult.items}
        total={productsResult.total}
        page={productsResult.page}
        pageSize={productsResult.pageSize}
        isAdmin={isAdmin}
      />
    </div>
  );
}
