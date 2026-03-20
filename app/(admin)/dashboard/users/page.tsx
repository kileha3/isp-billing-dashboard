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
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Plus, MoreHorizontal, Pencil, Trash2, KeyRound, Filter } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { usePageTitle } from "@/hooks/use-page-title";
import { z } from "zod";
import type { User, Tenant } from "@/lib/types";

const userSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Enter a valid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  role: z.enum(["super_admin", "tenant_admin", "operator"]),
});

const MOCK_USERS: User[] = [
  { _id: "u1", name: "Super Admin", email: "lkileha@gmail.com", role: "super_admin", createdAt: new Date().toISOString() },
  { _id: "u2", name: "FastNet Admin", email: "admin@fastnet.com", role: "tenant_admin", tenantId: "t1", createdAt: new Date(Date.now() - 86400000 * 5).toISOString() },
  { _id: "u3", name: "John Operator", email: "john@fastnet.com", role: "operator", tenantId: "t1", createdAt: new Date(Date.now() - 86400000 * 2).toISOString() },
  { _id: "u4", name: "QuickConnect Admin", email: "admin@quickconnect.co.ke", role: "tenant_admin", tenantId: "t2", createdAt: new Date(Date.now() - 86400000 * 8).toISOString() },
];

const MOCK_TENANTS: Tenant[] = [
  { _id: "t1", name: "FastNet ISP", subdomain: "fastnet", branding: { logo: "", primaryColor: "#3B82F6", secondaryColor: "#1E40AF", businessName: "FastNet" }, support: { phone: "", email: "", whatsapp: "", showOnPortal: false }, portalSettings: { displayMode: "both", welcomeMessage: "", termsUrl: "", showPoweredBy: true }, settings: { currency: "KES", timezone: "Africa/Nairobi" }, status: "active", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { _id: "t2", name: "QuickConnect Ltd", subdomain: "quickconnect", branding: { logo: "", primaryColor: "#10B981", secondaryColor: "#065F46", businessName: "QuickConnect" }, support: { phone: "", email: "", whatsapp: "", showOnPortal: false }, portalSettings: { displayMode: "both", welcomeMessage: "", termsUrl: "", showPoweredBy: true }, settings: { currency: "KES", timezone: "Africa/Nairobi" }, status: "active", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
];

type UserForm = {
  name: string;
  email: string;
  password: string;
  role: "super_admin" | "tenant_admin" | "operator";
  tenantId: string;
};

const DEFAULT_FORM: UserForm = { name: "", email: "", password: "", role: "tenant_admin", tenantId: "" };

const ROLE_COLORS: Record<string, string> = {
  super_admin: "bg-primary/10 text-primary",
  tenant_admin: "bg-emerald-500/10 text-emerald-600",
  operator: "bg-amber-500/10 text-amber-600",
};

export default function UsersPage() {
  usePageTitle("Users");
  const { isRole } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [users, setUsers] = useState<User[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [roleFilter, setRoleFilter] = useState("all");
  const [showDialog, setShowDialog] = useState(false);
  const [form, setForm] = useState<UserForm>(DEFAULT_FORM);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!isRole("super_admin")) router.push("/dashboard");
  }, [isRole, router]);

  const load = useCallback(async () => {
    try {
      const [usersData, tenantsData] = await Promise.allSettled([
        apiClient.users.list(),
        apiClient.tenants.list(),
      ]);
      if (usersData.status === "fulfilled") setUsers(usersData.value.users ?? usersData.value);
      else setUsers(MOCK_USERS);
      if (tenantsData.status === "fulfilled") setTenants(tenantsData.value.tenants ?? tenantsData.value);
      else setTenants(MOCK_TENANTS);
    } catch {
      setUsers(MOCK_USERS);
      setTenants(MOCK_TENANTS);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleCreate() {
    setSubmitting(true);
    try {
      await apiClient.users.create(form);
      toast({ title: "User created", description: `${form.name} has been added.` });
      setShowDialog(false);
      setForm(DEFAULT_FORM);
      load();
    } catch {
      toast({ title: "Error", description: "Failed to create user.", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(user: User) {
    if (!confirm(`Delete user "${user.name}"?`)) return;
    try {
      await apiClient.users.delete(user._id);
      toast({ title: "User deleted" });
      load();
    } catch {
      toast({ title: "Error", description: "Failed to delete user.", variant: "destructive" });
    }
  }

  function getTenantName(tenantId?: string) {
    if (!tenantId) return "—";
    return tenants.find(t => t._id === tenantId)?.name ?? tenantId;
  }

  const userFormValid = userSchema.safeParse(form).success;

  const columns = [
    { key: "name", label: "Name" },
    { key: "email", label: "Email", render: (v: unknown) => <span className="text-muted-foreground text-sm">{String(v)}</span> },
    {
      key: "role", label: "Role",
      render: (v: unknown) => (
        <Badge variant="outline" className={`text-xs font-medium border-0 ${ROLE_COLORS[String(v)] ?? ""}`}>
          {String(v).replace("_", " ")}
        </Badge>
      )
    },
    { key: "tenantId", label: "Tenant", render: (v: unknown) => getTenantName(String(v === null || v === undefined ? "" : v)) },
    { key: "createdAt", label: "Joined", render: (v: unknown) => new Date(String(v)).toLocaleDateString() },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Users</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage platform users and their roles</p>
        </div>
        <Button onClick={() => setShowDialog(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add User
        </Button>
      </div>

      <DataTable
        data={(roleFilter === "all" ? users : users.filter(u => u.role === roleFilter)) as unknown as Record<string, unknown>[]}
        columns={columns as never}
        loading={loading}
        searchable
        searchKeys={["name", "email"] as never}
        searchPlaceholder="users"
        emptyMessage="No users found."
        pageSize={10}
        filterSlot={
          <Select value={roleFilter} onValueChange={setRoleFilter}>
            <SelectTrigger className="h-10 w-48 bg-background">
              <Filter className="h-3.5 w-3.5 mr-2 text-muted-foreground" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Roles</SelectItem>
              <SelectItem value="super_admin">Super Admin</SelectItem>
              <SelectItem value="tenant_admin">Tenant Admin</SelectItem>
              <SelectItem value="operator">Operator</SelectItem>
            </SelectContent>
          </Select>
        }
        actions={(row) => {
          const u = row as unknown as User;
          return (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem>
                  <Pencil className="mr-2 h-4 w-4" />Edit
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <KeyRound className="mr-2 h-4 w-4" />Reset Password
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="text-destructive" onClick={() => handleDelete(u)}>
                  <Trash2 className="mr-2 h-4 w-4" />Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          );
        }}
      />

      {/* Create User Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add User</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-2">
            <div className="flex flex-col gap-1.5">
              <Label>Full Name</Label>
              <Input placeholder="John Doe" value={form.name} onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Email</Label>
              <Input type="email" placeholder="john@example.com" value={form.email} onChange={(e) => setForm(f => ({ ...f, email: e.target.value }))} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Password</Label>
              <Input type="password" placeholder="Secure password" value={form.password} onChange={(e) => setForm(f => ({ ...f, password: e.target.value }))} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Role</Label>
              <Select value={form.role} onValueChange={(v) => setForm(f => ({ ...f, role: v as UserForm["role"] }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="tenant_admin">Tenant Admin</SelectItem>
                  <SelectItem value="operator">Operator</SelectItem>
                  <SelectItem value="super_admin">Super Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {form.role !== "super_admin" && (
              <div className="flex flex-col gap-1.5">
                <Label>Assign to Tenant</Label>
                <Select value={form.tenantId} onValueChange={(v) => setForm(f => ({ ...f, tenantId: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select tenant" /></SelectTrigger>
                  <SelectContent>
                    {tenants.map(t => <SelectItem key={t._id} value={t._id}>{t.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>Cancel</Button>
              <Button onClick={handleCreate} disabled={submitting || !userFormValid}>
              {submitting ? "Creating…" : "Create User"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
