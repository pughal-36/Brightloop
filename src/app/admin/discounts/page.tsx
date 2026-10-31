import { requireSession } from "@/server/lib/session";
import { Role } from "@/generated/prisma/enums";
import * as discountService from "@/server/modules/discounts/service";
import * as catalogService from "@/server/modules/catalog/service";
import { DiscountsTable } from "./discounts-table";
import { AddDiscountDialog } from "./discount-dialogs";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";

interface PageProps {
  searchParams: Promise<{
    search?: string;
    page?: string;
  }>;
}

export default async function DiscountsPage({ searchParams }: PageProps) {
  const session = await requireSession();
  const isAdmin = session.user.role === Role.ADMIN;

  const resolvedParams = await searchParams;
  const search = resolvedParams.search || "";
  const page = parseInt(resolvedParams.page || "1", 10) || 1;
  const pageSize = 10;

  const [discountsResult, productsResult] = await Promise.all([
    discountService.listDiscounts(session, {
      search,
      page,
      pageSize,
    }),
    catalogService.listProducts(session, { pageSize: 100, isActive: true }),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Discounts & Promotions</h1>
          <p className="text-sm text-muted-foreground">
            Define promotional discount rules applied automatically at invoice billing.
          </p>
        </div>
        {isAdmin && <AddDiscountDialog products={productsResult.items} />}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Discount Rules</CardTitle>
          <CardDescription>
            {discountsResult.total} promotional rule{discountsResult.total === 1 ? "" : "s"}{" "}
            configured.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DiscountsTable
            data={discountsResult.items}
            total={discountsResult.total}
            page={discountsResult.page}
            pageSize={discountsResult.pageSize}
            isAdmin={isAdmin}
          />
        </CardContent>
      </Card>
    </div>
  );
}
