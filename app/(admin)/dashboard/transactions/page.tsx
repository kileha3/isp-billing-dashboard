"use client";

import { useState, useEffect, useCallback } from "react";
import { apiClient } from "@/lib/api";
import { DataTable } from "@/components/admin/DataTable";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download, Filter } from "lucide-react";
import type { Transaction } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";
import { usePageTitle } from "@/hooks/use-page-title";

const MOCK_TXS: Transaction[] = Array.from({ length: 20 }, (_, i) => ({
  _id: String(i + 1),
  amount: [50, 100, 500, 200, 2000, 1200][i % 6],
  status: (["paid", "paid", "paid", "pending", "failed"] as const)[i % 5],
  customerPhone: `+2547${Math.floor(10000000 + Math.random() * 89999999)}`,
  paymentMethod: (["mpesa", "airtel", "voucher"] as const)[i % 3],
  reference: `REF${Math.random().toString(36).substring(2, 10).toUpperCase()}`,
  packageId: { _id: "2", name: "Daily 1GB" },
  tenantId: "t1",
  routerId: "r1",
  createdAt: new Date(Date.now() - i * 3600000 * 2).toISOString(),
  updatedAt: new Date().toISOString(),
}));

export default function TransactionsPage() {
  usePageTitle("Transactions");
  const { toast } = useToast();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");

  const load = useCallback(async () => {
    try {
      const data = await apiClient.transactions.list({ status: statusFilter !== "all" ? statusFilter : undefined });
      setTransactions(data.transactions ?? data);
    } catch {
      setTransactions(MOCK_TXS);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => { load(); }, [load]);

  const filtered = statusFilter === "all" ? transactions : transactions.filter(t => t.status === statusFilter);

  const totalRevenue = filtered.filter(t => t.status === "paid").reduce((sum, t) => sum + t.amount, 0);

  function formatCurrency(n: number) {
    return `KES ${n.toLocaleString()}`;
  }

  const columns = [
    { key: "reference", label: "Reference", render: (v: unknown) => <code className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">{String(v)}</code> },
    { key: "customerPhone", label: "Customer" },
    { key: "packageId", label: "Package", render: (v: unknown) => (v as { name: string })?.name ?? "Voucher" },
    { key: "paymentMethod", label: "Method", render: (v: unknown) => <span className="capitalize">{String(v)}</span> },
    { key: "amount", label: "Amount", render: (v: unknown) => <span className="font-semibold tabular-nums">{formatCurrency(Number(v))}</span> },
    { key: "status", label: "Status", render: (v: unknown) => <StatusBadge status={String(v)} /> },
    { key: "createdAt", label: "Date", render: (v: unknown) => new Date(String(v)).toLocaleDateString("en-KE", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Transactions</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Revenue: <span className="font-semibold text-foreground">{formatCurrency(totalRevenue)}</span> from {filtered.filter(t => t.status === "paid").length} payments
          </p>
        </div>
        <Button variant="outline" onClick={() => toast({ title: "Export coming soon" })}>
          <Download className="h-4 w-4 mr-2" />
          Export
        </Button>
      </div>

      <DataTable
        data={filtered as unknown as Record<string, unknown>[]}
        columns={columns as never}
        loading={loading}
        searchable
        searchKeys={["customerPhone", "reference"] as never}
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
              <SelectItem value="paid">Paid</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="failed">Failed</SelectItem>
            </SelectContent>
          </Select>
        }
      />
    </div>
  );
}
