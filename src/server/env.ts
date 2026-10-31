import "server-only";
import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  AUTH_SECRET: z.string().min(32, "AUTH_SECRET must be at least 32 characters"),
  APP_URL: z.string().url("APP_URL must be a valid URL"),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  CRON_SECRET: z.string().min(16, "CRON_SECRET must be at least 16 characters").default("dev_cron_secret_for_billing_32_chars"),
  DEMO_MODE: z
    .string()
    .optional()
    .transform((val) => val === "true" || val === "1")
    .default(false),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const formattedErrors = JSON.stringify(parsed.error.format(), null, 2);
  console.error(`Invalid environment variables:\n${formattedErrors}`);
  throw new Error(`Invalid environment variables:\n${formattedErrors}`);
}

export const env = parsed.data;

