"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
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
  Bar,
  BarChart,
} from "recharts";
import {
  Router,
  Users,
  CreditCard,
  Activity,
  Ticket,
  Package,
  TrendingUp,
  Calendar,
  AlertCircle,
} from "lucide-react";
import { formatCurrency } from "./transactions/page";
import { Transaction } from "@/lib/types";
import SocketClient from "@/lib/socket.util";
import { format } from 'timeago.js';
import { DateRange, DayPicker } from "react-day-picker";
import { addDays, format as formatDate } from "date-fns";
import "react-day-picker/style.css";

export const formatAgoTime = (date: string) => {
  return format(new Date(date));
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

// Invoice reminder dialog component
function InvoiceReminderDialog({ isOpen, onClose, onClear }: { 
  isOpen: boolean; 
  onClose: () => void; 
  onClear: () => void;
}) {
  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2">
        <div className="bg-card border border-border rounded-xl shadow-2xl p-6 animate-in fade-in zoom-in duration-200">
          <div className="flex items-center gap-3 mb-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-500/10 border border-amber-500/20">
              <AlertCircle className="h-6 w-6 text-amber-500" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-foreground">Pending Invoices</h3>
              <p className="text-sm text-muted-foreground">Action Required</p>
            </div>
          </div>
          
          <div className="mb-6">
            <p className="text-sm text-foreground mb-2">
              You have pending invoices that need to be cleared.
            </p>
            <p className="text-sm text-muted-foreground">
              Failure to clear these invoices will result in service suspension. 
              Please clear them as soon as possible to avoid interruption.
            </p>
          </div>

          <div className="flex gap-3">
            <button
              onClick={onClear}
              className="flex-1 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors font-medium text-sm"
            >
              Clear Invoices
            </button>
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-secondary text-secondary-foreground rounded-lg hover:bg-secondary/80 transition-colors font-medium text-sm"
            >
              Remind Me Later
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

export default function DashboardPage() {
  const router = useRouter();
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
  const [sessionReport, setSessionReport] = useState<any>(null)
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showClearInvoice, setShowClearInvoice] = useState(false);
  const [showInvoiceDialog, setShowInvoiceDialog] = useState(false);

  // Date range state - initialize to last 7 days
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: addDays(new Date(), -7),
    to: addDays(new Date(), 1)
  });

  // Check if we should show the invoice reminder dialog
  const shouldShowInvoiceReminder = useCallback(() => {
    if (!showClearInvoice) {
      localStorage.removeItem('invoiceReminderDismissed');
      return false;

    };
    
    const lastDismissed = localStorage.getItem('invoiceReminderDismissed');
    if (!lastDismissed) return true;
    
    const dismissedTime = parseInt(lastDismissed, 10);
    const oneHourAgo = Date.now() - (5 * 60 * 1000);
    
    // Show if more than 1 hour has passed since last dismissal
    return dismissedTime < oneHourAgo;
  }, [showClearInvoice]);

  // Handle invoice dialog close (remind me later)
  const handleInvoiceRemindLater = useCallback(() => {
    // Store current timestamp in localStorage
    localStorage.setItem('invoiceReminderDismissed', Date.now().toString());
    setShowInvoiceDialog(false);
  }, []);

  // Handle clear invoices action
  const handleClearInvoices = useCallback(() => {
    setShowInvoiceDialog(false);
    // Navigate to invoices page
    router.push('/dashboard/invoices');
  }, [router]);

  // Show dialog when condition is met
  useEffect(() => {
    if (!authLoading && shouldShowInvoiceReminder()) {
      setShowInvoiceDialog(true);
    }
  }, [authLoading, shouldShowInvoiceReminder]);

  const load = useCallback(async (showLoading: boolean = true) => {
    setLoading(showLoading);
    try {
      // Pass date range to API calls if they support it
      const dateFilter = dateRange?.from && dateRange?.to ? {
        startDate: formatDate(dateRange.from, 'yyyy-MM-dd'),
        endDate: formatDate(dateRange.to, 'yyyy-MM-dd')
      } : {};

      const [{ routers, vouchers, packages, payments, sessions }, { data: { settings: { currency } } }, transactions, { payment, session }, showClearDialog] = await Promise.all([
        apiClient.dashboard.getStats(),
        isSuperAdmin ? { data: { settings: { currency: "TZS" } } } : apiClient.tenant.get(user?.tenantId),
        apiClient.transactions.recent(),
        apiClient.dashboard.getReports(dateFilter as any),
        apiClient.invoices.showStatus()
      ]);
      if(!isSuperAdmin) setShowClearInvoice(showClearDialog);
      setSession(sessions)
      setTransReport(payment);
      setSessionReport(session);
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
  }, [dateRange]);

  // Reload when date range changes
  useEffect(() => {
    if (authLoading || !user) return;
    load();
  }, [dateRange]);

  useEffect(() => {
    if (authLoading || !user) return;
    load();
  }, [authLoading, user]);

  useEffect(() => {
    let unsubscribe: (() => void) | null = null;
    (async () => {
      const event = SocketClient.event_dashboard_sync;
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

  return (
    <div className="flex flex-col gap-6">
      {/* Invoice Reminder Dialog */}
      <InvoiceReminderDialog 
        isOpen={showInvoiceDialog}
        onClose={handleInvoiceRemindLater}
        onClear={handleClearInvoices}
      />

      {/* Page heading with date picker */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Overview of your ISP network</p>
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
                  numberOfMonths={1}
                  defaultMonth={dateRange?.from}
                />
              </div>
            </>
          )}
        </div>
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
              <h3 className="text-sm font-semibold text-foreground">
                Revenue — {dateRange?.from && dateRange?.to
                  ? `${formatDate(dateRange.from, "MMM dd")} - ${formatDate(dateRange.to, "MMM dd, yyyy")}`
                  : "Selected Period"}
              </h3>
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

          {transReport && transReport.data.length === 0 && (<h3 className="text-sm font-semibold text-foreground text-center py-20 px-10">No revenue report for selected period</h3>)}
        </div>

        {/* Sessions chart */}
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold text-foreground">
                Sessions — {dateRange?.from && dateRange?.to
                  ? `${formatDate(dateRange.from, "MMM dd")} - ${formatDate(dateRange.to, "MMM dd, yyyy")}`
                  : "Selected Period"}
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">Hotspot session counts</p>
            </div>
            {sessionReport && sessionReport.summary && (
              <span className="text-xs font-semibold text-[oklch(0.42_0.18_142)] bg-[oklch(0.65_0.2_142)]/12 border border-[oklch(0.65_0.2_142)]/25 rounded-full px-2.5 py-0.5">
                {sessionReport.summary.isPositiveGrowth ? "+" : "-"}{sessionReport.summary.growthPercentage}
              </span>
            )}
          </div>
          {sessionReport && sessionReport.data.length > 0 && (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={sessionReport.data} margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.9 0.01 260)" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: "oklch(0.52 0.02 260)" }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "oklch(0.52 0.02 260)" }} tickLine={false} axisLine={false} />
                <Tooltip content={<ChartTooltip formatter={(v) => `${v} sessions`} />} />
                <Bar dataKey="sessions" fill="oklch(0.52 0.22 260)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>)}
          {sessionReport && sessionReport.data.length === 0 && (<h3 className="text-sm font-semibold text-foreground text-center py-20 px-10">No session report for selected period</h3>)}
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
                  <span className="text-xs text-muted-foreground">{formatAgoTime(tx.createdAt)}</span>
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