"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import { apiClient } from "@/lib/api";
import { DataTable } from "@/components/admin/DataTable";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, MoreHorizontal, Trash2, Copy, Check, RefreshCw, Wifi, Info, ChevronRight, Filter, Settings2, ExternalLink, RefreshCcwDot } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import type { RouterDevice, RouterInfo, Tenant } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";
import { z } from "zod";
import { usePageTitle } from "@/hooks/use-page-title";
import { appName } from "@/lib/utils";


type WizardStep = "basic" | "vpn_script" | "interfaces" | "done";

interface WizardState {
  step: WizardStep;
  router: RouterDevice | null;
  vpnScript: string;
  routerInfo: RouterInfo | null;
  selectedInterface: string[];
  pollingStatus: "waiting" | "connected" | "timeout";
}

const STEP_LABELS: Record<WizardStep, string> = {
  basic: "Details",
  vpn_script: "Connection",
  interfaces: "Interfaces",
  done: "Summary",
};

const STEPS: WizardStep[] = ["basic", "vpn_script", "interfaces", "done"];

const basicSchema = z.object({
  name: z.string().min(1, "Router name is required"),
  location: z.string().min(1, "Location is required"),
  tenantId: z.string().optional(),
});

function StepIndicator({ current, steps }: { current: WizardStep; steps: WizardStep[] }) {
  const currentIdx = steps.indexOf(current);
  return (
    <div className="flex items-center gap-0 mb-6">
      {steps.map((step, i) => (
        <div key={step} className="flex items-center gap-0 flex-1 min-w-0">
          <div className="flex items-center gap-1.5 min-w-0">
            <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold transition-colors ${i < currentIdx ? "bg-primary text-primary-foreground" : i === currentIdx ? "bg-primary text-primary-foreground ring-2 ring-primary/30" : "bg-muted text-muted-foreground"}`}>
              {i < currentIdx ? <Check className="h-3 w-3" /> : i + 1}
            </div>
            <span className={`text-xs truncate hidden sm:block ${i === currentIdx ? "font-medium text-foreground" : "text-muted-foreground"}`}>
              {STEP_LABELS[step]}
            </span>
          </div>
          {i < steps.length - 2 && <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground/40 mx-1" />}
        </div>
      ))}
    </div>
  );
}

function CopyableScript({ content, label, onCopy }: { content: string; label?: string, onCopy: () => void }) {
  const [copied, setCopied] = useState(false);
  function handleCopy() {
    navigator.clipboard.writeText(content);
    setCopied(true);
    onCopy();
    setTimeout(() => setCopied(false), 2000);
  }
  return (
    <div className="flex flex-col gap-2 w-full">
      {label && <p className="text-sm text-muted-foreground">{label}</p>}
      <div className="relative w-full">
        <pre className="rounded-md bg-[hsl(220,13%,9%)] text-[hsl(210,17%,82%)] p-4 text-xs font-mono overflow-auto max-h-52 leading-relaxed whitespace-pre-wrap break-words w-full">
          {content}
        </pre>
        <Button
          variant="outline"
          size="sm"
          className="absolute top-2 right-2 h-7 px-2 text-xs bg-background/80 backdrop-blur-sm"
          onClick={handleCopy}
        >
          {copied ? <><Check className="h-3 w-3 mr-1" />Copied</> : <><Copy className="h-3 w-3 mr-1" />Copy</>}
        </Button>
      </div>
    </div>
  );
}



export default function RoutersPage() {
  usePageTitle("Routers");
  const { toast } = useToast();
  const { isRole, user } = useAuth();
  const isSuperAdmin = isRole("super_admin");

  const [routers, setRouters] = useState<RouterDevice[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");
  const [showWizard, setShowWizard] = useState(false);
  const [scriptCopied, setScriptCopied] = useState(false);
  // For re-setup from list actions
  const [setupTarget, setSetupTarget] = useState<RouterDevice | null>(null);

  const [basicForm, setBasicForm] = useState({ name: "", location: "", tenantId: "" });
  const [basicErrors, setBasicErrors] = useState<Partial<Record<keyof typeof basicForm, string>>>({});
  const [submittingBasic, setSubmittingBasic] = useState(false);

  const [wizard, setWizard] = useState<WizardState>({
    step: "basic",
    router: null,
    vpnScript: "",
    routerInfo: null,
    selectedInterface: [],
    pollingStatus: "waiting",
  });

  const [pollingInterval, setPollingInterval] = useState<NodeJS.Timeout | null>(null);

  const load = useCallback(async () => {
    try {
      const { data } = await apiClient.routers.list();
      setRouters(data);
    } catch {
      setRouters([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadTenants = useCallback(async () => {
    if (!isSuperAdmin) return;
    try {
      const { data } = await apiClient.tenants.list();
      setTenants(data);
    } catch {
      setTenants([]);
    }
  }, [isSuperAdmin]);

  useEffect(() => { load(); loadTenants(); }, [load, loadTenants]);

  useEffect(() => {
    return () => { if (pollingInterval) clearInterval(pollingInterval); };
  }, [pollingInterval]);

  async function openWizard(existingRouter?: RouterDevice) {
    if (pollingInterval) { clearInterval(pollingInterval); setPollingInterval(null); }
    if (existingRouter) {
      setBasicForm(f => ({ ...f, name: existingRouter.name!, location: existingRouter.location!, tenantId: existingRouter.tenantId! }))
      const { data: { script } } = await apiClient.routers.getScript(existingRouter._id);
      setSetupTarget(existingRouter);
      setWizard({
        step: "basic",
        router: existingRouter,
        vpnScript: script,
        routerInfo: existingRouter.info,
        selectedInterface: [],
        pollingStatus: "waiting",
      });
      startPolling(existingRouter._id);
    } else {
      setSetupTarget(null);
      setBasicForm({ name: "", location: "", tenantId: isSuperAdmin ? "" : (user?.tenantId ?? "") });
      setBasicErrors({});
      setWizard({ step: "basic", router: null, vpnScript: "", routerInfo: null, selectedInterface: [], pollingStatus: "waiting" });
    }
    setShowWizard(true);
  }

  function closeWizard() {
    if (pollingInterval) { clearInterval(pollingInterval); setPollingInterval(null); }
    setShowWizard(false);
    setSetupTarget(null);
    load();
  }

  function validateBasic() {
    const result = basicSchema.safeParse(basicForm);
    if (!result.success) {
      const errs: Partial<Record<keyof typeof basicForm, string>> = {};
      result.error.errors.forEach(e => {
        const field = e.path[0] as keyof typeof basicForm;
        errs[field] = e.message;
      });
      setBasicErrors(errs);
      return false;
    }
    setBasicErrors({});
    return true;
  }

  const updateInterfaces = async () => {
    if (!setupTarget) return;
    const payload = { captiveInterfaces: wizard.selectedInterface }
    await apiClient.routers.update(setupTarget._id, payload);
    toast({title: "Configurations was saved successfully"});
    load();
  }

  async function handleSaveBasic() {
    if (!validateBasic()) return;
    setSubmittingBasic(true);
    try {
      const payload = { name: basicForm.name, location: basicForm.location, tenantId: basicForm.tenantId || user?.tenantId };
      const { data: { router } } = await (setupTarget ? apiClient.routers.update(setupTarget._id, payload) : apiClient.routers.create(payload));
      const { data: { script } } = await apiClient.routers.getScript(router._id);
      setWizard(w => ({ ...w, step: "vpn_script", router, vpnScript: script }));
      startPolling(router._id);
    } catch {
      //
    } finally {
      setSubmittingBasic(false);
    }
  }

  function startPolling(routerId: string) {
    if (!scriptCopied || routerId.length === 0) return;
    const interval = setInterval(async () => {
      try {
        const { data: router } = await apiClient.routers.getInfo(routerId);
        if (router?.status === "online") {
          clearInterval(interval);
          setPollingInterval(null);
          setWizard(w => ({ ...w, pollingStatus: "connected", routerInfo: router.info }));
        }
      } catch { /* keep polling */ }
    }, 30000);
    setPollingInterval(interval);
    setTimeout(() => {
      clearInterval(interval);
      setPollingInterval(null);
      setWizard(w => {
        if (w.pollingStatus === "waiting") return { ...w, pollingStatus: "timeout" };
        return w;
      });
    }, 300000);
  }

  function handleProceedToInterfaces() {
    setWizard(w => ({ ...w, step: "interfaces" }));
  }

  function handleSelectInterface(iface: string) {
    const exist = (wizard.selectedInterface).includes(iface);
    const selectedInterface = [...(wizard.selectedInterface).filter(name => exist ? name !== iface : true), exist ? null : iface].filter(Boolean) as string[];
    setWizard(w => ({ ...w, selectedInterface, step: "interfaces" }));
  }

  async function checkRouterStatus(routerId?: string) {
    if (!routerId) return;
    load();
  }

  async function handleDelete(router: RouterDevice) {
    if (!confirm(`Delete router "${router.name}"?`)) return;
    try {
      const { message } = await apiClient.routers.delete(router._id);
      toast({ title: message });
      load();
    } catch {
      toast({ title: "Error", description: "Failed to delete router.", variant: "destructive" });
    }
  }

  function getTenantName(tenantId: string) {
    return tenants.find(t => t._id === tenantId)?.name ?? tenantId;
  }

  const columns = [
    { key: "name", label: "Name" },
    { key: "location", label: "Location" },
    { key: "ipAddress", label: "Assigned IP" },
    {
      key: "model", label: "Device Info",
      render: (v: unknown, row: unknown) => {
        const r = row as RouterDevice;
        return (
          <div className="flex flex-col gap-0.5">
            <span className="text-sm font-medium">{r.info?.model || "Undetermined"}</span>
            <code className="text-xs font-mono text-muted-foreground">{r.info?.version || "Undetermined"}</code>
          </div>
        );
      }
    },
    ...(isSuperAdmin ? [{ key: "tenantId", label: "Tenant", render: (v: unknown) => <span className="text-sm text-muted-foreground">{getTenantName(String(v))}</span> }] : []),
    {
      key: "uptime", label: "Uptime", render: (v: unknown, row: unknown) => {
        const r = row as RouterDevice;
        return (
          <div className="flex flex-col gap-0.5">
            <span className="text-sm font-medium">{r.status === "online" ? (r.info?.uptime || "Undetermined") : ""}</span>
          </div>
        );
      }
    },
    { key: "status", label: "Status", render: (v: unknown) => <StatusBadge status={String(v)} /> },

    {
      key: "_id",
      label: "",
      render: (_v: unknown, row: unknown) => {
        const r = row as RouterDevice;
        const isOnline = r.status === "online";
        const url = r.ipAddress ? `http://${r.ipAddress}` : null;
        return (
          <TooltipProvider delayDuration={200}>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  disabled={!isOnline || !url}
                  onClick={() => url && window.open(url, "_blank", "noopener,noreferrer")}
                  className={[
                    "flex items-center justify-center h-7 w-7 rounded-md transition-colors",
                    isOnline && url
                      ? "text-emerald-600 hover:bg-emerald-50 cursor-pointer"
                      : "text-muted-foreground/30 cursor-not-allowed",
                  ].join(" ")}
                  aria-label={isOnline ? `Open ${r.name} admin panel` : "Router offline"}
                >
                  <ExternalLink className="h-4 w-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="left">
                {isOnline && url ? `Open admin panel (${r.ipAddress})` : "Router is offline"}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        );
      },
    },
  ];

  const wizardStep = wizard.step;
  const wizardTitle = setupTarget ? `Re-install Billing — ${setupTarget.name}` : "Add Router";

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Routers</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage your MikroTik routers</p>
        </div>
        <Button onClick={() => openWizard()}>
          <Plus className="h-4 w-4 mr-2" />
          Add Router
        </Button>
      </div>

      <DataTable
        data={(statusFilter === "all" ? routers : routers.filter(r => r.status === statusFilter)) as unknown as Record<string, unknown>[]}
        columns={columns as never}
        loading={loading}
        searchable
        searchKeys={["name", "location"] as never}
        searchPlaceholder="routers"
        emptyMessage="No routers yet. Add your first MikroTik router."
        pageSize={10}
        filterSlot={
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-10 w-44 bg-background">
              <Filter className="h-3.5 w-3.5 mr-2 text-muted-foreground" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="online">Online</SelectItem>
              <SelectItem value="offline">Offline</SelectItem>
            </SelectContent>
          </Select>
        }
        actions={(row) => {
          const r = row as unknown as RouterDevice;
          return (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => openWizard(r)}>
                  <Settings2 className="mr-2 h-4 w-4" />
                  Setup Wizard
                </DropdownMenuItem>
                {r.status !== "online" && (<DropdownMenuItem onClick={() => checkRouterStatus(r._id)}>
                  <RefreshCcwDot className="mr-2 h-4 w-4" />
                  Check Status
                </DropdownMenuItem>)}
                <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => handleDelete(r)}>
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          );
        }}
      />

      {/* Add/Re-install Router Wizard */}
      <Dialog open={showWizard} onOpenChange={(open) => { if (!open) closeWizard(); }}>
        <DialogContent className="w-full max-w-3xl sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>{wizardTitle}</DialogTitle>
          </DialogHeader>

          <StepIndicator current={wizardStep} steps={STEPS} />

          {/* Step 1 — Basic Info (only for new routers) */}
          {wizardStep === "basic" && (
            <div className="flex flex-col gap-4">
              <p className="text-sm text-muted-foreground">Enter the router name and location. configuration script will be generated automatically after saving.</p>

              {/* Horizontal row for Router Name and Location */}
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <Label>Router Name <span className="text-destructive">*</span></Label>
                  <Input
                    placeholder="e.g. Main Gateway"
                    value={basicForm.name}
                    onChange={(e) => { setBasicForm(f => ({ ...f, name: e.target.value })); setBasicErrors(er => ({ ...er, name: undefined })); }}
                    autoFocus
                  />
                  {basicErrors.name && <p className="text-xs text-destructive">{basicErrors.name}</p>}
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label>Location <span className="text-destructive">*</span></Label>
                  <Input
                    placeholder="e.g. Dodoma, Sinza"
                    value={basicForm.location}
                    onChange={(e) => { setBasicForm(f => ({ ...f, location: e.target.value })); setBasicErrors(er => ({ ...er, location: undefined })); }}
                  />
                  {basicErrors.location && <p className="text-xs text-destructive">{basicErrors.location}</p>}
                </div>
              </div>

              {isSuperAdmin && (
                <div className="flex flex-col gap-1.5">
                  <Label>Tenant</Label>
                  <Select value={basicForm.tenantId} onValueChange={(v) => setBasicForm(f => ({ ...f, tenantId: v }))}>
                    <SelectTrigger><SelectValue placeholder="Select tenant" /></SelectTrigger>
                    <SelectContent>
                      {tenants.map(t => <SelectItem key={t._id} value={t._id}>{t.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={closeWizard}>Cancel</Button>
                <Button onClick={handleSaveBasic} disabled={submittingBasic || (basicSchema.safeParse(basicForm).error?.isEmpty == false)}>
                  {submittingBasic ? "Creating…" : "Save & Continue"}
                </Button>
              </div>
            </div>
          )}

          {/* Step 2 — VPN Script */}
          {wizardStep === "vpn_script" && wizard.router && (
            <div className="flex flex-col gap-4">
              <div className="flex items-start gap-3 rounded-lg border border-border p-3 bg-muted/30">
                <Info className="h-4 w-4 mt-0.5 text-primary shrink-0" />
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Paste this script into your MikroTik router terminal. It will establish a VPN connection back to the ${appName} server. Once connected, the status below will update automatically.
                </p>
              </div>
              <CopyableScript content={wizard.vpnScript} onCopy={() => {
                setScriptCopied(true);
                startPolling(wizard.router?._id || "");
              }} />
              <div className={`flex items-center gap-3 rounded-lg border p-3 transition-colors ${wizard.pollingStatus === "connected" ? "border-emerald-500/30 bg-emerald-500/5" : wizard.pollingStatus === "timeout" ? "border-destructive/30 bg-destructive/5" : "border-border"}`}>
                {wizard.pollingStatus === "waiting" && scriptCopied && (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin text-muted-foreground shrink-0" />
                    <div>
                      <p className="text-sm font-medium">Waiting for connection…</p>
                      <p className="text-xs text-muted-foreground">Checking every 30 seconds</p>
                    </div>
                  </>
                )}
                {wizard.pollingStatus === "connected" && wizard.routerInfo && (
                  <div className="flex flex-col gap-2 w-full">
                    <div className="flex items-center gap-2">
                      <Wifi className="h-4 w-4 text-emerald-600 shrink-0" />
                      <p className="text-sm font-semibold text-emerald-600">Router Connected</p>
                    </div>
                    <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs">
                      <span className="text-muted-foreground">Model</span><span className="font-medium">{wizard.routerInfo.model}</span>
                      <span className="text-muted-foreground">RouterOS</span><span className="font-medium">{wizard.routerInfo.version}</span>
                      <span className="text-muted-foreground">VPN IP</span><code className="font-mono font-medium">{wizard.routerInfo.cpuLoad}</code>
                    </div>
                  </div>
                )}
                {wizard.pollingStatus === "timeout" && scriptCopied && (
                  <>
                    <div className="h-4 w-4 shrink-0 rounded-full bg-destructive/20" />
                    <div>
                      <p className="text-sm font-medium text-destructive">Connection timeout</p>
                      <p className="text-xs text-muted-foreground">Check if script was applied correctly and try again</p>
                    </div>
                  </>
                )}
              </div>
              <div className="flex justify-end gap-2">
                <Button onClick={handleProceedToInterfaces} disabled={wizard.pollingStatus === "waiting" && wizard.routerInfo === null}>
                  Next: Select Interface (s)
                </Button>
              </div>
            </div>
          )}

          {/* Step 3 — Interface Selection */}
          {wizardStep === "interfaces" && wizard.routerInfo && (
            <div className="flex flex-col gap-4">
              <p className="text-sm text-muted-foreground">
                Select the network interfaces where the captive portal (hotspot) will be active. This is typically the LAN or bridge interface facing your customers.
              </p>
              <div className="flex flex-col gap-2 max-h-60 overflow-y-auto pr-1">
                {wizard.routerInfo.interfaces.map(iface => {
                  const isSelected = (wizard.selectedInterface || []).includes(iface.name)
                  return (
                    <button
                      key={iface.name}
                      onClick={() => handleSelectInterface(iface.name)}
                      className={`flex items-center justify-between rounded-lg border border-border px-4 py-3 text-left transition-colors ${isSelected ? "bg:border-primary bg: bg-primary/5" : ""} hover:border-primary hover:bg-primary/5`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="h-2 w-2 rounded-full bg-primary" />
                        <code className="text-sm font-mono font-medium">{iface.name}</code>
                        <code className="text-sm font-mono font-medium">{iface.isRunning ? "Running" : "Iddle"}</code>
                      </div>
                      <Badge variant="outline" className="text-xs">
                        {iface.name.includes("wlan") ? "Wireless" : iface.name.includes("bridge") ? "Bridge" : iface.name.includes("ether") ? "Ethernet" : "Interface"}
                      </Badge>
                    </button>
                  )
                })}
              </div>
              <div className="flex justify-end">
                <Button variant="outline" className="mr-1.5" onClick={() => setWizard(w => ({ ...w, step: "vpn_script" }))}>Back</Button>
                <Button onClick={() => setWizard(w => ({ ...w, step: "done" }))} disabled={(wizard.selectedInterface || []).length === 0}>
                  Preview Setup
                </Button>
              </div>
            </div>
          )}

          {/* Step 5 — Done */}
          {wizardStep === "done" && (
            <div className="flex flex-col items-center gap-4 py-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/10">
                <Check className="h-8 w-8 text-emerald-600" />
              </div>
              <div className="text-center">
                <h3 className="text-lg font-semibold">Router Setup Complete</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  <span className="font-medium">{wizard.router?.name}</span> is configured and ready to serve customers.
                </p>
              </div>
              {wizard.routerInfo && (
                <div className="w-full rounded-lg border border-border p-4 grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
                  <span className="text-muted-foreground">Model</span><span className="font-medium">{wizard.routerInfo.model}</span>
                  <span className="text-muted-foreground">RouterOS</span><span className="font-medium">{wizard.routerInfo.version}</span>
                  <span className="text-muted-foreground">Portal Interface</span><code className="font-mono font-medium">{wizard.selectedInterface.join(",")}</code>
                </div>
              )}
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" className="mr-1.5" onClick={() => setWizard(w => ({ ...w, step: "interfaces" }))}>Back</Button>
                <Button onClick={() => {
                  updateInterfaces();
                  closeWizard()
                }} disabled={(wizard.selectedInterface || []).length === 0}>
                  <Check className="h-4 w-4 mr-1.5" />Save configuration
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
