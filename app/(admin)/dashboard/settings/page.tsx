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
import { Save } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth-context";

export default function SettingsPage({ tenantId }: { tenantId: string }) {
  const { toast } = useToast();
  const { user } = useAuth();
  const [general, setGeneral] = useState({
    currency: "TZS",
    timezone: "Africa/Dar_es_Salaam",
  });


  const load = useCallback(async () => {
    try {
      const { data } = await apiClient.tenant.get(tenantId);
      setGeneral(data.settings)
    } catch {}
  }, [tenantId]);

  const [profile, setProfile] = useState({
    name: "",
    email: "",
    currentPassword: "",
    newPassword: "",
  });

  const [payment, setPayment] = useState({
    gateway: "",
    account: "",
    password: "",
    token: "",
  });

  const [saving, setSaving] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPayment, setSavingPayment] = useState(false);

  useEffect(() => {
    if (user) {
      setProfile((p) => ({
        ...p,
        name: user.name ?? "",
        email: user.email ?? "",
      }));
    }
  }, [user]);

  useEffect(() => { load(); }, [load]);

  async function handleSaveGeneral() {
    setSaving(true);
    try {
      await apiClient.tenant.updateSettings(general, user!._id);
      toast({ title: "General settings saved" });
    } catch (error) {
      console.error(error)
      toast({ title: "Saved locally", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveProfile() {
    setSavingProfile(true);
    try {
      await apiClient.auth.updateProfile(profile);
      toast({ title: "Profile updated" });
      setProfile((p) => ({ ...p, currentPassword: "", newPassword: "" }));
    } catch {
      toast({ title: "Error updating profile", variant: "destructive" });
    } finally {
      setSavingProfile(false);
    }
  }

  async function handleSavePayment() {
    setSavingPayment(true);
    try {
      await apiClient.tenant.updateSettings({ paymentGateway: payment }, user!._id);
      toast({ title: "Gateway settings saved" });
    } catch {
      toast({ title: "Error saving gateway settings", variant: "destructive" });
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

      {/* 6-column layout */}
      <div className="grid grid-cols-6 gap-6">
        {/* General */}
        <Card className="col-span-6 md:col-span-3">
          <CardHeader>
            <CardTitle className="text-base">General</CardTitle>
            <CardDescription>
              Currency and timezone preferences
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label>Currency</Label>
              <select
                className="border rounded-md h-10 px-3 text-sm"
                value={general.currency}
                onChange={(e) =>
                  setGeneral((g) => ({ ...g, currency: e.target.value }))
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
                  setGeneral((g) => ({ ...g, timezone: e.target.value }))
                }
              />
            </div>

            <div className="flex justify-end">
              <Button onClick={handleSaveGeneral} disabled={saving}>
                <Save className="h-4 w-4 mr-2" />
                {saving ? "Saving…" : "Save"}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Profile */}
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
              placeholder="Email"
              value={profile.email}
              onChange={(e) =>
                setProfile((p) => ({ ...p, email: e.target.value }))
              }
            />

            <Separator />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                type="password"
                placeholder="Current Password"
                value={profile.currentPassword}
                onChange={(e) =>
                  setProfile((p) => ({
                    ...p,
                    currentPassword: e.target.value,
                  }))
                }
              />
              <Input
                type="password"
                placeholder="New Password"
                value={profile.newPassword}
                onChange={(e) =>
                  setProfile((p) => ({
                    ...p,
                    newPassword: e.target.value,
                  }))
                }
              />
            </div>

            <div className="flex justify-end">
              <Button onClick={handleSaveProfile} disabled={savingProfile}>
                <Save className="h-4 w-4 mr-2" />
                {savingProfile ? "Saving…" : "Update Profile"}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Payment */}

        <Card className="col-span-6 md:col-span-3">
          <CardHeader>
            <CardTitle className="text-base">Payment & Gateway</CardTitle>
            <CardDescription>
              Configure your payment provider credentials
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label>Gateway</Label>
              <select
                className="border rounded-md h-10 px-3 text-sm"
                value={payment.gateway}
                onChange={(e) =>
                  setPayment((p) => ({ ...p, gateway: e.target.value }))
                }
              >
                <option value="">Select gateway</option>
                <option value="selcom">Selcom</option>
                <option value="palmpesa">PalmPesa</option>
                <option value="azampesa">AzamPesa</option>
              </select>
            </div>

            {payment.gateway && (
              <>
                <div className="flex flex-col gap-1.5">
                  <Label>Username / Account ID</Label>
                  <Input
                    value={payment.account}
                    onChange={(e) =>
                      setPayment((p) => ({
                        ...p,
                        account: e.target.value,
                      }))
                    }
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label>Password</Label>
                  <Input
                    type="password"
                    value={payment.password}
                    onChange={(e) =>
                      setPayment((p) => ({
                        ...p,
                        password: e.target.value,
                      }))
                    }
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label>Token</Label>
                  <Input
                    value={payment.token}
                    onChange={(e) =>
                      setPayment((p) => ({
                        ...p,
                        token: e.target.value,
                      }))
                    }
                  />
                </div>
              </>
            )}

            <div className="flex justify-end">
              <Button onClick={handleSavePayment} disabled={savingPayment}>
                <Save className="h-4 w-4 mr-2" />
                {savingPayment ? "Saving…" : "Save Payment Settings"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>


    </div>
  );
}