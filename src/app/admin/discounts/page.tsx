import { requireSession } from "@/server/lib/session";
import { Role, DiscountType, DiscountScope } from "@/generated/prisma/enums";
import * as discountService from "@/server/modules/discounts/service";
import * as catalogService from "@/server/modules/catalog/service";
import { DataTable, type ColumnDef } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { formatINR } from "@/lib/money";
import { getToday } from "@/lib/dates";
import { AddDiscountDialog, DeactivateDiscountButton } from "./discount-dialogs";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";

interface PageProps {
  searchParams: Promise<{
    search?: string;
    page?: string;
  }>;
}

interface DiscountRow {
  id: string;
  name: string;
  type: DiscountType;
  value: number;
  minPurchase: number | null;
  minQty: number | null;
  startDate: Date;
  endDate: Date;
  usageLimit: number;
  usedCount: number;
  scope: DiscountScope;
  isActive: boolean;
  products: Array<{ product: { id: string; name: string } }>;
  _count: { applications: number };
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

  const today = getToday();

  const columns: ColumnDef<DiscountRow>[] = [
    {
      header: "Discount Rule",
      accessorKey: "name",
      cell: (row) => (
        <div>
          <div className="font-semibold text-foreground text-sm">{row.name}</div>
          <div className="text-xs text-muted-foreground">
            {row.scope === DiscountScope.SUBSCRIPTION ? (
              <span>Whole Subscription (includes plan fee)</span>
            ) : (
              <span>
                {row.products.length} product{row.products.length === 1 ? "" : "s"}:{" "}
                {row.products.map((p) => p.product.name).join(", ") || "None"}
              </span>
            )}
          </div>
        </div>
      ),
    },
    {
      header: "Value",
      accessorKey: "value",
      cell: (row) => {
        if (row.type === DiscountType.PERCENT) {
          return (
            <Badge variant="outline" className="font-mono text-xs">
              {(row.value / 100).toFixed(2)}% OFF
            </Badge>
          );
        }
        return (
          <Badge variant="outline" className="font-mono text-xs font-semibold text-emerald-600">
            {formatINR(row.value)} OFF
          </Badge>
        );
      },
    },
    {
      header: "Status",
      accessorKey: "isActive",
      cell: (row) => {
        const isExpired = new Date(row.endDate).getTime() < today.getTime();
        const isExhausted = row.usedCount >= row.usageLimit;

        if (!row.isActive) {
          return <Badge variant="secondary">INACTIVE</Badge>;
        }
        if (isExpired) {
          return <Badge className="bg-red-600 hover:bg-red-700">EXPIRED</Badge>;
        }
        if (isExhausted) {
          return <Badge className="bg-amber-600 hover:bg-amber-700">EXHAUSTED</Badge>;
        }
        return <Badge className="bg-emerald-600 hover:bg-emerald-700">ACTIVE</Badge>;
      },
    },
    {
      header: "Usage",
      accessorKey: "usedCount",
      cell: (row) => {
        const pct = Math.min(100, Math.round((row.usedCount / row.usageLimit) * 100));
        return (
          <div className="w-36 space-y-1">
            <div className="flex justify-between text-xs">
              <span className="font-medium">
                {row.usedCount} / {row.usageLimit}
              </span>
              <span className="text-muted-foreground">{pct}%</span>
            </div>
            <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
              <div
                className={`h-full transition-all ${
                  pct >= 100
                    ? "bg-amber-500"
                    : pct >= 80
                    ? "bg-amber-400"
                    : "bg-primary"
                }`}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        );
      },
    },
    {
      header: "Validity",
      accessorKey: "startDate",
      cell: (row) => (
        <div className="text-xs space-y-0.5">
          <div>From: {new Date(row.startDate).toLocaleDateString()}</div>
          <div className="text-muted-foreground">
            To: {new Date(row.endDate).toLocaleDateString()}
          </div>
        </div>
      ),
    },
    {
      header: "Actions",
      cell: (row) => {
        if (!isAdmin || !row.isActive) return null;
        return <DeactivateDiscountButton id={row.id} name={row.name} />;
      },
    },
  ];

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
          <DataTable
            columns={columns}
            data={discountsResult.items}
            total={discountsResult.total}
            page={discountsResult.page}
            pageSize={discountsResult.pageSize}
            searchPlaceholder="Search discounts by name..."
            emptyMessage="No discount rules found. Create your first promotional rule."
          />
        </CardContent>
      </Card>
    </div>
  );
}
