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

## 05 Quotation Templates & Subscriptions
- [x] Quotation templates: admin CRUD with template lines and selectable products/variants
- [x] Subscriptions creation: create blank or from template with plan fee and planTaxRateBps snapshots, auto-generated SUB- number from Postgres sequence default
- [x] Line editor with server-computed totals snapshotting effective unit price (salesPrice + variant extraPrice) and tax rate bps
- [x] Central transition function `transitionSubscription` enforcing the full transition state machine and plan flags (`closable`, `pausable`, `renewable`)
- [x] Status history tracking: immutable StatusHistory records written on every state transition
- [x] Subscription actions: send quotation (immutable once sent), confirm, activate, pause, resume (recalculates nextPeriodStart to first period start on/after resume date), renew (extends expiry by one billing period), close with required reason, and delete (DRAFT only)
- [x] UI: /admin/subscriptions list with filters, pagination, and creation dialogs (blank or from template); /admin/subscriptions/[id] detail page with line snapshots, totals, action triggers, and chronological StatusHistory timeline
- [x] Tests: comprehensive integration tests covering legal & illegal transitions, flag enforcement, draft editing/deletion, and timeline logging

## 06 Discounts
- [x] Discounts CRUD: admin management with scope (SUBSCRIPTION, PRODUCTS), type (PERCENTAGE, FIXED), thresholds (minPurchasePaise, minQuantity), and usage limits
- [x] Pure evaluation function: `evaluateBestDiscount(subscriptionLines, planFee, date, candidateDiscounts)` with zero database access
- [x] Scope evaluation rules: PRODUCTS applies only to matching products; SUBSCRIPTION applies to eligible lines + plan fee
- [x] Discount limits and caps: percentage calculations, fixed discount capped at eligible base amount, and best-of-many selection
- [x] UI: /admin/discounts list with status badges (ACTIVE, EXPIRED, EXHAUSTED, INACTIVE), usage progress tracking, and creation dialog
- [x] Tests: unit tests covering date validity, usage exhaustion, thresholds, line scopes, and best-single discount selection; integration tests for discount CRUD and RBAC

## 07 Billing Engine
- [x] Pure period math in src/server/modules/billing/periods.ts (from startDate + n periods, month-end clipping without drift, daily/weekly/monthly/yearly)
- [x] Pure invoice computation in src/server/modules/billing/compute.ts (PLAN_FEE line first, product lines, DISCOUNT line, tax calculated per line on discounted base, totals, dueDate from payment terms)
- [x] Idempotent runBilling(asOfDate) with catch-up, advancing nextPeriodStart, per-subscription transaction using FOR UPDATE SKIP LOCKED
- [x] UNIQUE(subscriptionId, periodStart) conflict treated as skipped, one failure never halts the batch
- [x] Housekeeping in the same run: CONFIRMED to ACTIVE at startDate (nextPeriodStart = startDate) and autoClose plans closed past expiry
- [x] Dry-run previewBilling(asOfDate) returning counts only
- [x] Admin page at /admin/billing with as-of date picker ("Demo Clock" when DEMO_MODE=true), preview, run, summary card, and run history
- [x] Protected cron endpoint POST /api/cron/billing with CRON_SECRET header verification
- [x] Tests: unit tests for periods and compute, integration tests with real DB verifying 0 invoices on re-run, 3-month gap catch-up in order, pause skip, expiry cut-off, month-end start dates, discount tax math, and partial batch failures

## 08 Invoices & Payments (Lifecycle & Manual Payments)
- [x] Invoices listing: server-side pagination, search, status filter, and derived quick tabs (All, Outstanding, Overdue, Draft, Paid)
- [x] Derived metrics: Overdue is dynamically calculated (CONFIRMED, dueDate < today, balance > 0) and never stored
- [x] Single & bulk confirmation: freezes invoice lines, atomically checks and increments discount usage (UPDATE ... WHERE usedCount < usageLimit), creates DiscountApplication
- [x] RECONFIRM_REQUIRED flow: if discount is exhausted/invalid, removes discount line, recalculates line taxes and invoice totals, keeps in DRAFT, returns old and new totals (bulk confirm skips and lists them)
- [x] Invoice cancellation: cancels DRAFT or unpaid CONFIRMED invoices, atomically releases discount usage (decrements usedCount and deletes DiscountApplication)
- [x] Manual payments: records payment with PaymentMethod enum (provider MANUAL, amount > 0 and <= balance) on CONFIRMED invoices only, updates amountPaid in same transaction, flips status to PAID when balance is 0
- [x] Payment voiding: ADMIN only, requires void note, recalculates active payments, reverts invoice status from PAID to CONFIRMED if balance > 0
- [x] Send invoice: emails invoice statement summary to customer and records sentAt
- [x] Print page: standalone clean print layout at /admin/invoices/[id]/print with print-specific stylesheet
- [x] StatusHistory tracking: records transition history on confirm, payment, void, and cancellation
- [x] Tests: partial then full payment flips to PAID, overpayment rejected, payments blocked on DRAFT, exhausted discount returns RECONFIRM_REQUIRED, concurrent confirms never exceed usageLimit, cancel releases discount use

## 09 Customer Portal
- [x] Portal layout and navigation: responsive top bar with My Subscriptions, My Invoices, Payment History, session user display, and sign out
- [x] Scoped queries: strict customerId scoping across subscriptions, invoices, and payments, returning NOT_FOUND (404) for another customer's record to prevent enumeration/IDOR
- [x] Portal dashboard: active subscriptions count, pending quotations, total amount due, and conditional overdue alert banner with count and amount
- [x] Subscriptions view: status filter tabs, server-side pagination, line items snapshot (sanitized costPrice and internal notes), and StatusHistory timeline (sanitized staff IDs)
- [x] Quotation acceptance: customer action to confirm quotation before validUntil; rejects acceptance after expiry date with CONFLICT (409)
- [x] Role restrictions: customer sessions blocked from pause, close, renew, and activate with FORBIDDEN (403)
- [x] Invoices & printing: view invoice details, line items snapshot, status badges (with Overdue indicator), disabled "Pay now" button, and print preview page
- [x] Payment history: server-side paginated list of non-voided payments scoped to the authenticated customer

## 10 Dashboard and Reports
- [x] Database indexes: added explicit indexes on Invoice(customerId) and Subscription(nextPeriodStart) via migration 20261031111719_add_spec_10_indexes
- [x] KPI strip: active subscriptions (with paused counted separately), MRR (normalized monthly run-rate), ARR (MRR x 12), revenue collected, outstanding balance, overdue count and amount
- [x] SQL aggregation: pure SQL aggregate queries with camelCase double-quoted identifiers, BigInt conversions at repo boundary, and zero full table loads into JS
- [x] MRR normalization: pure helper and SQL calculation for YEARLY (/ 12), WEEKLY (* 52 / 12), DAILY (* 365 / 12), and MONTHLY plans
- [x] Revenue by month chart: pure SVG bar chart with grid lines, month labels, hover values, and responsive container without external charting libraries
- [x] Subscriptions by status: breakdown card showing counts and paused sub-counts across all lifecycle states
- [x] Detail tables: overdue invoices table and recent payments table with server-side pagination and direct invoice links
- [x] Filtering: date range, plan, customer, and status filter bar with query parameter synchronization and reset
- [x] Demo mode: server render timestamp displayed in layout footer when DEMO_MODE=true
- [x] Comprehensive test coverage: unit tests for MRR normalization across all plan periods; integration tests verifying IDOR protection, 404 responses, quotation expiry enforcement, staff action guards, and confidential data sanitization






