"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import { apiClient } from "@/lib/api";
import { DataTable } from "@/components/admin/DataTable";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MoreHorizontal, Pencil, Trash2, Filter, Plus, Copy, Check, Power, PowerOff } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import type { Package, PPPoEUser, Tenant } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";
import { usePageTitle } from "@/hooks/use-page-title";
import { z } from "zod";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

// PPPoE User Schema
const pppoeUserSchema = z.object({
  username: z.string().min(3, "Username must be at least 3 characters"),
  email: z.string().email("Invalid email address"),
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  location: z.string().optional(),
  packageId: z.string().min(1, "Package is required"),
  isActive: z.boolean().default(true),
});

type PPPoEUserForm = {
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  location: string;
  packageId: string;
};

const DEFAULT_FORM: PPPoEUserForm = {
  username: "",
  email: "",
  firstName: "",
  lastName: "",
  location: "",
  packageId: "",
};

export default function PPPoEUsersPage() {
  const { isRole, user } = useAuth();
  const { toast } = useToast();
  const [users, setUsers] = useState<PPPoEUser[]>([]);
  const [packages, setPackages] = useState<Package[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [editTarget, setEditTarget] = useState<PPPoEUser | null>(null);
  const [form, setForm] = useState<PPPoEUserForm>(DEFAULT_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [userToDelete, setUserToDelete] = useState<PPPoEUser | null>(null);
  const [statusFilter, setStatusFilter] = useState("all");
  const [copiedPassword, setCopiedPassword] = useState<string | null>(null);

  usePageTitle("PPPoE Users");

  const load = useCallback(async () => {
    try {
      const [usersData, packagesData] = await Promise.allSettled([
        apiClient.pppoe?.list() ?? Promise.reject("API not available"),
        apiClient.packages.list("pppoe"),
      ]);

      if (usersData.status === "fulfilled") setUsers(usersData.value);
      else setUsers([]);

      if (packagesData.status === "fulfilled") setPackages(packagesData.value.data);
      else setPackages([]);
    } catch (error: any) {
      setUsers([]);
      setPackages([]);
      toast({ title:  error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, []);

  function openAdd() {
    setEditTarget(null);
    setForm(DEFAULT_FORM);
    setShowDialog(true);
  }

  

  const isFormValid = pppoeUserSchema.safeParse(form).success;

  function openEdit(user: PPPoEUser) {
    setEditTarget(user);
    setForm({
      username: user.username,
      email: user.email || "",
      firstName: user.firstName,
      lastName: user.lastName,
      location: user.location || "",
      packageId: typeof user.packageId === 'string' ? user.packageId : user.packageId._id,
    });
    setShowDialog(true);
  }

  const handleActivate = async (user: PPPoEUser) => {
     const { message } = await apiClient.pppoe.activateDeactivate(user._id, user.status !== "active" ? "active" : "unpaid");
        toast({ title: "Status update", description: message });
        load();
  }

  async function handleSubmit() {
    setSubmitting(true);

    const validation = pppoeUserSchema.safeParse(form);
    if (!validation.success) {
      toast({
        title: "Validation Error",
        description: validation.error.errors[0].message,
        variant: "destructive"
      });
      setSubmitting(false);
      return;
    }

    const payload = {
      ...form,
      tenantId: user?.tenantId
    };

    try {
      if (editTarget) {
        const { message } = await apiClient.pppoe.update(editTarget._id, payload);
        toast({ title: "User Updated", description: message });
        load();
      } else {
        const { message } = await apiClient.pppoe.create(payload);
        toast({ title: "User Created", description: message });
      }
      setShowDialog(false);
      load();
    } catch (error: any) {
      toast({ title:  error.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  }

  const copyToClipboard = async (text: string, field: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedPassword(field);
      toast({
        title: "Copied!",
        description: `Password copied to clipboard`,
        duration: 2000,
      });
      setTimeout(() => setCopiedPassword(null), 2000);
    } catch (error: any) {
      toast({
        title: "Failed to copy",
        description: "Please try again",
        variant: "destructive",
      });
    }
  };

  function getPackageName(packageId: string | Package) {
    if (typeof packageId === 'string') {
      return packages.find(p => p._id === packageId)?.name ?? "Unknown Package";
    }
    return packageId.name;
  }

  function getPackagePrice(packageId: string | Package) {
    if (typeof packageId === 'string') {
      const pkg = packages.find(p => p._id === packageId);
      return pkg?.price ?? 0;
    }
    return packageId.price;
  }

  const columns = [
    { key: "username", label: "Username", render: (v: unknown) => String(v)},
    { 
      key: "password", 
      label: "Password", 
      render: (v: unknown, row: unknown) => {
        const user = row as PPPoEUser;
        const isCopied = copiedPassword === user.username;
        return (
          <div className="flex items-center gap-2 group">
            <span className="font-mono text-sm">{"•".repeat(8)}</span>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={() => copyToClipboard(user.password, user.username)}
              title="Click to copy password"
            >
              {isCopied ? (
                <Check className="h-3.5 w-3.5 text-green-500" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
            </Button>
          </div>
        );
      }
    },
    { key: "email", label: "Email", render: (v: unknown) => String(v) },
    { key: "firstName", label: "First Name" },
    { key: "lastName", label: "Last Name" },
    { key: "location", label: "Location", render: (v: unknown) => v ? String(v) : "—" },
    {
      key: "packageId",
      label: "Package",
      render: (v: unknown, row: unknown) => {
        const user = row as PPPoEUser;
        const packageName = getPackageName(v as string | Package);
        const price = getPackagePrice(v as string | Package);
        return (
          <div className="flex flex-col">
            <span className="text-sm font-medium">{packageName}</span>
            <span className="text-xs text-muted-foreground">Tsh {price.toLocaleString()}</span>
          </div>
        );
      }
    },
    {
      key: "status",
      label: "Status",
      render: (v: unknown) => <StatusBadge status={v as string} />
    },
    {
      key: "createdAt",
      label: "Created",
      render: (v: unknown) => new Date(String(v)).toLocaleDateString()
    },
  ];

  const filteredUsers = (statusFilter === "all"
    ? users
    : users.filter(user => user.status === statusFilter)) as unknown as Record<string, unknown>[];

  useEffect(() => { load(); }, [load]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">PPPoE Users</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage your PPPoE users and their packages</p>
        </div>
        <Button onClick={openAdd}>
          <Plus className="h-4 w-4 mr-2" />
          Add PPPoE User
        </Button>
      </div>

      <DataTable
        data={filteredUsers}
        columns={columns as never}
        loading={loading}
        searchable
        searchKeys={["username", "email", "firstName", "lastName"] as never}
        searchPlaceholder="Search users..."
        emptyMessage="No PPPoE users found."
        pageSize={10}
        filterSlot={
          <div className="flex gap-3">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="h-10 w-44 bg-background">
                <Filter className="h-3.5 w-3.5 mr-2 text-muted-foreground" />
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Users</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="suspended">Suspended</SelectItem>
                <SelectItem value="unpaid">Unpaid</SelectItem>
                <SelectItem value="offline">Offline</SelectItem>
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
              <DropdownMenuItem onClick={() => openEdit(row as unknown as PPPoEUser)}>
                <Pencil className="mr-2 h-4 w-4" />Edit
              </DropdownMenuItem>

              <DropdownMenuItem onClick={() => handleActivate(row as unknown as PPPoEUser)}>
                {row.status !== "active" && (<Power className="mr-2 h-4 w-4" />)}
                {row.status === "active" && (<PowerOff className="mr-2 h-4 w-4" />)}
                {row.status === "active" ? "Mark Unpaid":"Activate"}
              </DropdownMenuItem>
              <DropdownMenuItem className="text-destructive" onClick={() => setUserToDelete(row as unknown as PPPoEUser)}>
                <Trash2 className="mr-2 h-4 w-4" />Delete
              </DropdownMenuItem>
              
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      />

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editTarget ? "Edit PPPoE User" : "Add PPPoE User"}</DialogTitle>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-4 py-2 max-h-[70vh] overflow-y-auto pr-1">
            {/* Username */}
            <div className="flex flex-col gap-1.5">
              <Label>Username *</Label>
              <Input
                placeholder="e.g. john_doe"
                value={form.username}
                disabled={editTarget != null}
                onChange={(e) => setForm(f => ({ ...f, username: e.target.value }))}
              />
            </div>

            {/* Email */}
            <div className="flex flex-col gap-1.5">
              <Label>Email *</Label>
              <Input
                type="email"
                placeholder="john@example.com"
                value={form.email}
                onChange={(e) => setForm(f => ({ ...f, email: e.target.value }))}
              />
            </div>

            {/* First Name & Last Name */}
            <div className="flex flex-col gap-1.5">
              <Label>First Name *</Label>
              <Input
                placeholder="John"
                value={form.firstName}
                onChange={(e) => setForm(f => ({ ...f, firstName: e.target.value }))}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label>Last Name *</Label>
              <Input
                placeholder="Doe"
                value={form.lastName}
                onChange={(e) => setForm(f => ({ ...f, lastName: e.target.value }))}
              />
            </div>

            {/* Location (Optional) */}
            <div className="col-span-2 flex flex-col gap-1.5">
              <Label>Location (Optional)</Label>
              <Input
                placeholder="e.g. Dar es Salaam, Kinondoni"
                value={form.location}
                onChange={(e) => setForm(f => ({ ...f, location: e.target.value }))}
              />
            </div>

            {/* Package Selection - 40% width */}
            <div className="col-span-2 flex flex-col gap-1.5" style={{ width: "40%" }}>
              <Label>Package *</Label>
              <Select value={form.packageId} onValueChange={(v) => setForm(f => ({ ...f, packageId: v }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a package..." />
                </SelectTrigger>
                <SelectContent>
                  {packages.map(pkg => (
                    <SelectItem key={pkg._id} value={pkg._id}>
                      <div className="flex flex-col">
                        <span>{pkg.name}</span>
                        <span className="text-xs text-muted-foreground">
                          {pkg.isFree ? "Free" : `Tsh ${pkg.price.toLocaleString()}`} • {pkg.duration} {pkg.durationUnit}
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {packages.length === 0 && (
                <p className="text-xs text-muted-foreground mt-1">
                  No packages available
                </p>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={submitting || !isFormValid}>
              {submitting ? "Saving…" : editTarget ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {userToDelete && (
        <ConfirmDialog
          open={userToDelete !== null}
          title="Delete PPPoE User"
          message={`Are you sure you want to delete user "${userToDelete.username}"? This will disconnect them and cannot be undone.`}
          variant="destructive"
          onCancel={() => setUserToDelete(null)}
          onConfirm={async () => {
            const userId = userToDelete!._id;
            setUserToDelete(null);
            try {
              await apiClient.pppoe.delete(userId);
              toast({ description: "PPPoE user deleted successfully", title: "User Deleted" });
              load();
            } catch (error: any) {
              toast({ title:  error.message, variant: "destructive" });
            }
          }}
        />
      )}
    </div>
  );
}