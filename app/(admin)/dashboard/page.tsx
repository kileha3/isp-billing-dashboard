"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import { usePageTitle } from "@/hooks/use-page-title";
import { apiClient } from "@/lib/api";
import { StatCard } from "@/components/admin/StatCard";
import { StatusBadge } from "@/components/admin/StatusBadge";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import {
  Router,
  Users,
  CreditCard,
  Activity,
  Ticket,
  Package,
  TrendingUp,
} from "lucide-react";
import { formatCurrency } from "./transactions/page";
import { Transaction } from "@/lib/types";
import SocketClient from "@/lib/socket.util";


function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-KE", { hour: "2-digit", minute: "2-digit" });
}

// Custom tooltip for charts
function ChartTooltip({ active, payload, label, formatter }: {
  active?: boolean;
  payload?: { value: number }[];
  label?: string;
  formatter: (v: number) => string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2 shadow-sm text-sm">
      <p className="text-muted-foreground mb-0.5">{label}</p>
      <p className="font-semibold text-foreground">{formatter(payload[0].value)}</p>
    </div>
  );
}

export default function DashboardPage() {
  usePageTitle("Dashboard");
  const { user, loading: authLoading, isRole } = useAuth();
  const [routerStats, setRouterStats] = useState<any>(null);
  const [voucherStats, setVoucherStats] = useState<any>(null);
  const [packageStats, setPackageStats] = useState<any>(null);
  const [paymentStats, setPaymentStats] = useState<any>(null);
  const [currency, setCurrency] = useState<string>("TZS");
  const [session, setSession] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const isSuperAdmin = isRole("super_admin");
  const [recentTransactions, setRecentTransaction] = useState<Array<Transaction>>([])
  const [transReport, setTransReport] = useState<any>(null)


  const load = useCallback(async () => {
    try {
      const [{ routers, vouchers, packages, payments, sessions }, { data: { settings: { currency } } }, { data: transactions }, report] = await Promise.all([
        apiClient.dashboard.getStats(),
        isSuperAdmin ? { data: { settings: { currency: "TZS" } } } : apiClient.tenant.get(user?.tenantId),
        apiClient.transactions.recent(),
        apiClient.dashboard.paymentReports()
      ]);
      setSession(sessions)
      setTransReport(report);
      setRouterStats(routers);
      setVoucherStats(vouchers);
      setPackageStats(packages);
      setCurrency(currency);
      setPaymentStats(payments);
      setRecentTransaction(transactions);

    } catch {

    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    if (authLoading || !user) return;
    load();
  }, [authLoading, user]);

  useEffect(() => {
    let unsubscribe: (() => void) | null = null;
    (async () => {
      const event = SocketClient.event_dashboard_sync;
      unsubscribe = await SocketClient.subscribe(event, user?.tenantId ?? event, (_) => load());
    })();

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [user]);

  return (
    <div className="flex flex-col gap-6">
      {/* Page heading */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Overview of your ISP network</p>
      </div>

      {/* Stat cards — middle card is "hero" (navy fill) to match DashboardDesign */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">
        {routerStats && (<StatCard
          label="Routers"
          value={loading ? "—" : routerStats!.total}
          icon={Router}
          change={`${routerStats!.online} online`}
          changePositive
        />)}
        <StatCard
          label="Active Sessions"
          value={loading ? "—" : session}
          icon={Activity}
          change="Live"
          changePositive
        />
        {paymentStats && (<StatCard
          label="Total Revenue"
          value={loading ? "—" : formatCurrency(paymentStats.totalEarnings, currency)}
          icon={TrendingUp}
          change={`${paymentStats.totalTransactions} txns`}
          changePositive
          hero
        />)}
        {paymentStats && (<StatCard
          label="Today Revenue"
          value={loading ? "—" : formatCurrency(paymentStats.todayEarnings, currency)}
          icon={CreditCard}
          change={`${paymentStats.todayTransactions} txns`}
          changePositive
        />)}
        {packageStats && (<StatCard
          label="Packages"
          value={loading ? "—" : packageStats.total}
          icon={Package}
          change={`${packageStats.bestPerforming.length} best perfoming`}
          changePositive
        />)}
        {voucherStats && (<StatCard
          label="Vouchers"
          value={loading ? "—" : voucherStats.total}
          icon={Ticket}
          change={`${voucherStats.unused} unused`}
          changePositive
        />)}
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Revenue chart */}
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold text-foreground">Revenue — Last 7 Days</h3>
              <p className="text-xs text-muted-foreground mt-0.5">Daily transaction totals</p>
            </div>
            {transReport && transReport.data.length > 0 && (<span className="text-xs font-semibold text-[oklch(0.42_0.18_142)] bg-[oklch(0.65_0.2_142)]/12 border border-[oklch(0.65_0.2_142)]/25 rounded-full px-2.5 py-0.5">
              {transReport.summary.isPositiveGrowth ? "+" : "-"}{transReport.summary.growthPercentage}
            </span>)}
          </div>
          {transReport && transReport.data.length > 0 && (<ResponsiveContainer width="100%" height={200}>
            <AreaChart data={transReport.data} margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
              <defs>
                <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="oklch(0.52 0.22 260)" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="oklch(0.52 0.22 260)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.9 0.01 260)" vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: "oklch(0.52 0.02 260)" }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "oklch(0.52 0.02 260)" }} tickLine={false} axisLine={false} tickFormatter={(v) => `${v / 1000}k`} />
              <Tooltip content={<ChartTooltip formatter={(v) => formatCurrency(v, currency)} />} />
              <Area type="monotone" dataKey="amount" stroke="oklch(0.52 0.22 260)" strokeWidth={2.5} fill="url(#revGrad)" dot={false} activeDot={{ r: 4, strokeWidth: 0 }} />
            </AreaChart>
          </ResponsiveContainer>)}

          {transReport && transReport.data.length === 0 && (<h3 className="text-sm font-semibold text-foreground text-center py-20 px-10">No revenue report</h3>)}
        </div>

        {/* Sessions chart */}
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold text-foreground">Sessions — Last 7 Days</h3>
              <p className="text-xs text-muted-foreground mt-0.5">Hotspot session counts</p>
            </div>
            <span className="text-xs font-semibold text-[oklch(0.42_0.18_142)] bg-[oklch(0.65_0.2_142)]/12 border border-[oklch(0.65_0.2_142)]/25 rounded-full px-2.5 py-0.5">
              +10%
            </span>
          </div>
          {/* <ResponsiveContainer width="100%" height={200}>
            <BarChart data={s.sessionChart} margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.9 0.01 260)" vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: "oklch(0.52 0.02 260)" }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "oklch(0.52 0.02 260)" }} tickLine={false} axisLine={false} />
              <Tooltip content={<ChartTooltip formatter={(v) => `${v} sessions`} />} />
              <Bar dataKey="count" fill="oklch(0.52 0.22 260)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer> */}
        </div>
      </div>

      {/* Recent transactions */}
      {recentTransactions && (<div className="rounded-xl border border-border bg-card">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div>
            <h3 className="text-sm font-semibold text-foreground">Recent Transactions</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Latest payment activity</p>
          </div>
          <Users className="h-4 w-4 text-muted-foreground" />
        </div>
        <div className="divide-y divide-border/60">
          {recentTransactions.map((tx) => (
            <div key={tx._id} className="flex items-center justify-between px-5 py-3.5 gap-4 hover:bg-muted/20 transition-colors">
              <div className="flex flex-col gap-0.5 min-w-0">
                <span className="text-sm font-medium tabular-nums">{tx.customer}</span>
                <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
                  <span className="text-xs text-muted-foreground">{tx.package?.name ?? "Voucher"}</span>
                  {tx.router && (
                    <>
                      <span className="text-xs text-muted-foreground/40">&middot;</span>
                      <span className="text-xs text-muted-foreground">{tx.router.name}</span>
                    </>
                  )}
                  {tx.tenant && (
                    <>
                      <span className="text-xs text-muted-foreground/40">&middot;</span>
                      <span className="text-xs text-muted-foreground">{tx.tenant.name}</span>
                    </>
                  )}
                  <span className="text-xs text-muted-foreground/40">&middot;</span>
                  <span className="text-xs text-muted-foreground">{formatTime(tx.createdAt)}</span>
                </div>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <StatusBadge status={tx.status} />
                <span className="text-sm font-bold tabular-nums">{formatCurrency(tx.amount, currency)}</span>
              </div>
            </div>
          ))}
          {recentTransactions.length === 0 && (<h3 className="text-sm font-semibold text-foreground text-center py-20 px-10">No transaction data</h3>)}
        </div>
      </div>)}
    </div>
  );
}
