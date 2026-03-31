"use client";

import { useState, useEffect } from "react";
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
  BarChart,
  Bar,
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
import SocketClient from "@/lib/socket.util";

interface DashboardStats {
  routers: { total: number; online: number; offline: number };
  packages: { total: number };
  vouchers: { total: number; unused: number };
  transactions: { total: number; revenue: number; todayRevenue: number };
  sessions: { active: number };
  revenueChart: { date: string; amount: number }[];
  sessionChart: { date: string; count: number }[];
  recentTransactions: {
    _id: string;
    amount: number;
    status: string;
    customerPhone: string;
    createdAt: string;
    packageId?: { name: string };
    routerId?: { name: string };
    tenantId?: { name: string } | string;
    tenantName?: string;
    routerName?: string;
  }[];
}

const MOCK_STATS: DashboardStats = {
  routers: { total: 12, online: 9, offline: 3 },
  packages: { total: 8 },
  vouchers: { total: 340, unused: 120 },
  transactions: { total: 1420, revenue: 284000, todayRevenue: 12400 },
  sessions: { active: 47 },
  revenueChart: [
    { date: "Mar 14", amount: 9200 },
    { date: "Mar 15", amount: 11400 },
    { date: "Mar 16", amount: 8700 },
    { date: "Mar 17", amount: 13200 },
    { date: "Mar 18", amount: 10800 },
    { date: "Mar 19", amount: 15600 },
    { date: "Mar 20", amount: 12400 },
  ],
  sessionChart: [
    { date: "Mar 14", count: 38 },
    { date: "Mar 15", count: 52 },
    { date: "Mar 16", count: 41 },
    { date: "Mar 17", count: 63 },
    { date: "Mar 18", count: 45 },
    { date: "Mar 19", count: 71 },
    { date: "Mar 20", count: 47 },
  ],
  recentTransactions: [
    { _id: "1", amount: 500, status: "paid", customerPhone: "+254712345678", createdAt: new Date().toISOString(), packageId: { name: "Daily 1GB" }, routerId: { name: "Main Gateway" }, tenantName: "FastNet ISP" },
    { _id: "2", amount: 1200, status: "paid", customerPhone: "+254798765432", createdAt: new Date(Date.now() - 3600000).toISOString(), packageId: { name: "Weekly 5GB" }, routerId: { name: "Westlands Hub" }, tenantName: "FastNet ISP" },
    { _id: "3", amount: 200, status: "pending", customerPhone: "+254756789012", createdAt: new Date(Date.now() - 7200000).toISOString(), packageId: { name: "Hourly Unlimited" }, routerId: { name: "Kasarani Node" }, tenantName: "QuickConnect Ltd" },
    { _id: "4", amount: 3000, status: "paid", customerPhone: "+254700123456", createdAt: new Date(Date.now() - 10800000).toISOString(), packageId: { name: "Monthly 30GB" }, routerId: { name: "Main Gateway" }, tenantName: "FastNet ISP" },
    { _id: "5", amount: 500, status: "failed", customerPhone: "+254733456789", createdAt: new Date(Date.now() - 14400000).toISOString(), packageId: { name: "Daily 1GB" }, routerId: { name: "Westlands Hub" }, tenantName: "QuickConnect Ltd" },
  ],
};

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-KE", { style: "currency", currency: "KES", maximumFractionDigits: 0 }).format(amount);
}

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
  const { user, loading: authLoading } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user != null) SocketClient.connect().then(_ => SocketClient.join(user?._id!));
    if (authLoading || !user) return;
    apiClient.dashboard.getStats()
      .then(setStats)
      .catch(() => setStats(MOCK_STATS))
      .finally(() => setLoading(false));
  }, [authLoading, user]);

  const s = stats ?? MOCK_STATS;

  return (
    <div className="flex flex-col gap-6">
      {/* Page heading */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Overview of your ISP network</p>
      </div>

      {/* Stat cards — middle card is "hero" (navy fill) to match DashboardDesign */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">
        <StatCard
          label="Routers"
          value={loading ? "—" : s.routers.total}
          icon={Router}
          change={`${s.routers.online} online`}
          changePositive
        />
        <StatCard
          label="Active Sessions"
          value={loading ? "—" : s.sessions.active}
          icon={Activity}
          change="Live"
          changePositive
        />
        <StatCard
          label="Total Revenue"
          value={loading ? "—" : formatCurrency(s.transactions.revenue)}
          icon={TrendingUp}
          change={`${s.transactions.total} txns`}
          changePositive
          hero
        />
        <StatCard
          label="Today Revenue"
          value={loading ? "—" : formatCurrency(s.transactions.todayRevenue)}
          icon={CreditCard}
          change="+KES"
          changePositive
        />
        <StatCard
          label="Packages"
          value={loading ? "—" : s.packages.total}
          icon={Package}
        />
        <StatCard
          label="Vouchers"
          value={loading ? "—" : s.vouchers.unused}
          icon={Ticket}
          change={`${s.vouchers.total} total`}
          changePositive
        />
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
            <span className="text-xs font-semibold text-[oklch(0.42_0.18_142)] bg-[oklch(0.65_0.2_142)]/12 border border-[oklch(0.65_0.2_142)]/25 rounded-full px-2.5 py-0.5">
              +15%
            </span>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={s.revenueChart} margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
              <defs>
                <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="oklch(0.52 0.22 260)" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="oklch(0.52 0.22 260)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.9 0.01 260)" vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: "oklch(0.52 0.02 260)" }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "oklch(0.52 0.02 260)" }} tickLine={false} axisLine={false} tickFormatter={(v) => `${v / 1000}k`} />
              <Tooltip content={<ChartTooltip formatter={(v) => formatCurrency(v)} />} />
              <Area type="monotone" dataKey="amount" stroke="oklch(0.52 0.22 260)" strokeWidth={2.5} fill="url(#revGrad)" dot={false} activeDot={{ r: 4, strokeWidth: 0 }} />
            </AreaChart>
          </ResponsiveContainer>
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
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={s.sessionChart} margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.9 0.01 260)" vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: "oklch(0.52 0.02 260)" }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "oklch(0.52 0.02 260)" }} tickLine={false} axisLine={false} />
              <Tooltip content={<ChartTooltip formatter={(v) => `${v} sessions`} />} />
              <Bar dataKey="count" fill="oklch(0.52 0.22 260)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Recent transactions */}
      <div className="rounded-xl border border-border bg-card">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div>
            <h3 className="text-sm font-semibold text-foreground">Recent Transactions</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Latest payment activity</p>
          </div>
          <Users className="h-4 w-4 text-muted-foreground" />
        </div>
        <div className="divide-y divide-border/60">
          {s.recentTransactions.map((tx) => (
            <div key={tx._id} className="flex items-center justify-between px-5 py-3.5 gap-4 hover:bg-muted/20 transition-colors">
              <div className="flex flex-col gap-0.5 min-w-0">
                <span className="text-sm font-medium tabular-nums">{tx.customerPhone}</span>
                <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
                  <span className="text-xs text-muted-foreground">{tx.packageId?.name ?? "Voucher"}</span>
                  {tx.routerId?.name && (
                    <>
                      <span className="text-xs text-muted-foreground/40">&middot;</span>
                      <span className="text-xs text-muted-foreground">{tx.routerId.name}</span>
                    </>
                  )}
                  {tx.tenantName && (
                    <>
                      <span className="text-xs text-muted-foreground/40">&middot;</span>
                      <span className="text-xs text-muted-foreground">{tx.tenantName}</span>
                    </>
                  )}
                  <span className="text-xs text-muted-foreground/40">&middot;</span>
                  <span className="text-xs text-muted-foreground">{formatTime(tx.createdAt)}</span>
                </div>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <StatusBadge status={tx.status} />
                <span className="text-sm font-bold tabular-nums">{formatCurrency(tx.amount)}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
