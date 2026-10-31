# Performance Results

Measured against full scale seed dataset on 2026-10-31.

## Dataset Scale
- **Subscriptions**: 5,017
- **Invoices**: 31,002
- **Payments**: 23,301
- **Customers**: 414

## Benchmark Results (SLA Target: < 300 ms)

| Query / Operation | Median (ms) | Min (ms) | Max (ms) | Avg (ms) | Target | Result |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| **Dashboard KPIs** | 54.03 ms | 42.90 ms | 66.88 ms | 52.37 ms | < 300 ms | **PASS** |
| **Revenue by Month** | 42.44 ms | 38.35 ms | 44.71 ms | 42.11 ms | < 300 ms | **PASS** |
| **Subscriptions by Status** | 3.81 ms | 3.57 ms | 4.43 ms | 3.96 ms | < 300 ms | **PASS** |
| **Overdue Invoices List** | 9.60 ms | 7.41 ms | 12.35 ms | 9.46 ms | < 300 ms | **PASS** |
| **Recent Payments List** | 32.35 ms | 29.33 ms | 52.85 ms | 36.45 ms | < 300 ms | **PASS** |
| **Invoices List (Default)** | 16.10 ms | 14.59 ms | 35.72 ms | 19.94 ms | < 300 ms | **PASS** |
| **Invoices List (Overdue View)** | 14.26 ms | 11.06 ms | 22.47 ms | 16.04 ms | < 300 ms | **PASS** |
| **Invoices List (Outstanding View)** | 12.75 ms | 12.40 ms | 13.18 ms | 12.73 ms | < 300 ms | **PASS** |
| **Invoices List (Search)** | 151.56 ms | 137.97 ms | 248.16 ms | 174.86 ms | < 300 ms | **PASS** |

## Query Descriptions
- **Dashboard KPIs**: MRR, active/paused counts, revenue collected, outstanding balance, overdue metrics
- **Revenue by Month**: Monthly aggregated revenue from payments grouped by month (12 months)
- **Subscriptions by Status**: Counts grouped by status and pausedCount filter
- **Overdue Invoices List**: Paginated list (page 1, 10 rows) of CONFIRMED invoices past due with balance
- **Recent Payments List**: Paginated list (page 1, 10 rows) of non-voided payments ordered by date desc
- **Invoices List (Default)**: Paginated invoice listing (page 1, 20 rows) ordered by createdAt desc with customer & plan
- **Invoices List (Overdue View)**: Paginated invoice listing with view='overdue' (CONFIRMED & past due date)
- **Invoices List (Outstanding View)**: Paginated invoice listing with view='outstanding' (CONFIRMED status)
- **Invoices List (Search)**: Search across invoice number, customer name, and email with pagination

## Methodology
- Measurements conducted using Node.js `performance.now()` with high-resolution timestamps.
- Initial unmeasured warmup execution to prime PostgreSQL shared buffers and query planner caches.
- 5 measured iterations per query with outlier tracking (min, max, median, average).
- All queries executed through application repository functions with realistic filters and pagination parameters.
