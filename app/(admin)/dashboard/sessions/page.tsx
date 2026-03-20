"use client";

import { useState, useEffect, useCallback } from "react";
import { apiClient } from "@/lib/api";
import { DataTable } from "@/components/admin/DataTable";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RefreshCw, WifiOff, MoreHorizontal, Eraser, PackageOpen, Filter } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import type { HotspotSession, Package } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";
import { StatCard } from "@/components/admin/StatCard";
import { usePageTitle } from "@/hooks/use-page-title";
import { Activity, Wifi, Clock } from "lucide-react";

const SESSION_STATUSES: HotspotSession["status"][] = ["active", "active", "active", "active", "active", "active", "disconnected", "disconnected", "disconnected", "expired", "expired", "expired", "disconnected", "active", "expired"];
const MOCK_SESSIONS: HotspotSession[] = Array.from({ length: 15 }, (_, i) => ({
  _id: String(i + 1),
  macAddress: Array.from({ length: 6 }, () => Math.floor(Math.random() * 256).toString(16).padStart(2, "0")).join(":"),
  ipAddress: `192.168.${Math.floor(i / 5) + 1}.${(i % 5) + 10}`,
  routerId: { _id: "r1", name: i < 7 ? "Main Gateway" : i < 12 ? "Westlands Hub" : "Kasarani Node" },
  packageId: { _id: ["p1", "p2", "p3"][i % 3], name: ["Hourly Unlimited", "Daily 1GB", "Weekly 5GB"][i % 3] },
  status: SESSION_STATUSES[i],
  startTime: new Date(Date.now() - (i + 1) * 900000).toISOString(),
  endTime: SESSION_STATUSES[i] !== "active" ? new Date(Date.now() - i * 600000).toISOString() : undefined,
  dataUsed: Math.floor(Math.random() * 800),
  tenantId: "t1",
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
}));

const MOCK_PACKAGES: Package[] = [
  { _id: "p1", name: "Hourly Unlimited", description: "", price: 50, duration: 1, durationUnit: "hours", dataLimit: 0, speedLimit: 10, status: "active", isPublic: true, tenantId: "t1", routerIds: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { _id: "p2", name: "Daily 1GB", description: "", price: 100, duration: 1, durationUnit: "days", dataLimit: 1024, speedLimit: 20, status: "active", isPublic: true, tenantId: "t1", routerIds: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { _id: "p3", name: "Weekly 5GB", description: "", price: 500, duration: 7, durationUnit: "days", dataLimit: 5120, speedLimit: 50, status: "active", isPublic: true, tenantId: "t1", routerIds: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { _id: "p4", name: "Monthly 30GB", description: "", price: 2000, duration: 1, durationUnit: "months", dataLimit: 30720, speedLimit: 100, status: "active", isPublic: true, tenantId: "t1", routerIds: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
];

function formatBytes(mb: number) {
  if (mb >= 1024) return `${(mb / 1024).toFixed(1)} GB`;
  return `${mb} MB`;
}

function formatDuration(startIso: string, endIso?: string) {
  const start = new Date(startIso).getTime();
  const end = endIso ? new Date(endIso).getTime() : Date.now();
  const mins = Math.floor((end - start) / 60000);
  if (mins < 60) return `${mins}m`;
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
}

type ActionType = "kick" | "clear_mac" | "change_package";

interface ActionState {
  type: ActionType;
  session: HotspotSession;
  selectedPackageId?: string;
}

export default function SessionsPage() {
  usePageTitle("Sessions");
  const { toast } = useToast();
  const [sessions, setSessions] = useState<HotspotSession[]>([]);
  const [packages, setPackages] = useState<Package[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");
  const [actionState, setActionState] = useState<ActionState | null>(null);
  const [acting, setActing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [sessData, pkgData] = await Promise.allSettled([
        apiClient.sessions.list(),
        apiClient.packages.list(),
      ]);
      if (sessData.status === "fulfilled") setSessions(sessData.value.sessions ?? sessData.value);
      else setSessions(MOCK_SESSIONS);
      if (pkgData.status === "fulfilled") setPackages(pkgData.value.packages ?? pkgData.value);
      else setPackages(MOCK_PACKAGES);
    } catch {
      setSessions(MOCK_SESSIONS);
      setPackages(MOCK_PACKAGES);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function executeAction() {
    if (!actionState) return;
    setActing(true);
    const { type, session, selectedPackageId } = actionState;
    try {
      if (type === "kick") {
        await apiClient.sessions.disconnect(session._id);
        toast({ title: "User kicked out", description: `Session for ${session.macAddress} disconnected.` });
      } else if (type === "clear_mac") {
        await apiClient.sessions.clearMac(session._id);
        toast({ title: "MAC address cleared", description: `${session.macAddress} has been cleared from the router.` });
      } else if (type === "change_package" && selectedPackageId) {
        await apiClient.sessions.changePackage(session._id, selectedPackageId);
        const pkg = packages.find(p => p._id === selectedPackageId);
        toast({ title: "Package changed", description: `Switched to ${pkg?.name ?? selectedPackageId}.` });
      }
      setActionState(null);
      load();
    } catch {
      toast({ title: "Error", description: "Action failed. Please try again.", variant: "destructive" });
    } finally {
      setActing(false);
    }
  }

  const active = sessions.filter(s => s.status === "active");
  const totalData = sessions.reduce((sum, s) => sum + (s.dataUsed ?? 0), 0);

  const columns = [
    { key: "macAddress", label: "MAC Address", render: (v: unknown) => <code className="text-xs font-mono bg-muted px-1.5 py-0.5 rounded">{String(v)}</code> },
    { key: "ipAddress", label: "IP Address", render: (v: unknown) => <code className="text-xs font-mono">{String(v)}</code> },
    { key: "routerId", label: "Router", render: (v: unknown) => (v as { name: string })?.name ?? "—" },
    { key: "packageId", label: "Package", render: (v: unknown) => (v as { name: string })?.name ?? "—" },
    { key: "startTime", label: "Duration", render: (v: unknown, row: unknown) => formatDuration(String(v), (row as HotspotSession).endTime) },
    { key: "dataUsed", label: "Data Used", render: (v: unknown) => formatBytes(Number(v)) },
    { key: "status", label: "Status", render: (v: unknown) => <StatusBadge status={String(v)} /> },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Sessions</h1>
          <p className="text-sm text-muted-foreground mt-1">Live and historical hotspot sessions</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <StatCard label="Active Sessions" value={active.length} icon={Activity} changePositive />
        <StatCard label="Total Sessions" value={sessions.length} icon={Wifi} />
        <StatCard label="Total Data Used" value={formatBytes(totalData)} icon={Clock} />
      </div>

      <DataTable
        data={(statusFilter === "all" ? sessions : sessions.filter(s => s.status === statusFilter)) as unknown as Record<string, unknown>[]}
        columns={columns as never}
        loading={loading}
        searchable
        searchKeys={["macAddress", "ipAddress"] as never}
        searchPlaceholder="by MAC or IP"
        emptyMessage="No sessions recorded yet."
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
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="disconnected">Disconnected</SelectItem>
                <SelectItem value="expired">Expired</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={load} disabled={loading} className="h-10">
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
        }
        actions={(row) => {
          const s = row as unknown as HotspotSession;
          if (s.status !== "active") return null;
          return (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onClick={() => setActionState({ type: "change_package", session: s, selectedPackageId: typeof s.packageId === "object" ? (s.packageId as { _id: string })._id : s.packageId })}
                >
                  <PackageOpen className="mr-2 h-4 w-4" />
                  Change Package
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setActionState({ type: "clear_mac", session: s })}>
                  <Eraser className="mr-2 h-4 w-4" />
                  Clear MAC Address
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onClick={() => setActionState({ type: "kick", session: s })}
                >
                  <WifiOff className="mr-2 h-4 w-4" />
                  Kick Out User
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          );
        }}
      />

      {/* Action Confirmation Dialog */}
      <Dialog open={!!actionState} onOpenChange={(open) => { if (!open) setActionState(null); }}>
        <DialogContent className="max-w-sm">
          {actionState?.type === "kick" && (
            <>
              <DialogHeader>
                <DialogTitle>Kick Out User</DialogTitle>
                <DialogDescription>
                  This will immediately disconnect the session for <code className="font-mono text-xs bg-muted px-1 rounded">{actionState.session.macAddress}</code>.
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
                  This removes <code className="font-mono text-xs bg-muted px-1 rounded">{actionState.session.macAddress}</code> from the router&apos;s ARP and hotspot binding tables. The device will need to reconnect.
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
                  Select a new package for <code className="font-mono text-xs bg-muted px-1 rounded">{actionState.session.macAddress}</code>. The change takes effect immediately.
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
                        {p.name} — KES {p.price.toLocaleString()}
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
