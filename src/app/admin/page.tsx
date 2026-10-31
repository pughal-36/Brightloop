import Link from "next/link";
import { requireSession } from "@/server/lib/session";
import { Role } from "@/generated/prisma/enums";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Users, Package, Receipt, Layers, UserCog, FileCheck2, Percent } from "lucide-react";

export default async function AdminDashboardPage() {
  const session = await requireSession();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Welcome back, {session.user.name}. Manage your business operations below.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Link href="/admin/customers">
          <Card className="hover:bg-muted/50 transition-colors cursor-pointer h-full">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Customers</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <CardDescription>
                View and manage client accounts, contacts, and billing addresses.
              </CardDescription>
            </CardContent>
          </Card>
        </Link>

        <Link href="/admin/products">
          <Card className="hover:bg-muted/50 transition-colors cursor-pointer h-full">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Products</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <CardDescription>
                Manage service offerings, software licenses, physical items, and variants.
              </CardDescription>
            </CardContent>
          </Card>
        </Link>

        <Link href="/admin/taxes">
          <Card className="hover:bg-muted/50 transition-colors cursor-pointer h-full">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Taxes</CardTitle>
              <Receipt className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <CardDescription>
                Define GST and tax rates with basis-point precision.
              </CardDescription>
            </CardContent>
          </Card>
        </Link>

        <Link href="/admin/plans">
          <Card className="hover:bg-muted/50 transition-colors cursor-pointer h-full">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Plans</CardTitle>
              <Layers className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <CardDescription>
                Configure recurring subscription periods and lifecycle flags.
              </CardDescription>
            </CardContent>
          </Card>
        </Link>

        <Link href="/admin/subscriptions">
          <Card className="hover:bg-muted/50 transition-colors cursor-pointer h-full">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Subscriptions</CardTitle>
              <FileCheck2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <CardDescription>
                Manage quotations, recurring subscriptions, and status lifecycles.
              </CardDescription>
            </CardContent>
          </Card>
        </Link>

        <Link href="/admin/discounts">
          <Card className="hover:bg-muted/50 transition-colors cursor-pointer h-full">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Discounts</CardTitle>
              <Percent className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <CardDescription>
                Configure promo codes, percentage or fixed reductions, and limits.
              </CardDescription>
            </CardContent>
          </Card>
        </Link>

        {session.user.role === Role.ADMIN && (
          <Link href="/admin/staff">
            <Card className="hover:bg-muted/50 transition-colors cursor-pointer h-full">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Staff Members</CardTitle>
                <UserCog className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <CardDescription>
                  Invite staff operators and manage account activations.
                </CardDescription>
              </CardContent>
            </Card>
          </Link>
        )}
      </div>
    </div>
  );
}
