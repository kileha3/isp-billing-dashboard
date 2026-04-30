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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, MoreHorizontal, Pencil, Trash2, Router, Filter, Users } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import type { Package, RouterDevice, Tenant } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";
import { usePageTitle } from "@/hooks/use-page-title";
import { z } from "zod";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { labels } from "@/components/portal/CaptivePortalClient";

const packageSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  maxUsers: z.coerce.number().int().min(0, "Max connection must be at least 0").max(10000, "Max connection must be at most 10000"),
  maxReconnects: z.coerce.number().int().min(0, "Max sessions must be at least 0").max(1000, "Max sessions must be at most 1000"),
  price: z.coerce.number().min(0, "Price must be 0 or more"),
  duration: z.coerce.number().int().min(1, "Duration must be at least 1"),
  dataLimit: z.coerce.number().min(0, "Data limit must be 0 or more"),
  speedLimit: z.coerce.number().min(0, "Speed limit must be 0 or more"),
  routerIds: z.array(z.string()).min(1, "At least one router must be selected"),
});

type DurationUnit = "minutes" | "hours" | "days" | "months";

export const formatDuration = (value: number, unit: string, lan: string) => {
  return lan === "en" ? `${value} ${unit}`: `${unit} ${value} `;
}

export const formatData = (mb: number, unit: string, unlimited: string) => {
  if (mb === 0) return unlimited;
  if (unit === "GB") return `${mb}${unit}`
  if (mb >= 1024 && unit === "MB") return `${(mb / 1024).toFixed(0)}GB`;
  return `${mb}MB`;
}

export const formatSpeed = (mb: number, unlimited: string) => {
  if (mb === 0) return unlimited;
  return `${mb}Mbps`;
}

type DataLimitUnit = "GB" | "MB"

type PackageForm = {
  name: string;
  maxUsers: number;
  maxReconnects: number;
  description: string;
  price: number;
  duration: string;
  durationUnit: DurationUnit;
  dataLimit: string;
  dataLimitUnit: string;
  speedLimit: string;
  isPublic: boolean;
  isFree: boolean;
  isPpPoe: boolean;
  tenantId: string;
  routerIds: string[];
};

const DEFAULT_FORM: PackageForm = {
  name: "", maxUsers: 1, maxReconnects: 3, description: "", price: 0, duration: "", durationUnit: "hours", isFree: false, isPpPoe: false,
  dataLimit: "0", speedLimit: "0", dataLimitUnit: "GB", isPublic: true, tenantId: "", routerIds: [],
};

export default function PackagesPage() {
  const { isRole, user } = useAuth();
  const { toast } = useToast();
  const [packages, setPackages] = useState<Package[]>([]);
  const [routers, setRouters] = useState<RouterDevice[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [editTarget, setEditTarget] = useState<Package | null>(null);
  const [form, setForm] = useState<PackageForm>(DEFAULT_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [packageToDelete, setPackageToDelete] = useState<Package | null>(null);
  const language = "en";

  usePageTitle("Packages");
  const isSuperAdmin = isRole("super_admin");
  const [statusFilter, setStatusFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");

  const load = useCallback(async () => {
    try {
      const [pkgData, routerData] = await Promise.allSettled([
        apiClient.packages.list(),
        apiClient.routers.list(),
      ]);
      if (pkgData.status === "fulfilled") setPackages(pkgData.value.data);
      else setPackages([]);
      if (routerData.status === "fulfilled") setRouters(routerData.value.data);
      else setRouters([]);
    } catch (error: any) {
      setPackages([]);
      setRouters([]);
      toast({ title:  error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, []);

  const loadTenants = useCallback(async () => {
    if (!isSuperAdmin) return;
    try {
      const { data } = await apiClient.tenants.list();
      setTenants(data);
    } catch (error: any) {
      setTenants([]);
      toast({ title:  error.message, variant: "destructive" });
    }
  }, [isSuperAdmin]);

  useEffect(() => { load(); loadTenants(); }, [load, loadTenants]);

  // When tenantId in form changes, reset router selection
  function setFormTenantId(tid: string) {
    setForm(f => ({ ...f, tenantId: tid, routerIds: [] }));
  }

  // Get routers filtered by selected tenant (or current user's tenant)
  function getAvailableRouters(): RouterDevice[] {
    const tid = form.tenantId || user?.tenantId;
    if (!tid) return routers;
    return routers.filter(r => r.tenantId === tid);
  }

  function openAdd() {
    setEditTarget(null);
    setForm({ ...DEFAULT_FORM, tenantId: isSuperAdmin ? "" : (user?.tenantId ?? "") });
    setShowDialog(true);
  }

  function openEdit(pkg: Package) {
    setEditTarget(pkg);
    setForm({
      name: pkg.name,
      maxUsers: pkg.maxUsers ?? 1,
      maxReconnects: pkg.maxReconnects ?? 3,
      description: pkg.description ?? "",
      price: pkg.price,
      duration: String(pkg.duration),
      durationUnit: (pkg.durationUnit as DurationUnit) ?? "hours",
      dataLimit: String(pkg.dataLimit),
      speedLimit: String(pkg.speedLimit),
      dataLimitUnit: (pkg.dataLimitUnit as DataLimitUnit) ?? "GB",
      isPublic: pkg.isPublic,
      tenantId: pkg.tenantId,
      routerIds: pkg.routerIds ?? [],
      isPpPoe: pkg.isPpPoe,
      isFree: pkg.isFree
    });
    setShowDialog(true);
  }

  function toggleRouter(routerId: string) {
    setForm(f => ({
      ...f,
      routerIds: f.routerIds.includes(routerId)
        ? f.routerIds.filter(id => id !== routerId)
        : [...f.routerIds, routerId],
    }));
  }

  async function handleSubmit() {
    setSubmitting(true);
    const payload = {
      ...form,
      price: Number(form.price),
      duration: Number(form.duration),
      dataLimit: Number(form.dataLimit),
      speedLimit: Number(form.speedLimit),
      maxUsers: Number(form.maxUsers),
      maxReconnects: Number(form.maxReconnects),
    };
    
    // Validate router selection for new packages
    if (!editTarget && payload.routerIds.length === 0) {
      toast({ 
        title: "Validation Error", 
        description: "Please select at least one router for the package.", 
        variant: "destructive" 
      });
      setSubmitting(false);
      return;
    }
    
    try {
      if (editTarget) {
        await apiClient.packages.update(editTarget._id, payload);
        toast({ title: "Package updates", description:"Package was updated successfully" });
        load();
      } else {
        await apiClient.packages.create(payload);
        toast({ title: "Package creation", description:"Package created successfully" });
      }
      setShowDialog(false);
      load();
    } catch (error: any) {
     toast({ title:  error.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  }

  function getTenantName(tenantId: string) {
    return tenants.find(t => t._id === tenantId)?.name ?? (tenantId || "—");
  }

  function getRouterNames(routerIds: string[]) {
    if (!routerIds || routerIds.length === 0) return null;
    return routerIds.map(id => routers.find(r => r._id === id)?.name ?? null).filter(Boolean);
  }

  const packageFormValid = packageSchema.safeParse(form).success;

  const columns = [
    { key: "name", label: "Name" },
    { key: "maxUsers", label: "Connections", render: (v: unknown, row: unknown) => {
      const pkg = row as unknown as Package;
      return pkg.isPpPoe && v == 0 ? "Unlimited": Number(v)
    }},
    { key: "maxReconnects", label: "Reconnets", render: (v: unknown, row: unknown) => {
      const pkg = row as unknown as Package;
      return pkg.isPpPoe && v == 0 ? "Unlimited": Number(v)
    }},
    ...(isSuperAdmin ? [{ key: "tenantId", label: "Tenant", render: (v: unknown) => <span className="text-sm text-muted-foreground">{getTenantName(String(v))}</span> }] : []),
    { key: "price", label: "Price", render: (v: unknown, row: unknown) => <span className="font-semibold">{v === 0 ? "Free" : `${(row as Package).currency ?? "TZS"} ${Number(v).toLocaleString()}`}</span> },
    {
      key: "duration", label: "Duration",
      render: (v: unknown, row: unknown) => {
        const pkg = row as unknown as Package;
        return formatDuration(Number(v), labels[language]?.duration[pkg.durationUnit] ?? "minutes", language);
      }
    },
    { key: "dataLimit", label: "Data", render: (v: unknown, row: unknown) => {
       const pkg = row as unknown as Package;
      return formatData(Number(v), pkg.dataLimitUnit, labels[language]?.unlimited); 
    }},
    { key: "speedLimit", label: "Speed", render: (v: unknown) => formatSpeed(Number(v), labels[language]?.unlimited) },
    {
      key: "routerIds", label: "Routers",
      render: (v: unknown) => {
        const ids = v as string[];
        if (!ids || ids.length === 0) {
          return <Badge variant="outline" className="text-xs text-muted-foreground">All routers</Badge>;
        }
        const names = getRouterNames(ids);
        return (
          <div className="flex flex-wrap gap-1">
            {names?.map(name => (
              <Badge key={name} variant="secondary" className="text-xs flex items-center gap-1">
                <Router className="h-3 w-3" />{name}
              </Badge>
            ))}
          </div>
        );
      }
    },
    { key: "isPpPoe", label: "Category", render: (v: unknown) => (v ? "PPPoE" : "Hotspot") },
    { key: "isPublic", label: "Visibility", render: (v: unknown) => <StatusBadge status={v ? "public" : "private"} /> },
  ];

  const availableRouters = getAvailableRouters();

  const getFilteredSessions = () => {
    let filtered = (statusFilter === "all" ? packages : packages.filter(p => p.isPublic === (statusFilter === "true")));
    if(categoryFilter !== "all"){
      filtered = filtered.filter(p => p.isPpPoe === (categoryFilter === "true"));
    }

    if(typeFilter !== "all"){
      filtered = filtered.filter(p => p.isFree === (typeFilter === "true"));
    }
    return filtered as unknown as Record<string, unknown>[];
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Packages</h1>
          <p className="text-sm text-muted-foreground mt-1">Create your prefered packages available to customers</p>
        </div>
        <Button onClick={openAdd}>
          <Plus className="h-4 w-4 mr-2" />
          Add Package
        </Button>
      </div>

      <DataTable
        data={getFilteredSessions()}
        columns={columns as never}
        loading={loading}
        searchable
        searchKeys={["name"] as never}
        searchPlaceholder="packages"
        emptyMessage="No packages yet."
        pageSize={10}
        filterSlot={
          <div className="flex gap-3">
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="h-10 w-44 bg-background">
                <Filter className="h-3.5 w-3.5 mr-2 text-muted-foreground" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All types</SelectItem>
                <SelectItem value="false">Paid</SelectItem>
                <SelectItem value="true">Free</SelectItem>
              </SelectContent>
            </Select>

            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="h-10 w-44 bg-background">
                <Filter className="h-3.5 w-3.5 mr-2 text-muted-foreground" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All categories</SelectItem>
                <SelectItem value="true">PPPoE</SelectItem>
                <SelectItem value="false">Hotspot</SelectItem>
              </SelectContent>
            </Select>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="h-10 w-44 bg-background">
                <Filter className="h-3.5 w-3.5 mr-2 text-muted-foreground" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All visibilities</SelectItem>
                <SelectItem value="false">Private</SelectItem>
                <SelectItem value="true">Public</SelectItem>
              </SelectContent>
            </Select>
          </div>
        }
        actions={(row) => (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => openEdit(row as unknown as Package)}>
                <Pencil className="mr-2 h-4 w-4" />Edit
              </DropdownMenuItem>
              <DropdownMenuItem className="text-destructive" onClick={() => setPackageToDelete(row as unknown as Package)}>
                <Trash2 className="mr-2 h-4 w-4" />Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      />

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editTarget ? "Edit Package" : "Add Package"}</DialogTitle>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-4 py-2 max-h-[70vh] overflow-y-auto pr-1">
            {/* Package Name - Full width */}
            <div className="col-span-2 flex flex-col gap-1.5">
              <Label>Package Name</Label>
              <Input
                placeholder="e.g. Daily Unlimited Internet"
                value={form.name}
                onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))}
              />
            </div>

            {/* Tenant association (super admin only) */}
            {isSuperAdmin && (
              <div className="col-span-2 flex flex-col gap-1.5">
                <Label>Tenant</Label>
                <Select value={form.tenantId} onValueChange={setFormTenantId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select tenant" />
                  </SelectTrigger>
                  <SelectContent>
                    {tenants.map(t => (
                      <SelectItem key={t._id} value={t._id}>{t.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="flex flex-col gap-1.5">
              <Label>Price (Tsh)</Label>
              <Input
                type="number"
                placeholder="0"
                value={form.price === 0 ? "" : form.price}
                onChange={(e) => {
                  const value = e.target.value === "" ? 0 : parseInt(e.target.value) || 0;
                  setForm(f => ({ ...f, price: value }));
                }}
              />
            </div>

            {/* Duration */}
            <div className="flex flex-col gap-1.5">
              <Label>Duration</Label>
              <div className="flex gap-2">
                <Input
                  type="number"
                  placeholder="1"
                  value={form.duration}
                  onChange={(e) => setForm(f => ({ ...f, duration: e.target.value }))}
                  className="flex-1 min-w-0"
                />
                <Select
                  value={form.durationUnit}
                  onValueChange={(v) => setForm(f => ({ ...f, durationUnit: v as DurationUnit }))}
                >
                  <SelectTrigger className="w-28">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="minutes">Minutes</SelectItem>
                    <SelectItem value="hours">Hours</SelectItem>
                    <SelectItem value="days">Days</SelectItem>
                    <SelectItem value="weeks">Weeks</SelectItem>
                    <SelectItem value="months">Months</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Speed Limit */}
            <div className="flex flex-col gap-1.5">
              <Label>Speed Limit (Mbps, 0 = unlimited)</Label>
              <Input
                type="number"
                placeholder="10"
                value={form.speedLimit}
                onChange={(e) => setForm(f => ({ ...f, speedLimit: e.target.value }))}
              />
            </div>

            {/* Data Limit - Split into value + unit (GB/MB) */}
            <div className="flex flex-col gap-1.5">
              <Label>Data Limit (0 = unlimited)</Label>
              <div className="flex gap-2">
                <Input
                  type="number"
                  placeholder="1"
                  value={form.dataLimit}
                  onChange={(e) => setForm(f => ({ ...f, dataLimit: e.target.value }))}
                  className="flex-1 min-w-0"
                />
                <Select
                  value={form.dataLimitUnit || "GB"}
                  onValueChange={(v) => setForm(f => ({ ...f, dataLimitUnit: v as "MB" | "GB" }))}
                >
                  <SelectTrigger className="w-24">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="MB">MB</SelectItem>
                    <SelectItem value="GB">GB</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Max Users & Max Sessions Row */}
            {!form.isPpPoe && (<div className="col-span-2 grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <Label className="flex items-center gap-2">
                  Connections
                </Label>
                <Input
                  type="number"
                  min="1"
                  placeholder="1"
                  value={form.maxUsers === 0 ? "" : form.maxUsers}
                  onChange={(e) => {
                    const value = e.target.value === "" ? 0 : parseInt(e.target.value) || 1;
                    setForm(f => ({ ...f, maxUsers: value }));
                  }}
                />
                <span className="text-xs text-muted-foreground">Simultaneous connections per device</span>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label className="flex items-center gap-2">
                  Reconnects (0 = unlimited)
                </Label>
                <Input
                  type="number"
                  min="1"
                  max="10"
                  placeholder="1"
                  value={form.maxReconnects === 0 ? "" : form.maxReconnects}
                  onChange={(e) => {
                    const value = e.target.value === "" ? 0 : parseInt(e.target.value) || 1;
                    setForm(f => ({ ...f, maxReconnects: Math.min(value, 10000) }));
                  }}
                />
                <span className="text-xs text-muted-foreground">Maximum reconnects per session</span>
              </div>
            </div>)}

            {/* Toggle Switches Row */}
            <div className="col-span-2 flex items-center gap-6">
              <div className="flex items-center gap-3">
                <Switch
                  checked={form.isPublic}
                  onCheckedChange={(v) => setForm(f => ({ ...f, isPublic: v }))}
                  id="isPublic"
                />
                <Label htmlFor="isPublic">Make it Public</Label>
              </div>

              <div className="flex items-center gap-3">
                <Switch
                  checked={form.isFree}
                  onCheckedChange={(v) => setForm(f => ({ ...f, isFree: v, price: 0 }))}
                  id="isFree"
                />
                <Label htmlFor="isFree">Free package</Label>
              </div>

              <div className="flex items-center gap-3">
                <Switch
                  checked={form.isPpPoe}
                  onCheckedChange={(v) => setForm(f => ({ ...f, isPpPoe: v, maxUsers: v ? 0:1, maxReconnects: v ? 0: 3 }))}
                  id="isPpPoe" 
                />
                <Label htmlFor="isPpPoe">Is PPPoE</Label>
              </div>
            </div>

            {/* Router mapping */}
            <div className="col-span-2 flex flex-col gap-2 mt-4">
              <div className="flex items-center justify-between">
                <Label className={!editTarget && form.routerIds.length === 0 ? "" : ""}>
                  Router Mapping {!editTarget && <span className="text-xs">*</span>}
                </Label>
                <span className="text-xs text-muted-foreground">
                  {form.routerIds.length === 0 ? "" : `${form.routerIds.length} router(s) selected`}
                </span>
              </div>

              {availableRouters.length === 0 ? (
                <p className="text-xs text-muted-foreground py-2">
                  {isSuperAdmin && !form.tenantId
                    ? "Select a tenant to see its routers."
                    : "No routers available. Add routers first."}
                </p>
              ) : (
                <div className={`rounded-md border border-border divide-y divide-border ${!editTarget && form.routerIds.length === 0 ? 'border-destructive' : ''}`}>
                  {availableRouters.map(router => (
                    <label
                      key={router._id}
                      className="flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-muted/40 transition-colors"
                    >
                      <Checkbox
                        checked={form.routerIds.includes(router._id)}
                        onCheckedChange={() => toggleRouter(router._id)}
                      />
                      <div className="flex flex-col gap-0.5 flex-1 min-w-0">
                        <span className="text-sm font-medium">{router.name}</span>
                        <span className="text-xs text-muted-foreground">{router.location}</span>
                      </div>
                      <StatusBadge status={router.status} />
                    </label>
                  ))}
                </div>
              )}

              {availableRouters.length > 0 && !editTarget && form.routerIds.length === 0 && (
                <p className="text-xs text-destructive">
                  Please select at least one router.
                </p>
              )}
              
              {availableRouters.length > 0 && editTarget && (
                <p className="text-xs text-muted-foreground">
                  Leave unchecked to show this package on all routers.
                </p>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleSubmit} 
              disabled={submitting || !packageFormValid || (!editTarget && form.routerIds.length === 0)}
            >
              {submitting ? "Saving…" : editTarget ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {packageToDelete && (<ConfirmDialog
        open={packageToDelete !== null}
        title="Delete Package"
        message={`Are you sure you want to delete ${packageToDelete!.name}? This action cannot be undone.`}
        variant="destructive"
        onCancel={() => setPackageToDelete(null)}
        onConfirm={async () => {
          const packageId = packageToDelete!._id;
          setPackageToDelete(null);
          try {
            const { message } = await apiClient.packages.delete(packageId);
            toast({ description: message , title:"Package deletion"});
            load();
          } catch (error: any) {
            toast({ title:  error.message, variant: "destructive" });
          }
        }}
      />)}
    </div>
  );
}