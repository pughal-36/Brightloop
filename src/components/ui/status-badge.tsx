import * as React from "react";
import { cn } from "cn";
import { Badge } from "@/components/ui/badge";

export type EntityStatus =
  | "DRAFT"
  | "QUOTATION"
  | "CONFIRMED"
  | "ACTIVE"
  | "PAUSED"
  | "CLOSED"
  | "PAID"
  | "CANCELLED"
  | "OVERDUE";

interface StatusBadgeProps {
  status: string;
  isPaused?: boolean;
  isOverdue?: boolean;
  className?: string;
}

export function StatusBadge({
  status,
  isPaused,
  isOverdue,
  className,
}: StatusBadgeProps) {
  // Overdue overrides normal confirmed status badge styling
  if (isOverdue || status === "OVERDUE") {
    return (
      <Badge
        variant="outline"
        className={cn(
          "bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/30 font-semibold px-2 py-0.5",
          className
        )}
      >
        <span className="mr-1.5 h-1.5 w-1.5 rounded-full bg-rose-500 inline-block animate-pulse" />
        Overdue
      </Badge>
    );
  }

  // Paused status
  if (isPaused || status === "PAUSED") {
    return (
      <Badge
        variant="outline"
        className={cn(
          "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30 font-medium px-2 py-0.5",
          className
        )}
      >
        <span className="mr-1.5 h-1.5 w-1.5 rounded-full bg-amber-500 inline-block" />
        Paused
      </Badge>
    );
  }

  const normalized = status.toUpperCase();

  switch (normalized) {
    case "ACTIVE":
      return (
        <Badge
          variant="outline"
          className={cn(
            "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 font-medium px-2 py-0.5",
            className
          )}
        >
          <span className="mr-1.5 h-1.5 w-1.5 rounded-full bg-emerald-500 inline-block" />
          Active
        </Badge>
      );
    case "PAID":
      return (
        <Badge
          variant="outline"
          className={cn(
            "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 font-medium px-2 py-0.5",
            className
          )}
        >
          <span className="mr-1.5 h-1.5 w-1.5 rounded-full bg-emerald-500 inline-block" />
          Paid
        </Badge>
      );
    case "CONFIRMED":
      return (
        <Badge
          variant="outline"
          className={cn(
            "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/30 font-medium px-2 py-0.5",
            className
          )}
        >
          <span className="mr-1.5 h-1.5 w-1.5 rounded-full bg-blue-500 inline-block" />
          Confirmed
        </Badge>
      );
    case "QUOTATION":
      return (
        <Badge
          variant="outline"
          className={cn(
            "bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border-indigo-500/30 font-medium px-2 py-0.5",
            className
          )}
        >
          <span className="mr-1.5 h-1.5 w-1.5 rounded-full bg-indigo-500 inline-block" />
          Quotation
        </Badge>
      );
    case "DRAFT":
      return (
        <Badge
          variant="outline"
          className={cn(
            "bg-slate-500/10 text-slate-700 dark:text-slate-400 border-slate-500/30 font-medium px-2 py-0.5",
            className
          )}
        >
          <span className="mr-1.5 h-1.5 w-1.5 rounded-full bg-slate-400 inline-block" />
          Draft
        </Badge>
      );
    case "CLOSED":
      return (
        <Badge
          variant="outline"
          className={cn(
            "bg-zinc-500/10 text-zinc-600 dark:text-zinc-400 border-zinc-500/30 font-medium px-2 py-0.5",
            className
          )}
        >
          <span className="mr-1.5 h-1.5 w-1.5 rounded-full bg-zinc-400 inline-block" />
          Closed
        </Badge>
      );
    case "CANCELLED":
      return (
        <Badge
          variant="outline"
          className={cn(
            "bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/30 font-medium px-2 py-0.5",
            className
          )}
        >
          <span className="mr-1.5 h-1.5 w-1.5 rounded-full bg-red-500 inline-block" />
          Cancelled
        </Badge>
      );
    default:
      return (
        <Badge variant="outline" className={cn("font-medium", className)}>
          {status}
        </Badge>
      );
  }
}

