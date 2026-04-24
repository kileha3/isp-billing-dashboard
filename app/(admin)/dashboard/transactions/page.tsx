"use client";

import { useState, useEffect, useCallback } from "react";
import { apiClient } from "@/lib/api";
import { DataTable } from "@/components/admin/DataTable";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Filter, Calendar } from "lucide-react";
import type { Transaction } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";
import { usePageTitle } from "@/hooks/use-page-title";
import { useAuth } from "@/lib/auth-context";
import SocketClient from "@/lib/socket.util";
import { DateRange } from "react-day-picker";
import { addDays, format as formatDate } from "date-fns";
import { DayPicker } from "react-day-picker";
import "react-day-picker/style.css";

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
        startDate: formatDate(dateRange.from, 'yyyy-MM-dd'),
        endDate: formatDate(dateRange.to, 'yyyy-MM-dd')
      } : {};
      
      const { data } = await apiClient.transactions.list(dateFilter);
      setTransactions(data);
    } catch {
      setTransactions([]);
    } finally {
      setLoading(false);
    }
  }, [ dateRange]);

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
    if (!dateRange?.to) return formatDate(dateRange.from, "MMM dd, yyyy");
    return `${formatDate(dateRange.from, "MMM dd")} - ${formatDate(dateRange.to, "MMM dd, yyyy")}`;
  };

  // Apply client-side date filtering as fallback
  const getFilteredTransactions = () => {
    let filtered = statusFilter === "all" ? transactions : transactions.filter(t => t.status === statusFilter);
    filtered = categoryFilter === "all" ? filtered : filtered.filter(t => t.source === categoryFilter);
    
    return filtered;
  };

  const filteredTransactions = getFilteredTransactions();

  const columns = [
    { key: "appliedVoucher", label: "Voucher" },
    isSuperAdmin ? { key: "tenant", label: "Tenant", render: (v: unknown) => (v as any)?.name } : null,
    { key: "package", label: "Package", render: (v: unknown) => (v as any)?.name },
    { key: "router", label: "Router", render: (v: unknown) => (v as any)?.name },
    { key: "paymentMethod", label: "Method", render: (v: unknown) => <span className="capitalize">{String(v)}</span> },
    { key: "source", label: "Category", render: (v: unknown) => <span className="capitalize">{String(v)}</span> },
    {
      key: "amount", label: "Amount", render: (v: unknown, row: unknown) => {
        const payment = row as Transaction;
        return <span className="font-semibold tabular-nums">{formatCurrency(Number(v), payment.currency)}</span>;
      }
    },
    { key: "customer", label: "Customer" },
    { key: "status", label: "Status", render: (v: unknown) => <StatusBadge status={String(v).toLowerCase()} /> },
    { key: "createdAt", label: "Date", render: (v: unknown) => new Date(String(v)).toLocaleDateString() },
  ].filter(Boolean);

  // Calculate summary statistics for the filtered transactions
  const totalAmount = filteredTransactions.reduce((sum, t) => sum + t.amount, 0);
  const completedCount = filteredTransactions.filter(t => t.status === "COMPLETED").length;
  const pendingCount = filteredTransactions.filter(t => t.status === "PENDING").length;
  const failedCount = filteredTransactions.filter(t => t.status === "FAILED").length;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Transactions</h1>
          <p className="text-sm text-muted-foreground mt-1">Collected payments from customers</p>
        </div>
        
        {/* Date Range Picker */}
        <div className="relative">
          <button
            onClick={() => setShowDatePicker(!showDatePicker)}
            className="flex items-center gap-2 px-3 py-2 text-sm rounded-lg border border-border bg-card hover:bg-muted/20 transition-colors"
          >
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium">{formatDateRange()}</span>
          </button>
          
          {showDatePicker && (
            <>
              <div 
                className="fixed inset-0 z-40" 
                onClick={() => setShowDatePicker(false)}
              />
              <div className="absolute right-0 top-full mt-2 z-50 bg-card border border-border rounded-lg shadow-lg p-3">
                <DayPicker
                  mode="range"
                  selected={dateRange}
                  onSelect={handleDateRangeSelect}
                  numberOfMonths={2}
                  defaultMonth={dateRange?.from}
                />
              </div>
            </>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-sm text-muted-foreground">Total Amount</p>
          <p className="text-2xl font-bold">
            {transactions.length > 0 && filteredTransactions.length > 0 
              ? formatCurrency(totalAmount, transactions[0]?.currency || "TZS")
              : "—"}
          </p>
          <p className="text-xs text-muted-foreground mt-1">{filteredTransactions.length} transactions</p>
        </div>
        
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-sm text-muted-foreground">Completed</p>
          <p className="text-2xl font-bold text-green-600">{completedCount}</p>
          <p className="text-xs text-muted-foreground mt-1">
            {filteredTransactions.length > 0 
              ? `${((completedCount / filteredTransactions.length) * 100).toFixed(1)}% of total`
              : "0% of total"}
          </p>
        </div>
        
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-sm text-muted-foreground">Pending</p>
          <p className="text-2xl font-bold text-yellow-600">{pendingCount}</p>
          <p className="text-xs text-muted-foreground mt-1">
            {filteredTransactions.length > 0 
              ? `${((pendingCount / filteredTransactions.length) * 100).toFixed(1)}% of total`
              : "0% of total"}
          </p>
        </div>
        
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-sm text-muted-foreground">Failed</p>
          <p className="text-2xl font-bold text-red-600">{failedCount}</p>
          <p className="text-xs text-muted-foreground mt-1">
            {filteredTransactions.length > 0 
              ? `${((failedCount / filteredTransactions.length) * 100).toFixed(1)}% of total`
              : "0% of total"}
          </p>
        </div>
      </div>

      <DataTable
        data={filteredTransactions as unknown as Record<string, unknown>[]}
        columns={columns as never}
        loading={loading}
        searchable
        searchKeys={["amount", "package"] as never}
        searchPlaceholder="Search transactions..."
        emptyMessage={dateRange?.from && dateRange?.to 
          ? `No transactions found for ${formatDateRange()}`
          : "No transactions found."}
        pageSize={10}
        filterSlot={
          <div className="flex items-center gap-2">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="h-10 w-44 bg-background">
                <Filter className="h-3.5 w-3.5 mr-2 text-muted-foreground" />
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
              <SelectTrigger className="h-10 w-44 bg-background">
                <Filter className="h-3.5 w-3.5 mr-2 text-muted-foreground" />
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
      />
    </div>
  );
}