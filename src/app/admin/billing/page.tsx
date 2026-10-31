import { requireSession } from "@/server/lib/session";
import { Role } from "@/generated/prisma/enums";
import { listBillingRuns } from "@/server/modules/billing";
import { env } from "@/server/env";
import { getTodayDateString } from "@/lib/dates";
import { BillingClient } from "./billing-client";

export default async function AdminBillingPage() {
  const session = await requireSession();
  const runs = await listBillingRuns(session, 50);
  const defaultDate = getTodayDateString();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Billing Engine</h1>
        <p className="text-sm text-muted-foreground">
          Manage automated recurring invoice generation, catch-up missed periods, and run audit logs.
        </p>
      </div>

      <BillingClient
        demoMode={env.DEMO_MODE}
        initialRuns={runs}
        defaultDate={defaultDate}
      />
    </div>
  );
}