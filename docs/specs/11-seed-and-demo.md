# 11 Seed data and demo
Purpose: realistic data for development, the scale test, and the demo.
Rules:
- Idempotent seed script (pnpm db:seed). SEED_SCALE=small|full. Small is the default.
- Always: 1 admin, 2 staff, taxes (e.g. 5%, 12%, 18%), products including one with a Brand variant where Odoo adds 560 INR,
  plans covering daily, weekly, monthly and yearly with different flag combinations, templates, a few discounts.
- Edge cases, named so they're easy to find in the demo: a paused subscription, a closable plan, an expiring discount, an exhausted discount,
  a fully paid invoice, a partially paid invoice, an overdue invoice, a failed Razorpay attempt.
- Full scale: about 5,000 subscriptions and about 30,000 invoices via batched createMany, using Faker with a fixed seed so results repeat.
- A perf script (pnpm perf) times the dashboard queries and prints EXPLAIN for the slowest.
- README gets a 3-minute demo script and a "known decisions" list (no proration, no dunning emails, single currency).
Done when: seed runs twice without duplicates; full scale seeds in a few minutes; perf script shows every dashboard query under the target.