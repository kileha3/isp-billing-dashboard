"use client";

import { useState, useEffect, useCallback } from "react";
import { apiClient } from "@/lib/api";
import { DataTable } from "@/components/admin/DataTable";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RefreshCw, WifiOff, MoreHorizontal, Eraser, PackageOpen, Filter, Calendar, History, Loader2 } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { StatCard } from "@/components/admin/StatCard";
import { usePageTitle } from "@/hooks/use-page-title";
import { Activity, Wifi, Clock } from "lucide-react";
import { HotspotSession, Package } from "@/lib/types";
import { useAuth } from "@/lib/auth-context";
import SocketClient from "@/lib/socket.util";
import { DateRange, DayPicker } from "react-day-picker";
import { addDays, format as formatDate } from "date-fns";
import "react-day-picker/style.css";


function formatBytes(octate: number) {
  const mb: number = parseFloat((octate / 1048576).toFixed(2));
  if (mb >= 1024) return `${(mb / 1024).toFixed(1)} GB`;
  return `${mb} MB`;
}


type ActionType = "kick" | "clear_mac" | "change_package";

interface ActionState {
  type: ActionType;
  session: HotspotSession;
  selectedPackageId?: string;
}

interface HistoryDialogState {
  isOpen: boolean;
  loading: boolean;
  sessions: HotspotSession[];
  currentSession: HotspotSession | null;
}

export default function SessionsPage() {
  usePageTitle("Sessions");
  const { toast } = useToast();
  const [sessions, setSessions] = useState<HotspotSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [actionState, setActionState] = useState<ActionState | null>(null);
  const [packages, setPackages] = useState<Package[]>([]);
  const [acting, setActing] = useState(false);
  const { user } = useAuth();
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [historyDialog, setHistoryDialog] = useState<HistoryDialogState>({
    isOpen: false,
    loading: false,
    sessions: [],
    currentSession: null
  });

  // Date range state - initialize to last 7 days
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: addDays(new Date(), -7),
    to: addDays(new Date(), 1),
  });

  const load = useCallback(async (showLoading: boolean = true) => {
    setLoading(showLoading);
    try {
      // Pass date range to API calls if they support it
      const dateFilter = dateRange?.from && dateRange?.to ? {
        startDate: formatDate(dateRange.from, 'yyyy-MM-dd'),
        endDate: formatDate(dateRange.to, 'yyyy-MM-dd')
      } : {};

      const [_sessions, { data: _packages }] = await Promise.all([
        apiClient.sessions.list(dateFilter as any),
        apiClient.packages.list()
      ]);
      setSessions(_sessions);
      setPackages(_packages);
    } catch {
      setSessions([]);
    } finally {
      setLoading(false);
    }
  }, [dateRange]);

  // Reload when date range changes
  useEffect(() => {
    if (user) load();
  }, [dateRange]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!user) return;
    let unsubscribe: (() => void) | null = null;
    (async () => {
      const event = SocketClient.event_session_sync;
      unsubscribe = await SocketClient.subscribe(event, event, (_) => load(false));
    })();

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [user]);

  async function executeAction() {
    if (!actionState) return;
    setActing(true);
    const { type, session, selectedPackageId } = actionState;
    try {
      if (type === "kick") {
        const { success } = await apiClient.sessions.disconnect(session._id);
        toast({ title: success ? "User kicked out" : undefined, description: success ? `Session for ${session.network.ip} disconnected.` : "Failed to kick out user, try again" });
      } else if (type === "clear_mac") {
        const { success } = await apiClient.sessions.clearMac(session._id);
        toast({ title: success ? "MAC address cleared" : undefined, description: success ? `${session.network.mac} has been cleared from the router.` : "Failed to clear MAC address, try again later" });
      } else if (type === "change_package" && selectedPackageId) {
        const { success } = await apiClient.sessions.changePackage(session._id, selectedPackageId);
        const pkg = packages.find(p => p._id === selectedPackageId);
        toast({ title: success ? "Package changed" : undefined, description: success ? `Switched to ${pkg?.name ?? selectedPackageId}.` : "Failed to change package try again later" });
      }
      setActionState(null);
      load();
    } catch {
      toast({ title: "Error", description: "Action failed. Please try again.", variant: "destructive" });
    } finally {
      setActing(false);
    }
    setActionState(null);
  }

  // Handle date range selection
  const handleDateRangeSelect = (range: DateRange | undefined) => {
    setDateRange(range);
    setShowDatePicker(false);
  };

  const showHistory = async (session: HotspotSession) => {
    // Open dialog with loading state
    setHistoryDialog({
      isOpen: true,
      loading: true,
      sessions: [],
      currentSession: session
    });

    try {
      const historySessions = await apiClient.sessions.history(session._id);
      setHistoryDialog(prev => ({
        ...prev,
        loading: false,
        sessions: historySessions || []
      }));
    } catch (error) {
      console.error("Failed to load history:", error);
      toast({
        title: "Error",
        description: "Failed to load session history. Please try again.",
        variant: "destructive"
      });
      setHistoryDialog(prev => ({
        ...prev,
        loading: false,
        sessions: []
      }));
    }
  };

  // Format display date range
  const formatDateRange = () => {
    if (!dateRange?.from) return "Select date range";
    if (!dateRange?.to) return formatDate(dateRange.from, "MMM dd, yyyy");
    return `${formatDate(dateRange.from, "MMM dd")} - ${formatDate(dateRange.to, "MMM dd, yyyy")}`;
  };

  // Filter sessions by date range if needed
  const getFilteredSessions = () => {
    let filtered = sessions;
    if (statusFilter !== "all") filtered = sessions.filter(s => s.status === statusFilter);
    if (typeFilter !== "all") filtered = sessions.filter(s => s.isPPPoE === (typeFilter === "pppoe"))
    return filtered;
  };

  const filteredSessions = getFilteredSessions();
  const active = filteredSessions.filter(s => s.status === "active");
  const totalData = filteredSessions.reduce((sum, s) => sum + ((s.usage.output + s.usage.input)), 0);

  // History table columns (without sessions column)
  const historyColumns = [
    { key: "ipAddress", label: "IP Address", render: (v: unknown, row: unknown) => (row as HotspotSession).network.ip },
    { key: "router", label: "Router", render: (v: unknown, row: unknown) => `${(row as HotspotSession).nas.name} - ${(row as HotspotSession).nas.location} (${(row as HotspotSession).nas.ip})` },
    { key: "package", label: "Package", render: (v: unknown, row: unknown) => (row as HotspotSession).package.name },
    { key: "timeLapse", label: "Duration", render: (v: unknown, row: unknown) => (row as HotspotSession).timeLapse },
    {
      key: "dataUsed", label: "Data Used", render: (v: unknown, row: unknown) => {
        const sess = row as HotspotSession;
        return formatBytes(Number(sess.usage.output + sess.usage.input))
      }
    },
    { key: "status", label: "Status", render: (v: unknown) => <StatusBadge status={String(v)} /> },
  ];

  // Main table columns
  const columns = [
    { key: "username", label: "User", render: (v: unknown, row: unknown) => (row as HotspotSession).username },
    { key: "ipAddress", label: "IP Address", render: (v: unknown, row: unknown) => (row as HotspotSession).network.ip },
    { key: "router", label: "Router", render: (v: unknown, row: unknown) => `${(row as HotspotSession).nas.name} - ${(row as HotspotSession).nas.location} (${(row as HotspotSession).nas.ip})` },
    { key: "package", label: "Package", render: (v: unknown, row: unknown) => (row as HotspotSession).package.name },
    { key: "timeLapse", label: "Duration", render: (v: unknown, row: unknown) => (row as HotspotSession).timeLapse },
    { key: "type", label: "Type", render: (v: unknown, row: unknown) => (row as HotspotSession).isPPPoE ? "PPPoE" : "Hotspot" },
    {
      key: "dataUsed", label: "Data Used", render: (v: unknown, row: unknown) => {
        const sess = row as HotspotSession;
        return formatBytes(Number(sess.usage.output + sess.usage.input))
      }
    },
    { key: "sessions", label: "Sessions", render: (v: unknown, row: unknown) => (row as HotspotSession).sessions },
    { key: "status", label: "Status", render: (v: unknown) => <StatusBadge status={String(v)} /> },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Sessions</h1>
          <p className="text-sm text-muted-foreground mt-1">Live and historical hotspot sessions</p>
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

      <div className="grid grid-cols-3 gap-4">
        <StatCard label="Active Sessions" value={active.length} icon={Activity} changePositive />
        <StatCard label="Total Sessions" value={filteredSessions.length} icon={Wifi} />
        <StatCard label="Total Data Used" value={formatBytes(totalData)} icon={Clock} />
      </div>

      <DataTable
        data={filteredSessions as unknown as Record<string, unknown>[]}
        columns={columns as never}
        loading={loading}
        searchable
        searchKeys={["macAddress", "ipAddress"] as never}
        searchPlaceholder="by MAC or IP"
        emptyMessage="No sessions recorded for the selected period."
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
                <SelectItem value="active">Online</SelectItem>
                <SelectItem value="offline">Offline</SelectItem>
                <SelectItem value="expired">Expired</SelectItem>
              </SelectContent>
            </Select>

            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="h-10 w-44 bg-background">
                <Filter className="h-3.5 w-3.5 mr-2 text-muted-foreground" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="pppoe">PPPoE</SelectItem>
                <SelectItem value="hotspot">Hotspot</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={() => load(false)} disabled={loading} className="h-10">
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
        }
        actions={(row) => {
          const s = row as unknown as HotspotSession;
          //if (s.status !== "active") return null;
          return (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onClick={() => setActionState({ type: "change_package", session: s, selectedPackageId: s.package.id })}
                >
                  <PackageOpen className="mr-2 h-4 w-4" />
                  Change Package
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setActionState({ type: "clear_mac", session: s })}>
                  <Eraser className="mr-2 h-4 w-4" />
                  Clear MAC Address
                </DropdownMenuItem>

                {s.sessions > 1 && (<DropdownMenuItem onClick={() => showHistory(s)}>
                  <History className="mr-2 h-4 w-4" />
                  Show History
                </DropdownMenuItem>)}
                {s.status !== "expired" && (<DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onClick={() => setActionState({ type: "kick", session: s })}
                >
                  <WifiOff className="mr-2 h-4 w-4" />
                  Kick Out User
                </DropdownMenuItem>)}
              </DropdownMenuContent>
            </DropdownMenu>
          );
        }}
      />

      {/* History Dialog */}
      <Dialog open={historyDialog.isOpen} onOpenChange={(open) => {
        if (!open) setHistoryDialog({ isOpen: false, loading: false, sessions: [], currentSession: null });
      }}>
        <DialogContent 
        style={{ width: `${historyDialog.loading ? 30:80}vw`, maxWidth: `${historyDialog.loading ? 30:80}vw` }}
        >
          <DialogHeader>
            <DialogTitle>
              Session History
              {historyDialog.currentSession && (
                <span className="text-sm font-normal text-muted-foreground ml-2">
                  for {historyDialog.currentSession.username} ({historyDialog.currentSession.network.mac})
                </span>
              )}
            </DialogTitle>
            <DialogDescription>
              Historical sessions for this user
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-auto min-h-0">
            {historyDialog.loading ? (
              <div className="flex flex-col items-center justify-center h-full">
                <Loader2 className="h-8 w-8 animate-spin text-primary mb-3" />
                <p className="text-sm text-muted-foreground">Loading session history...</p>
              </div>
            ) : historyDialog.sessions.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full">
                <History className="h-12 w-12 text-muted-foreground/50 mb-3" />
                <p className="text-sm text-muted-foreground">No historical sessions found</p>
              </div>
            ) : (
              <div className="w-full">
                <DataTable
                  data={historyDialog.sessions as unknown as Record<string, unknown>[]}
                  columns={historyColumns as never}
                  loading={false}
                  searchable={false}
                  emptyMessage="No historical sessions found"
                  pageSize={10}
                />
              </div>
            )}
          </div>

          {!historyDialog.loading && (<DialogFooter>
            <Button variant="outline" onClick={() => setHistoryDialog({ isOpen: false, loading: false, sessions: [], currentSession: null })}>
              Close
            </Button>
          </DialogFooter>)}
        </DialogContent>
      </Dialog>

      {/* Action Confirmation Dialog */}
      <Dialog open={!!actionState} onOpenChange={(open) => { if (!open) setActionState(null); }}>
        <DialogContent className="max-w-sm">
          {actionState?.type === "kick" && (
            <>
              <DialogHeader>
                <DialogTitle>Kick Out User</DialogTitle>
                <DialogDescription>
                  This will immediately disconnect the session for <code className="font-mono text-xs bg-muted px-1 rounded">{actionState.session.network.mac}</code>.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button variant="outline" onClick={() => setActionState(null)}>Cancel</Button>
                <Button variant="destructive" onClick={executeAction} disabled={acting}>
                  {acting ? "Kicking…" : "Kick Out"}
                </Button>
              </DialogFooter>
            </>
          )}

          {actionState?.type === "clear_mac" && (
            <>
              <DialogHeader>
                <DialogTitle>Clear MAC Address</DialogTitle>
                <DialogDescription>
                  This removes <code className="font-mono text-xs bg-muted px-1 rounded">{actionState.session.network.mac}</code> from the router&apos;s ARP and hotspot binding tables. The device will need to reconnect.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button variant="outline" onClick={() => setActionState(null)}>Cancel</Button>
                <Button onClick={executeAction} disabled={acting}>
                  {acting ? "Clearing…" : "Clear MAC"}
                </Button>
              </DialogFooter>
            </>
          )}

          {actionState?.type === "change_package" && (
            <>
              <DialogHeader>
                <DialogTitle>Change Package</DialogTitle>
                <DialogDescription>
                  Select a new package for <code className="font-mono text-xs bg-muted px-1 rounded">{actionState.session.network.ip}</code>. The change takes effect immediately.
                </DialogDescription>
              </DialogHeader>
              <div className="py-2">
                <Label className="mb-2 block">New Package</Label>
                <Select
                  value={actionState.selectedPackageId}
                  onValueChange={(v) => setActionState(a => a ? { ...a, selectedPackageId: v } : null)}
                >
                  <SelectTrigger><SelectValue placeholder="Select package" /></SelectTrigger>
                  <SelectContent>
                    {packages.map(p => (
                      <SelectItem key={p._id} value={p._id}>
                        {p.name} — {p.currency ?? "TZS"}{p.price.toLocaleString()}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setActionState(null)}>Cancel</Button>
                <Button onClick={executeAction} disabled={acting || !actionState.selectedPackageId}>
                  {acting ? "Applying…" : "Apply Package"}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}