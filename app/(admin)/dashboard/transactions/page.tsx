"use client";

import { useState, useEffect, useCallback } from "react";
import { apiClient } from "@/lib/api";
import { DataTable } from "@/components/admin/DataTable";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Filter } from "lucide-react";
import type { Transaction } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";
import { usePageTitle } from "@/hooks/use-page-title";
import { useAuth } from "@/lib/auth-context";
import SocketClient from "@/lib/socket.util";

export const formatCurrency = (n: number, currency: string) => {
  return `${currency} ${n.toLocaleString()}`;
}

export default function TransactionsPage() {
  usePageTitle("Transactions");
  const { toast } = useToast();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");
  const { isRole, user } = useAuth();
  const isSuperAdmin = isRole("super_admin");

  const load = useCallback(async (showLoading: boolean = true) => {
    try {
      setLoading(showLoading);
      const { data } = await apiClient.transactions.list({ status: statusFilter !== "all" ? statusFilter : undefined });
      setTransactions(data);
    } catch {
      setTransactions([]);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

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

  const filtered = statusFilter === "all" ? transactions : transactions.filter(t => t.status === statusFilter);



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
    { key: "reference", label: "Reference", render: (v: unknown) => <code className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">{String(v)}</code> },
    { key: "customer", label: "Customer" },
    { key: "status", label: "Status", render: (v: unknown) => <StatusBadge status={String(v).toLowerCase()} /> },
    { key: "createdAt", label: "Date", render: (v: unknown) => new Date(String(v)).toLocaleDateString() },
  ].filter(Boolean);

  return (
    <div className="flex flex-col gap-6">

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Transactions</h1>
          <p className="text-sm text-muted-foreground mt-1">Collected payments from customers</p>
        </div>

      </div>

      <DataTable
        data={filtered as unknown as Record<string, unknown>[]}
        columns={columns as never}
        loading={loading}
        searchable
        searchKeys={["customer", "reference", "tenant", "package"] as never}
        searchPlaceholder="transactions"
        emptyMessage="No transactions found."
        pageSize={10}
        filterSlot={
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-10 w-44 bg-background">
              <Filter className="h-3.5 w-3.5 mr-2 text-muted-foreground" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="COMPLETED">Paid</SelectItem>
              <SelectItem value="PEMDING">Pending</SelectItem>
              <SelectItem value="FAILED">Failed</SelectItem>
            </SelectContent>
          </Select>
        }
      />
    </div>
  );
}
