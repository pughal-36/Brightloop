import "server-only";
import { db } from "@/server/db";

export async function pingDatabase(): Promise<void> {
  await db.$queryRaw`SELECT 1`;
}

