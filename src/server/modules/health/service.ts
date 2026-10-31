import "server-only";
import { pingDatabase } from "./repo";
import type { HealthResponse } from "./schema";

export async function checkHealth(): Promise<HealthResponse> {
  await pingDatabase();
  return { ok: true };
}

