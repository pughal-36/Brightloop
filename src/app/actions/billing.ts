"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/server/lib/session";
import { runBilling, previewBilling } from "@/server/modules/billing";

export async function runBillingAction(formData: FormData) {
  const session = await requireSession();
  const asOfDateStr = formData.get("asOfDate")?.toString();
  const asOfDate = asOfDateStr ? new Date(`${asOfDateStr}T00:00:00.000Z`) : undefined;

  try {
    const result = await runBilling(session, { asOfDate });
    revalidatePath("/admin/billing");
    revalidatePath("/admin/subscriptions");
    return { ok: true, data: result };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to run billing";
    return { ok: false, error: message };
  }
}

export async function previewBillingAction(asOfDateStr?: string) {
  const session = await requireSession();
  const asOfDate = asOfDateStr ? new Date(`${asOfDateStr}T00:00:00.000Z`) : undefined;

  try {
    const result = await previewBilling(session, { asOfDate });
    return { ok: true, data: result };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to preview billing";
    return { ok: false, error: message };
  }
}

