import "server-only";
import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const formattedErrors = JSON.stringify(parsed.error.format(), null, 2);
  console.error(`Invalid environment variables:\n${formattedErrors}`);
  throw new Error(`Invalid environment variables:\n${formattedErrors}`);
}

export const env = parsed.data;

