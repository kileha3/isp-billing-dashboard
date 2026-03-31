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
import { Plus, MoreHorizontal, Pencil, Trash2, Router, Filter } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import type { Package, RouterDevice, Tenant } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";
import { usePageTitle } from "@/hooks/use-page-title";
import { z } from "zod";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

const packageSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  price: z.coerce.number().min(0, "Price must be 0 or more"),
  duration: z.coerce.number().int().min(1, "Duration must be at least 1"),
  dataLimit: z.coerce.number().min(0, "Data limit must be 0 or more"),
  speedLimit: z.coerce.number().min(0, "Speed limit must be 0 or more"),
});

type DurationUnit = "minutes" | "hours" | "days" | "months";

type PackageForm = {
  name: string;
  description: string;
  price: number;
  duration: string;
  durationUnit: DurationUnit;
  dataLimit: string;
  speedLimit: string;
  isPublic: boolean;
  isFree: boolean;
  tenantId: string;
  routerIds: string[];
};

const DEFAULT_FORM: PackageForm = {
  name: "", description: "", price: 1000, duration: "", durationUnit: "hours", isFree: false,
  dataLimit: "", speedLimit: "", isPublic: true, tenantId: "", routerIds: [],
};

function formatDuration(value: number, unit: string) {
  if (unit === "minutes") return value < 60 ? `${value}m` : `${Math.round(value / 60)}h`;
  if (unit === "hours") return `${value}h`;
  if (unit === "days") return `${value}d`;
  if (unit === "months") return `${value} mo`;
  // Legacy: treat as raw minutes
  if (value < 60) return `${value}m`;
  if (value < 1440) return `${Math.round(value / 60)}h`;
  return `${Math.round(value / 1440)}d`;
}

function formatData(mb: number) {
  if (mb === 0) return "Unlimited";
  if (mb >= 1024) return `${(mb / 1024).toFixed(0)}GB`;
  return `${mb}MB`;
}

function formatSpeed(mb: number) {
  if (mb === 0) return "Unlimited";
  return `${mb}Mbps`;
}

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

  usePageTitle("Packages");
  const isSuperAdmin = isRole("super_admin");
  const [statusFilter, setStatusFilter] = useState("all");

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
    } catch {
      setPackages([]);
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
      description: pkg.description ?? "",
      price: pkg.price,
      duration: String(pkg.duration),
      durationUnit: (pkg.durationUnit as DurationUnit) ?? "hours",
      dataLimit: String(pkg.dataLimit),
      speedLimit: String(pkg.speedLimit),
      isPublic: pkg.isPublic,
      tenantId: pkg.tenantId,
      routerIds: pkg.routerIds ?? [],
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
    };
    try {
      if (editTarget) {
        await apiClient.packages.update(editTarget._id, payload);
        toast({ title: "Package updated" });
        load();
      } else {
        await apiClient.packages.create(payload);
        toast({ title: "Package created" });
      }
      setShowDialog(false);
      load();
    } catch {
      toast({ title: "Error", description: "Failed to save package.", variant: "destructive" });
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
    ...(isSuperAdmin ? [{ key: "tenantId", label: "Tenant", render: (v: unknown) => <span className="text-sm text-muted-foreground">{getTenantName(String(v))}</span> }] : []),
    { key: "price", label: "Price (Tsh)", render: (v: unknown) => <span className="font-semibold">{v === 0 ? "Free": `Tsh ${Number(v).toLocaleString()}`}</span> },
    {
      key: "duration", label: "Duration",
      render: (v: unknown, row: unknown) => {
        const pkg = row as unknown as Package;
        return formatDuration(Number(v), pkg.durationUnit ?? "minutes");
      }
    },
    { key: "dataLimit", label: "Data", render: (v: unknown) => formatData(Number(v)) },
    { key: "speedLimit", label: "Speed", render: (v: unknown) => formatSpeed(Number(v)) },
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
    { key: "isPublic", label: "Visibility", render: (v: unknown) => <StatusBadge status={v ? "public" : "private"} /> },
  ];

  const availableRouters = getAvailableRouters();

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
        data={(statusFilter === "all" ? packages : packages.filter(p => p.isPublic === (statusFilter === "true"))) as unknown as Record<string, unknown>[]}
        columns={columns as never}
        loading={loading}
        searchable
        searchKeys={["name"] as never}
        searchPlaceholder="packages"
        emptyMessage="No packages yet."
        pageSize={10}
        filterSlot={
          <div className="flex gap-3">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
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
              <DropdownMenuItem className="text-destructive" onClick={() => setPackageToDelete  (row as unknown as Package)}>
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
            <div className="col-span-2 flex flex-col gap-1.5">
              <Label>Package Name</Label>
              <Input placeholder="e.g. Daily 1GB" value={form.name} onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="col-span-2 flex flex-col gap-1.5">
              <Label>Description</Label>
              <Input placeholder="Short description" value={form.description} onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))} />
            </div>

            {/* Tenant association (super admin only) */}
            {isSuperAdmin && (
              <div className="col-span-2 flex flex-col gap-1.5">
                <Label>Tenant</Label>
                <Select value={form.tenantId} onValueChange={setFormTenantId}>
                  <SelectTrigger><SelectValue placeholder="Select tenant" /></SelectTrigger>
                  <SelectContent>
                    {tenants.map(t => <SelectItem key={t._id} value={t._id}>{t.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="flex flex-col gap-1.5">
              <Label>Price (Tsh)</Label>
              <Input type="number" placeholder="100" value={form.price} onChange={(e) => setForm(f => ({ ...f, price: parseInt(e.target.value) }))} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Duration</Label>
              <div className="flex gap-2">
                <Input type="number" placeholder="1" value={form.duration} onChange={(e) => setForm(f => ({ ...f, duration: e.target.value }))} className="flex-1 min-w-0" />
                <Select value={form.durationUnit} onValueChange={(v) => setForm(f => ({ ...f, durationUnit: v as DurationUnit }))}>
                  <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="minutes">Minutes</SelectItem>
                    <SelectItem value="hours">Hours</SelectItem>
                    <SelectItem value="days">Days</SelectItem>
                    <SelectItem value="months">Months</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Data Limit (MB, 0 = unlimited)</Label>
              <Input type="number" placeholder="1024" value={form.dataLimit} onChange={(e) => setForm(f => ({ ...f, dataLimit: e.target.value }))} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Speed Limit (Mbps, 0 = unlimited)</Label>
              <Input type="number" placeholder="10" value={form.speedLimit} onChange={(e) => setForm(f => ({ ...f, speedLimit: e.target.value }))} />
            </div>
            <div className="col-span-2 flex items-center gap-6">
              <div className="flex items-center gap-3">
                <Switch checked={form.isPublic} onCheckedChange={(v) => setForm(f => ({ ...f, isPublic: v }))} id="isPublic" />
                <Label htmlFor="isPublic">Let user see this package</Label>
              </div>

              <div className="flex items-center gap-3">
                <Switch checked={form.isFree} onCheckedChange={(v) => setForm(f => ({ ...f, isFree: v, price: 0 }))} id="isFree" />
                <Label htmlFor="isFree">Free package</Label>
              </div>
            </div>


            {/* Router mapping */}
            <div className="col-span-2 flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <Label>Router Mapping</Label>
                <span className="text-xs text-muted-foreground">
                  {form.routerIds.length === 0 ? "Shown on all routers" : `${form.routerIds.length} router(s) selected`}
                </span>
              </div>
              {availableRouters.length === 0 ? (
                <p className="text-xs text-muted-foreground py-2">
                  {isSuperAdmin && !form.tenantId ? "Select a tenant to see its routers." : "No routers available. Add routers first."}
                </p>
              ) : (
                <div className="rounded-md border border-border divide-y divide-border">
                  {availableRouters.map(router => (
                    <label key={router._id} className="flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-muted/40 transition-colors">
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
              {availableRouters.length > 0 && (
                <p className="text-xs text-muted-foreground">Leave unchecked to show this package on all routers.</p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={submitting || !packageFormValid}>
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
                  toast({ title: message });
                  load();
                } catch {
                  toast({ title: "Error", description: "Failed to delete package.", variant: "destructive" });
                }
              }}
            />)}
    </div>
  );
}
