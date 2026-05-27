"use client";

import { useState, useEffect, useCallback } from "react";
import { apiClient } from "@/lib/api";
import { DataTable } from "@/components/admin/DataTable";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Filter, Calendar, Trash2, RefreshCcwDot, MoreHorizontal } from "lucide-react";
import type { Transaction } from "@/lib/types";
import { usePageTitle } from "@/hooks/use-page-title";
import { useAuth } from "@/lib/auth-context";
import SocketClient from "@/lib/socket.util";
import { DateRange } from "react-day-picker";
import { addDays, format as formatDateFn } from "date-fns";
import { DayPicker } from "react-day-picker";
import "react-day-picker/style.css";
import { formatDate } from "@/lib/utils";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useToast } from "@/hooks/use-toast";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";

export const formatCurrency = (n: number, currency: string) => {
  return `${currency} ${n.toLocaleString()}`;
}

export default function TransactionsPage() {
  usePageTitle("Transactions");
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const { isRole, user } = useAuth();
  const isSuperAdmin = isRole("super_admin");
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const { toast } = useToast();

  // Date range state - initialize to last 7 days
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: addDays(new Date(), -7),
    to: addDays(new Date(), 1),
  });

  const load = useCallback(async (showLoading: boolean = true) => {
    try {
      setLoading(showLoading);
      // Pass date range to API calls if they support it
      const dateFilter = dateRange?.from && dateRange?.to ? {
        startDate: formatDateFn(dateRange.from, 'yyyy-MM-dd'),
        endDate: formatDateFn(dateRange.to, 'yyyy-MM-dd')
      } : {};

      const data = await apiClient.transactions.list(dateFilter);
      setTransactions(data);
    } catch {
      setTransactions([]);
    } finally {
      setLoading(false);
    }
  }, [dateRange]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    let unsubscribe: (() => void) | null = null;
    (async () => {
      const event = SocketClient.event_transaction_sync;
      unsubscribe = await SocketClient.subscribe(event, user?.tenantId ?? event, (_) => load(false));
    })();

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [user]);

  // Handle date range selection
  const handleDateRangeSelect = (range: DateRange | undefined) => {
    setDateRange(range);
    setShowDatePicker(false);
  };

  // Format display date range
  const formatDateRange = () => {
    if (!dateRange?.from) return "Select date range";
    if (!dateRange?.to) return formatDateFn(dateRange.from, "MMM dd, yyyy");
    return `${formatDateFn(dateRange.from, "MMM dd")} - ${formatDateFn(dateRange.to, "MMM dd, yyyy")}`;
  };

  // Format date range for confirmation message
  const formatDateRangeForMessage = () => {
    if (!dateRange?.from && !dateRange?.to) return "all time";
    if (dateRange?.from && !dateRange?.to) return `since ${formatDateFn(dateRange.from, "MMMM dd, yyyy")}`;
    if (!dateRange?.from && dateRange?.to) return `up to ${formatDateFn(dateRange.to, "MMMM dd, yyyy")}`;
    return `from ${formatDateFn(dateRange.from!, "MMMM dd, yyyy")} to ${formatDateFn(dateRange.to!, "MMMM dd, yyyy")}`;
  };

  // Delete failed transactions
  const handleDeleteFailedTransactions = async () => {
    setDeleting(true);
    try {
      const failedTransactions = transactions.filter(
        t => t.status.toLowerCase() === "failed"
      );

      if (failedTransactions.length === 0) {
        toast({
          title: "No failed transactions",
          description: "There are no failed transactions to delete.",
          variant: "default"
        });
        setShowDeleteConfirm(false);
        return;
      }

      // Call API to delete failed transactions
      const { success, message } = await apiClient.transactions.deleteFailed({
        startDate: formatDateFn(dateRange?.from || new Date(), 'yyyy-MM-dd'),
        endDate: formatDateFn(dateRange?.to || new Date(), 'yyyy-MM-dd')
      });

      toast({
        title: success ? "Success" : "Failed",
        description: message || `${failedTransactions.length} failed transaction(s) have been deleted.`,
        variant: "default"
      });

      // Reload transactions
      await load(false);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to delete failed transactions.",
        variant: "destructive"
      });
    } finally {
      setDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  // Get count of failed transactions in current view
  const getFailedCount = () => {
    return filteredTransactions.filter(t => t.status.toLowerCase() === "failed").length;
  };

  // Apply client-side date filtering as fallback
  const getFilteredTransactions = () => {
    let filtered = statusFilter === "all" ? transactions : transactions.filter(t => t.status.toLowerCase() === statusFilter.toLowerCase());
    filtered = categoryFilter === "all" ? filtered : filtered.filter(t => t.source === categoryFilter);

    return filtered;
  };

  const filteredTransactions = getFilteredTransactions();
  const failedCount = getFailedCount();

  const columns = [
    { key: "appliedVoucher", label: "Voucher", render: (v: unknown, row: unknown) => (row as any)?.appliedVoucher || "-" },
    isSuperAdmin ? { key: "tenant", label: "Tenant", render: (v: unknown) => (v as any)?.name } : null,
    { key: "package", label: "Package", render: (v: unknown) => (v as any)?.name },
    isSuperAdmin ? null : { key: "router", label: "Router", render: (v: unknown) => (v as any)?.name },
    { key: "paymentMethod", label: "Method", render: (v: unknown) => <span className="capitalize">{String(v)}</span> },
    { key: "source", label: "Category", render: (v: unknown) => <span className="capitalize">{String(v)}</span> },
    {
      key: "amount", label: "Amount", render: (v: unknown, row: unknown) => {
        const payment = row as Transaction;
        return <span className="font-semibold tabular-nums">{formatCurrency(Number(v), payment.currency)}</span>;
      }
    },
    isSuperAdmin ? null : { key: "customer", label: "Customer" },
    { key: "status", label: "Status", render: (v: unknown) => <StatusBadge status={String(v).toLowerCase()} /> },
    { key: "createdAt", label: "Date", render: (v: unknown) => formatDate(v) },
  ].filter(Boolean);

  // Calculate summary statistics for the filtered transactions
  const totalAmount = filteredTransactions.filter(t => t.status.toLowerCase() === "completed" && t.amount > 0).reduce((sum, t) => sum + t.amount, 0);
  const completedCount = filteredTransactions.filter(t => t.status.toLowerCase() === "completed" && t.amount > 0).length;
  const pendingCount = filteredTransactions.filter(t => t.status.toLowerCase() === "pending" && t.amount > 0).length;

  // Generate confirmation message with date range
  const getConfirmationMessage = () => {
    const dateRangeText = formatDateRangeForMessage();
    if (failedCount === 0) {
      return `No failed transactions found ${dateRangeText !== "all time" ? `for ${dateRangeText}` : ""}.`;
    }
    return `Are you sure you want to delete ${failedCount} failed transaction(s) ${dateRangeText !== "all time" ? `for ${dateRangeText}` : ""}? This action cannot be undone.`;
  };

  return (
    <div className="flex flex-col gap-4 md:gap-6">
      {/* Header Section - Mobile Responsive */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-semibold tracking-tight">Transactions</h1>
          <p className="text-xs md:text-sm text-muted-foreground mt-0.5 md:mt-1">Collected payments from customers</p>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3">
          {/* Delete Failed Transactions Button */}
          {failedCount > 0 && (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="flex items-center justify-center gap-2 px-3 py-2 text-sm rounded-lg bg-red-600 hover:bg-red-700 text-white transition-colors"
              disabled={deleting}
            >
              <Trash2 className="h-4 w-4" />
              <span className="whitespace-nowrap">Delete Failed</span>
            </button>
          )}

          {/* Date Range Picker */}
          <div className="relative w-full sm:w-auto">
            <button
              onClick={() => setShowDatePicker(!showDatePicker)}
              className="flex items-center justify-center gap-2 px-3 py-2 text-sm rounded-lg border border-border bg-card hover:bg-muted/20 transition-colors w-full sm:w-auto"
            >
              <Calendar className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              <span className="font-medium truncate max-w-[200px] sm:max-w-none">
                {formatDateRange()}
              </span>
            </button>

            {showDatePicker && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setShowDatePicker(false)}
                />
                <div className="absolute right-0 left-0 sm:left-auto top-full mt-2 z-50 bg-card border border-border rounded-lg shadow-lg p-3 w-full sm:w-auto">
                  <DayPicker
                    mode="range"
                    selected={dateRange}
                    onSelect={handleDateRangeSelect}
                    numberOfMonths={1}
                    defaultMonth={dateRange?.from}
                    className="mx-auto"
                  />
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Summary Cards - Mobile Responsive Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        <div className="rounded-lg border border-border bg-card p-3 md:p-4">
          <p className="text-xs md:text-sm text-muted-foreground">Total Amount</p>
          <p className="text-base md:text-2xl font-bold truncate">
            {transactions.length > 0 && filteredTransactions.length > 0
              ? formatCurrency(totalAmount, transactions[0]?.currency || "TZS")
              : "—"}
          </p>
          <p className="text-[10px] md:text-xs text-muted-foreground mt-0.5 md:mt-1">{filteredTransactions.length} transactions</p>
        </div>

        <div className="rounded-lg border border-border bg-card p-3 md:p-4">
          <p className="text-xs md:text-sm text-muted-foreground">Completed</p>
          <p className="text-base md:text-2xl font-bold text-green-600">{completedCount}</p>
          <p className="text-[10px] md:text-xs text-muted-foreground mt-0.5 md:mt-1">
            {filteredTransactions.length > 0
              ? `${((completedCount / filteredTransactions.length) * 100).toFixed(1)}%`
              : "0%"}
          </p>
        </div>

        <div className="rounded-lg border border-border bg-card p-3 md:p-4">
          <p className="text-xs md:text-sm text-muted-foreground">Pending</p>
          <p className="text-base md:text-2xl font-bold text-yellow-600">{pendingCount}</p>
          <p className="text-[10px] md:text-xs text-muted-foreground mt-0.5 md:mt-1">
            {filteredTransactions.length > 0
              ? `${((pendingCount / filteredTransactions.length) * 100).toFixed(1)}%`
              : "0%"}
          </p>
        </div>

        <div className="rounded-lg border border-border bg-card p-3 md:p-4">
          <p className="text-xs md:text-sm text-muted-foreground">Failed</p>
          <p className="text-base md:text-2xl font-bold text-red-600">{failedCount}</p>
          <p className="text-[10px] md:text-xs text-muted-foreground mt-0.5 md:mt-1">
            {filteredTransactions.length > 0
              ? `${((failedCount / filteredTransactions.length) * 100).toFixed(1)}%`
              : "0%"}
          </p>
        </div>
      </div>

      {/* Filter Section - Mobile Responsive */}
      <div className="overflow-x-auto">
        <DataTable
          data={filteredTransactions as unknown as Record<string, unknown>[]}
          columns={columns as never}
          loading={loading}
          searchable
          searchKeys={["amount", "customer", "package", "appliedVoucher"] as never}
          searchPlaceholder="Search transactions..."
          emptyMessage={dateRange?.from && dateRange?.to
            ? `No transactions found for ${formatDateRange()}`
            : "No transactions found."}
          pageSize={10}
          filterSlot={
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="h-10 w-full sm:w-44 bg-background">
                  <Filter className="h-3.5 w-3.5 mr-2 text-muted-foreground flex-shrink-0" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="COMPLETED">Paid</SelectItem>
                  <SelectItem value="PENDING">Pending</SelectItem>
                  <SelectItem value="FAILED">Failed</SelectItem>
                </SelectContent>
              </Select>

              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="h-10 w-full sm:w-44 bg-background">
                  <Filter className="h-3.5 w-3.5 mr-2 text-muted-foreground flex-shrink-0" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  <SelectItem value="voucher">Voucher</SelectItem>
                  <SelectItem value="mobile">Mobile</SelectItem>
                </SelectContent>
              </Select>
            </div>
          }

          actions={(row) => {
            const r = row as unknown as Transaction;
            return (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-7 w-7">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                {r.status.toLowerCase() !== "completed" && (<DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => {
                    toast({
                      title: "Transaction Sync",
                      description: "Syncying transaction status...",
                      variant: "default"
                    });
                    apiClient.transactions.reprocess(r._id).then(() => load(false));
                  }}>
                    <RefreshCcwDot className="mr-2 h-4 w-4" />
                    Sync Transaction
                  </DropdownMenuItem>

                </DropdownMenuContent>)}
              </DropdownMenu>
            );
          }}
        />
      </div>

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        open={showDeleteConfirm}
        title="Delete Failed Transactions"
        message={getConfirmationMessage()}
        confirmText={deleting ? "Deleting..." : "Delete"}
        cancelText="Cancel"
        onCancel={() => setShowDeleteConfirm(false)}
        onConfirm={handleDeleteFailedTransactions}
        variant="destructive"
      />
    </div>
  );
}