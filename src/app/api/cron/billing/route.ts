import { NextRequest, NextResponse } from "next/server";
import { env } from "@/server/env";
import { runBilling } from "@/server/modules/billing";

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const cronSecretHeader = req.headers.get("x-cron-secret");

  const bearerToken = authHeader?.startsWith("Bearer ")
    ? authHeader.slice(7).trim()
    : null;

  const providedSecret = cronSecretHeader || bearerToken;

  if (!providedSecret || providedSecret !== env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    let asOfDate: Date | undefined;
    try {
      const body = await req.json();
      if (body?.asOfDate) {
        asOfDate = new Date(`${body.asOfDate}T00:00:00.000Z`);
      }
    } catch {
      // Body is optional
    }

    const result = await runBilling(null, { asOfDate });
    return NextResponse.json({ ok: true, billingRun: result });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Billing run failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

