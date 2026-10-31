"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { RotateCcw, Filter } from "lucide-react";

interface FilterProps {
  plans: Array<{ id: string; name: string }>;
  customers: Array<{ id: string; name: string }>;
}

export function DashboardFilters({ plans, customers }: FilterProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const startDate = searchParams?.get("startDate") || "";
  const endDate = searchParams?.get("endDate") || "";
  const planId = searchParams?.get("planId") || "";
  const customerId = searchParams?.get("customerId") || "";
  const status = searchParams?.get("status") || "";

  function updateQuery(key: string, value: string) {
    const params = new URLSearchParams(searchParams?.toString() || "");
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    // Reset pages when filters change
    params.delete("overduePage");
    params.delete("paymentsPage");
    router.push(`${pathname}?${params.toString()}`);
  }

  function handleReset() {
    router.push(pathname);
  }

  const hasFilters = Boolean(startDate || endDate || planId || customerId || status);

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border bg-card p-4 shadow-sm">
      <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground mr-1">
        <Filter className="h-4 w-4" />
        Filters:
      </div>

      {/* Date Range */}
      <div className="flex items-center gap-1.5">
        <Input
          type="date"
          value={startDate}
          onChange={(e) => updateQuery("startDate", e.target.value)}
          className="h-8 w-36 text-xs"
          placeholder="Start date"
        />
        <span className="text-xs text-muted-foreground">to</span>
        <Input
          type="date"
          value={endDate}
          onChange={(e) => updateQuery("endDate", e.target.value)}
          className="h-8 w-36 text-xs"
          placeholder="End date"
        />
      </div>

      {/* Plan */}
      <div className="w-40">
        <select
          value={planId}
          onChange={(e) => updateQuery("planId", e.target.value)}
          className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
        >
          <option value="">All Plans</option>
          {plans.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>

      {/* Customer */}
      <div className="w-44">
        <select
          value={customerId}
          onChange={(e) => updateQuery("customerId", e.target.value)}
          className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
        >
          <option value="">All Customers</option>
          {customers.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      {/* Status */}
      <div className="w-36">
        <select
          value={status}
          onChange={(e) => updateQuery("status", e.target.value)}
          className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
        >
          <option value="">All Statuses</option>
          <option value="ACTIVE">ACTIVE</option>
          <option value="QUOTATION">QUOTATION</option>
          <option value="CONFIRMED">CONFIRMED</option>
          <option value="DRAFT">DRAFT</option>
          <option value="CLOSED">CLOSED</option>
        </select>
      </div>

      {/* Reset */}
      {hasFilters && (
        <Button
          variant="ghost"
          size="sm"
          onClick={handleReset}
          className="h-8 px-2 text-xs text-muted-foreground hover:text-foreground"
        >
          <RotateCcw className="mr-1 h-3.5 w-3.5" />
          Reset
        </Button>
      )}
    </div>
  );
}

