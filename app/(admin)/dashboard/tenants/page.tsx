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
import { Switch } from "@/components/ui/switch";
import { Plus, MoreHorizontal, Palette, PowerOff, Power, Filter } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { Tenant } from "@/lib/types";
import { z } from "zod";
import { usePageTitle } from "@/hooks/use-page-title";

// Updated Zod schema with proper conditional validation for paymentPref
const tenantSchema = z.object({
  name: z.string().min(2, "Business name must be at least 2 characters"),
  adminName: z.string().min(2, "Admin name is required"),
  adminEmail: z.string().email("Enter a valid email address"),
  paymentPref: z.object({
    enableCharges: z.boolean(),
    registrationFee: z.number().min(0, "Registration fee must be 0 or greater"),
    monthlyFee: z.number().min(-1, "Monthly fee must be 0 or greater"),
  }).superRefine((data, ctx) => {
    if (data.enableCharges) {
      if (!data.registrationFee || data.registrationFee < 0) {
        ctx.addIssue({
          code: "custom",
          message: "Registration fee is required when charges are enabled",
          path: ["registrationFee"],
        });
      }
      if (!data.monthlyFee) {
        ctx.addIssue({
          code: "custom",
          message: "Monthly fee is required when charges are enabled",
          path: ["monthlyFee"],
        });
      }
    }
  }),
});

type TenantForm = {
  name: string;
  adminName: string;
  adminEmail: string;
  paymentPref: {
    enableCharges: boolean;
    registrationFee: string;
    monthlyFee: string;
  };
};

const DEFAULT_FORM: TenantForm = {
  name: "",
  adminName: "",
  adminEmail: "",
  paymentPref: {
    enableCharges: false,
    registrationFee: "",
    monthlyFee: "",
  },
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
  const [errors, setErrors] = useState<Record<string, string>>({});
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

  useEffect(() => {
    load();
  }, [load]);

  // Form validation using Zod
  function validate(): boolean {
    const payload = {
      name: form.name.trim(),
      adminName: form.adminName.trim(),
      adminEmail: form.adminEmail.trim(),
      paymentPref: {
        enableCharges: form.paymentPref.enableCharges,
        registrationFee: form.paymentPref.enableCharges && form.paymentPref.registrationFee
          ? parseFloat(form.paymentPref.registrationFee)
          : 0,
        monthlyFee: form.paymentPref.enableCharges && form.paymentPref.monthlyFee
          ? parseFloat(form.paymentPref.monthlyFee)
          : 0,
      },
    };

    const result = tenantSchema.safeParse(payload);

    if (!result.success) {
      const newErrors: Record<string, string> = {};
      result.error.errors.forEach((err) => {
        const key = err.path.join(".");
        newErrors[key] = err.message;
      });
      setErrors(newErrors);
      return false;
    }

    setErrors({});
    return true;
  }

  function isFormValid(): boolean {
    return form.name.trim().length >= 2 &&
           form.adminName.trim().length >= 2 &&
           form.adminEmail.includes("@");
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

  async function handleCreate() {
    if (!validate()) return;

    setSubmitting(true);

    try {
      const payload = {
        name: form.name.trim(),
        adminName: form.adminName.trim(),
        adminEmail: form.adminEmail.trim(),
        paymentPref: {
          enableCharges: form.paymentPref.enableCharges,
          registrationFee: form.paymentPref.enableCharges && form.paymentPref.registrationFee
            ? parseFloat(form.paymentPref.registrationFee)
            : 0,
          monthlyFee: form.paymentPref.enableCharges && form.paymentPref.monthlyFee
            ? parseFloat(form.paymentPref.monthlyFee)
            : 0,
        },
      };

      const {  message, success, tenantId} = await apiClient.tenants.create(payload);

      toast({ title: "Success", description: message });

      if (success) {
        setShowDialog(false);
        setForm(DEFAULT_FORM);
        load();
        router.push(`/dashboard/tenants/${tenantId}/portal`);
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to create tenant.",
        variant: "destructive"
      });
    } finally {
      setSubmitting(false);
    }
  }

  // Update top-level fields
  function setField<K extends keyof Omit<TenantForm, "paymentPref">>(
    key: K,
    value: TenantForm[K]
  ) {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (errors[key]) {
      setErrors((prev) => {
        const updated = { ...prev };
        delete updated[key];
        return updated;
      });
    }
  }

  // Update nested paymentPref fields
  function updatePaymentPref<K extends keyof TenantForm["paymentPref"]>(
    key: K,
    value: TenantForm["paymentPref"][K]
  ) {
    setForm((prev) => ({
      ...prev,
      paymentPref: {
        ...prev.paymentPref,
        [key]: value,
      },
    }));

    // Clear fees when disabling charges
    if (key === "enableCharges" && value === false) {
      setForm((prev) => ({
        ...prev,
        paymentPref: {
          ...prev.paymentPref,
          registrationFee: "",
          monthlyFee: "",
        },
      }));
    }

    // Clear related errors
    const errorKey = `paymentPref.${key}`;
    if (errors[errorKey]) {
      setErrors((prev) => {
        const updated = { ...prev };
        delete updated[errorKey];
        return updated;
      });
    }
  }

  const columns = [
    { key: "createdAt", label: "Created", render: (v: unknown) => new Date(String(v)).toLocaleDateString() },
    { key: "name", label: "Business Name" },
    {
      key: "branding",
      label: "Brand Color",
      render: (v: unknown) => {
        const b = v as Tenant["branding"];
        return (
          <div className="flex items-center gap-2">
            <div className="h-4 w-4 rounded-full border border-border" style={{ background: b.primaryColor }} />
            <span className="text-xs font-mono text-muted-foreground">{b.primaryColor}</span>
          </div>
        );
      },
    },
    {
      key: "currency",
      label: "Currency",
      render: (_: unknown, row: any) => (row as Tenant).settings?.currency || "N/A",
    },
    {
      key: "timezone",
      label: "TimeZone",
      render: (_: unknown, row: any) => (row as Tenant).settings?.timezone || "N/A",
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
        searchPlaceholder="Search tenants..."
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
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => handleToggleStatus(t)}>
                  {t.status === "active" ? (
                    <><PowerOff className="mr-2 h-4 w-4" /> Suspend</>
                  ) : (
                    <><Power className="mr-2 h-4 w-4" /> Activate</>
                  )}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          );
        }}
      />

      {/* Create Tenant Dialog */}
      <Dialog 
        open={showDialog} 
        onOpenChange={(open) => {
          if (!open) {
            setForm(DEFAULT_FORM);
            setErrors({});
          }
          setShowDialog(open);
        }}
      >
        <DialogContent className="w-full max-w-lg sm:max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add New Tenant</DialogTitle>
          </DialogHeader>

          <div className="flex flex-col gap-6 py-2">
            {/* Business Info */}
            <div className="space-y-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Business Information</p>
              <div className="space-y-1.5">
                <Label>Business Name <span className="text-destructive">*</span></Label>
                <Input
                  placeholder="e.g. FastNet ISP"
                  value={form.name}
                  onChange={(e) => setField("name", e.target.value)}
                />
                {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
              </div>
            </div>

            {/* Admin Account */}
            <div className="space-y-3 border-t border-border pt-4">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Admin Account</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Admin Name <span className="text-destructive">*</span></Label>
                  <Input
                    placeholder="Full name"
                    value={form.adminName}
                    onChange={(e) => setField("adminName", e.target.value)}
                  />
                  {errors.adminName && <p className="text-xs text-destructive">{errors.adminName}</p>}
                </div>

                <div className="space-y-1.5">
                  <Label>Admin Email <span className="text-destructive">*</span></Label>
                  <Input
                    type="email"
                    placeholder="admin@fastnet.com"
                    value={form.adminEmail}
                    onChange={(e) => setField("adminEmail", e.target.value)}
                  />
                  {errors.adminEmail && <p className="text-xs text-destructive">{errors.adminEmail}</p>}
                </div>
              </div>
            </div>

            {/* Payment Preferences */}
            <div className="space-y-3 border-t border-border pt-4">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Payment Preferences</p>
                <div className="flex items-center gap-2">
                  <Label htmlFor="enable-charges" className="text-sm cursor-pointer">Enable Charges</Label>
                  <Switch
                    id="enable-charges"
                    checked={form.paymentPref.enableCharges}
                    onCheckedChange={(checked) => updatePaymentPref("enableCharges", checked)}
                  />
                </div>
              </div>

              {form.paymentPref.enableCharges && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                  <div className="space-y-1.5">
                    <Label>Registration Fee <span className="text-destructive">*</span></Label>
                    <Input
                      type="number"
                      placeholder="0.00"
                      value={form.paymentPref.registrationFee}
                      onChange={(e) => updatePaymentPref("registrationFee", e.target.value)}
                      min="0"
                      step="0.01"
                    />
                    {errors["paymentPref.registrationFee"] && (
                      <p className="text-xs text-destructive">{errors["paymentPref.registrationFee"]}</p>
                    )}
                    <p className="text-xs text-muted-foreground">One-time fee charged during customer registration</p>
                  </div>

                  <div className="space-y-1.5">
                    <Label>Monthly Fee <span className="text-destructive">*</span></Label>
                    <Input
                      type="number"
                      placeholder="0.00"
                      value={form.paymentPref.monthlyFee}
                      onChange={(e) => updatePaymentPref("monthlyFee", e.target.value)}
                      min="0"
                      step="0.01"
                    />
                    {errors["paymentPref.monthlyFee"] && (
                      <p className="text-xs text-destructive">{errors["paymentPref.monthlyFee"]}</p>
                    )}
                    <p className="text-xs text-muted-foreground">Recurring monthly subscription fee</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowDialog(false);
                setForm(DEFAULT_FORM);
                setErrors({});
              }}
            >
              Cancel
            </Button>
            <Button 
              onClick={handleCreate} 
              disabled={submitting || !isFormValid()}
            >
              {submitting ? "Creating Tenant..." : "Create Tenant"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}