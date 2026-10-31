import { requireSession } from "@/server/lib/session";
import { Role } from "@/generated/prisma/enums";
import * as planService from "@/server/modules/plans/service";
import * as catalogService from "@/server/modules/catalog/service";
import { PlansTable } from "./plans-table";
import { AddPlanDialog } from "./plan-dialogs";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Clock, ShieldX, PauseCircle, RefreshCw } from "lucide-react";

interface PageProps {
  searchParams: Promise<{
    search?: string;
    page?: string;
  }>;
}

export default async function PlansPage({ searchParams }: PageProps) {
  const session = await requireSession();
  const isAdmin = session.user.role === Role.ADMIN;

  const resolvedParams = await searchParams;
  const search = resolvedParams.search || "";
  const page = parseInt(resolvedParams.page || "1", 10) || 1;
  const pageSize = 10;

  const [plansResult, taxesResult] = await Promise.all([
    planService.listPlans(session, {
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
          <h1 className="text-2xl font-bold tracking-tight">Subscription Plans</h1>
          <p className="text-sm text-muted-foreground">
            Define recurring rates, billing schedules, and subscription lifecycle rules.
          </p>
        </div>
        {isAdmin && <AddPlanDialog taxes={taxesResult.items} />}
      </div>

      {/* Flag Summary Reference Card */}
      <Card className="bg-muted/30">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">Plan Lifecycle Rules</CardTitle>
          <CardDescription className="text-xs">
            Flags set per-plan define which operational transitions are permitted on active subscriptions.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 text-xs">
            <div className="flex items-start gap-2">
              <Clock className="h-4 w-4 text-primary shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold text-foreground">autoClose</span>
                <p className="text-muted-foreground mt-0.5">
                  Subscription closes itself when expiry date passes.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-2">
              <ShieldX className="h-4 w-4 text-primary shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold text-foreground">closable</span>
                <p className="text-muted-foreground mt-0.5">
                  Allows staff or customer early cancellation before period ends.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-2">
              <PauseCircle className="h-4 w-4 text-primary shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold text-foreground">pausable</span>
                <p className="text-muted-foreground mt-0.5">
                  Can be temporarily paused; billing engine skips paused periods.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-2">
              <RefreshCw className="h-4 w-4 text-primary shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold text-foreground">renewable</span>
                <p className="text-muted-foreground mt-0.5">
                  Allows extension of subscription term by one billing cycle.
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <PlansTable
        data={plansResult.items}
        total={plansResult.total}
        page={plansResult.page}
        pageSize={plansResult.pageSize}
        isAdmin={isAdmin}
      />
    </div>
  );
}
