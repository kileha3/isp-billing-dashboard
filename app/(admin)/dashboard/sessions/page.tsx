"use client";

import { useState, useEffect, useCallback } from "react";
import { apiClient } from "@/lib/api";
import { DataTable } from "@/components/admin/DataTable";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RefreshCw, WifiOff, MoreHorizontal, Eraser, PackageOpen, Filter, Calendar, History, Loader2, Trash2 } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { StatCard } from "@/components/admin/StatCard";
import { usePageTitle } from "@/hooks/use-page-title";
import { Activity, Wifi, Clock } from "lucide-react";
import { HotspotSession, Package } from "@/lib/types";
import { useAuth } from "@/lib/auth-context";
import SocketClient from "@/lib/socket.util";
import { DateRange, DayPicker } from "react-day-picker";
import { addDays, format as formatDateFn } from "date-fns";
import "react-day-picker/style.css";
import { formatDate } from "@/lib/utils";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";


function formatBytes(octate: number) {
  const mb: number = parseFloat((octate / 1048576).toFixed(2));
  if (mb >= 1024) return `${(mb / 1024).toFixed(2)} GB`;
  return `${mb.toFixed(2)} MB`;
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
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletingExpired, setDeletingExpired] = useState(false);
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
        startDate: formatDateFn(dateRange.from, 'yyyy-MM-dd'),
        endDate: formatDateFn(dateRange.to, 'yyyy-MM-dd')
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
        const { success } = await apiClient.sessions.disconnect(session.username);
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

  // Delete expired sessions
  const handleDeleteExpiredSessions = async () => {
    setDeletingExpired(true);
    try {
      const expiredSessions = filteredSessions.filter(
        s => s.status === "expired"
      );
      
      if (expiredSessions.length === 0) {
        toast({ 
          title: "No expired sessions", 
          description: "There are no expired sessions to delete.",
          variant: "default"
        });
        setShowDeleteConfirm(false);
        return;
      }

      // Call API to delete expired sessions
      const { success, message } = await apiClient.sessions.deleteExpired({
        startDate: formatDateFn(dateRange?.from || new Date(), 'yyyy-MM-dd'),
        endDate: formatDateFn(dateRange?.to || new Date(), 'yyyy-MM-dd')
      });
      
      toast({ 
        title: success ? "Success" : "Failed", 
        description: message || `${expiredSessions.length} expired session(s) have been deleted.`,
        variant: success ? "default" : "destructive"
      });
      
      // Reload sessions
      await load(false);
    } catch (error: any) {
      toast({ 
        title: "Error", 
        description: error.message || "Failed to delete expired sessions.",
        variant: "destructive"
      });
    } finally {
      setDeletingExpired(false);
      setShowDeleteConfirm(false);
    }
  };

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
  const formatDateRangeDisplay = () => {
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

  // Filter sessions by date range if needed
  const getFilteredSessions = () => {
    let filtered = sessions;
    if (statusFilter !== "all") filtered = sessions.filter(s => s.status === statusFilter);
    if (typeFilter !== "all") filtered = sessions.filter(s => s.isPPPoE === (typeFilter === "pppoe"))
    return filtered;
  };

  const filteredSessions = getFilteredSessions();
  const expiredCount = filteredSessions.filter(s => s.status === "expired").length;
  
  // Calculate session statistics
  const active = filteredSessions.filter(s => s.status === "active");
  const offline = filteredSessions.filter(s => s.status === "offline");
  const expired = filteredSessions.filter(s => s.status === "expired");
  const totalDataInput = filteredSessions.reduce((sum, s) => sum + Number(s.usage.input), 0);
  const totalDataOutput = filteredSessions.reduce((sum, s) => sum + Number(s.usage.output), 0);

  // Generate confirmation message with date range
  const getConfirmationMessage = () => {
    const dateRangeText = formatDateRangeForMessage();
    if (expiredCount === 0) {
      return `No expired sessions found ${dateRangeText !== "all time" ? `for ${dateRangeText}` : ""}.`;
    }
    return `Are you sure you want to delete ${expiredCount} expired session(s) ${dateRangeText !== "all time" ? `for ${dateRangeText}` : ""}? This action cannot be undone.`;
  };

  // History table columns (without sessions column)
  const historyColumns = [
    { key: "ipAddress", label: "IP Address", render: (v: unknown, row: unknown) => (row as HotspotSession).network.ip },
    { key: "router", label: "Router", render: (v: unknown, row: unknown) => `${(row as HotspotSession).nas.name} - ${(row as HotspotSession).nas.location} (${(row as HotspotSession).nas.ip})` },
    { key: "package", label: "Package", render: (v: unknown, row: unknown) => (row as HotspotSession).package.name },
    { key: "timeLapse", label: "Duration", render: (v: unknown, row: unknown) => (row as HotspotSession).timeLapse },
    {
      key: "dataUsed", label: "Data Used (Down/Up)", render: (v: unknown, row: unknown) => {
        const sess = row as HotspotSession;
        return `${formatBytes(Number(sess.usage.output))}/${formatBytes(Number(sess.usage.input))}`
      }
    },
    { key: "status", label: "Status", render: (v: unknown) => <StatusBadge status={String(v)} /> },
    { key: "startedAt", label: "Started", render: (v: unknown, row: unknown) => formatDate((row as HotspotSession).session.start) },
  ];

  // Main table columns (hide some columns on mobile)
  const columns = [
    { key: "username", label: "User", render: (v: unknown, row: unknown) => (row as HotspotSession).username },
    { 
      key: "macAddress", 
      label: "MAC Address", 
      className: "hidden sm:table-cell",
      render: (v: unknown, row: unknown) => (row as HotspotSession).network.mac 
    },
    { 
      key: "router", 
      label: "Router", 
      className: "hidden md:table-cell",
      render: (v: unknown, row: unknown) => `${(row as HotspotSession).nas.name}` 
    },
    { key: "package", label: "Package", render: (v: unknown, row: unknown) => (row as HotspotSession).package.name },
    {
      key: "dataUsed", 
      label: "Data Used (Down/Up)", 
      render: (v: unknown, row: unknown) => {
        const sess = row as HotspotSession;
        return `${formatBytes(Number(sess.usage.output))} / ${formatBytes(Number(sess.usage.input))}`
      }
    },
    { 
      key: "startedAt", 
      label: "Started", 
      className: "hidden lg:table-cell",
      render: (v: unknown, row: unknown) => formatDate((row as HotspotSession).session.start) 
    },
    { 
      key: "expireOn", 
      label: "Expires", 
      className: "hidden lg:table-cell",
      render: (v: unknown, row: unknown) => formatDate((row as HotspotSession).session.expireOn) 
    },
    { key: "status", label: "Status", render: (v: unknown) => <StatusBadge status={String(v) === "active" ? "online": String(v)} /> },
  ];

  return (
    <div className="flex flex-col gap-4 md:gap-6">
      {/* Header Section - Responsive */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-semibold tracking-tight">Sessions</h1>
          <p className="text-xs md:text-sm text-muted-foreground mt-0.5 md:mt-1">Live and historical hotspot sessions</p>
        </div>

        {/* Action Buttons Group - Responsive */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          {/* Delete Expired Sessions Button */}
          {expiredCount > 0 && (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="flex items-center justify-center gap-2 px-3 py-1.5 md:py-2 text-xs md:text-sm rounded-lg bg-red-600 hover:bg-red-700 text-white transition-colors"
              disabled={deletingExpired}
            >
              <Trash2 className="h-3.5 w-3.5 md:h-4 md:w-4" />
              <span>Delete Expired</span>
            </button>
          )}

          {/* Date Range Picker - Responsive */}
          <div className="relative">
            <button
              onClick={() => setShowDatePicker(!showDatePicker)}
              className="flex items-center justify-center gap-2 px-2 md:px-3 py-1.5 md:py-2 text-xs md:text-sm rounded-lg border border-border bg-card hover:bg-muted/20 transition-colors w-full sm:w-auto"
            >
              <Calendar className="h-3.5 w-3.5 md:h-4 md:w-4 text-muted-foreground" />
              <span className="font-medium text-xs md:text-sm">{formatDateRangeDisplay()}</span>
            </button>

            {showDatePicker && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setShowDatePicker(false)}
                />
                <div className="absolute right-0 top-full mt-2 z-50 bg-card border border-border rounded-lg shadow-lg p-2 md:p-3 min-w-[280px] sm:min-w-[auto]">
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
      </div>

      {/* Stat Cards - Mobile Friendly Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 md:gap-4">
        <StatCard label="Active Sessions" value={active.length} icon={Activity} changePositive />
        <StatCard label="Offline Sessions" value={offline.length} icon={WifiOff} />
        <StatCard label="Expired Sessions" value={expired.length} icon={Clock} />
        <StatCard label="Total Sessions" value={filteredSessions.length} icon={Wifi} />
        <StatCard label="Total Data" value={`${formatBytes(totalDataOutput)} / ${formatBytes(totalDataInput)}`} icon={Clock} />
      </div>

      <DataTable
        data={filteredSessions as unknown as Record<string, unknown>[]}
        columns={columns as never}
        loading={loading}
        searchable
        searchKeys={["macAddress", "ipAddress","username","package"] as never}
        searchPlaceholder="by MAC, Username .."
        emptyMessage="No sessions recorded for the selected period."
        pageSize={10}
        filterSlot={
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            <div className="flex gap-2">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="h-9 md:h-10 flex-1 sm:w-36 md:w-44 bg-background text-xs md:text-sm">
                  <Filter className="h-3 w-3 md:h-3.5 md:w-3.5 mr-1 md:mr-2 text-muted-foreground" />
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="active">Online</SelectItem>
                  <SelectItem value="offline">Offline</SelectItem>
                  <SelectItem value="expired">Expired</SelectItem>
                </SelectContent>
              </Select>

              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="h-9 md:h-10 flex-1 sm:w-36 md:w-44 bg-background text-xs md:text-sm">
                  <Filter className="h-3 w-3 md:h-3.5 md:w-3.5 mr-1 md:mr-2 text-muted-foreground" />
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="pppoe">PPPoE</SelectItem>
                  <SelectItem value="hotspot">Hotspot</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            {/* Hide refresh button on mobile, show only on sm and up */}
            <Button 
              variant="outline" 
              onClick={() => load(false)} 
              disabled={loading} 
              className="h-9 md:h-10 hidden sm:flex"
            >
              <RefreshCw className={`h-3.5 w-3.5 md:h-4 md:w-4 mr-1 md:mr-2 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
        }
        actions={(row) => {
          const s = row as unknown as HotspotSession;
          return (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7">
                  <MoreHorizontal className="h-3.5 w-3.5 md:h-4 md:w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onClick={() => setActionState({ type: "change_package", session: s, selectedPackageId: s.package.id })}
                >
                  <PackageOpen className="mr-2 h-3.5 w-3.5 md:h-4 md:w-4" />
                  Change Package
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setActionState({ type: "clear_mac", session: s })}>
                  <Eraser className="mr-2 h-3.5 w-3.5 md:h-4 md:w-4" />
                  Clear MAC
                </DropdownMenuItem>

                <DropdownMenuItem onClick={() => showHistory(s)}>
                  <History className="mr-2 h-3.5 w-3.5 md:h-4 md:w-4" />
                  History
                </DropdownMenuItem>
                {s.status !== "expired" && (
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onClick={() => setActionState({ type: "kick", session: s })}
                  >
                    <WifiOff className="mr-2 h-3.5 w-3.5 md:h-4 md:w-4" />
                    Kick Out
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          );
        }}
      />

      {/* History Dialog - Responsive width */}
      <Dialog open={historyDialog.isOpen} onOpenChange={(open) => {
        if (!open) setHistoryDialog({ isOpen: false, loading: false, sessions: [], currentSession: null });
      }}>
        <DialogContent
          className="w-[95vw] max-w-[95vw] sm:max-w-[80vw] md:max-w-[70vw] lg:max-w-[80vw]"
        >
          <DialogHeader>
            <DialogTitle className="text-base md:text-lg">
              Session History
              {historyDialog.currentSession && (
                <span className="text-xs md:text-sm font-normal text-muted-foreground ml-1 md:ml-2">
                  for {historyDialog.currentSession.username} - {historyDialog.currentSession.network.host}
                </span>
              )}
            </DialogTitle>
            <DialogDescription className="text-xs md:text-sm">
              Historical sessions for this user
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-auto min-h-0">
            {historyDialog.loading ? (
              <div className="flex flex-col items-center justify-center h-full py-8">
                <Loader2 className="h-6 w-6 md:h-8 md:w-8 animate-spin text-primary mb-2 md:mb-3" />
                <p className="text-xs md:text-sm text-muted-foreground">Loading session history...</p>
              </div>
            ) : historyDialog.sessions.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full py-8">
                <History className="h-8 w-8 md:h-12 md:w-12 text-muted-foreground/50 mb-2 md:mb-3" />
                <p className="text-xs md:text-sm text-muted-foreground">No historical sessions found</p>
              </div>
            ) : (
              <div className="w-full overflow-x-auto">
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

          {!historyDialog.loading && (
            <DialogFooter>
              <Button 
                variant="outline" 
                onClick={() => setHistoryDialog({ isOpen: false, loading: false, sessions: [], currentSession: null })}
                className="h-9 md:h-10 text-xs md:text-sm"
              >
                Close
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>

      {/* Action Confirmation Dialog - Responsive */}
      <Dialog open={!!actionState} onOpenChange={(open) => { if (!open) setActionState(null); }}>
        <DialogContent className="max-w-[95vw] sm:max-w-sm">
          {actionState?.type === "kick" && (
            <>
              <DialogHeader>
                <DialogTitle className="text-base md:text-lg">Kick Out User</DialogTitle>
                <DialogDescription className="text-xs md:text-sm">
                  This will immediately disconnect the session for <code className="font-mono text-xs bg-muted px-1 rounded">{actionState.session.network.mac}</code>.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter className="flex gap-2 sm:gap-0">
                <Button variant="outline" onClick={() => setActionState(null)} className="flex-1 sm:flex-none h-9 md:h-10 text-xs md:text-sm">
                  Cancel
                </Button>
                <Button variant="destructive" onClick={executeAction} disabled={acting} className="flex-1 sm:flex-none h-9 md:h-10 text-xs md:text-sm">
                  {acting ? "Kicking…" : "Kick Out"}
                </Button>
              </DialogFooter>
            </>
          )}

          {actionState?.type === "clear_mac" && (
            <>
              <DialogHeader>
                <DialogTitle className="text-base md:text-lg">Clear MAC Address</DialogTitle>
                <DialogDescription className="text-xs md:text-sm">
                  This removes <code className="font-mono text-xs bg-muted px-1 rounded">{actionState.session.network.mac}</code> from the router&apos;s ARP and hotspot binding tables.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter className="flex gap-2 sm:gap-0">
                <Button variant="outline" onClick={() => setActionState(null)} className="flex-1 sm:flex-none h-9 md:h-10 text-xs md:text-sm">
                  Cancel
                </Button>
                <Button onClick={executeAction} disabled={acting} className="flex-1 sm:flex-none h-9 md:h-10 text-xs md:text-sm">
                  {acting ? "Clearing…" : "Clear MAC"}
                </Button>
              </DialogFooter>
            </>
          )}

          {actionState?.type === "change_package" && (
            <>
              <DialogHeader>
                <DialogTitle className="text-base md:text-lg">Change Package</DialogTitle>
                <DialogDescription className="text-xs md:text-sm">
                  Select a new package for <code className="font-mono text-xs bg-muted px-1 rounded">{actionState.session.network.ip}</code>.
                </DialogDescription>
              </DialogHeader>
              <div className="py-2">
                <Label className="mb-2 block text-sm md:text-base">New Package</Label>
                <Select
                  value={actionState.selectedPackageId}
                  onValueChange={(v) => setActionState(a => a ? { ...a, selectedPackageId: v } : null)}
                >
                  <SelectTrigger className="h-9 md:h-10 text-xs md:text-sm">
                    <SelectValue placeholder="Select package" />
                  </SelectTrigger>
                  <SelectContent>
                    {packages.map(p => (
                      <SelectItem key={p._id} value={p._id} className="text-xs md:text-sm">
                        {p.name} — {p.currency ?? "TZS"}{p.price.toLocaleString()}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <DialogFooter className="flex gap-2 sm:gap-0">
                <Button variant="outline" onClick={() => setActionState(null)} className="flex-1 sm:flex-none h-9 md:h-10 text-xs md:text-sm">
                  Cancel
                </Button>
                <Button onClick={executeAction} disabled={acting || !actionState.selectedPackageId} className="flex-1 sm:flex-none h-9 md:h-10 text-xs md:text-sm">
                  {acting ? "Applying…" : "Apply Package"}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Expired Sessions Confirmation Dialog */}
      <ConfirmDialog
        open={showDeleteConfirm}
        title="Delete Expired Sessions"
        message={getConfirmationMessage()}
        confirmText={deletingExpired ? "Deleting..." : "Delete"}
        cancelText="Cancel"
        onCancel={() => setShowDeleteConfirm(false)}
        onConfirm={handleDeleteExpiredSessions}
        variant="destructive"
      />
    </div>
  );
}