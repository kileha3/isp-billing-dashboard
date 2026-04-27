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
import { Save, Key, Shield } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth-context";
import { GatewayConfig } from "@/lib/types";
import { Switch } from "@/components/ui/switch";

export default function SettingsPage({ tenantId }: { tenantId: string }) {
  const { toast } = useToast();
  const { user } = useAuth();

  const [general, setGeneral] = useState({
    currency: "TZS",
    timezone: "Africa/Dar_es_Salaam",
    language: "en",
  });

  const [gateways, setGateways] = useState<Array<GatewayConfig>>([]);
  const [activeGateway, setActiveGateway] = useState<
    string | null | undefined
  >(null);

  const [profile, setProfile] = useState({
    name: "",
    email: "",
    status: "",
  });

  const [payment, setPayment] = useState<{
    gateway: string;
    values: Record<string, string>;
  }>({
    gateway: "",
    values: {},
  });

  const [charges, setCharges] = useState({
    applyCharges: false,
    registrationFee: 0,
    monthlyFee: 0,
    monthlyThreshold: 0,
  });

  const [saving, setSaving] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPayment, setSavingPayment] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);

  const load = useCallback(async () => {
    try {
      const [{ data }, remoteGateway] = await Promise.all([
        apiClient.tenant.get(tenantId),
        apiClient.transactions.gateways(),
      ]);

      setGeneral({
        currency: data.settings.currency || "TZS",
        timezone: data.settings.timezone || "Africa/Dar_es_Salaam",
        language: data.settings.language || "en",
      });

      setGateways(remoteGateway);

      const active = remoteGateway.find(
        (g) => g.gateway.id === data.paymentGateway?.gateway
      )?.gateway.name;

      if (active) setActiveGateway(active);

      // Load charges data
      if (data.paymentPref) {
        setCharges({
          applyCharges: data.paymentPref.enableCharges || false,
          registrationFee: data.paymentPref.registrationFee || 0,
          monthlyFee: data.paymentPref.monthlyFee || 0,
          monthlyThreshold: data.paymentPref.monthlyThreshold || 0,
        });
      }

      if (user) {
      setProfile((p) => ({
        ...p,
        name: user.name ?? "",
        email: user.email ?? "",
        status: data.status ?? "active",
      }));
    }
    } catch { }
  }, [tenantId]);


  useEffect(() => {
    load();
  }, [load]);

  async function handleSaveGeneral() {
    if (!user) return;
    setSaving(true);
    try {
      await apiClient.tenant.updateSettings(general, user!.tenantId!);
      toast({ title: "General settings saved" });
    } catch (error: any) {
      toast({ title: error.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveProfile() {
    setSavingProfile(true);
    try {
      await apiClient.auth.updateProfile({ name: profile.name });
      toast({ title: "Profile updated" });
    } catch {
      toast({ title: "Error updating profile", variant: "destructive" });
    } finally {
      setSavingProfile(false);
    }
  }

  async function handlePasswordChange() {
    setChangingPassword(true);
    try {
      await apiClient.auth.forgotPassword(profile.email);
      toast({ 
        title: "Password reset email sent", 
        description: "Check your email for instructions to reset your password" 
      });
    } catch {
      toast({ 
        title: "Error sending reset email", 
        variant: "destructive" 
      });
    } finally {
      setChangingPassword(false);
    }
  }

  const selectedGateway = gateways.find(
    (g) => g.gateway.id === payment.gateway
  );

  function isPaymentValid(): boolean {
    if (!selectedGateway) return false;

    return selectedGateway.fields.every((field) => {
      const value = payment.values[field.name];
      return typeof value === "string" && value.trim().length > 0;
    });
  }

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

  async function handleSavePayment() {
    if (!user) return;

    if (!isPaymentValid()) {
      toast({
        title: "Please fill all required fields",
        variant: "destructive",
      });
      return;
    }

    setSavingPayment(true);

    try {
      await apiClient.tenant.updateSettings(
        {
          paymentGateway: {
            gateway: payment.gateway,
            auths: payment.values,
          },
        },
        user!.tenantId!
      );
      setPayment({
        gateway: "",
        values: {},
      });
      load();
      toast({ title: "Gateway settings saved" });
    } catch {
      toast({
        title: "Error saving gateway settings",
        variant: "destructive",
      });
    } finally {
      setSavingPayment(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Manage your account and tenant preferences
        </p>
      </div>

      <div className="grid grid-cols-6 gap-6">
        {/* GENERAL */}
        <Card className="col-span-6 md:col-span-3">
          <CardHeader>
            <CardTitle className="text-base">General</CardTitle>
            <CardDescription>
              Currency, timezone, and language preferences
            </CardDescription>
          </CardHeader>

          <CardContent className="flex flex-col gap-4">
            {/* Row 1 */}
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

            {/* Row 2 */}
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

            <div className="flex justify-end">
              <Button onClick={handleSaveGeneral} disabled={saving}>
                <Save className="h-4 w-4 mr-2" />
                {saving ? "Saving…" : "Save"}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* PROFILE */}
        <Card className="col-span-6 md:col-span-3">
          <CardHeader>
            <CardTitle className="text-base">Profile</CardTitle>
            <CardDescription>Your personal account details</CardDescription>
          </CardHeader>

          <CardContent className="flex flex-col gap-4">
            <Input
              placeholder="Full Name"
              value={profile.name}
              onChange={(e) =>
                setProfile((p) => ({ ...p, name: e.target.value }))
              }
            />

            <Input
              type="email"
              value={profile.email}
              disabled
              className="opacity-70 cursor-not-allowed"
            />

            <div className="flex items-center justify-between pt-2">
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Account Status:</span>
                <span className={`text-sm font-medium ${profile.status === 'active' ? 'text-green-600' : 'text-red-600'}`}>
                  {profile.status?.toUpperCase() || 'ACTIVE'}
                </span>
              </div>
              
              <Button
                onClick={handlePasswordChange}
                disabled={changingPassword}
                variant="outline"
                size="sm"
              >
                <Key className="h-4 w-4 mr-2" />
                {changingPassword ? "Sending..." : "Password Change"}
              </Button>
            </div>

            <div className="flex justify-end">
              <Button onClick={handleSaveProfile} disabled={savingProfile}>
                <Save className="h-4 w-4 mr-2" />
                {savingProfile ? "Saving…" : "Update Profile"}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* PAYMENT */}
        {gateways.length > 0 && (
          <Card className="col-span-6 md:col-span-3">
            <CardHeader>
              <CardTitle className="text-base">
                Payment & Gateway
              </CardTitle>
              <CardDescription>
                Configure your payment provider credentials{" "}
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

              <div className="flex justify-end">
                <Button
                  onClick={handleSavePayment}
                  disabled={
                    savingPayment ||
                    !isPaymentValid() ||
                    !payment.gateway
                  }
                >
                  <Save className="h-4 w-4 mr-2" />
                  {savingPayment
                    ? "Saving…"
                    : "Save Payment Settings"}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* CHARGES */}
        {charges && (
          <Card className="col-span-6 md:col-span-3">
            <CardHeader>
              <CardTitle className="text-base">Charges</CardTitle>
              <CardDescription>
                Fee structure applied to this account
              </CardDescription>
            </CardHeader>

            <CardContent className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Switch
                    checked={charges.applyCharges}
                    onCheckedChange={(checked) =>
                      setCharges((c) => ({ ...c, applyCharges: checked }))
                    }
                    disabled
                  />
                  <Label>{charges.applyCharges ? "Charges are applied to this account" : "No charges applied to this account"}</Label>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="flex flex-col gap-1.5">
                  <Label>Registration Fee</Label>
                  <Input
                    type="number"
                    value={charges.registrationFee}
                    onChange={(e) =>
                      setCharges((c) => ({
                        ...c,
                        registrationFee: parseFloat(e.target.value) || 0,
                      }))
                    }
                    disabled
                    className="bg-muted"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label>Monthly Fee</Label>
                  <Input
                    type="number"
                    value={charges.monthlyFee}
                    onChange={(e) =>
                      setCharges((c) => ({
                        ...c,
                        monthlyFee: parseFloat(e.target.value) || 0,
                      }))
                    }
                    disabled
                    className="bg-muted"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label>Monthly Threshold</Label>
                  <Input
                    type="number"
                    value={charges.monthlyThreshold}
                    onChange={(e) =>
                      setCharges((c) => ({
                        ...c,
                        monthlyThreshold: parseFloat(e.target.value) || 0,
                      }))
                    }
                    disabled
                    className="bg-muted"
                  />
                </div>
              </div>

              <p className="text-xs text-muted-foreground mt-2">
                These charges are configured by the system administrator and cannot be modified here.
                They determine the fee structure applied to this tenant account.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}