"use client";

import * as React from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";

export interface ColumnDef<T> {
  header: React.ReactNode;
  accessorKey?: keyof T | string;
  cell?: (row: T) => React.ReactNode;
  className?: string;
}

export interface DataTableProps<T> {
  columns: ColumnDef<T>[];
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  searchPlaceholder?: string;
  emptyMessage?: string;
  actions?: React.ReactNode;
  searchValue?: string;
  onSearch?: (search: string) => void;
  onPageChange?: (newPage: number) => void;
  showSearch?: boolean;
}

export function DataTable<T>({
  columns,
  data,
  total,
  page,
  pageSize,
  searchPlaceholder = "Search...",
  emptyMessage = "No results found.",
  actions,
  searchValue,
  onSearch,
  onPageChange,
  showSearch = true,
}: DataTableProps<T>) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const currentSearchFromParams = searchParams?.get("search") || "";
  const [searchTerm, setSearchTerm] = React.useState(
    searchValue !== undefined ? searchValue : currentSearchFromParams
  );

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  function handleNavigate(newPage: number, newSearch?: string) {
    if (onPageChange) {
      onPageChange(newPage);
      return;
    }
    const params = new URLSearchParams(searchParams?.toString() || "");
    params.set("page", newPage.toString());
    const searchVal = newSearch !== undefined ? newSearch : (searchParams?.get("search") || "");
    if (searchVal) {
      params.set("search", searchVal);
    } else {
      params.delete("search");
    }
    router.push(`${pathname}?${params.toString()}`);
  }

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (onSearch) {
      onSearch(searchTerm);
      return;
    }
    const params = new URLSearchParams(searchParams?.toString() || "");
    params.set("page", "1");
    if (searchTerm.trim()) {
      params.set("search", searchTerm.trim());
    } else {
      params.delete("search");
    }
    router.push(`${pathname}?${params.toString()}`);
  }

  const startRecord = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const endRecord = Math.min(page * pageSize, total);

  return (
    <div className="space-y-4">
      {(showSearch || actions) && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          {showSearch ? (
            <form onSubmit={handleSearchSubmit} className="relative w-full sm:w-72 flex items-center">
              <Search className="absolute left-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder={searchPlaceholder}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8 text-sm"
              />
            </form>
          ) : (
            <div />
          )}
          {actions && <div className="flex items-center gap-2 self-end sm:self-auto">{actions}</div>}
        </div>
      )}

      <div className="rounded-md border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map((col, idx) => (
                <TableHead key={idx} className={col.className}>
                  {col.header}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-32 text-center text-muted-foreground text-sm"
                >
                  {emptyMessage}
                </TableCell>
              </TableRow>
            ) : (
              data.map((row, rowIdx) => (
                <TableRow key={rowIdx}>
                  {columns.map((col, colIdx) => (
                    <TableCell key={colIdx} className={col.className}>
                      {col.cell
                        ? col.cell(row)
                        : col.accessorKey
                        ? String((row as Record<string, unknown>)[col.accessorKey as string] ?? "")
                        : null}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex flex-col sm:flex-row items-center justify-between gap-2 px-1 text-xs text-muted-foreground">
        <div>
          Showing {startRecord} to {endRecord} of {total} entries
        </div>
        <div className="flex items-center space-x-2">
          <span>
            Page {page} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleNavigate(page - 1)}
            disabled={page <= 1}
            className="h-8 px-2"
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleNavigate(page + 1)}
            disabled={page >= totalPages}
            className="h-8 px-2"
          >
            Next
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      </div>
    </div>
  );
}
