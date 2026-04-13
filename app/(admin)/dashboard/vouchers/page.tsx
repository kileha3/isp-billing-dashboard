"use client";

import { useState, useEffect, useCallback } from "react";
import { apiClient } from "@/lib/api";
import { DataTable } from "@/components/admin/DataTable";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Plus, Download, Printer, Filter, MoreHorizontal, Trash2, LockIcon, Lock } from "lucide-react";
import type { Voucher, Package } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";
import { usePageTitle } from "@/hooks/use-page-title";
import { z } from "zod";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useRouterEvents } from "@/hooks/use-router-event";

const generateSchema = z.object({
  packageId: z.string().min(1, "Select a package"),
  quantity: z.coerce.number().int().min(1, "At least 1").max(500, "Max 500"),
  prefix: z.string().max(10, "Max 10 chars").optional(),
});


export default function VouchersPage() {
  usePageTitle("Vouchers");
  const { toast } = useToast();
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [packages, setPackages] = useState<Package[]>([]);
  const [loading, setLoading] = useState(true);
  const [showGenerate, setShowGenerate] = useState(false);
  const [form, setForm] = useState({ packageId: "", quantity: "10", prefix: "" });
  const [submitting, setSubmitting] = useState(false);
  const [statusFilter, setStatusFilter] = useState("all");
  const [voucherToDelete, setVoucherToDelete] = useState<Voucher | null>(null)
  const [voucherToRevoke, setVoucherToRevoke] = useState<Voucher | null>(null)
   const { routerEvent, isConnected } = useRouterEvents("voucher_consumed_status");

  const load = useCallback(async () => {
    try {
      const [vData, pData] = await Promise.all([
        apiClient.vouchers.list(),
        apiClient.packages.list(),
      ]);
      setVouchers(vData.data ?? vData);
      setPackages(pData.data ?? pData);
    } catch {
      setVouchers([]);
      setPackages([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (routerEvent) load();
  }, [routerEvent, isConnected]);

  async function handleGenerate() {
    setSubmitting(true);
    try {
      const data = await apiClient.vouchers.generate({
        packageId: form.packageId,
        quantity: Number(form.quantity),
        prefix: form.prefix || undefined,
      });
      toast({ title: `${data.vouchers?.length ?? form.quantity} vouchers generated` });
      setShowGenerate(false);
      load();
    } catch {
      toast({ title: "Error", description: "Failed to generate vouchers.", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleExport() {
    try {
      const data = await apiClient.vouchers.export();
      const blob = new Blob([data], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "vouchers.csv";
      a.click();
    } catch {
      // fallback: CSV from mock
      const csv = ["Code,Package,Status,Created",
        ...vouchers.map(v => `${v.code},${(v.packageId as { name: string })?.name ?? ""},${v.status},${new Date(v.createdAt).toLocaleDateString()}`)
      ].join("\n");
      const blob = new Blob([csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "vouchers.csv";
      a.click();
      toast({ title: "Exported vouchers as CSV" });
    }
  }



  const columns = [
    { key: "code", label: "Code", render: (v: unknown) => String(v) },
    { key: "packageId", label: "Package", render: (v: unknown) => (v as { name: string })?.name ?? "—" },
    {
      key: "ipAddress", label: "IP Address", render: (v: unknown, row: unknown) => {
        const voucher = row as unknown as Voucher;
        return voucher.usedBy?.ipAddress ?? "-"
      }
    },
    {
      key: "macAddress", label: "MAC Address", render: (v: unknown, row: unknown) => {
        const voucher = row as unknown as Voucher;
        return voucher.usedBy?.macAddress ?? "-"
      }
    },
    { key: "status", label: "Status", render: (v: unknown) => <StatusBadge status={String(v)} /> },
    { key: "usedAt", label: "Used At", render: (v: unknown) => v ? new Date(String(v)).toLocaleDateString() : "-" },
    { key: "createdAt", label: "Created", render: (v: unknown) => new Date(String(v)).toLocaleDateString() },
  ];

  const filteredVouchers = statusFilter === "all" ? vouchers : vouchers.filter(v => v.status === statusFilter);
  const generateValid = generateSchema.safeParse({ ...form }).success;



  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Vouchers</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Create vochers for your customer to consume
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handleExport}>
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
          <Button onClick={() => setShowGenerate(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Generate Vouchers
          </Button>
        </div>
      </div>

      <DataTable
        data={filteredVouchers as unknown as Record<string, unknown>[]}
        columns={columns as never}
        loading={loading}
        searchable
        searchKeys={["code", "batchId"] as never}
        searchPlaceholder="vouchers"
        emptyMessage="No vouchers yet. Generate some to get started."
        pageSize={10}
        filterSlot={
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v)}>
            <SelectTrigger className="h-10 w-40 bg-background">
              <Filter className="h-3.5 w-3.5 mr-2 text-muted-foreground" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="unused">Unused</SelectItem>
              <SelectItem value="redeemed">Redeemed</SelectItem>
              <SelectItem value="expired">Expired</SelectItem>
            </SelectContent>
          </Select>
        }
        actions={(row) => {
          const voucher = row as unknown as Voucher;
          return (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {voucher.status === "used" && (<DropdownMenuItem onClick={() => setVoucherToRevoke(row as unknown as Voucher)}>
                  <Lock className="mr-2 h-4 w-4" />Revoke Access
                </DropdownMenuItem>)}
               {voucher.status !== "used" && ( <DropdownMenuItem className="text-destructive" onClick={() => setVoucherToDelete(row as unknown as Voucher)}>
                  <Trash2 className="mr-2 h-4 w-4" />Delete
                </DropdownMenuItem>)}
              </DropdownMenuContent>
            </DropdownMenu>
          );
        }}
      />

      <Dialog open={showGenerate} onOpenChange={setShowGenerate}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Generate Vouchers</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-2">
            <div className="flex flex-col gap-1.5">
              <Label>Package</Label>
              <Select value={form.packageId} onValueChange={(v) => setForm(f => ({ ...f, packageId: v }))}>
                <SelectTrigger><SelectValue placeholder="Select package…" /></SelectTrigger>
                <SelectContent>
                  {packages.map(p => <SelectItem key={p._id} value={p._id}>{p.name} — Tsh {p.price}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Quantity</Label>
              <Input type="number" min="1" max="500" value={form.quantity} onChange={(e) => setForm(f => ({ ...f, quantity: e.target.value }))} />
            </div>
            {/* <div className="flex flex-col gap-1.5">
              <Label>Code Prefix (optional)</Label>
              <Input placeholder="e.g. NB" maxLength={6} value={form.prefix} onChange={(e) => setForm(f => ({ ...f, prefix: e.target.value.toUpperCase() }))} />
            </div> */}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowGenerate(false)}>Cancel</Button>
            <Button onClick={handleGenerate} disabled={submitting || !generateValid}>
              <Printer className="h-4 w-4 mr-2" />
              {submitting ? "Generating…" : `Generate ${form.quantity}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {voucherToDelete && (<ConfirmDialog
        open={voucherToDelete !== null}
        title="Delete Voucher"
        message={`Are you sure you want to delete ${voucherToDelete!.code}? This action cannot be undone.`}
        variant="destructive"
        onCancel={() => setVoucherToDelete(null)}
        onConfirm={async () => {
          const id = voucherToDelete!._id;
          setVoucherToDelete(null);
          try {
            const { message } = await apiClient.vouchers.delete(id);
            toast({ title: message });
            load();
          } catch {
            toast({ title: "Error", description: "Failed to delete a voucher.", variant: "destructive" });
          }
        }}
      />)}


      {voucherToRevoke && (<ConfirmDialog
        open={voucherToRevoke !== null}
        title="Revoke Access"
        message={`Are you sure you want to revoke clients with code ${voucherToRevoke!.code} access?`}
        variant="destructive"
        onCancel={() => setVoucherToRevoke(null)}
        onConfirm={async () => {
          const id = voucherToRevoke!._id;
          setVoucherToRevoke(null);
          try {
            const { message } = await apiClient.vouchers.revoke(id);
            toast({ title: message });
            load();
          } catch {
            toast({ title: "Error", description: "Failed to revoke access.", variant: "destructive" });
          }
        }}
      />)}
    </div>
  );
}
