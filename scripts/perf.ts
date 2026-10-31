import "dotenv/config";
import { performance } from "node:perf_hooks";
import fs from "node:fs";
import path from "node:path";
import { db } from "../src/server/db";
import { getToday } from "../src/lib/dates";
import {
  getKPIMetricsRecord,
  getRevenueByMonthRecord,
  getSubscriptionsByStatusRecord,
  getOverdueInvoicesRecord,
  getRecentPaymentsRecord,
} from "../src/server/modules/dashboard/repo";
import { listInvoicesRecord } from "../src/server/modules/invoices/repo";

interface BenchmarkResult {
  name: string;
  description: string;
  iterations: number;
  minMs: number;
  maxMs: number;
  avgMs: number;
  medianMs: number;
  status: "PASS" | "FAIL";
}

async function runBenchmark(
  name: string,
  description: string,
  fn: () => Promise<unknown>,
  iterations = 5
): Promise<BenchmarkResult> {
  const times: number[] = [];

  // Warmup run
  await fn();

  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    await fn();
    const duration = performance.now() - start;
    times.push(duration);
  }

  times.sort((a, b) => a - b);
  const minMs = Math.round(times[0] * 100) / 100;
  const maxMs = Math.round(times[times.length - 1] * 100) / 100;
  const avgMs = Math.round((times.reduce((sum, t) => sum + t, 0) / times.length) * 100) / 100;
  const medianMs = Math.round(times[Math.floor(times.length / 2)] * 100) / 100;

  return {
    name,
    description,
    iterations,
    minMs,
    maxMs,
    avgMs,
    medianMs,
    status: medianMs <= 300 ? "PASS" : "FAIL",
  };
}

async function main() {
  console.log("=================================================");
  console.log("       BrightLoop Performance Benchmark Suite     ");
  console.log("=================================================");

  const today = getToday();
  const filter = {
    overduePage: 1,
    overduePageSize: 10,
    paymentsPage: 1,
    paymentsPageSize: 10,
  };

  // Check dataset scale
  const [subCount, invCount, payCount, custCount] = await Promise.all([
    db.subscription.count(),
    db.invoice.count(),
    db.payment.count(),
    db.customer.count(),
  ]);

  console.log(`Dataset size:`);
  console.log(`  Subscriptions: ${subCount.toLocaleString()}`);
  console.log(`  Invoices:      ${invCount.toLocaleString()}`);
  console.log(`  Payments:      ${payCount.toLocaleString()}`);
  console.log(`  Customers:     ${custCount.toLocaleString()}`);
  console.log("-------------------------------------------------");
  console.log("Running query performance measurements...\n");

  const benchmarks: BenchmarkResult[] = [];

  // 1. Dashboard KPI Metrics
  benchmarks.push(
    await runBenchmark(
      "Dashboard KPIs",
      "MRR, active/paused counts, revenue collected, outstanding balance, overdue metrics",
      () => getKPIMetricsRecord(filter, today)
    )
  );

  // 2. Revenue by Month
  benchmarks.push(
    await runBenchmark(
      "Revenue by Month",
      "Monthly aggregated revenue from payments grouped by month (12 months)",
      () => getRevenueByMonthRecord(filter)
    )
  );

  // 3. Subscriptions by Status
  benchmarks.push(
    await runBenchmark(
      "Subscriptions by Status",
      "Counts grouped by status and pausedCount filter",
      () => getSubscriptionsByStatusRecord(filter)
    )
  );

  // 4. Overdue Invoices
  benchmarks.push(
    await runBenchmark(
      "Overdue Invoices List",
      "Paginated list (page 1, 10 rows) of CONFIRMED invoices past due with balance",
      () => getOverdueInvoicesRecord(filter, today)
    )
  );

  // 5. Recent Payments
  benchmarks.push(
    await runBenchmark(
      "Recent Payments List",
      "Paginated list (page 1, 10 rows) of non-voided payments ordered by date desc",
      () => getRecentPaymentsRecord(filter)
    )
  );

  // 6. Invoice List (Default)
  benchmarks.push(
    await runBenchmark(
      "Invoices List (Default)",
      "Paginated invoice listing (page 1, 20 rows) ordered by createdAt desc with customer & plan",
      () => listInvoicesRecord({ page: 1, pageSize: 20, view: "all" })
    )
  );

  // 7. Invoice List (Overdue View)
  benchmarks.push(
    await runBenchmark(
      "Invoices List (Overdue View)",
      "Paginated invoice listing with view='overdue' (CONFIRMED & past due date)",
      () => listInvoicesRecord({ page: 1, pageSize: 20, view: "overdue" })
    )
  );

  // 8. Invoice List (Outstanding View)
  benchmarks.push(
    await runBenchmark(
      "Invoices List (Outstanding View)",
      "Paginated invoice listing with view='outstanding' (CONFIRMED status)",
      () => listInvoicesRecord({ page: 1, pageSize: 20, view: "outstanding" })
    )
  );

  // 9. Invoice List (Search)
  benchmarks.push(
    await runBenchmark(
      "Invoices List (Search)",
      "Search across invoice number, customer name, and email with pagination",
      () => listInvoicesRecord({ page: 1, pageSize: 20, view: "all", search: "DEMO" })
    )
  );

  // Print results table
  console.log("\nMeasured Results (Target: < 300 ms per query):");
  console.table(
    benchmarks.map((b) => ({
      Query: b.name,
      "Median (ms)": b.medianMs,
      "Min (ms)": b.minMs,
      "Max (ms)": b.maxMs,
      "Avg (ms)": b.avgMs,
      Status: b.status,
    }))
  );

  const hasFailures = benchmarks.some((b) => b.status === "FAIL");
  if (hasFailures) {
    console.error("\n[WARNING] One or more queries exceeded the 300 ms SLA target.");
  } else {
    console.log("\n[SUCCESS] All queries executed well under the 300 ms SLA target.");
  }

  // Generate docs/perf-results.md
  const markdownReport = `# Performance Results

Measured against full scale seed dataset on ${new Date().toISOString().slice(0, 10)}.

## Dataset Scale
- **Subscriptions**: ${subCount.toLocaleString()}
- **Invoices**: ${invCount.toLocaleString()}
- **Payments**: ${payCount.toLocaleString()}
- **Customers**: ${custCount.toLocaleString()}

## Benchmark Results (SLA Target: < 300 ms)

| Query / Operation | Median (ms) | Min (ms) | Max (ms) | Avg (ms) | Target | Result |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |
${benchmarks
  .map(
    (b) =>
      `| **${b.name}** | ${b.medianMs.toFixed(2)} ms | ${b.minMs.toFixed(2)} ms | ${b.maxMs.toFixed(2)} ms | ${b.avgMs.toFixed(2)} ms | < 300 ms | **${b.status}** |`
  )
  .join("\n")}

## Query Descriptions
${benchmarks.map((b) => `- **${b.name}**: ${b.description}`).join("\n")}

## Methodology
- Measurements conducted using Node.js \`performance.now()\` with high-resolution timestamps.
- Initial unmeasured warmup execution to prime PostgreSQL shared buffers and query planner caches.
- 5 measured iterations per query with outlier tracking (min, max, median, average).
- All queries executed through application repository functions with realistic filters and pagination parameters.
`;

  const outputPath = path.resolve(__dirname, "../docs/perf-results.md");
  fs.writeFileSync(outputPath, markdownReport, "utf-8");
  console.log(`Saved benchmark report to ${outputPath}`);

  await db.$disconnect();
}

main().catch((err) => {
  console.error("Benchmark failed:", err);
  process.exit(1);
});
