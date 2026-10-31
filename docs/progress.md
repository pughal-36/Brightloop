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

## 01 Authentication
- [x] Password policy: shared Zod schema (min 9 chars, upper, lower, special) & live checklist function in `src/lib/password.ts`
- [x] Signup: creates User (role CUSTOMER) + linked Customer in one transaction, lowercased email, duplicate conflict check, bcryptjs cost 12
- [x] Login: timing attack protection with cost 12 dummy hash, identical generic error for unknown/wrong/inactive, LoginAttempt recording, 15-minute lockout on 6th failed attempt per email+IP
- [x] Session: JWT via jose (HS256, AUTH_SECRET, 7 days) in httpOnly/SameSite=Lax cookie, request-memoized `getSession()`, `requireSession()`, session versioning
- [x] Password reset: 3 requests/hour limit, 32-byte base64url token stored as sha256, single-use, 30-min expiry, increments `sessionVersion` to invalidate existing sessions
- [x] Email interface: `src/server/lib/email.ts` logging reset links in development without logging passwords
- [x] ReturnTo sanitizer & role-based routing: rejects protocol/scheme and open redirects (`//evil.com`, `https://evil.com`, `javascript:`)
- [x] Security headers in `next.config.ts` (nosniff, strict-origin-when-cross-origin, DENY, camera/mic/geo off, HSTS in production)
- [x] UI with shadcn: `/signup`, `/login`, `/forgot-password`, `/reset-password` with live password checklist, loading states, field errors, distinct invalid/expired token state, locked state
- [x] Minimal placeholder pages: `/admin` and `/portal` calling `requireSession()` with logout button and redirect to login
- [x] Comprehensive unit and integration tests passing in Vitest

## 02 RBAC, Staff, Customers
- [x] Role guards: requireRole(...roles) used inside every service function
- [x] Route group layouts: /admin/* allows ADMIN and STAFF, /portal/* only CUSTOMER; wrong role goes to /forbidden, unauthenticated redirects to /login
- [x] Admin layout with sidebar: Customers, Products, Taxes, Plans, Staff (admin only), Subscriptions, Invoices, Billing, Discounts, Dashboard
- [x] Staff: admin creates staff (name, email) reusing reset token flow to email set-password link; deactivation immediately revokes sessions and prevents self-deactivation
- [x] Customers: CRUD by ADMIN/STAFF with search and server-side pagination; customer data scoped by customerId
- [x] Integration tests for STAFF forbidden from admin services, customer forbidden from admin services, staff deactivation

## 03 Catalog: Products, Variants, Taxes
- [x] Taxes: CRUD with rateBps (0..10000 basis points), ADMIN write only, STAFF read only, soft deactivation
- [x] Products: CRUD with types (SERVICE, SOFTWARE, ADD_ON, PHYSICAL, OTHER), salesPrice, costPrice, notes, taxId
- [x] ProductVariants: unique (productId, attribute, value), extraPrice
- [x] Price & margin math: effective price = salesPrice + variant.extraPrice, margin = salesPrice - costPrice
- [x] Data security: costPrice and margin absent from all non-admin / customer-facing responses
- [x] UI: /admin/products (list, detail with variants and margin), /admin/taxes
- [x] Integration tests for variant price math, effective pricing, margin, and role guards

## 04 Plans
- [x] Plans: CRUD with price, billingPeriod (DAILY|WEEKLY|MONTHLY|YEARLY), minQty (>=1), availableFrom, availableTo, taxId
- [x] Lifecycle flags: autoClose, closable, pausable, renewable
- [x] Availability window enforcement: isPlanSelectable verifies isActive, availableFrom <= asOfDate <= availableTo
- [x] UI: /admin/plans with flag toggles, lifecycle rule summaries, and availability window display
- [x] Reusable DataTable + server-side pagination component used across all admin lists
- [x] Integration tests for plan flags, window validation, and selectable checks


