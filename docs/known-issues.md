# Known Issues & Bug Reports

## 1. "Functions cannot be passed directly to Client Components" on Server Pages Using DataTable

### Root Cause
Next.js App Router Server Components cannot serialize non-plain objects or JavaScript functions across the Server -> Client Component boundary. In the initial implementation, server `page.tsx` components defined DataTable `ColumnDef` arrays containing `cell: (row) => ReactNode` rendering functions, and passed those `columns` directly as props to the `"use client"` `DataTable` component.

### Occurrences in `src/app`
1. `src/app/admin/subscriptions/page.tsx`: Server component defined `columns` containing `cell` functions for number link, plan name, customer, status badge, dates, and actions, passing them to `DataTable`.
2. `src/app/admin/customers/page.tsx`: Server component defined `columns` containing `cell` functions for customer name, email, phone, status badge, and action dialog triggers, passing them to `DataTable`.
3. `src/app/admin/products/page.tsx`: Server component defined `columns` containing `cell` functions for product name, category badge, prices, tax rate, gross margin, and edit/delete actions, passing them to `DataTable`.
4. `src/app/admin/taxes/page.tsx`: Server component defined `columns` containing `cell` functions for tax name, rate in percentage, active status badge, and edit actions, passing them to `DataTable`.
5. `src/app/admin/plans/page.tsx`: Server component defined `columns` containing `cell` functions for plan name, fee, billing period, tax, lifecycle flags, status badge, and edit/toggle actions, passing them to `DataTable`.
6. `src/app/admin/staff/page.tsx`: Server component defined `columns` containing `cell` functions for staff name, email, active badge, and deactivate button action, passing them to `DataTable`.
7. `src/app/admin/discounts/page.tsx`: Server component defined `columns` containing `cell` functions for discount name, type/value, scope, usage limits, date ranges, status badges, and edit/toggle actions, passing them to `DataTable`.

### Remediation Pattern
For each page, create a sibling client component (`*-table.tsx` or `*-table-client.tsx`) marked with `"use client"`. The client component owns the `ColumnDef` definitions (including all `cell` render functions, action dialog triggers, formatting helpers, and links) and renders `DataTable`. The server `page.tsx` remains a pure Server Component that fetches data through server services, sanitizes data into plain serializable objects, and passes only plain props (`data`, `total`, `page`, `pageSize`, `search`, etc.) to the client table component.
