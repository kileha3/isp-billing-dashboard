"use client";

import { useState, useEffect, useCallback } from "react";
import { apiClient } from "@/lib/api";
import { DataTable } from "@/components/admin/DataTable";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Plus, MoreHorizontal, Pencil, Trash2, Filter, RefreshCw, Users, Gift, Calendar, DollarSign, Clock, Power, PowerOff, Eye } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import type { Offer, Package, OfferCriteria } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";
import { usePageTitle } from "@/hooks/use-page-title";
import { z } from "zod";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { format } from "date-fns";

// Types
interface OfferWithQualified extends Offer {
  qualifiedUsersCount?: number;
}

// Schema for offer validation (without discount)
const offerSchema = z.object({
  name: z.string().min(3, ""),
  packageId: z.string().min(1, ""),
  criteria: z.object({
    minUsageDays: z.object({
      enabled: z.boolean(),
      operator: z.enum([">", ">=", "=", "<", "<="]),
      value: z.number().min(0, "Value must be 0 or greater"),
    }),
    totalSpent: z.object({
      enabled: z.boolean(),
      operator: z.enum([">", ">=", "=", "<", "<="]),
      value: z.number().min(0, "Value must be 0 or greater"),
    }),
    lastPurchaseDays: z.object({
      enabled: z.boolean(),
      operator: z.enum([">", ">=", "=", "<", "<="]),
      value: z.number().min(0, "Value must be 0 or greater"),
    }),
  }),
  startDate: z.string().min(1, "Start date is required"),
  endDate: z.string().min(1, "End date is required"),
  status: z.string(),
}).refine((data) => {
  // Ensure at least one criteria is enabled
  const hasAtLeastOneCriteria = 
    data.criteria.minUsageDays.enabled ||
    data.criteria.totalSpent.enabled ||
    data.criteria.lastPurchaseDays.enabled;
  
  if (!hasAtLeastOneCriteria) {
    return false;
  }
  return true;
}, {
  message: "",
  path: ["criteria"],
}).refine((data) => {
  // Validate end date is after start date
  const start = new Date(data.startDate);
  const end = new Date(data.endDate);
  return end > start;
}, {
  message: "End date must be after start date",
  path: ["endDate"],
});

type OfferFormData = z.infer<typeof offerSchema>;

const DEFAULT_CRITERIA = {
  minUsageDays: { enabled: false, operator: ">=" as const, value: 0 },
  totalSpent: { enabled: false, operator: ">=" as const, value: 0 },
  lastPurchaseDays: { enabled: false, operator: "<=" as const, value: 30 },
};

const DEFAULT_FORM: OfferFormData = {
  name: "",
  packageId: "",
  criteria: DEFAULT_CRITERIA,
  startDate: new Date().toISOString().split("T")[0],
  endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
  status: "active",
};

const OPERATORS = [
  { value: ">", label: "Greater than (>)" },
  { value: ">=", label: "Greater than or equal (≥)" },
  { value: "=", label: "Equal to (=)" },
  { value: "<", label: "Less than (<)" },
  { value: "<=", label: "Less than or equal (≤)" },
];

export default function OffersPage() {
  usePageTitle("Offers");
  const { toast } = useToast();

  const [offers, setOffers] = useState<OfferWithQualified[]>([]);
  const [packages, setPackages] = useState<Package[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [editTarget, setEditTarget] = useState<Offer | null>(null);
  const [form, setForm] = useState<OfferFormData>(DEFAULT_FORM);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [offerToDelete, setOfferToDelete] = useState<Offer | null>(null);
  const [statusFilter, setStatusFilter] = useState("all");
  const [showCriteriaDialog, setShowCriteriaDialog] = useState(false);
  const [selectedOffer, setSelectedOffer] = useState<Offer | null>(null);

  // Load offers and packages
  const load = useCallback(async (show: boolean = true) => {
    try {
      setLoading(show);
      const [offersData, packagesData] = await Promise.all([
        apiClient.offers?.list() || { data: [] },
        apiClient.packages.list("all","false","false"),
      ]);
      
      setOffers(offersData || []);
      setPackages(packagesData.data || []);
    } catch (error: any) {
      console.error("Failed to load offers:", error);
      toast({ 
        title: "Error loading offers", 
        description: error.message, 
        variant: "destructive" 
      });
      setOffers([]);
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  // Validate form in real-time
  const validateForm = useCallback(() => {
    const result = offerSchema.safeParse(form);
    if (!result.success) {
      const errors: Record<string, string> = {};
      result.error.errors.forEach((err) => {
        const path = err.path.join(".");
        errors[path] = err.message;
      });
      setFormErrors(errors);
      return false;
    }
    setFormErrors({});
    return true;
  }, [form]);

  // Re-validate when form changes
  useEffect(() => {
    validateForm();
  }, [form, validateForm]);

  // Check if form is valid for submission
  const isFormValid = () => {
    const result = offerSchema.safeParse(form);
    return result.success;
  };

  // Open dialog for creating new offer
  function openCreate() {
    setEditTarget(null);
    setForm({
      ...DEFAULT_FORM,
      startDate: new Date().toISOString().split("T")[0],
      endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
    });
    setFormErrors({});
    setShowDialog(true);
  }

  // Open dialog for editing offer
  function openEdit(offer: Offer) {
    setEditTarget(offer);
    setForm({
      name: offer.name,
      packageId: offer.packageId,
      criteria: offer.criteria,
      startDate: new Date(offer.startDate).toISOString().split("T")[0],
      endDate: new Date(offer.endDate).toISOString().split("T")[0],
      status: offer.status,
    });
    setFormErrors({});
    setShowDialog(true);
  }

  // Show criteria dialog
  function openShowCriteria(offer: Offer) {
    setSelectedOffer(offer);
    setShowCriteriaDialog(true);
  }

  // Toggle offer status
  async function toggleStatus(offer: Offer) {
    try {
      await apiClient.offers?.activateDeactivate(offer._id, !offer.status);
      toast({ 
        title: `Offer ${!offer.status ? "activated" : "deactivated"}`, 
        description: `${offer.name} has been ${!offer.status ? "activated" : "deactivated"} successfully` 
      });
      load(false);
    } catch (error: any) {
      toast({ 
        title: "Failed to update status", 
        description: error.message, 
        variant: "destructive" 
      });
    }
  }

  // Handle form submission
  async function handleSubmit() {
    if (!isFormValid()) {
      toast({ 
        title: "Validation Error", 
        description: "Please fix the errors before submitting", 
        variant: "destructive" 
      });
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        name: form.name,
        packageId: form.packageId,
        criteria: form.criteria,
        startDate: new Date(form.startDate).toISOString(),
        endDate: new Date(form.endDate).toISOString(),
        status: form.status,
      };

      if (editTarget) {
        await apiClient.offers?.update(editTarget._id, payload);
        toast({ title: "Offer updated", description: "Offer has been updated successfully" });
      } else {
        await apiClient.offers?.create(payload);
        toast({ title: "Offer created", description: "New offer has been created successfully" });
      }
      
      setShowDialog(false);
      load();
    } catch (error: any) {
      toast({ 
        title: "Failed to save offer", 
        description: error.message, 
        variant: "destructive" 
      });
    } finally {
      setSubmitting(false);
    }
  }

  // Update criteria field
  function updateCriteria(
    field: keyof typeof DEFAULT_CRITERIA,
    subField: string,
    value: any
  ) {
    setForm(prev => ({
      ...prev,
      criteria: {
        ...prev.criteria,
        [field]: {
          ...prev.criteria[field],
          [subField]: value,
        },
      },
    }));
  }

  // Toggle criteria enable/disable
  function toggleCriteria(field: keyof typeof DEFAULT_CRITERIA, enabled: boolean) {
    setForm(prev => ({
      ...prev,
      criteria: {
        ...prev.criteria,
        [field]: {
          ...prev.criteria[field],
          enabled,
        },
      },
    }));
  }

  // Get package name by ID
  function getPackageName(packageId: string) {
    const pkg = packages.find(p => p._id === packageId);
    return pkg?.name || "Unknown Package";
  }

  // Check if offer is expired
  function isOfferExpired(offer: Offer) {
    return offer.status === "expired"
  }

  // Get active criteria count
  function getActiveCriteriaCount(criteria: OfferCriteria) {
    let count = 0;
    if (criteria.minUsageDays.enabled) count++;
    if (criteria.totalSpent.enabled) count++;
    if (criteria.lastPurchaseDays.enabled) count++;
    return count;
  }

  // Get criteria display text
  function getCriteriaDisplayText(criteria: OfferCriteria) {
    const items = [];
    
    if (criteria.minUsageDays.enabled) {
      items.push(`Usage days: ${criteria.minUsageDays.operator} ${criteria.minUsageDays.value} days`);
    }
    if (criteria.totalSpent.enabled) {
      items.push(`Total spent: ${criteria.totalSpent.operator} TZS ${criteria.totalSpent.value.toLocaleString()}`);
    }
    if (criteria.lastPurchaseDays.enabled) {
      items.push(`Last purchase: ${criteria.lastPurchaseDays.operator} ${criteria.lastPurchaseDays.value} days ago`);
    }
    
    return items;
  }

  // Columns for DataTable
  const columns = [
    { 
      key: "name", 
      label: "Offer Name", 
      render: (v: unknown, row: unknown) => {
        const offer = row as OfferWithQualified;
        return (
          <div className="flex flex-col gap-0.5">
            <span className="text-sm font-medium">{offer.name}</span>
          </div>
        );
      }
    },
    {
      key: "packageId",
      label: "Package",
      render: (v: unknown) => {
        const packageId = v as string;
        const pkg = packages.find(p => p._id === packageId);
        return (
          <Badge variant="outline" className="text-xs">
            {pkg?.name || "Unknown"}
          </Badge>
        );
      }
    },
    {
      key: "criteria",
      label: "Criteria",
      render: (v: unknown, row: unknown) => {
        const offer = row as Offer;
        const count = getActiveCriteriaCount(offer.criteria);
        return (
          <Badge variant="secondary" className="text-xs">
            {count} active criteria
          </Badge>
        );
      }
    },
    {
      key: "dateRange",
      label: "Validity",
      render: (v: unknown, row: unknown) => {
        const offer = row as Offer;
        return (
          <div className="flex flex-col gap-0.5">
            <span className="text-xs">
              {format(new Date(offer.startDate), "MMM d, yyyy")} - {" "}
              {format(new Date(offer.endDate), "MMM d, yyyy")}
            </span>
          </div>
        );
      }
    },
    {
      key: "totalJoined",
      label: "Usage",
      render: (v: unknown, row: unknown) => Number(v) || 0
    },
    {
      key: "status",
      label: "Status",
      render: (v: unknown, row: unknown) => {
        const offer = row as Offer;
        let status = offer.status ? "active" : "inactive";
        return <StatusBadge status={status} />;
      }
    },
    {
      key: "createdAt",
      label: "Created",
      render: (v: unknown) => {
        if (!v) return "-";
        return new Date(v as string).toLocaleDateString();
      }
    },
  ];

  // Filter offers
  const getFilteredOffers = () => {
    let filtered = offers;
    
    if (statusFilter !== "all") {
      filtered = filtered.filter(offer => {
        if (statusFilter === "active") return offer.status === "active";
        if (statusFilter === "inactive") return offer.status === "innactive";
        if (statusFilter === "expired") return offer.status === "expired";
        return true;
      });
    }
    
    return filtered;
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Customer Offers</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Create targeted promotions for your customers based on their behavior
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4 mr-2" />
          Create Offer
        </Button>
      </div>

      <DataTable
        data={getFilteredOffers() as unknown as Record<string, unknown>[]}
        columns={columns as never}
        loading={loading}
        searchable
        searchKeys={["name"] as never}
        searchPlaceholder="Search offers..."
        emptyMessage="No offers created yet. Click 'Create Offer' to get started."
        pageSize={10}
        filterSlot={
          <div className="flex flex-row gap-2">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="h-10 w-44 bg-background">
                <Filter className="h-3.5 w-3.5 mr-2 text-muted-foreground" />
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Offers</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
                <SelectItem value="expired">Expired</SelectItem>
              </SelectContent>
            </Select>

            <Button variant="outline" onClick={() => load()} disabled={loading} className="h-10">
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
        }
        actions={(row: unknown) => {
          const offer = row as Offer;
          const expired = isOfferExpired(offer);
          return (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => openShowCriteria(offer)}>
                  <Eye className="mr-2 h-4 w-4" />
                  Show Criteria
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => openEdit(offer)} disabled={expired}>
                  <Pencil className="mr-2 h-4 w-4" />
                  Edit Offer
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => toggleStatus(offer)} disabled={expired}>
                  {offer.status ? (
                    <>
                      <PowerOff className="mr-2 h-4 w-4" />
                      Deactivate
                    </>
                  ) : (
                    <>
                      <Power className="mr-2 h-4 w-4" />
                      Activate
                    </>
                  )}
                </DropdownMenuItem>
                <DropdownMenuItem 
                  className="text-destructive"
                  onClick={() => setOfferToDelete(offer)}
                  disabled={expired}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete Offer
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          );
        }}
      />

      {/* Create/Edit Offer Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {editTarget ? "Edit Offer" : "Create New Offer"}
            </DialogTitle>
          </DialogHeader>

          <div className="flex flex-col gap-6 py-4">
            {/* Basic Information */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold">Basic Information</h3>
              
              <div className="flex gap-4">
                <div className="flex-[7] flex flex-col gap-1.5">
                  <Label>Offer Name *</Label>
                  <Input
                    placeholder="e.g., VIP Customer Reward"
                    value={form.name}
                    onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))}
                    className={formErrors.name ? "border-destructive" : ""}
                  />
                  {formErrors.name && (
                    <p className="text-xs text-destructive">{formErrors.name}</p>
                  )}
                </div>

                <div className="flex-[3] flex flex-col gap-1.5">
                  <Label>Target Package *</Label>
                  <Select value={form.packageId} onValueChange={(v) => setForm(f => ({ ...f, packageId: v }))}>
                    <SelectTrigger className={formErrors.packageId ? "border-destructive" : ""}>
                      <SelectValue placeholder="Select package..." />
                    </SelectTrigger>
                    <SelectContent>
                      {packages.filter(p => !p.isFree).map(pkg => (
                        <SelectItem key={pkg._id} value={pkg._id}>
                          {pkg.name} - {pkg.price === 0 ? "Free" : `TZS ${pkg.price.toLocaleString()}`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {formErrors.packageId && (
                    <p className="text-xs text-destructive">{formErrors.packageId}</p>
                  )}
                </div>
              </div>
            </div>

            {/* Qualification Criteria */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <Users className="h-4 w-4" />
                Customer Qualification Criteria
                <span className="text-xs text-muted-foreground font-normal">
                  (At least one required)
                </span>
              </h3>
              
              {formErrors["criteria"] && (
                <p className="text-xs text-destructive">{formErrors["criteria"]}</p>
              )}
              
              <div className="space-y-4 pl-4 border-l-2 border-border">
                {/* Minimum Usage Days */}
                <div className="flex items-start gap-3">
                  <Switch
                    checked={form.criteria.minUsageDays.enabled}
                    onCheckedChange={(v) => toggleCriteria("minUsageDays", v)}
                  />
                  <div className="flex-1 space-y-2">
                    <Label className="flex items-center gap-2">
                      <Calendar className="h-3 w-3" />
                      Minimum usage days
                    </Label>
                    {form.criteria.minUsageDays.enabled && (
                      <div className="flex gap-2">
                        <Select
                          value={form.criteria.minUsageDays.operator}
                          onValueChange={(v) => updateCriteria("minUsageDays", "operator", v)}
                        >
                          <SelectTrigger className="w-40">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {OPERATORS.map(op => (
                              <SelectItem key={op.value} value={op.value}>{op.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Input
                          type="number"
                          placeholder="Days"
                          className="w-32"
                          value={form.criteria.minUsageDays.value}
                          onChange={(e) => updateCriteria("minUsageDays", "value", parseInt(e.target.value) || 0)}
                        />
                        <span className="text-sm text-muted-foreground">days</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Total Amount Spent */}
                <div className="flex items-start gap-3">
                  <Switch
                    checked={form.criteria.totalSpent.enabled}
                    onCheckedChange={(v) => toggleCriteria("totalSpent", v)}
                  />
                  <div className="flex-1 space-y-2">
                    <Label className="flex items-center gap-2">
                      <DollarSign className="h-3 w-3" />
                      Total amount spent
                    </Label>
                    {form.criteria.totalSpent.enabled && (
                      <div className="flex gap-2">
                        <Select
                          value={form.criteria.totalSpent.operator}
                          onValueChange={(v) => updateCriteria("totalSpent", "operator", v)}
                        >
                          <SelectTrigger className="w-40">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {OPERATORS.map(op => (
                              <SelectItem key={op.value} value={op.value}>{op.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Input
                          type="number"
                          placeholder="Amount"
                          className="w-32"
                          value={form.criteria.totalSpent.value}
                          onChange={(e) => updateCriteria("totalSpent", "value", parseInt(e.target.value) || 0)}
                        />
                        <span className="text-sm text-muted-foreground">TZS</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Last Purchase Date */}
                <div className="flex items-start gap-3">
                  <Switch
                    checked={form.criteria.lastPurchaseDays.enabled}
                    onCheckedChange={(v) => toggleCriteria("lastPurchaseDays", v)}
                  />
                  <div className="flex-1 space-y-2">
                    <Label className="flex items-center gap-2">
                      <Clock className="h-3 w-3" />
                      Last purchase within
                    </Label>
                    {form.criteria.lastPurchaseDays.enabled && (
                      <div className="flex gap-2">
                        <Select
                          value={form.criteria.lastPurchaseDays.operator}
                          onValueChange={(v) => updateCriteria("lastPurchaseDays", "operator", v)}
                        >
                          <SelectTrigger className="w-40">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {OPERATORS.map(op => (
                              <SelectItem key={op.value} value={op.value}>{op.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Input
                          type="number"
                          placeholder="Days"
                          className="w-32"
                          value={form.criteria.lastPurchaseDays.value}
                          onChange={(e) => updateCriteria("lastPurchaseDays", "value", parseInt(e.target.value) || 0)}
                        />
                        <span className="text-sm text-muted-foreground">days ago</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Validity Period */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Validity Period
              </h3>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <Label>Start Date *</Label>
                  <Input
                    type="date"
                    value={form.startDate}
                    onChange={(e) => setForm(f => ({ ...f, startDate: e.target.value }))}
                    className={formErrors.startDate ? "border-destructive" : ""}
                  />
                  {formErrors.startDate && (
                    <p className="text-xs text-destructive">{formErrors.startDate}</p>
                  )}
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label>End Date *</Label>
                  <Input
                    type="date"
                    value={form.endDate}
                    onChange={(e) => setForm(f => ({ ...f, endDate: e.target.value }))}
                    className={formErrors.endDate ? "border-destructive" : ""}
                  />
                  {formErrors.endDate && (
                    <p className="text-xs text-destructive">{formErrors.endDate}</p>
                  )}
                </div>
              </div>
            </div>

            {/* Status */}
            <div className="flex items-center gap-3">
              <Switch
                checked={form.status === "active"}
                onCheckedChange={(v) => setForm(f => ({ ...f, status: v ? "active" : "inactive" }))}
              />
              <Label>Activate offer immediately</Label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleSubmit} 
              disabled={submitting || !isFormValid()}
            >
              {submitting ? "Saving..." : (editTarget ? "Update Offer" : "Create Offer")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Show Criteria Dialog */}
      <Dialog open={showCriteriaDialog} onOpenChange={setShowCriteriaDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              Offer Criteria: {selectedOffer?.name}
            </DialogTitle>
            <DialogDescription>
              Detailed qualification criteria for this offer
            </DialogDescription>
          </DialogHeader>

          {selectedOffer && (
            <div className="flex flex-col gap-6 py-4">
              {/* Basic Info */}
              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-muted-foreground">Target Package</h3>
                <Badge variant="outline" className="text-sm">
                  {getPackageName(selectedOffer.packageId)}
                </Badge>
              </div>

              {/* Criteria Details */}
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-muted-foreground">Qualification Criteria</h3>
                <div className="space-y-2">
                  {getActiveCriteriaCount(selectedOffer.criteria) === 0 ? (
                    <p className="text-sm text-muted-foreground">No criteria defined</p>
                  ) : (
                    getCriteriaDisplayText(selectedOffer.criteria).map((criteria, index) => (
                      <div key={index} className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg">
                        <Badge variant="secondary" className="text-xs">
                          {index === 0 ? "Must meet:" : "And"}
                        </Badge>
                        <span className="text-sm">{criteria}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Validity Period */}
              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-muted-foreground">Validity Period</h3>
                <div className="flex items-center gap-2 text-sm">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span>
                    {format(new Date(selectedOffer.startDate), "PPP")} - {format(new Date(selectedOffer.endDate), "PPP")} {isOfferExpired(selectedOffer) ? "(Expired)" : ""}
                  </span>
                </div>
              </div>

              
            </div>
          )}

        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      {offerToDelete && (
        <ConfirmDialog
          open={offerToDelete !== null}
          title="Delete Offer"
          message={`Are you sure you want to delete "${offerToDelete.name}"? This action cannot be undone.`}
          variant="destructive"
          onCancel={() => setOfferToDelete(null)}
          onConfirm={async () => {
            const offerId = offerToDelete._id;
            setOfferToDelete(null);
            try {
              await apiClient.offers?.delete(offerId);
              toast({ title: "Offer deleted", description: "Offer has been deleted successfully" });
              load();
            } catch (error: any) {
              toast({ title: "Failed to delete offer", description: error.message, variant: "destructive" });
            }
          }}
        />
      )}
    </div>
  );
}