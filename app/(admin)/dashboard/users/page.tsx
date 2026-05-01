"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import { useRouter } from "next/navigation";
import { apiClient } from "@/lib/api";
import { DataTable } from "@/components/admin/DataTable";
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
import { formatDate } from "@/lib/utils";

const userSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Enter a valid email address"),
  role: z.enum(["super_admin", "tenant_admin", "operator"]),
});


type UserForm = {
  name: string;
  id: string;
  email: string;
  role: "super_admin" | "tenant_admin" | "operator";
  tenantId?: string;
};

const DEFAULT_FORM: UserForm = { name: "", email: "", role: "tenant_admin", tenantId: "", id: "" };

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
  const [me, setMe] = useState<User>();

  useEffect(() => {
    if (!isRole("super_admin")) router.push("/dashboard");
  }, [isRole, router]);

  const load = useCallback(async () => {
    try {
      const [usersData, tenantsData, meData] = await Promise.allSettled([
        apiClient.users.list(),
        apiClient.tenants.list(),
        apiClient.auth.me()
      ]);
      if (usersData.status === "fulfilled") setUsers(usersData.value);
      if (tenantsData.status === "fulfilled") setTenants(tenantsData.value.data);
      if (meData.status === "fulfilled") setMe(meData.value);
      else setTenants([]);
    } catch {
      setUsers([]);
      setTenants([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleUpdate() {
    setSubmitting(true);
    try {
      await apiClient.users.update(form.id, { ...form, id: undefined });
      toast({ title: "User updated", description: `${form.name} has been updated.` });
      setShowDialog(false);
      setForm(DEFAULT_FORM);
      load();
    } catch {
      toast({ title: "Error", description: "Failed to update user.", variant: "destructive" });
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
    { key: "createdAt", label: "Joined", render: (v: unknown) => formatDate(v) },
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
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Users</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage platform users and their roles</p>
        </div>
        {/* <Button onClick={() => setShowDialog(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add User
        </Button> */}
      </div>

      <DataTable
        data={((roleFilter === "all" ? users : users.filter(u => u.role === roleFilter)).filter(u => u._id !== me?.id)) as unknown as Record<string, unknown>[]}
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
                <DropdownMenuItem onClick={() => {
                  setForm({ name: u.name, email: u.email, tenantId: u.tenantId, role: u.role, id: u._id })
                  setShowDialog(true);
                }}>
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
    <DialogTitle>Update User</DialogTitle>
  </DialogHeader>

  <div className="flex flex-col gap-4 py-2">
    <div className="flex flex-col gap-1.5">
      <Label>Full Name</Label>
      <Input 
        placeholder="John Doe" 
        value={form.name} 
        onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))} 
      />
    </div>

    <div className="flex flex-col gap-1.5">
      <Label>Email</Label>
      <Input 
        type="email" 
        placeholder="john@example.com" 
        value={form.email} 
        onChange={(e) => setForm(f => ({ ...f, email: e.target.value }))} 
      />
    </div>

    {/* ── Role + Tenant side by side ── */}
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
      {/* Role */}
      <div className="flex flex-col gap-1.5">
        <Label>Role</Label>
        <Select 
          value={form.role} 
          onValueChange={(v) => setForm(f => ({ ...f, role: v as UserForm["role"] }))}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select role" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="tenant_admin">Tenant Admin</SelectItem>
            <SelectItem value="operator">Operator</SelectItem>
            <SelectItem value="super_admin">Super Admin</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Tenant – only shown when needed */}
      {form.role !== "super_admin" && (
        <div className="flex flex-col gap-1.5">
          <Label>Assign to Tenant</Label>
          <Select 
            value={form.tenantId ?? ""} 
            onValueChange={(v) => setForm(f => ({ ...f, tenantId: v }))}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select tenant" />
            </SelectTrigger>
            <SelectContent>
              {tenants.map(t => (
                <SelectItem key={t._id} value={t._id}>
                  {t.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
    </div>
  </div>

  <DialogFooter>
    <Button variant="outline" onClick={() => setShowDialog(false)}>
      Cancel
    </Button>
    <Button 
      onClick={handleUpdate} 
      disabled={submitting || !userFormValid}
    >
      {submitting ? "Updating…" : "Update User"}
    </Button>
  </DialogFooter>
</DialogContent>
      </Dialog>
    </div>
  );
}
