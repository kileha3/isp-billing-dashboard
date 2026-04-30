"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { apiClient, imageUrl } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Separator } from "@/components/ui/separator";
import { Save, Upload, Eye, Wifi, Phone, Mail, MessageCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { TenantPortalSettings } from "@/lib/types";
import { appName } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";

const DEFAULT_SETTINGS: any = {
  branding: {
    logo: "",
    primaryColor: "#3B82F6",
    secondaryColor: "#1E40AF",
    businessName: "My ISP",
  },
  support: {
    phone: "",
    email: "",
    whatsapp: "",
    showOnPortal: false,
  },
  portalSettings: {
    displayMode: "both",
    welcomeMessage: "Welcome! Select a package or enter your voucher code to get connected.",
    termsUrl: "",
    showPoweredBy: true,
  },
  currency:"TZS"
};

const PRESET_COLORS = [
  { label: "Ocean Blue", primary: "#3B82F6", secondary: "#1E40AF" },
  { label: "Emerald", primary: "#10B981", secondary: "#065F46" },
  { label: "Violet", primary: "#8B5CF6", secondary: "#4C1D95" },
  { label: "Rose", primary: "#F43F5E", secondary: "#881337" },
  { label: "Amber", primary: "#F59E0B", secondary: "#78350F" },
  { label: "Slate", primary: "#475569", secondary: "#0F172A" },

  // New ones
  { label: "Teal", primary: "#14B8A6", secondary: "#134E4A" },
  { label: "Sky", primary: "#0EA5E9", secondary: "#075985" },
  { label: "Indigo", primary: "#6366F1", secondary: "#312E81" },
  { label: "Lime", primary: "#84CC16", secondary: "#365314" },
  { label: "Orange", primary: "#F97316", secondary: "#7C2D12" },
  { label: "Red", primary: "#EF4444", secondary: "#7F1D1D" },
  { label: "Pink", primary: "#EC4899", secondary: "#831843" },
  { label: "Cyan", primary: "#06B6D4", secondary: "#164E63" },
  { label: "Cool Gray", primary: "#6B7280", secondary: "#111827" },

  // Slightly more unique / brand-like
  { label: "Deep Purple", primary: "#7C3AED", secondary: "#2E1065" },
  { label: "Forest Green", primary: "#15803D", secondary: "#052E16" },
  { label: "Sunset", primary: "#FB7185", secondary: "#7F1D1D" },
  { label: "Midnight Blue", primary: "#1E3A8A", secondary: "#020617" },
];

export default function PortalCustomizationPage({ tenantId }: { tenantId: string }) {
  const { toast } = useToast();
  const router = useRouter();
  const [settings, setSettings] = useState<TenantPortalSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { isRole } = useAuth();
  const isSuperAdmin = isRole("super_admin");

  const load = useCallback(async () => {
    try {
      const { data } = await apiClient.tenant.get(tenantId);
      if(!data.portalSettings.termsUrl) data.portalSettings.termsUrl = "https://isp.easypay.co.tz/terms-and-conditions";
      setSettings(data as any);
      if (settings.branding.logo) setLogoPreview(settings.branding.logo);
    } catch (error: any) {
      setSettings(DEFAULT_SETTINGS);
      toast({ title:  error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => { load(); }, [load]);

  function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => setLogoPreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  }

  const canNotSave = () => {
    return saving || (settings.support.showOnPortal && (settings.support.email.length <= 2 || settings.support.phone.length <= 8 || settings.support.whatsapp.length <= 8));
  }

  async function handleSave() {
    setSaving(true);
    try {
      let logoUrl = settings.branding.logo;
      if (logoFile) {
        const formData = new FormData();
        formData.append("logo", logoFile);
        const uploadData = await apiClient.tenant.uploadLogo(formData, tenantId);
        logoUrl = uploadData.url;
      }
      const _settings = { ...settings, branding: { ...settings.branding, logo: logoUrl }};
      await apiClient.tenant.updatePortalSettings(_settings, tenantId);
      toast({ title: "Portal settings saved", description: "Your captive portal has been updated." });
      router.back();
    } catch (error: any) {
     toast({ title:  error.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  function setBranding(key: keyof TenantPortalSettings["branding"], value: string) {
    setSettings(s => ({ ...s, branding: { ...s.branding, [key]: value } }));
  }
  function setSupport(key: keyof TenantPortalSettings["support"], value: string | boolean) {
    setSettings(s => ({ ...s, support: { ...s.support, [key]: value } }));
  }
  function setPortal(key: keyof TenantPortalSettings["portalSettings"], value: string | boolean) {
    setSettings(s => ({ ...s, portalSettings: { ...s.portalSettings, [key]: value } }));
  }

  /* if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Progress />
      </div>
    );
  } */

  // Live preview styles
  const previewStyle = {
    "--portal-primary": settings.branding.primaryColor,
    "--portal-secondary": settings.branding.secondaryColor,
  } as React.CSSProperties;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Portal Design</h1>
          <p className="text-sm text-muted-foreground mt-1">Customize how your captive portal looks for customers</p>
        </div>
        <Button onClick={handleSave} disabled={canNotSave()}>
          <Save className="h-4 w-4 mr-2" />
          {saving ? "Saving…" : "Save Changes"}
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_360px]">
        {/* Settings Panel */}
        <div className="flex flex-col gap-5">

          {/* Branding */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Branding</CardTitle>
              <CardDescription>Logo, business name, and color scheme shown to customers</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-5">
              {/* Logo */}
              <div className="flex flex-col gap-2">
                <Label>Logo</Label>
                <div className="flex items-center gap-4">
                  <div className="flex h-16 w-16 items-center justify-center rounded-xl border-2 border-dashed border-border bg-muted overflow-hidden">
                    {logoPreview || settings.branding.logo.length ? (
                      <img src={logoPreview ?  logoPreview : `${imageUrl(settings.branding.logo)}`} alt="Logo" className="h-full w-full object-contain" />
                    ) : (
                      <Wifi className="h-6 w-6 text-muted-foreground" />
                    )}
                  </div>
                  <div className="flex flex-col gap-1">
                    <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
                      <Upload className="h-3.5 w-3.5 mr-1.5" />
                      Upload Logo
                    </Button>
                    <p className="text-xs text-muted-foreground">PNG, JPG up to 2MB</p>
                  </div>
                  <input ref={fileInputRef} type="file" accept="image/jpg, image/png" className="hidden" onChange={handleLogoChange} />
                </div>
              </div>

              {/* Business name */}
              <div className="flex flex-col gap-1.5">
                <Label>Business Name</Label>
                <Input
                  placeholder="e.g. FastNet WiFi"
                  value={settings.branding.businessName}
                  onChange={(e) => setBranding("businessName", e.target.value)}
                />
              </div>

              {/* Color presets */}
              <div className="flex flex-col gap-2">
                <Label>Color Theme</Label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {PRESET_COLORS.map((preset) => (
                    <button
                      key={preset.label}
                      title={preset.label}
                      onClick={() => {
                        setBranding("primaryColor", preset.primary);
                        setBranding("secondaryColor", preset.secondary);
                      }}
                      className="h-7 w-7 rounded-full border-2 transition-all hover:scale-110"
                      style={{
                        background: preset.primary,
                        borderColor: settings.branding.primaryColor === preset.primary ? "#000" : "transparent",
                      }}
                    />
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1.5">
                    <Label className="text-xs text-muted-foreground">Primary Color</Label>
                    <div className="flex gap-2 items-center">
                      <input
                        type="color"
                        value={settings.branding.primaryColor}
                        onChange={(e) => setBranding("primaryColor", e.target.value)}
                        className="h-8 w-10 rounded cursor-pointer border border-border bg-background"
                      />
                      <Input
                        value={settings.branding.primaryColor}
                        onChange={(e) => setBranding("primaryColor", e.target.value)}
                        className="font-mono text-sm"
                      />
                    </div>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label className="text-xs text-muted-foreground">Secondary Color</Label>
                    <div className="flex gap-2 items-center">
                      <input
                        type="color"
                        value={settings.branding.secondaryColor}
                        onChange={(e) => setBranding("secondaryColor", e.target.value)}
                        className="h-8 w-10 rounded cursor-pointer border border-border bg-background"
                      />
                      <Input
                        value={settings.branding.secondaryColor}
                        onChange={(e) => setBranding("secondaryColor", e.target.value)}
                        className="font-mono text-sm"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Display Mode */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Portal Display Mode</CardTitle>
              <CardDescription>Control what payment options are shown to customers</CardDescription>
            </CardHeader>
            <CardContent>
              <RadioGroup
                value={settings.portalSettings.displayMode}
                onValueChange={(v) => setPortal("displayMode", v)}
                className="flex flex-col gap-3"
              >
                {[
                  { value: "both", label: "Packages & Vouchers", desc: "Show tabs for both package purchase and voucher redemption" },
                  { value: "packages_only", label: "Packages Only", desc: "Only show package purchase — no voucher option" },
                  { value: "vouchers_only", label: "Vouchers Only", desc: "Only show voucher redemption — no package purchase" },
                ].map((opt) => (
                  <label
                    key={opt.value}
                    className={`flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition-colors ${settings.portalSettings.displayMode === opt.value ? "border-primary bg-primary/5" : "border-border hover:bg-muted/40"}`}
                  >
                    <RadioGroupItem value={opt.value} className="mt-0.5" />
                    <div>
                      <p className="text-sm font-medium">{opt.label}</p>
                      <p className="text-xs text-muted-foreground">{opt.desc}</p>
                    </div>
                  </label>
                ))}
              </RadioGroup>
            </CardContent>
          </Card>

          {/* Support Info */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Support Information</CardTitle>
              <CardDescription>Contact details displayed at the bottom of the portal</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="flex items-center gap-3">
                <Switch
                  id="showSupport"
                  checked={settings.support.showOnPortal}
                  onCheckedChange={(v) => setSupport("showOnPortal", v)}
                />
                <Label htmlFor="showSupport">Show support info on portal</Label>
              </div>
              <Separator />
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <Label className="flex items-center gap-1.5"><Phone className="h-3.5 w-3.5" />Phone</Label>
                  <Input placeholder="+255712XXXXXX" value={settings.support.phone} onChange={(e) => {
                    setSupport("phone", e.target.value);
                    setSupport("whatsapp", e.target.value)
                  }} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label className="flex items-center gap-1.5"><Mail className="h-3.5 w-3.5" />Email</Label>
                  <Input placeholder="support@myisp.com" type="email" value={settings.support.email} onChange={(e) => setSupport("email", e.target.value)} />
                </div>
                {/* <div className="flex flex-col gap-1.5">
                  <Label className="flex items-center gap-1.5"><MessageCircle className="h-3.5 w-3.5" />WhatsApp</Label>
                  <Input placeholder="+255712XXXXXX" value={settings.support.whatsapp} onChange={(e) => setSupport("whatsapp", e.target.value)} />
                </div> */}
              </div>
            </CardContent>
          </Card>

          {/* Portal Content */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Portal Content</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <Label>Welcome Message</Label>
                <Textarea
                  rows={2}
                  placeholder="Welcome! Select a package to get connected."
                  value={settings.portalSettings.welcomeMessage}
                  onChange={(e) => setPortal("welcomeMessage", e.target.value)}
                />
              </div>
              {/* <div className="flex flex-col gap-1.5">
                <Label>Terms of Service URL (optional)</Label>
                <Input placeholder="https://myisp.com/terms" value={settings.portalSettings.termsUrl} onChange={(e) => setPortal("termsUrl", e.target.value)} />
              </div> */}
              {isSuperAdmin && (<div className="flex items-center gap-3">
                <Switch
                  id="showPoweredBy"
                  checked={settings.portalSettings.showPoweredBy}
                  onCheckedChange={(v) => setPortal("showPoweredBy", v)}
                />
                <Label htmlFor="showPoweredBy">Show "Powered by {appName}"</Label>
              </div>)}
            </CardContent>
          </Card>
        </div>

        {/* Live Preview */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <Eye className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">Live Preview</span>
          </div>
          <div className="sticky top-6 rounded-2xl border border-border overflow-hidden shadow-lg bg-background" style={previewStyle}>
            {/* Portal Preview */}
            <div className="flex flex-col min-h-[600px]">
              {/* Header */}
              <div className="flex items-center gap-3 px-5 py-4" style={{ background: settings.branding.primaryColor }}>
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/20 overflow-hidden shrink-0">
                  {logoPreview || settings.branding.logo.length ? (
                      <img src={logoPreview ?  logoPreview : `${imageUrl(settings.branding.logo)}`} alt="Logo" className="h-8 w-8 object-contain" />
                    ): (
                    <Wifi className="h-5 w-5 text-white" />
                  )}
                </div>
                <div>
                  <p className="font-bold text-white text-sm">{settings.branding.businessName || "My ISP"}</p>
                  <p className="text-white/70 text-xs">Connect to the internet</p>
                </div>
              </div>

              {/* Welcome */}
              {settings.portalSettings.welcomeMessage && (
                <div className="px-5 py-3 bg-muted/30 border-b border-border">
                  <p className="text-xs text-muted-foreground leading-relaxed">{settings.portalSettings.welcomeMessage}</p>
                </div>
              )}

              {/* Content */}
              <div className="flex-1 px-5 py-4">
                {settings.portalSettings.displayMode === "both" && (
                  <div className="flex gap-1 mb-4">
                    <div className="flex-1 py-1.5 text-center text-xs font-semibold rounded-lg text-white" style={{ background: settings.branding.primaryColor }}>
                      Buy Access
                    </div>
                    <div className="flex-1 py-1.5 text-center text-xs font-medium rounded-lg border border-border text-muted-foreground">
                      Have a Voucher?
                    </div>
                  </div>
                )}

                {settings.portalSettings.displayMode !== "vouchers_only" && (
                  <div className="flex flex-col gap-2">
                    {[
                      { name: "Hourly", price: "TZS 50", data: "Unlimited", duration: "1 hour" },
                      { name: "Daily", price: "TZS 100", data: "1 GB", duration: "24 hours" },
                      { name: "Weekly", price: "TZS 500", data: "5 GB", duration: "7 days" },
                    ].map((pkg) => (
                      <div key={pkg.name} className="flex items-center justify-between rounded-lg border border-border p-3 hover:border-[var(--portal-primary)] transition-colors cursor-pointer">
                        <div>
                          <p className="text-xs font-semibold">{pkg.name}</p>
                          <p className="text-[10px] text-muted-foreground">{pkg.data} &middot; {pkg.duration}</p>
                        </div>
                        <div className="rounded-md px-3 py-1 text-xs font-bold text-white" style={{ background: settings.branding.primaryColor }}>
                          {pkg.price}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {settings.portalSettings.displayMode === "vouchers_only" && (
                  <div className="flex flex-col gap-2 mt-2">
                    <p className="text-xs font-medium">Enter Voucher Code</p>
                    <div className="flex gap-2">
                      <div className="flex-1 h-8 rounded-md border border-border bg-muted/30" />
                      <div className="h-8 px-3 rounded-md text-xs font-semibold text-white flex items-center" style={{ background: settings.branding.primaryColor }}>
                        Redeem
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Support */}
              {settings.support.showOnPortal && (settings.support.phone || settings.support.email || settings.support.whatsapp) && (
                <div className="px-5 py-3 border-t border-border bg-muted/20 flex flex-col gap-1">
                  <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Need help?</p>
                  <div className="flex flex-wrap gap-3">
                    {settings.support.phone && <a href={`tel:${settings.support.phone}`} className="text-xs" style={{ color: settings.branding.primaryColor }}>{settings.support.phone}</a>}
                    {settings.support.email && <a href={`mailto:${settings.support.email}`} className="text-xs" style={{ color: settings.branding.primaryColor }}>{settings.support.email}</a>}
                  </div>
                </div>
              )}

              {/* Powered by */}
              {settings.portalSettings.showPoweredBy && (
                <div className="px-5 py-2 text-center">
                  <p className="text-[10px] text-muted-foreground/50">Powered by {appName}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
