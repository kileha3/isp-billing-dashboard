"use client";

import { useState, useEffect, useCallback } from "react";
import { apiClient } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Save } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth-context";
import { GatewayConfig } from "@/lib/types";

export default function DefaultsPage() {
  const { toast } = useToast();
  const { user } = useAuth();

  const [general, setGeneral] = useState({
    currency: "TZS",
    timezone: "Africa/Dar_es_Salaam",
    language: "en",
  });

  const [charges, setCharges] = useState({
    enableCharges: false,
    monthlyFee: "",
    registrationFee: "",
    monthlyThreshold: "",
  });

  const [gateways, setGateways] = useState<Array<GatewayConfig>>([]);
  const [activeGateway, setActiveGateway] = useState<string | undefined>(undefined);

  const [payment, setPayment] = useState<{
    gateway: string;
    values: Record<string, string>;
  }>({
    gateway: "",
    values: {},
  });

  const [saving, setSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [initialData, setInitialData] = useState<any>(null);

  const load = useCallback(async () => {
    try {
      const [data, remoteGateway] = await Promise.all([
        apiClient.defaults.current(),
        apiClient.transactions.gateways(),
      ]);

      setGateways(remoteGateway);

      const newGeneral = {
        currency: data?.currency || "TZS",
        timezone: data?.timezone || "Africa/Dar_es_Salaam",
        language: data?.language || "sw",
      };

      const newCharges = {
        enableCharges: data?.enableCharges || false,
        monthlyFee: data?.monthlyFee?.toString() || "",
        registrationFee: data?.registrationFee?.toString() || "",
        monthlyThreshold: data?.monthlyThreshold?.toString() || "",
      };

      const newPayment = {
        gateway: data?.payment?.gateway || "",
        values:  {},
      };

      setGeneral(newGeneral);
      setCharges(newCharges);
      setPayment(newPayment);

      setInitialData({
        general: newGeneral,
        charges: newCharges,
        payment: newPayment,
      });

      if(data?.payment) {
        const active = remoteGateway.find(
          (g) => g.gateway.id === data.payment?.gateway
        )?.gateway.name;
        
        if (active) setActiveGateway(active);
      }
      
      setIsDirty(false);
    } catch { }
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  // Helper function to parse charge values
  const parseChargeValue = (value: string): number => {
    if (value === "" || value === null || value === undefined) return 0;
    const parsed = parseFloat(value);
    return isNaN(parsed) ? 0 : parsed;
  };

  // Check if form is valid
  const isFormValid = useCallback(() => {
    // Check general settings
    if (!general.currency || !general.timezone || !general.language) {
      return false;
    }

    // Check charges if enabled
    if (charges.enableCharges) {
      const monthlyFee = parseChargeValue(charges.monthlyFee);
      const registrationFee = parseChargeValue(charges.registrationFee);
      const monthlyThreshold = parseChargeValue(charges.monthlyThreshold);
      
      if (monthlyFee < 0 || registrationFee < 0 || monthlyThreshold < 0) {
        return false;
      }
      // Monthly fee should be between 0 and 100
      if (monthlyFee > 100) {
        return false;
      }
    }

    // Check payment if gateway is selected
    if (payment.gateway) {
      const selectedGateway = gateways.find(
        (g) => g.gateway.id === payment.gateway
      );
      
      if (selectedGateway) {
        // Check all required fields are filled
        const allFieldsFilled = selectedGateway.fields.every((field) => {
          const value = payment.values[field.name];
          return value && value.trim().length > 0;
        });
        
        if (!allFieldsFilled) {
          return false;
        }
      }
    }

    return true;
  }, [general, charges, payment, gateways]);

  // Check if any data has changed
  const hasChanges = useCallback(() => {
    if (!initialData) return false;

    // Check general changes
    const generalChanged = 
      initialData.general.currency !== general.currency ||
      initialData.general.timezone !== general.timezone ||
      initialData.general.language !== general.language;

    // Check charges changes
    const chargesChanged = 
      initialData.charges.enableCharges !== charges.enableCharges ||
      initialData.charges.monthlyFee !== charges.monthlyFee ||
      initialData.charges.registrationFee !== charges.registrationFee ||
      initialData.charges.monthlyThreshold !== charges.monthlyThreshold;

    // Check payment changes
    const paymentChanged = 
      initialData.payment.gateway !== payment.gateway ||
      JSON.stringify(initialData.payment.values) !== JSON.stringify(payment.values);

    return generalChanged || chargesChanged || paymentChanged;
  }, [initialData, general, charges, payment]);

  // Update dirty state when data changes
  useEffect(() => {
    if (initialData) {
      setIsDirty(hasChanges());
    }
  }, [general, charges, payment, hasChanges, initialData]);

  // Determine if save button should be enabled
  const isSaveEnabled = isDirty && isFormValid() && !saving;

  async function handleSaveAll() {
    if (!user) return;
    if (!isFormValid()) {
      toast({ 
        title: "Invalid form", 
        description: "Please check all required fields",
        variant: "destructive" 
      });
      return;
    }
    
    setSaving(true);
    
    try {
      const monthlyFee = parseChargeValue(charges.monthlyFee);
      const registrationFee = parseChargeValue(charges.registrationFee);
      const monthlyThreshold = parseChargeValue(charges.monthlyThreshold);
      
      const chargesToSave = charges.enableCharges 
        ? {
            enableCharges: true,
            monthlyFee,
            registrationFee,
            monthlyThreshold,
          }
        : {
            enableCharges: false,
            monthlyFee: 0,
            registrationFee: 0,
            monthlyThreshold: 0,
          };
      
      const payload: any = {
        ...general,
        charges: chargesToSave,
      };
      
      // Only include payment if a gateway is selected and has values
      if (payment.gateway && Object.keys(payment.values).length > 0) {
        const selectedGateway = gateways.find(
          (g) => g.gateway.id === payment.gateway
        );
        
        if (selectedGateway) {
          const allFieldsFilled = selectedGateway.fields.every((field) => {
            const value = payment.values[field.name];
            return value && value.trim().length > 0;
          });
          
          if (allFieldsFilled) {
            payload.payment = {
              gateway: payment.gateway,
              auths: payment.values,
            };
          }
        }
      }
      
      await apiClient.defaults.createUpdate({...payload, ...charges, charges: undefined});
      toast({ title: "All settings saved successfully" });
      
      // Reload data to refresh initial state and active gateway display
      await load();
    } catch (error) {
      toast({ 
        title: "Error saving settings", 
        description: "Please try again",
        variant: "destructive" 
      });
    } finally {
      setSaving(false);
    }
  }

  const selectedGateway = gateways.find(
    (g) => g.gateway.id === payment.gateway
  );

  function handleGatewayChange(gatewayId: string) {
    const gw = gateways.find((g) => g.gateway.id === gatewayId);

    const initialValues: Record<string, string> = {};

    gw?.fields.forEach((f) => {
      initialValues[f.name] = "";
    });

    setPayment({
      gateway: gatewayId,
      values: initialValues,
    });
  }

  const handleEnableChargesChange = (enabled: boolean) => {
    if (!enabled) {
      setCharges({
        enableCharges: false,
        monthlyFee: "",
        registrationFee: "",
        monthlyThreshold: "",
      });
    } else {
      setCharges((prev) => ({
        ...prev,
        enableCharges: true,
      }));
    }
  };

  const handleChargeInputChange = (
    field: "monthlyFee" | "registrationFee" | "monthlyThreshold",
    value: string
  ) => {
    // Allow empty string, decimal numbers, and negative sign
    if (value === "" || value === "-" || /^-?\d*\.?\d*$/.test(value)) {
      setCharges((c) => ({
        ...c,
        [field]: value,
      }));
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">System Defaults</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage your system preferences to be adapted by tenants
          </p>
        </div>
        <Button 
          onClick={handleSaveAll} 
          disabled={!isSaveEnabled}
          size="default"
        >
          <Save className="h-4 w-4 mr-2" />
          {saving ? "Saving all settings…" : "Save All Settings"}
        </Button>
      </div>

      <div className="grid grid-cols-6 gap-6">
        {/* GENERAL SECTION */}
        <Card className="col-span-6 md:col-span-3">
          <CardHeader>
            <CardTitle className="text-base">General</CardTitle>
            <CardDescription>
              Currency, timezone, and language preferences
            </CardDescription>
          </CardHeader>

          <CardContent className="flex flex-col gap-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <Label>Currency</Label>
                <select
                  className="border rounded-md h-10 px-3 text-sm"
                  value={general.currency}
                  onChange={(e) =>
                    setGeneral((g) => ({
                      ...g,
                      currency: e.target.value,
                    }))
                  }
                >
                  <option value="TZS">Tanzanian Shilling (TZS)</option>
                  <option value="KES">Kenyan Shilling (KES)</option>
                  <option value="UGX">Ugandan Shilling (UGX)</option>
                  <option value="RWF">Rwandan Franc (RWF)</option>
                  <option value="BIF">Burundian Franc (BIF)</option>
                  <option value="SSP">South Sudanese Pound (SSP)</option>
                </select>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label>Timezone</Label>
                <Input
                  value={general.timezone}
                  onChange={(e) =>
                    setGeneral((g) => ({
                      ...g,
                      timezone: e.target.value,
                    }))
                  }
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <Label>Language</Label>
                <select
                  className="border rounded-md h-10 px-3 text-sm"
                  value={general.language}
                  onChange={(e) =>
                    setGeneral((g) => ({
                      ...g,
                      language: e.target.value,
                    }))
                  }
                >
                  <option value="en">English</option>
                  <option value="sw">Swahili</option>
                </select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* PAYMENT GATEWAY SECTION */}
        {gateways.length > 0 && (
          <Card className="col-span-6 md:col-span-3">
            <CardHeader>
              <CardTitle className="text-base">
                Payment & Gateway
              </CardTitle>
              <CardDescription>
                Configure your system payment gateway{" "}
                {activeGateway ? `, right now ` : ""}
                <strong>{activeGateway || ""}</strong>
                {activeGateway ? ` is configured for payments` : ""}
              </CardDescription>
            </CardHeader>

            <CardContent className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <Label>Gateway</Label>
                <select
                  className="border rounded-md h-10 px-3 text-sm"
                  value={payment.gateway}
                  onChange={(e) =>
                    handleGatewayChange(e.target.value)
                  }
                >
                  <option value="">Select gateway</option>
                  {gateways.map((g) => (
                    <option key={g.gateway.id} value={g.gateway.id}>
                      {g.gateway.name}
                    </option>
                  ))}
                </select>
              </div>

              {selectedGateway &&
                selectedGateway.fields.map((field) => (
                  <div
                    key={field.name}
                    className="flex flex-col gap-1.5"
                  >
                    <Label className="capitalize">
                      {field.name}
                    </Label>
                    <Input
                      placeholder={field.placeholder}
                      value={payment.values[field.name] || ""}
                      onChange={(e) =>
                        setPayment((p) => ({
                          ...p,
                          values: {
                            ...p.values,
                            [field.name]: e.target.value,
                          },
                        }))
                      }
                    />
                  </div>
                ))}
            </CardContent>
          </Card>
        )}

        {/* CHARGE & FEES SECTION */}
        <Card className="col-span-6 md:col-span-3">
          <CardHeader>
            <CardTitle className="text-base">Charge & Fees</CardTitle>
            <CardDescription>
              Configure monthly fees, registration fees, and thresholds
            </CardDescription>
          </CardHeader>

          <CardContent className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div className="flex flex-col gap-1">
                <Label className="font-medium">Enable Charges</Label>
                <p className="text-xs text-muted-foreground">
                  When disabled, all charges will be set to zero
                </p>
              </div>
              <Switch
                checked={charges.enableCharges}
                onCheckedChange={handleEnableChargesChange}
              />
            </div>

            <Separator />

            {/* Monthly Fee and Threshold - same row */}
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <Label>Monthly Fee (%)</Label>
                <Input
                  type="text"
                  inputMode="decimal"
                  placeholder="0"
                  value={charges.monthlyFee}
                  onChange={(e) =>
                    handleChargeInputChange("monthlyFee", e.target.value)
                  }
                  disabled={!charges.enableCharges}
                />
                <p className="text-xs text-muted-foreground">
                  Percentage fee charged monthly (0-100%)
                </p>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label>Monthly Threshold</Label>
                <Input
                  type="text"
                  inputMode="decimal"
                  placeholder="0"
                  value={charges.monthlyThreshold}
                  onChange={(e) =>
                    handleChargeInputChange("monthlyThreshold", e.target.value)
                  }
                  disabled={!charges.enableCharges}
                />
                <p className="text-xs text-muted-foreground">
                  Minimum threshold before monthly fee is applied
                </p>
              </div>
            </div>

            {/* Registration Fee - half width */}
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <Label>Registration Fee (Price)</Label>
                <Input
                  type="text"
                  inputMode="decimal"
                  placeholder="0"
                  value={charges.registrationFee}
                  onChange={(e) =>
                    handleChargeInputChange("registrationFee", e.target.value)
                  }
                  disabled={!charges.enableCharges}
                />
                <p className="text-xs text-muted-foreground">
                  One-time fee charged during registration
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}