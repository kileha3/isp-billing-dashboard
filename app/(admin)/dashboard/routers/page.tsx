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
import { Plus, MoreHorizontal, Trash2, Copy, Check, RefreshCw, Wifi, Info, ChevronRight, Filter, Settings2, RefreshCcwDot, CheckCheck, X, Pencil, Network, Router, Workflow, RouteOff, WifiSync, BrushCleaning, Grid2X2Plus } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import type { DevicePortalInterface, RouterDevice, RouterInfo, Tenant } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";
import { z } from "zod";
import { usePageTitle } from "@/hooks/use-page-title";
import { appName } from "@/lib/utils";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Progress } from "@radix-ui/react-progress";
import { useSocketEvents } from "@/hooks/use-socket-event";


type WizardStep = "basic" | "vpn_script" | "interfaces" | "done";
type WizardMode = "create" | "edit" | "setup";

interface WizardState {
  step: WizardStep;
  mode: WizardMode;
  router: RouterDevice | null;
  vpnScript: string;
  routerInfo: RouterInfo | null;
  selectedInterface: { type: string; interfaces: Array<string> } | undefined;
  pollingStatus: "waiting" | "connected" | "timeout";
  canClose: boolean;
}

type WhitelistForm = {
  name: string;
  mac: string;
};

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

const SERVICES = ["Hotspot", "PPPoE", "Combined"] as const;

export default function RoutersPage() {
  usePageTitle("Routers");
  const { toast } = useToast();
  const { isRole, user } = useAuth();
  const isSuperAdmin = isRole("super_admin");

  const [routers, setRouters] = useState<RouterDevice[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");
  const [stateFilter, setStateFilter] = useState("all");
  const [showWizard, setShowWizard] = useState(false);
  const [scriptCopied, setScriptCopied] = useState(false);
  const [routerToDelete, setRouterToDelete] = useState<RouterDevice | null>(null);
  const [serviceInterfaces, setServiceInterfaces] = useState<DevicePortalInterface | undefined>(undefined);
  const [selectedType, setSelectedType] = useState<typeof SERVICES[number]>("Hotspot");
  const [setupTarget, setSetupTarget] = useState<RouterDevice | null>(null);
  const [routerToAddWhiteList, setRouterToAddWhiteList] = useState<RouterDevice | null>(null);
  const [basicForm, setBasicForm] = useState({ name: "", location: "", tenantId: "" });
  const [basicErrors, setBasicErrors] = useState<Partial<Record<keyof typeof basicForm, string>>>({});
  const [submittingBasic, setSubmittingBasic] = useState(false);
  const [routerId, setRouterId] = useState<string | null>(null);
  const { socketEvent } = useSocketEvents<{ routerId: string; tenantId: string }>("router_status_check", (data) => {
    console.log("kileha-match-fn", data, data.routerId === routerId, data.tenantId === user?.tenantId)
    return data.routerId === routerId || data.tenantId === user?.tenantId;
  }, true);


  const [whitelistForm, setWhitelistForm] = useState<WhitelistForm>({
    name: "",
    mac: "",
  });

  const [whitelistErrors, setWhitelistErrors] = useState<Partial<WhitelistForm>>(
    {}
  );

  const isValidMac = (mac: string) =>
    /^([0-9A-Fa-f]{2}:){5}[0-9A-Fa-f]{2}$/.test(mac);

  const handleWhitelist = async () => {
    const errors: Partial<WhitelistForm> = {};

    if (!whitelistForm.name.trim()) {
      errors.name = "Name is required";
    }

    if (!whitelistForm.mac.trim()) {
      errors.mac = "MAC address is required";
    } else if (!isValidMac(whitelistForm.mac)) {
      errors.mac = "Invalid MAC address format";
    }

    setWhitelistErrors(errors);

    if (Object.keys(errors).length > 0) return;

    await apiClient.routers.whileListAp({ routerId: routerToAddWhiteList!._id, ...whitelistForm })

    // reset + close
    setWhitelistForm({ name: "", mac: "" });
    setRouterToAddWhiteList(null);
    toast({ title: "AP Whitelisting", description: 'You have successfully whitelisted an access point' })
  };

  const isFormValid =
    whitelistForm.name.trim().length > 0 &&
    isValidMac(whitelistForm.mac);

  const [wizard, setWizard] = useState<WizardState>({
    step: "basic",
    mode: "create",
    router: null,
    vpnScript: "",
    routerInfo: null,
    selectedInterface: undefined,
    pollingStatus: "waiting",
    canClose: true,
  });

  const load = useCallback(async (showLoading: boolean = true) => {
    try {
      setLoading(showLoading);
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
    console.log("kileha-ui", socketEvent, routerId);
    if (socketEvent) {
      load().then(() => {
        const isNewRouter = routerId && showWizard && wizard.mode === "setup";
        if (!isNewRouter) return;
        const router = routers.find(router => router._id === routerId);
        if (!router) return;
        console.log("kileha", router);
        updateStatus(router);
        setWizard((prev) => ({ ...prev, router, step: "interfaces", canClose: false }));
        setRouterId(null);
      })
    };
  }, [socketEvent, routerId]);

  async function openWizardForCreate() {
    setSetupTarget(null);
    setBasicForm({ name: "", location: "", tenantId: isSuperAdmin ? "" : (user?.tenantId ?? "") });
    setBasicErrors({});
    setServiceInterfaces(undefined);
    setSelectedType("Hotspot");
    setWizard({
      step: "basic",
      mode: "create",
      router: null,
      vpnScript: "",
      routerInfo: null,
      selectedInterface: undefined,
      pollingStatus: "waiting",
      canClose: true,
    });
    setShowWizard(true);
  }

  async function openWizardForEdit(router: RouterDevice) {
    setSetupTarget(router);
    setBasicForm({
      name: router.name!,
      location: router.location!,
      tenantId: router.tenantId!
    });
    setBasicErrors({});
    setWizard({
      step: "basic",
      mode: "edit",
      router: router,
      vpnScript: "",
      routerInfo: router.info,
      selectedInterface: router.portalInterface,
      pollingStatus: "waiting",
      canClose: true,
    });
    setShowWizard(true);
  }

  async function openWizardForSetup(router: RouterDevice) {
    setSetupTarget(router);
    setBasicForm({
      name: router.name!,
      location: router.location!,
      tenantId: router.tenantId!
    });
    setBasicErrors({});

    // Fetch script for the router
    const { data: { script } } = await apiClient.routers.getScript(router._id);

    setWizard({
      step: "vpn_script",
      mode: "setup",
      router: router,
      vpnScript: script,
      routerInfo: router.info,
      selectedInterface: router.portalInterface,
      pollingStatus: router.info ? "connected" : "waiting",
      canClose: true,
    });
    setServiceInterfaces((Array.isArray(router.portalInterface) ? (router.portalInterface as any)[0] : router.portalInterface));
    setShowWizard(true);
  }

  function closeWizard() {
    if (!wizard.canClose) return;
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
    setShowWizard(false);
    await apiClient.routers.update(setupTarget._id, { portalInterface: serviceInterfaces });
    await load();
    toast({ title: "Configuration saved successfully" });
  }

  async function handleSaveBasic() {
    if (!validateBasic()) return;
    setSubmittingBasic(true);
    try {
      const payload = { name: basicForm.name, location: basicForm.location, tenantId: basicForm.tenantId || user?.tenantId };

      if (wizard.mode === "edit") {
        // Edit mode - just update and close
        const { message } = await apiClient.routers.update(setupTarget!._id, payload);
        toast({ title: "Routers", description: message });
        closeWizard();
      } else {
        // Create mode - create router and proceed to script
        const { router, message } = await apiClient.routers.create(payload);
        toast({ title: "Routers", description: message });
        const { data: { script } } = await apiClient.routers.getScript(router._id);
        setSetupTarget(router);
        setRouterId(router._id);
        setWizard(w => ({
          ...w,
          step: "vpn_script",
          mode: "setup",
          vpnScript: script,
          router,
          canClose: true
        }));
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to save router information.", variant: "destructive" });
    } finally {
      setSubmittingBasic(false);
    }
  }

  const updateStatus = (router: RouterDevice) => {
    setWizard((w) => ({
      ...w,
      router,
      pollingStatus: router?.status === "online" ? "connected" : w.pollingStatus,
      routerInfo: router.info,
    }));
  }



  function handleProceedToInterfaces() {
    setWizard(w => ({ ...w, step: "interfaces", canClose: true }));
  }

  async function checkRouterStatus(routerId?: string) {
    if (!routerId) return;
    await apiClient.routers.checkStatus(routerId);
  }

  async function resetDevice(routerId?: string) {
    if (!routerId) return;
    const { success } = await apiClient.routers.resetDevice(routerId);
    toast({ title: `Device reset`, description: success ? "The device has been reset successfully" : "Failed to reset the device, try again" })
  }

  const isCombinedActive = selectedType === "Combined" || serviceInterfaces?.type === "combined";

  const handleSelectInterface = (ifaceName: string) => {
    setServiceInterfaces((prev: DevicePortalInterface | undefined) => {
      const _interfaces = serviceInterfaces?.interfaces || [];
      const exists = _interfaces.includes(ifaceName);
      const selected = {
        ...(prev ? prev : {}),
        type: selectedType.toLowerCase(),
        interfaces: exists
          ? _interfaces.filter((i) => i !== ifaceName)
          : [..._interfaces, ifaceName]
      }
      return selected;
    });
  };

  const handleSelectService = (type: typeof SERVICES[number]) => {
    setSelectedType(type);

    setServiceInterfaces((prev: any) => {
      if (type === "Combined") {
        return undefined;
      }
      return prev;
    });
  };

  const handleChangeState = async (router: RouterDevice) => {
    await apiClient.routers.update(router._id, { isActive: !router.isActive });
    load();
    toast({ title: `Router ${router.isActive ? "deactivated" : "activated"} successfully` });
  }

  function getTenantName(tenantId: string) {
    return tenants.find(t => t._id === tenantId)?.name ?? tenantId;
  }

  const columns = [
    { key: "name", label: "Name" },
    { key: "location", label: "Location" },
    {
      key: "platform", label: "Identity", render: (v: unknown, row: unknown) => {
        const r = row as RouterDevice;
        return (
          <div className="flex flex-col gap-0.5">
            <span className="text-sm">{r.info.platform || "Undetermined"}</span>
          </div>
        );
      }
    },
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
    { key: "isActive", label: "State", render: (v: unknown) => <StatusBadge status={String(v ? "active" : "inactive")} /> },
  ];

  const wizardStep = wizard.step;
  const wizardTitle = wizard.mode === "create" ? "Add Router" : wizard.mode === "edit" ? `Edit Router — ${setupTarget?.name}` : `Setup Billing — ${setupTarget?.name}`;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Routers</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage your MikroTik routers</p>
        </div>
        <Button onClick={openWizardForCreate}>
          <Plus className="h-4 w-4 mr-2" />
          Add Router
        </Button>
      </div>

      <DataTable
        data={(statusFilter === "all" || stateFilter === "all" ? routers : routers.filter(r => r.status === statusFilter && String(r.isActive) === stateFilter)) as unknown as Record<string, unknown>[]}
        columns={columns as never}
        loading={loading}
        searchable
        searchKeys={["name", "location"] as never}
        searchPlaceholder="routers"
        emptyMessage="No routers yet. Add your first MikroTik router."
        pageSize={10}
        filterSlot={
          <div className="flex flex-row gap-2">
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

            <Select value={stateFilter} onValueChange={setStateFilter}>
              <SelectTrigger className="h-10 w-44 bg-background">
                <Filter className="h-3.5 w-3.5 mr-2 text-muted-foreground" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All States</SelectItem>
                <SelectItem value="true">Active</SelectItem>
                <SelectItem value="false">Inactive</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={() => load(false)} disabled={loading} className="h-10">
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
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
                <DropdownMenuItem onClick={() => openWizardForEdit(r)}>
                  <Pencil className="mr-2 h-4 w-4" />
                  Edit Router
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => openWizardForSetup(r)}>
                  <Workflow className="mr-2 h-4 w-4" />
                  Setup Wizard
                </DropdownMenuItem>
                {r.isActive && r.status === "online" && (<DropdownMenuItem onClick={() => setRouterToAddWhiteList(r)}>
                  <Grid2X2Plus className="mr-2 h-4 w-4" />
                  Whitelist AP
                </DropdownMenuItem>)}
                {r.isActive && (<DropdownMenuItem onClick={() => checkRouterStatus(r._id)}>
                  <RefreshCcwDot className="mr-2 h-4 w-4" />
                  Sync Device
                </DropdownMenuItem>)}
                {r.isActive && r.status === "online" && (<DropdownMenuItem onClick={() => resetDevice(r._id)}>
                  <BrushCleaning className="mr-2 h-4 w-4" />
                  Reset Device
                </DropdownMenuItem>)}
                {isSuperAdmin && (<DropdownMenuItem onClick={() => handleChangeState(r)}>
                  {r.isActive ? (<RouteOff className="mr-2 h-4 w-4" />) : (<CheckCheck className="mr-2 h-4 w-4" />)}
                  {r.isActive ? "Deactivate" : "Activate"}
                </DropdownMenuItem>)}
                {isSuperAdmin && (<DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => setRouterToDelete(r as any)}>
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </DropdownMenuItem>)}
              </DropdownMenuContent>
            </DropdownMenu>
          );
        }}
      />

      {/* Router Wizard Dialog */}
      <Dialog open={showWizard} onOpenChange={(open) => { if (!open && wizard.canClose) closeWizard(); }}>
        <DialogContent className="w-full max-w-3xl sm:max-w-3xl" onInteractOutside={(e) => {
          if (!wizard.canClose) e.preventDefault();
        }}>
          <DialogHeader>
            <DialogTitle>{wizardTitle}</DialogTitle>
          </DialogHeader>

          {/* Only show steps for create and setup modes, not for edit */}
          {(wizard.mode === "create" || wizard.mode === "setup") && wizardStep !== "basic" && (
            <StepIndicator current={wizardStep} steps={STEPS} />
          )}

          {/* Step 1 — Basic Info (only for create mode) */}
          {wizardStep === "basic" && wizard.mode === "create" && (
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
                <Button onClick={handleSaveBasic} disabled={submittingBasic}>
                  {submittingBasic ? "Creating…" : "Save & Continue"}
                </Button>
              </div>
            </div>
          )}

          {/* Step 1 — Basic Info (for edit mode) */}
          {wizardStep === "basic" && wizard.mode === "edit" && (
            <div className="flex flex-col gap-4">
              <p className="text-sm text-muted-foreground">Edit router details.</p>

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
                <Button onClick={handleSaveBasic} disabled={submittingBasic}>
                  Update
                </Button>
              </div>
            </div>
          )}

          {/* Step 2 — VPN Script */}
          {wizardStep === "vpn_script" && wizard.mode === "setup" && wizard.router && (
            <div className="flex flex-col gap-4">
              <div className="flex items-start gap-3 rounded-lg border border-border p-3 bg-muted/30">
                <Info className="h-4 w-4 mt-0.5 text-primary shrink-0" />
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Paste this script into your MikroTik router terminal. It will establish a VPN connection back to the {appName} server. Once connected, the status below will update automatically.
                </p>
              </div>
              <CopyableScript content={wizard.vpnScript} onCopy={() => {

                setScriptCopied(true);
                setWizard((prev) => ({ ...prev, pollingStatus: "waiting" }));
              }} />
              {scriptCopied === true && (
                <div className={`flex items-center gap-3 rounded-lg border p-3 transition-colors ${wizard.router.status === "online" ? "border-emerald-500/30 bg-emerald-500/5" : wizard.pollingStatus === "timeout" ? "border-destructive/30 bg-destructive/5" : "border-border"}`}>
                  {wizard.pollingStatus === "waiting" && (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin text-muted-foreground shrink-0" />
                      <div>
                        <p className="text-sm font-medium">Waiting for connection…</p>
                        <p className="text-xs text-muted-foreground">Checking every 30 seconds</p>
                      </div>
                    </>
                  )}
                  {wizard.pollingStatus === "connected" && wizard.routerInfo && wizard.router.status === "online" && (
                    <div className="flex flex-col gap-2 w-full">
                      <div className="flex items-center gap-2">
                        <Wifi className="h-4 w-4 text-emerald-600 shrink-0" />
                        <p className="text-sm font-semibold text-emerald-600">Router Connected</p>
                      </div>
                      <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs">
                        <span className="text-muted-foreground">Model</span><span className="font-medium">{wizard.routerInfo.model}</span>
                        <span className="text-muted-foreground">RouterOS</span><span className="font-medium">{wizard.routerInfo.version}</span>
                      </div>
                    </div>
                  )}
                  {wizard.pollingStatus === "timeout" && wizard.router.status !== "online" && (
                    <>
                      <div className="h-4 w-4 shrink-0 rounded-full bg-destructive/20" />
                      <div>
                        <p className="text-sm font-medium text-destructive">Connection timeout</p>
                        <p className="text-xs text-muted-foreground">Check if script was applied correctly and try again</p>
                      </div>
                    </>
                  )}
                </div>
              )}
              <div className="flex justify-end gap-2">
                <Button onClick={handleProceedToInterfaces} disabled={wizard.router.status !== "online"}>
                  Next: Select Interface(s)
                </Button>
              </div>
            </div>
          )}

          {/* Step 3 — Interface Selection */}
          {wizardStep === "interfaces" && wizard.mode === "setup" && wizard.routerInfo && (
            <div className="flex flex-col gap-4">
              <p className="text-sm text-muted-foreground">
                Select your prefered network interfaces where your billing services will be installed.
              </p>

              <div className="grid grid-cols-[30%_70%] gap-4 max-h-72">

                {/* LEFT — SERVICES */}
                <div className="flex flex-col gap-2 border rounded-lg p-3">
                  <p className="text-xs text-muted-foreground mb-1">Services</p>

                  {SERVICES.map((type) => {
                    const isActive = selectedType === type;
                    const disabled = false;

                    return (
                      <button
                        key={type}
                        onClick={() => handleSelectService(type)}
                        className={`text-left px-3 py-2 rounded-md border transition-colors
              ${isActive ? "border-primary bg-primary/5" : "border-border"}
              ${disabled ? "opacity-50 cursor-not-allowed" : "hover:bg-muted"}
            `}
                      >
                        <span className="text-sm font-medium">{type}</span>
                      </button>
                    );
                  })}
                </div>

                {/* RIGHT — INTERFACES */}
                <div className="flex flex-col gap-2 overflow-y-auto pr-1 border rounded-lg p-3">
                  <p className="text-xs text-muted-foreground mb-1">
                    Interfaces for {selectedType} {isCombinedActive && "(Hotspot and PPPoE)"}
                  </p>

                  {wizard.routerInfo.availableInterfaces.map((iface) => {
                    const selectedList = serviceInterfaces?.interfaces || [];
                    const isSelected = selectedList.includes(iface.name);

                    return (
                      <button
                        key={iface.name}
                        onClick={() => handleSelectInterface(iface.name)}
                        className={`flex items-center justify-between rounded-lg border px-4 py-3 text-left transition-colors
              ${isSelected ? "border-primary bg-primary/5" : "border-border"}
              hover:border-primary hover:bg-primary/5
            `}
                      >
                        <div className="flex items-center gap-3">
                          <div className="h-2 w-2 rounded-full bg-primary" />
                          <code className="text-sm font-mono font-medium">{iface.name}</code>
                          <code className="text-sm font-mono text-muted-foreground">
                            {iface.isRunning ? "Running" : "Idle"}
                          </code>
                        </div>

                        <Badge variant="outline" className="text-xs">
                          {iface.name.includes("wlan")
                            ? "Wireless"
                            : iface.name.includes("bridge")
                              ? "Bridge"
                              : iface.name.includes("ether")
                                ? "Ethernet"
                                : "Interface"}
                        </Badge>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* ACTIONS */}
              <div className="flex justify-end">
                <Button
                  variant="outline"
                  className="mr-1.5"
                  onClick={() => setWizard((w) => ({ ...w, step: "vpn_script", canClose: true }))}
                >
                  Back
                </Button>

                <Button
                  onClick={() => {
                    setWizard((w) => ({ ...w, step: "done", selectedInterface: serviceInterfaces, canClose: false }));
                  }}
                  disabled={(serviceInterfaces?.interfaces || []).length === 0}
                >
                  Preview Setup
                </Button>
              </div>
            </div>
          )}

          {/* Step 4 — Done */}
          {wizardStep === "done" && wizard.mode === "setup" && (
            <div className="flex flex-col items-center gap-4 py-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/10">
                <Network className="h-8 w-8 text-emerald-600" />
              </div>
              <div className="text-center">
                <h3 className="text-lg font-semibold">Billing service interfaces summary</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  <span className="font-medium">{wizard.router?.name}</span> is configured and ready to serve customers through the following interfaces.
                </p>
              </div>
              {wizard.routerInfo && (
                <div className="w-full rounded-lg border border-border p-4 grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
                  <span className="text-muted-foreground">Model</span><span className="font-medium">{wizard.routerInfo.model}</span>
                  <span className="text-muted-foreground">RouterOS</span><span className="font-medium">{wizard.routerInfo.version}</span>
                  <span className="text-muted-foreground">Portal Interfaces</span>
                  <code className="font-mono font-medium">
                    {wizard.selectedInterface?.type} - {wizard.selectedInterface?.interfaces.join(",")}
                  </code>
                </div>
              )}
              <div className="flex justify-end gap-2 pt-2">
                {!loading && (<Button variant="outline" onClick={() => setWizard(w => ({ ...w, step: "interfaces", canClose: true }))}>
                  Back
                </Button>)}
                {!loading && (<Button disabled={(wizard.selectedInterface?.interfaces || []).length == 0} onClick={() => {
                  updateInterfaces();
                }}>
                  <Check className="h-4 w-4 mr-1.5" />
                  Apply Configuration
                </Button>)}
                {loading && (<Progress />)}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>


      {routerToAddWhiteList && (<Dialog open={routerToAddWhiteList != null} onOpenChange={() => setRouterToAddWhiteList(null)}>
        <DialogContent className="w-full max-w-3xl sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Whitelist Access Point</DialogTitle>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-4">
            {/* Name */}
            <div className="flex flex-col gap-1.5">
              <Label>
                AP Name <span className="text-destructive">*</span>
              </Label>
              <Input
                placeholder="e.g. Main Gateway AP"
                value={whitelistForm.name}
                onChange={(e) => {
                  setWhitelistForm((f) => ({ ...f, name: e.target.value }));
                  setWhitelistErrors((er) => ({ ...er, name: undefined }));
                }}
              />
              {whitelistErrors.name && (
                <p className="text-xs text-destructive">
                  {whitelistErrors.name}
                </p>
              )}
            </div>

            {/* MAC */}
            <div className="flex flex-col gap-1.5">
              <Label>
                MAC Address <span className="text-destructive">*</span>
              </Label>
              <Input
                placeholder="e.g. 9C:E5:49:62:DC:9C"
                value={whitelistForm.mac}
                onChange={(e) => {
                  setWhitelistForm((f) => ({ ...f, mac: e.target.value }));
                  setWhitelistErrors((er) => ({ ...er, mac: undefined }));
                }}
              />
              {whitelistErrors.mac && (
                <p className="text-xs text-destructive">
                  {whitelistErrors.mac}
                </p>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 mt-6">
            <Button
              variant="outline"
              onClick={() => setRouterToAddWhiteList(null)}
            >
              Cancel
            </Button>

            <Button disabled={!isFormValid} onClick={handleWhitelist}>
              Whitelist Now
            </Button>
          </div>
        </DialogContent>
      </Dialog>)}

      {routerToDelete && (<ConfirmDialog
        open={routerToDelete !== null}
        title="Delete Router"
        message={`Are you sure you want to delete ${routerToDelete!.name}? This action cannot be undone.`}
        variant="destructive"
        onCancel={() => setRouterToDelete(null)}
        onConfirm={async () => {
          const routerId = routerToDelete!._id;
          setRouterToDelete(null);
          try {
            const { message } = await apiClient.routers.delete(routerId);
            toast({ title: "Device deletion", description: message });
            load();
          } catch {
            toast({ title: "Error", description: "Failed to delete router.", variant: "destructive" });
          }
        }}
      />)}
    </div>
  );
}