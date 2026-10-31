import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSession } from "@/server/lib/session";
import { Role } from "@/generated/prisma/enums";
import * as catalogService from "@/server/modules/catalog/service";
import { formatINR } from "@/lib/money";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { ChevronLeft } from "lucide-react";
import { AddVariantDialog, DeleteVariantButton } from "../product-dialogs";

interface PageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function ProductDetailPage({ params }: PageProps) {
  const session = await requireSession();
  const isAdmin = session.user.role === Role.ADMIN;
  const { id } = await params;

  let product;
  try {
    product = await catalogService.getProduct(session, id);
  } catch {
    notFound();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Link href="/admin/products">
          <Button variant="ghost" size="sm" className="h-8 px-2">
            <ChevronLeft className="mr-1 h-4 w-4" />
            Back to Products
          </Button>
        </Link>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight">{product.name}</h1>
            <Badge variant="outline" className="text-xs uppercase font-mono">
              {product.type}
            </Badge>
            <Badge variant={product.isActive ? "outline" : "destructive"} className="text-xs">
              {product.isActive ? "Active" : "Inactive"}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            {product.notes || "No additional notes provided."}
          </p>
        </div>

        {isAdmin && <AddVariantDialog productId={product.id} />}
      </div>

      {/* Pricing & Financial Overview */}
      <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="text-xs font-medium">Base Sales Price</CardDescription>
            <CardTitle className="text-xl font-bold text-foreground">
              {formatINR(product.salesPrice)}
            </CardTitle>
          </CardHeader>
        </Card>

        {isAdmin && product.costPrice !== undefined && (
          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="text-xs font-medium">Cost Price (Admin Only)</CardDescription>
              <CardTitle className="text-xl font-bold text-muted-foreground">
                {formatINR(product.costPrice)}
              </CardTitle>
            </CardHeader>
          </Card>
        )}

        {isAdmin && product.margin !== undefined && (
          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="text-xs font-medium">Margin (Sales - Cost)</CardDescription>
              <CardTitle
                className={`text-xl font-bold ${
                  product.margin >= 0 ? "text-emerald-600" : "text-rose-600"
                }`}
              >
                {formatINR(product.margin)}
              </CardTitle>
            </CardHeader>
          </Card>
        )}

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="text-xs font-medium">Tax Category</CardDescription>
            <CardTitle className="text-lg font-bold text-foreground">
              {product.tax
                ? `${product.tax.name} (${(product.tax.rateBps / 100).toFixed(2)}%)`
                : "Untaxed"}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Variants & Effective Prices */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base font-semibold">Product Variants</CardTitle>
              <CardDescription className="text-xs mt-0.5">
                Effective unit price = Base sales price + Variant extra price.
              </CardDescription>
            </div>
            {isAdmin && <AddVariantDialog productId={product.id} />}
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Attribute</TableHead>
                <TableHead>Value</TableHead>
                <TableHead>Extra Price</TableHead>
                <TableHead>Effective Unit Price</TableHead>
                {isAdmin && <TableHead className="text-right">Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {product.variants.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={isAdmin ? 5 : 4}
                    className="h-24 text-center text-muted-foreground text-sm"
                  >
                    No variants configured. Base product price applies to all orders.
                  </TableCell>
                </TableRow>
              ) : (
                product.variants.map((variant) => (
                  <TableRow key={variant.id}>
                    <TableCell className="font-medium">{variant.attribute}</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="font-mono text-xs">
                        {variant.value}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-sm text-muted-foreground">
                      {variant.extraPrice >= 0 ? "+" : ""}
                      {formatINR(variant.extraPrice)}
                    </TableCell>
                    <TableCell className="font-semibold text-sm text-foreground">
                      {formatINR(variant.effectivePrice)}
                    </TableCell>
                    {isAdmin && (
                      <TableCell className="text-right">
                        <DeleteVariantButton id={variant.id} productId={product.id} />
                      </TableCell>
                    )}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

