"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import { useRouter } from "next/navigation";
import { apiClient } from "@/lib/api";
import { DataTable } from "@/components/admin/DataTable";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, MoreHorizontal, Pencil, Trash2, Palette, PowerOff, Power, Filter } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { Tenant } from "@/lib/types";
import { z } from "zod";
import { usePageTitle } from "@/hooks/use-page-title";

const tenantSchema = z.object({
  name: z.string().min(2, "Business name must be at least 2 characters"),
  adminName: z.string().min(2, "Admin name is required"),
  adminEmail: z.string().email("Enter a valid email address"),
});

type TenantForm = {
  name: string;
  adminName: string;
  adminEmail: string;
};

const DEFAULT_FORM: TenantForm = {
  name: "", adminName: "", adminEmail: ""
};

export default function TenantsPage() {
  usePageTitle("Tenants");
  const { isRole } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");
  const [showDialog, setShowDialog] = useState(false);
  const [form, setForm] = useState<TenantForm>(DEFAULT_FORM);
  const [errors, setErrors] = useState<Partial<Record<keyof TenantForm, string>>>({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!isRole("super_admin")) router.push("/dashboard");
  }, [isRole, router]);

  const load = useCallback(async () => {
    try {
      const { data } = await apiClient.tenants.list();
      setTenants(data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  function validate(): boolean {
    const payload = {
      name: form.name, adminName: form.adminName,
      adminEmail: form.adminEmail

    };
    const result = tenantSchema.safeParse(payload);
    if (!result.success) {
      const errs: Partial<Record<keyof TenantForm, string>> = {};
      result.error.errors.forEach(e => {
        const field = e.path[0] as keyof TenantForm;
        if (!errs[field]) errs[field] = e.message;
      });
      setErrors(errs);
      return false;
    }
    setErrors({});
    return true;
  }

  function isFormValid(): boolean {
    const base = form.name.length >= 2 && form.adminName.length >= 2 && form.adminEmail.includes("@")
    if (!base) return false;
    return true;
  }

  async function handleCreate() {
    if (!validate()) return;
    setSubmitting(true);
    try {
      const { data: { message, success, tenantId } } = await apiClient.tenants.create({
        name: form.name, adminName: form.adminName, adminEmail: form.adminEmail,
      });

      toast({ title: "New tenant", description: message });
      // Auto-redirect to portal design page
      if (success) {
        setShowDialog(false);
        setForm(DEFAULT_FORM);
        load();
        router.push(`/dashboard/tenants/${tenantId}/portal`);
      }
    } catch {
      toast({ title: "Error", description: "Failed to create tenant.", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleToggleStatus(tenant: Tenant) {
    const newStatus = tenant.status === "active" ? "suspended" : "active";
    try {
      await apiClient.tenants.updateStatus(tenant._id, newStatus);
      toast({ title: `Tenant ${newStatus === "active" ? "activated" : "suspended"}` });
      load();
    } catch {
      toast({ title: "Error", description: "Failed to update status.", variant: "destructive" });
    }
  }

  async function handleDelete(tenant: Tenant) {
    if (!confirm(`Permanently delete "${tenant.name}"? This cannot be undone.`)) return;
    try {
      await apiClient.tenants.delete(tenant._id);
      toast({ title: "Tenant deleted" });
      load();
    } catch {
      toast({ title: "Error", description: "Failed to delete tenant.", variant: "destructive" });
    }
  }

  function setField<K extends keyof TenantForm>(key: K, value: TenantForm[K]) {
    setForm(f => ({ ...f, [key]: value }));
    setErrors(e => ({ ...e, [key]: undefined }));
  }

  const columns = [
    { key: "createdAt", label: "Created", render: (v: unknown) => new Date(String(v)).toLocaleDateString() },
    { key: "name", label: "Business Name" },
    {
      key: "branding", label: "Brand Color",
      render: (v: unknown) => {
        const b = v as Tenant["branding"];
        return (
          <div className="flex items-center gap-2">
            <div className="h-4 w-4 rounded-full border border-border" style={{ background: b.primaryColor }} />
            <span className="text-xs font-mono text-muted-foreground">{b.primaryColor}</span>
          </div>
        );
      }
    },
    {
      key: "currency", label: "Currency", render: (v: unknown, row: any) => {
        return (row as Tenant).settings.currency;
      }
    },
    {
      key: "timezone", label: "TimeZone", render: (v: unknown, row: any) => {
        return (row as Tenant).settings.timezone;
      }
    },
    { key: "status", label: "Status", render: (v: unknown) => <StatusBadge status={String(v)} /> },

  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Tenants</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage ISP providers on the platform</p>
        </div>
        <Button onClick={() => setShowDialog(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Tenant
        </Button>
      </div>

      <DataTable
        data={(statusFilter === "all" ? tenants : tenants.filter(t => t.status === statusFilter)) as unknown as Record<string, unknown>[]}
        columns={columns as never}
        loading={loading}
        searchable
        searchKeys={["name"] as never}
        searchPlaceholder="tenants"
        emptyMessage="No tenants yet."
        pageSize={10}
        filterSlot={
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-10 w-44 bg-background">
              <Filter className="h-3.5 w-3.5 mr-2 text-muted-foreground" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="suspended">Suspended</SelectItem>
            </SelectContent>
          </Select>
        }
        actions={(row) => {
          const t = row as unknown as Tenant;
          return (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => router.push(`/dashboard/tenants/${t._id}/portal`)}>
                  <Palette className="mr-2 h-4 w-4" />
                  Portal Design
                </DropdownMenuItem>
                {/* <DropdownMenuItem onClick={() => {
                  setForm({
                    name: t.name, adminName: "", adminEmail: "",
  chargingMode: "revenue_share", revenueSharePercent: "10", fixedAmount: "", fixedDuration: "monthly",
                  });
                  setShowDialog(true);
                }}>
                  <Pencil className="mr-2 h-4 w-4" />
                  Edit Details
                </DropdownMenuItem> */}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => handleToggleStatus(t)}>
                  {t.status === "active"
                    ? <><PowerOff className="mr-2 h-4 w-4" />Suspend</>
                    : <><Power className="mr-2 h-4 w-4" />Activate</>
                  }
                </DropdownMenuItem>
                {/* <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => handleDelete(t)}>
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </DropdownMenuItem> */}
              </DropdownMenuContent>
            </DropdownMenu>
          );
        }}
      />

      {/* Create Tenant Dialog */}
      <Dialog open={showDialog} onOpenChange={(open) => { setShowDialog(open); if (!open) { setForm(DEFAULT_FORM); setErrors({}); } }}>
        <DialogContent className="w-full max-w-lg sm:max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add Tenant</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-5 py-2">

            {/* Business info */}
            <div className="flex flex-col gap-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Business Info</p>
              <div className="flex flex-col gap-1.5">
                <Label>Business Name <span className="text-destructive">*</span></Label>
                <Input
                  placeholder="e.g. FastNet ISP"
                  value={form.name}
                  onChange={(e) => setField("name", e.target.value)}
                />
                {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
              </div>

            </div>

            {/* Admin account */}
            <div className="flex flex-col gap-3 border-t border-border pt-4">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Admin Account</p>
              <div className="flex flex-col gap-1.5">
                <Label>Admin Name <span className="text-destructive">*</span></Label>
                <Input placeholder="Full name" value={form.adminName} onChange={(e) => setField("adminName", e.target.value)} />
                {errors.adminName && <p className="text-xs text-destructive">{errors.adminName}</p>}
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Admin Email <span className="text-destructive">*</span></Label>
                <Input type="email" placeholder="admin@fastnet.com" value={form.adminEmail} onChange={(e) => setField("adminEmail", e.target.value)} />
                {errors.adminEmail && <p className="text-xs text-destructive">{errors.adminEmail}</p>}
              </div>

            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowDialog(false); setForm(DEFAULT_FORM); setErrors({}); }}>Cancel</Button>
            <Button onClick={handleCreate} disabled={submitting || !isFormValid()}>
              {submitting ? "Creating…" : "Create Tenant"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
