"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { formatINR } from "@/lib/money";
import { formatDate } from "@/lib/dates";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { InvoiceStatus } from "@/generated/prisma/enums";
import { bulkConfirmAction } from "@/app/actions/invoices";
import { toast } from "sonner";
import { CheckSquare, Search, FileText, CheckCircle2 } from "lucide-react";

interface InvoiceRow {
  id: string;
  number: string;
  status: InvoiceStatus;
  issueDate: Date | string;
  dueDate: Date | string;
  total: number;
  amountPaid: number;
  balance: number;
  isOverdue: boolean;
  customer: {
    name: string;
    email: string;
  };
}

interface InvoicesTableClientProps {
  invoices: InvoiceRow[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
  currentView: string;
  currentStatus?: string;
  searchQuery?: string;
}

export function InvoicesTableClient({
  invoices,
  totalCount,
  page,
  totalPages,
  currentView,
  currentStatus,
  searchQuery,
}: InvoicesTableClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isBulkConfirming, setIsBulkConfirming] = useState(false);
  const [search, setSearch] = useState(searchQuery || "");

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams(searchParams.toString());
    if (search.trim()) {
      params.set("search", search.trim());
    } else {
      params.delete("search");
    }
    params.set("page", "1");
    router.push(`/admin/invoices?${params.toString()}`);
  };

  const handleViewChange = (newView: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("view", newView);
    params.delete("status");
    params.set("page", "1");
    router.push(`/admin/invoices?${params.toString()}`);
  };

  const handleStatusChange = (newStatus: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("view");
    if (newStatus === "ALL") {
      params.delete("status");
    } else {
      params.set("status", newStatus);
    }
    params.set("page", "1");
    router.push(`/admin/invoices?${params.toString()}`);
  };

  const handleToggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const handleSelectAllDrafts = () => {
    const draftIds = invoices
      .filter((inv) => inv.status === InvoiceStatus.DRAFT)
      .map((inv) => inv.id);

    if (draftIds.every((id) => selectedIds.includes(id))) {
      setSelectedIds((prev) => prev.filter((id) => !draftIds.includes(id)));
    } else {
      setSelectedIds((prev) => Array.from(new Set([...prev, ...draftIds])));
    }
  };

  const handleBulkConfirm = async () => {
    if (selectedIds.length === 0) return;
    setIsBulkConfirming(true);
    try {
      const res = await bulkConfirmAction(selectedIds);
      if (res.ok && res.data) {
        const { confirmed, reconfirmRequired, failed } = res.data;
        if (confirmed.length > 0) {
          toast.success(`Successfully confirmed ${confirmed.length} invoice(s)`);
        }
        if (reconfirmRequired.length > 0) {
          toast.warning(
            `${reconfirmRequired.length} invoice(s) skipped due to exhausted discounts. Review them in Draft.`
          );
        }
        if (failed.length > 0) {
          toast.error(`${failed.length} invoice(s) failed to confirm`);
        }
        setSelectedIds([]);
        router.refresh();
      } else {
        toast.error(res.error || "Bulk confirm failed");
      }
    } catch {
      toast.error("An error occurred during bulk confirm");
    } finally {
      setIsBulkConfirming(false);
    }
  };

  const draftCount = invoices.filter((inv) => inv.status === InvoiceStatus.DRAFT).length;

  return (
    <div className="space-y-4">
      {/* Top filter tabs & Search */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        {/* Quick View Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          <Button
            type="button"
            size="sm"
            variant={currentView === "all" && !currentStatus ? "default" : "outline"}
            onClick={() => handleViewChange("all")}
          >
            All
          </Button>
          <Button
            type="button"
            size="sm"
            variant={currentView === "outstanding" ? "default" : "outline"}
            onClick={() => handleViewChange("outstanding")}
          >
            Outstanding
          </Button>
          <Button
            type="button"
            size="sm"
            variant={currentView === "overdue" ? "destructive" : "outline"}
            onClick={() => handleViewChange("overdue")}
          >
            Overdue
          </Button>
          <Button
            type="button"
            size="sm"
            variant={currentStatus === InvoiceStatus.DRAFT ? "default" : "outline"}
            onClick={() => handleStatusChange(InvoiceStatus.DRAFT)}
          >
            Drafts
          </Button>
          <Button
            type="button"
            size="sm"
            variant={currentStatus === InvoiceStatus.PAID ? "default" : "outline"}
            onClick={() => handleStatusChange(InvoiceStatus.PAID)}
          >
            Paid
          </Button>
        </div>

        {/* Search Bar */}
        <form onSubmit={handleSearchSubmit} className="flex items-center gap-2 max-w-sm">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search by invoice # or client..."
              className="pl-8 text-sm"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Button type="submit" size="sm" variant="secondary">
            Search
          </Button>
        </form>
      </div>

      {/* Bulk actions bar (shown when drafts are selected or present) */}
      {draftCount > 0 && (
        <div className="flex items-center justify-between bg-muted/40 p-2.5 rounded-lg border text-sm">
          <div className="flex items-center gap-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleSelectAllDrafts}
            >
              <CheckSquare className="w-3.5 h-3.5 mr-1.5" />
              {invoices.filter((inv) => inv.status === InvoiceStatus.DRAFT).every((inv) => selectedIds.includes(inv.id))
                ? "Deselect All Drafts"
                : "Select All Drafts"}
            </Button>
            <span className="text-xs text-muted-foreground">
              {selectedIds.length} invoice(s) selected
            </span>
          </div>

          <Button
            type="button"
            size="sm"
            onClick={handleBulkConfirm}
            disabled={selectedIds.length === 0 || isBulkConfirming}
          >
            <CheckCircle2 className="w-4 h-4 mr-1.5" />
            {isBulkConfirming ? "Confirming..." : `Bulk Confirm (${selectedIds.length})`}
          </Button>
        </div>
      )}

      {/* Invoices Table */}
      <div className="rounded-md border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10"></TableHead>
              <TableHead>Invoice #</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Issue Date</TableHead>
              <TableHead>Due Date</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead className="text-right">Balance</TableHead>
              <TableHead className="text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {invoices.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="p-8 text-center">
                  <EmptyState
                    icon={FileText}
                    title="No invoices found"
                    description="No invoices match the current filter criteria or search query."
                  />
                </TableCell>
              </TableRow>
            ) : (
              invoices.map((inv) => {
                const isDraft = inv.status === InvoiceStatus.DRAFT;
                const isSelected = selectedIds.includes(inv.id);

                return (
                  <TableRow key={inv.id}>
                    <TableCell>
                      {isDraft && (
                        <input
                          type="checkbox"
                          className="rounded border-input text-primary focus:ring-ring"
                          checked={isSelected}
                          onChange={() => handleToggleSelect(inv.id)}
                        />
                      )}
                    </TableCell>
                    <TableCell className="font-medium font-mono">
                      <Link
                        href={`/admin/invoices/${inv.id}`}
                        className="text-primary hover:underline"
                      >
                        {inv.number}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium text-sm leading-none">{inv.customer.name}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{inv.customer.email}</p>
                      </div>
                    </TableCell>
                    <TableCell className="text-xs">
                      {formatDate(inv.issueDate)}
                    </TableCell>
                    <TableCell className="text-xs">
                      {formatDate(inv.dueDate)}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={inv.status} isOverdue={inv.isOverdue} />
                    </TableCell>
                    <TableCell className="text-right font-medium text-sm">
                      {formatINR(inv.total)}
                    </TableCell>
                    <TableCell className="text-right font-semibold text-sm">
                      {inv.balance > 0 ? (
                        <span className={inv.isOverdue ? "text-red-600" : "text-amber-700"}>
                          {formatINR(inv.balance)}
                        </span>
                      ) : (
                        <span className="text-green-700">₹0.00</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Link href={`/admin/invoices/${inv.id}`}>
                        <Button variant="ghost" size="sm">
                          <FileText className="w-4 h-4 mr-1" />
                          View
                        </Button>
                      </Link>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination Controls */}
      <div className="flex items-center justify-between text-xs text-muted-foreground px-2">
        <span>
          Showing {invoices.length} of {totalCount} invoices
        </span>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => {
              const params = new URLSearchParams(searchParams.toString());
              params.set("page", String(page - 1));
              router.push(`/admin/invoices?${params.toString()}`);
            }}
          >
            Previous
          </Button>
          <span>
            Page {page} of {totalPages || 1}
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => {
              const params = new URLSearchParams(searchParams.toString());
              params.set("page", String(page + 1));
              router.push(`/admin/invoices?${params.toString()}`);
            }}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}
