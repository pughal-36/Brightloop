# BrightLoop rules
Read docs/domain.md before any task. Read only the spec for the current task (docs/specs/).

## Stack (locked)
Next.js App Router (src/app), TypeScript strict, Prisma 7 + Postgres (Docker), Zod, Tailwind + shadcn.
No new dependencies without asking. No backend-as-a-service.

## Architecture
- src/app: routes and UI only. No business logic, no Prisma imports.
- src/server/modules/<name>/{service,repo,schema}.ts: all logic. Only repo files touch Prisma.
- src/server files start with `import "server-only"`.
- Every service function takes the session and checks role. Customer data always scoped by customerId.
- Validate all input with Zod on the server.

## Hard rules
- Money is integer paise, via lib/money.ts. Never floats.
- Status changes only through the transition functions. Always write status_history.
- Invoice lines are snapshots. Never recompute a confirmed invoice.
- Throw AppError(code, status). Errors map to custom error pages and a standard JSON shape.
- No `any`. No secrets in code. Never log passwords or tokens.

## Workflow
- One module per task. Do not touch unrelated files.
- Before finishing: pnpm typecheck, pnpm lint, pnpm test must pass.
- Tick the item in docs/progress.md. If the spec is ambiguous, ask instead of guessing.

## Speed mode (autonomous)
- Do not ask questions. If something is ambiguous, pick the simplest option consistent with docs/domain.md, and log it
  in docs/assumptions.md (one line each).
- Errors: one fix attempt per failure. If it still fails, remove that sub-feature, log it in docs/known-issues.md, and move on.
  Never loop. Never commit with a failing typecheck.
- Never run: prisma migrate reset, git reset --hard, git push, git clean, rm -rf outside node_modules/.next, or anything that
  drops data. Never edit or delete existing migrations. Schema changes need a NEW migration, logged in docs/assumptions.md.
- Raw SQL: table and column names are camelCase and must be double-quoted. Sum() returns BigInt: convert at the repo boundary.
- Every new env key goes into src/server/env.ts and .env.example. Never read process.env elsewhere.
- Commit once at the end of each task with the message I give. Tick docs/progress.md.
- UI: plain shadcn, consistent, server-side pagination on every list. Do not spend time on visual polish.