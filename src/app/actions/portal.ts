"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/server/lib/session";
import { acceptQuotation } from "@/server/modules/portal";

export async function acceptQuotationAction(subscriptionId: string) {
  const session = await requireSession();
  await acceptQuotation(session, subscriptionId);
  revalidatePath(`/portal/subscriptions/${subscriptionId}`);
  revalidatePath("/portal/subscriptions");
  revalidatePath("/portal");
}
