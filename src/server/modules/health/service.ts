import "server-only";
import { pingDatabase } from "./repo";
import { AppError } from "@/server/errors";
import type { HealthResponse } from "./schema";

export async function checkHealth(): Promise<HealthResponse> {
  try {
    await pingDatabase();
    return { ok: true };
  } catch {
    throw new AppError("DATABASE_UNAVAILABLE");
  }
}
