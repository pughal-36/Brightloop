# BrightLoop Foundation Progress

- [x] 1. Install shadcn/ui (init for Next.js App Router, src/ layout) and components: button, input, label, card, table, dialog, form, badge, select, sonner
- [x] 2. src/server/env.ts: validate env vars with Zod (DATABASE_URL), fail fast
- [x] 3. src/server/db.ts: Prisma client singleton using pg adapter and generated client in src/generated/prisma (server-only)
- [x] 4. src/server/errors.ts: AppError(code, status, message) with standard error codes and JSON transformer
- [x] 5. src/lib/money.ts: integer-paise helpers (parseRupeesToPaise, formatINR, add, sub, percentOf)
- [x] 6. Custom pages: src/app/not-found.tsx, src/app/error.tsx, src/app/global-error.tsx, src/app/forbidden/page.tsx
- [x] 7. Health check: GET /api/health returning { ok: true } via server service function running SELECT 1
- [x] 8. Vitest configuration and comprehensive unit tests for src/lib/money.ts
- [x] 9. package.json scripts: typecheck, lint, test, db:generate, db:migrate
- [x] 10. Verification: pnpm typecheck, pnpm lint, pnpm test all pass

## Database Migration
- [x] Initial schema migration with number sequences (`subscription_number_seq`, `invoice_number_seq`) and check constraints
- [x] Integration tests for unique constraints, sequential number defaults, and check constraints

## Base Seed Data
- [x] Date helper (`src/lib/dates.ts`) with `APP_TZ = "Asia/Kolkata"` and unit tests
- [x] Configured `prisma.config.ts` seed command (`tsx prisma/seed.ts`) and `pnpm db:seed` script
- [x] Environment seed credentials validation (never hardcoded, bcrypt cost 12, password policy checks)
- [x] Idempotent seed script (`prisma/seed.ts`): users (1 ADMIN, 2 STAFF, 1 CUSTOMER), taxes, products (with Odoo variant +560 INR), plans (daily, weekly, monthly with tax, yearly with end date), 2 quotation templates with lines, discounts (percent, fixed, nearly exhausted, expired), and 10 Indian customers via Faker
- [x] Integration tests for seed idempotency, Odoo variant extraPrice, single ADMIN verification, and bcrypt password hashing


