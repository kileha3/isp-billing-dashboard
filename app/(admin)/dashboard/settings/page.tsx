"use client";

import { useState, useEffect, useCallback } from "react";
import { apiClient } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Save } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth-context";

export default function SettingsPage() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [general, setGeneral] = useState({ currency: "KES", timezone: "Africa/Nairobi" });
  const [profile, setProfile] = useState({ name: "", email: "", currentPassword: "", newPassword: "" });
  const [saving, setSaving] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);

  useEffect(() => {
    if (user) {
      setProfile(p => ({ ...p, name: user.name ?? "", email: user.email ?? "" }));
    }
  }, [user]);

  async function handleSaveGeneral() {
    setSaving(true);
    try {
      await apiClient.tenant.updateSettings(general);
      toast({ title: "Settings saved" });
    } catch {
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
      setProfile(p => ({ ...p, currentPassword: "", newPassword: "" }));
    } catch {
      toast({ title: "Error updating profile", variant: "destructive" });
    } finally {
      setSavingProfile(false);
    }
  }

  return (
    <div className="flex flex-col gap-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">Manage your account and tenant preferences</p>
      </div>

      {/* General Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">General</CardTitle>
          <CardDescription>Currency and timezone preferences</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label>Currency</Label>
              <Input value={general.currency} onChange={(e) => setGeneral(g => ({ ...g, currency: e.target.value }))} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Timezone</Label>
              <Input value={general.timezone} onChange={(e) => setGeneral(g => ({ ...g, timezone: e.target.value }))} />
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

      {/* Profile */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Profile</CardTitle>
          <CardDescription>Your personal account details</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label>Full Name</Label>
            <Input value={profile.name} onChange={(e) => setProfile(p => ({ ...p, name: e.target.value }))} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Email</Label>
            <Input type="email" value={profile.email} onChange={(e) => setProfile(p => ({ ...p, email: e.target.value }))} />
          </div>
          <Separator />
          <p className="text-sm font-medium text-muted-foreground">Change Password</p>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label>Current Password</Label>
              <Input type="password" value={profile.currentPassword} onChange={(e) => setProfile(p => ({ ...p, currentPassword: e.target.value }))} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>New Password</Label>
              <Input type="password" value={profile.newPassword} onChange={(e) => setProfile(p => ({ ...p, newPassword: e.target.value }))} />
            </div>
          </div>
          <div className="flex justify-end">
            <Button onClick={handleSaveProfile} disabled={savingProfile}>
              <Save className="h-4 w-4 mr-2" />
              {savingProfile ? "Saving…" : "Update Profile"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Captive Portal URL */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Captive Portal</CardTitle>
          <CardDescription>Configure your MikroTik hotspot to redirect to this URL</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg bg-muted p-3">
            <p className="text-xs text-muted-foreground mb-1">Redirect URL (set in MikroTik Hotspot profile)</p>
            <code className="text-sm font-mono break-all">
              {typeof window !== "undefined" ? window.location.origin : "https://your-domain.com"}/pay?router=ROUTER_ID
            </code>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Replace <code className="font-mono bg-muted px-1 rounded">ROUTER_ID</code> with the ID of each router found in the Routers page.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
