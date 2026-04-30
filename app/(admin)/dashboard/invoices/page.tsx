"use client";

import { useState, useEffect, useCallback } from "react";
import { apiClient } from "@/lib/api";
import { DataTable } from "@/components/admin/DataTable";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Filter, MoreHorizontal, Trash2, Lock, DollarSign, List, BetweenHorizonalEnd } from "lucide-react";
import type { Invoice } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";
import { usePageTitle } from "@/hooks/use-page-title";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useAuth } from "@/lib/auth-context";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { phoneSchemaDef } from "@/components/portal/PackageGrid";
import SocketClient from "@/lib/socket.util";
import { PayResult } from "@/components/portal/CaptivePortalClient";


export default function InvoicesPage() {
  usePageTitle("Invoices");
  const { toast } = useToast();
  const { isRole } = useAuth();
  const isSuperAdmin = isRole("super_admin")
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");
  const [showClearInvoice, setShowClearInvoice] = useState<Invoice | null>(null);
  const [invoiceToUpdate, setInvoiceToUpdate] = useState<Invoice | null>(null);
  const [invoiceToExempt, setExemptInvoice] = useState<Invoice | null>(null);
  const [phone, setPhone] = useState("");
  const [isPaying, setIsPaying] = useState(false);
  const { user } = useAuth();
  const phoneSchema = phoneSchemaDef({ min: 10, max: 13, language: "en" });
  const phoneResult = phoneSchema.safeParse(phone);
  const phoneError = phone.length >= 10 && !phoneResult.success
    ? phoneResult.error.errors[0]?.message
    : "";

  const load = useCallback(async (showLoading: boolean = true) => {
    setLoading(showLoading);
    try {
      const invoices = await apiClient.invoices.list();
      setInvoices(invoices.data ?? invoices);
    } catch (error: any) {
      setInvoices([]);
      toast({ title: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    let unsubscribe: (() => void) | null = null;
    (async () => {
      const event = SocketClient.event_invoice_sync;
      unsubscribe = await SocketClient.subscribe(event, user?.tenantId ?? event, (_) => load(false));
    })();

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [user]);


  const columns = [
    isSuperAdmin ? { key: "tenant", label: "Tenant", render: (v: unknown) => v } : null,
    { key: "amount", label: "Amount", render: (v: unknown) => Number(v).toLocaleString("en-US", { currency: "TZS" }) },
    { key: "description", label: "Description", render: (v: unknown) => v },
    { key: "status", label: "Status", render: (v: unknown) => <StatusBadge status={String(v)} /> },
    { key: "createdAt", label: "Created", render: (v: unknown) => new Date(String(v)).toLocaleDateString() },
    { key: "dueDate", label: "Due Date", render: (v: unknown) => new Date(String(v)).toLocaleDateString() },
  ].filter(Boolean);

  const filteredInvoices = statusFilter === "all" ? invoices : invoices.filter(v => v.status === statusFilter);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Invoices</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Invoices that must be paid for service offering
          </p>
        </div>
      </div>

      <DataTable
        data={filteredInvoices as unknown as Record<string, unknown>[]}
        columns={columns as never}
        loading={loading}
        searchable
        searchKeys={["code", "batchId"] as never}
        searchPlaceholder="invoices"
        emptyMessage="No invoices yet."
        pageSize={10}
        filterSlot={
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v)}>
            <SelectTrigger className="h-10 w-40 bg-background">
              <Filter className="h-3.5 w-3.5 mr-2 text-muted-foreground" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="paid">Paid</SelectItem>
              <SelectItem value="overdue">Overdue</SelectItem>
              <SelectItem value="expired">Expired</SelectItem>
            </SelectContent>
          </Select>
        }
        actions={(row) => {
          const invoice = row as unknown as Invoice;
          return (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">

                {invoice.status === "pending" && !isSuperAdmin && (<DropdownMenuItem onClick={() => setShowClearInvoice(row as unknown as Invoice)}>
                  <Lock className="mr-2 h-4 w-4" />Clear Invoice
                </DropdownMenuItem>)}

                {invoice.status === "pending" && isSuperAdmin && (<DropdownMenuItem onClick={() => setExemptInvoice(row as unknown as Invoice)}>
                  <BetweenHorizonalEnd className="mr-2 h-4 w-4" />Exempt Invoice
                </DropdownMenuItem>)}

                {["overdue", "expired", "paid"].includes(invoice.status) && (<DropdownMenuItem className="text-destructive" onClick={() => setInvoiceToUpdate({ ...(row as unknown as Invoice), status: "pending" })}>
                  <List className="mr-2 h-4 w-4" />Reactivate Invoice
                </DropdownMenuItem>)}
              </DropdownMenuContent>
            </DropdownMenu>
          );
        }}
      />

      <Dialog open={showClearInvoice != null} onOpenChange={() => setShowClearInvoice(null)}>
        <DialogContent className="max-w-sm">
          {!isPaying && (<div>
            <DialogHeader>
              <DialogTitle>Pay up this invoice</DialogTitle>
            </DialogHeader>
            <div className="flex flex-col gap-4 py-6 px-7">
              <Label className="text-xs font-medium">Phone Number</Label>
              <Input
                type="tel"
                placeholder="0712 XXX XXX"
                value={phone}
                autoFocus
                onChange={(e) => setPhone(e.target.value)}
                className="h-10 focus-visible:outline-none focus-visible:ring-2"
              />
              {phoneError && <p className="text-xs text-destructive">{phoneError}</p>}
            </div>
          </div>)}
          {isPaying && (<div className="min-h-[50v] bg-background flex flex-col items-center justify-center gap-6 py-16">
            <div className="h-18 w-18 rounded-full border-4 border-primary border-t-transparent animate-spin" />
            <p className="text-muted-foreground text-sm">Check your phone and enter your wallet PIN</p>
          </div>)}
          {!isPaying && (<DialogFooter>
            <Button variant="outline" onClick={() => setShowClearInvoice(null)} >Cancel</Button>
            <Button onClick={async () => {

              setIsPaying(true);
              const timeoutId = setTimeout(() => {
                setShowClearInvoice(null);
                setIsPaying(false);
              }, 2 * 60 * 1000)
              const { success, orderId } = await apiClient.invoices.pay(showClearInvoice!._id, phone);

              if (success && orderId) {
                SocketClient.waitFor<PayResult>(SocketClient.event_invoice_paid, orderId,
                  ({ success }) => {
                    clearTimeout(timeoutId);
                    setShowClearInvoice(null);
                    setIsPaying(false);
                    if (success) {
                      toast({ title: "Invoice paid successfully" });
                      load(false);
                    } else {
                      toast({ title: "Payment failed", variant: "destructive" });
                    }
                  })
              }
            }} disabled={phoneResult.success === false || isPaying}>
              Pay now
            </Button>
          </DialogFooter>)}
        </DialogContent>
      </Dialog>

      {invoiceToUpdate && (<ConfirmDialog
        open={invoiceToUpdate !== null}
        title="Invoice update"
        message={`You are about to reactivate tenant's invoice, make sure payments were not in order since once done user will be required to pay.`}
        onCancel={() => setInvoiceToUpdate(null)}
        onConfirm={async () => {
          const { _id: id, status } = invoiceToUpdate!;
          setInvoiceToUpdate(null);
          try {
            const { message } = await apiClient.invoices.update(id, status);
            toast({ title: message });
            load(false);
          } catch (error: any) {
            toast({ title: error.message, variant: "destructive" });
          }
        }}
      />)}

      {invoiceToExempt && (<ConfirmDialog
        open={invoiceToExempt !== null}
        title="Exempt Invoice"
        message={`You are about to exempt tenant's invoice, make sure payments are in order since once done user service will be activated.`}
        onCancel={() => setExemptInvoice(null)}
        onConfirm={async () => {
          const { _id: id } = invoiceToExempt!;
          setExemptInvoice(null);
          try {
            const { message } = await apiClient.invoices.update(id, "exempted");
            toast({ title: message });
            load(false);
          } catch (error: any) {
            toast({ title: error.message, variant: "destructive" });
          }
        }}
      />)}
    </div>
  );
}
