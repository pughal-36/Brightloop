import { z } from "zod";

export const runBillingSchema = z.object({
  asOfDate: z.coerce.date().optional(),
});

export type RunBillingInput = z.infer<typeof runBillingSchema>;

export const previewBillingSchema = z.object({
  asOfDate: z.coerce.date().optional(),
});

export type PreviewBillingInput = z.infer<typeof previewBillingSchema>;

export interface BillingRunError {
  subscriptionId: string;
  error: string;
}

export interface BillingRunSummary {
  id: string;
  asOfDate: Date;
  startedById?: string | null;
  startedAt: Date;
  finishedAt?: Date | null;
  created: number;
  skipped: number;
  failed: number;
  errors?: BillingRunError[] | null;
}

export interface BillingPreviewSummary {
  asOfDate: Date;
  eligibleSubscriptions: number;
  invoicesToCreate: number;
  skippedPeriods: number;
  housekeeping: {
    confirmedToActive: number;
    autoClosed: number;
  };
}

