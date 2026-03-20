"use client";

import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { apiClient } from "@/lib/api";
import { PortalHeader } from "@/components/portal/PortalHeader";
import { PackageGrid } from "@/components/portal/PackageGrid";
import { VoucherInput } from "@/components/portal/VoucherInput";
import { SupportInfo } from "@/components/portal/SupportInfo";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { TenantPortalSettings, Package } from "@/lib/types";

const DEFAULT_CONFIG: TenantPortalSettings = {
  branding: {
    logo: "",
    primaryColor: "#3B82F6",
    secondaryColor: "#1E40AF",
    businessName: "NetBill WiFi",
  },
  support: {
    phone: "+254700000000",
    email: "support@example.com",
    whatsapp: "",
    showOnPortal: true,
  },
  portalSettings: {
    displayMode: "both",
    welcomeMessage: "Welcome! Select a package or enter your voucher code to get connected.",
    termsUrl: "",
    showPoweredBy: true,
  },
};

const MOCK_PACKAGES: Package[] = [
  { _id: "1", name: "Hourly Unlimited", description: "1 hour of unlimited browsing", price: 50, duration: 60, durationUnit: "minutes", dataLimit: 0, speedLimit: 10, status: "active", isPublic: true, tenantId: "t1", routerIds: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { _id: "2", name: "Daily 1GB", description: "24 hours, 1 GB data", price: 100, duration: 1440, durationUnit: "minutes", dataLimit: 1024, speedLimit: 20, status: "active", isPublic: true, tenantId: "t1", routerIds: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { _id: "3", name: "Weekly 5GB", description: "7 days, 5 GB data", price: 500, duration: 10080, durationUnit: "minutes", dataLimit: 5120, speedLimit: 50, status: "active", isPublic: true, tenantId: "t1", routerIds: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { _id: "4", name: "Monthly 30GB", description: "30 days, 30 GB data", price: 2000, duration: 43200, durationUnit: "minutes", dataLimit: 30720, speedLimit: 100, status: "active", isPublic: true, tenantId: "t1", routerIds: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
];

type PayState = "idle" | "processing" | "success" | "failure";

interface PayContext {
  pkgName: string;
  amount: number;
  phone: string;
  method: string;
  message?: string;
  error?: string;
}

// Spinner ring component
function SpinnerRing({ color }: { color: string }) {
  return (
    <div className="relative h-24 w-24">
      {/* Track ring */}
      <div
        className="absolute inset-0 rounded-full"
        style={{ border: "6px solid", borderColor: `${color}22` }}
      />
      {/* Spinning arc */}
      <div
        className="absolute inset-0 rounded-full animate-spin"
        style={{
          border: "6px solid transparent",
          borderTopColor: color,
          borderRightColor: color,
        }}
      />
    </div>
  );
}

// Full-screen overlay that covers the portal
function PaymentOverlay({
  state,
  ctx,
  primaryColor,
  onDismissFailure,
}: {
  state: PayState;
  ctx: PayContext;
  primaryColor: string;
  onDismissFailure: () => void;
}) {
  // Auto-dismiss failure after 4 s
  useEffect(() => {
    if (state !== "failure") return;
    const t = setTimeout(onDismissFailure, 4000);
    return () => clearTimeout(t);
  }, [state, onDismissFailure]);

  const isProcessing = state === "processing";
  const isSuccess = state === "success";
  const isFailure = state === "failure";

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center px-6 text-center"
      style={{ background: "rgba(255,255,255,0.97)", backdropFilter: "blur(6px)" }}
    >
      {isProcessing && (
        <div className="flex flex-col items-center gap-6">
          <SpinnerRing color={primaryColor} />
          <div className="flex flex-col gap-2">
            <p className="text-lg font-bold text-foreground">Processing Payment</p>
            <p className="text-sm text-muted-foreground leading-relaxed max-w-xs">
              A payment push has been sent to{" "}
              <span className="font-semibold text-foreground">{ctx.phone}</span>.
            </p>
            <p className="text-xs text-muted-foreground">Enter your PIN on your phone to confirm.</p>
          </div>
        </div>
      )}

      {isSuccess && (
        <div className="flex flex-col items-center gap-6 animate-in fade-in zoom-in-95 duration-300">
          {/* Success circle */}
          <div
            className="flex h-24 w-24 items-center justify-center rounded-full"
            style={{ background: "#22c55e20" }}
          >
            <svg className="h-12 w-12 text-emerald-500" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
            </svg>
          </div>
          <div className="flex flex-col gap-2">
            <p className="text-2xl font-bold text-foreground">You're Connected!</p>
            <p className="text-sm text-muted-foreground leading-relaxed max-w-xs">
              {ctx.message ?? `${ctx.pkgName} activated successfully. Enjoy your browsing!`}
            </p>
          </div>
          {/* Dissolving bar */}
          <div className="h-1 w-40 rounded-full overflow-hidden bg-muted">
            <div
              className="h-full rounded-full animate-[shrink_4s_linear_forwards]"
              style={{ background: "#22c55e", width: "100%" }}
            />
          </div>
          <p className="text-xs text-muted-foreground">This page will close automatically…</p>
        </div>
      )}

      {isFailure && (
        <div className="flex flex-col items-center gap-6 animate-in fade-in zoom-in-95 duration-300">
          {/* Failure circle */}
          <div className="flex h-24 w-24 items-center justify-center rounded-full" style={{ background: "#ef444420" }}>
            <svg className="h-12 w-12 text-red-500" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <div className="flex flex-col gap-2">
            <p className="text-2xl font-bold text-foreground">Payment Failed</p>
            <p className="text-sm text-muted-foreground leading-relaxed max-w-xs">
              {ctx.error ?? "Something went wrong. Please try again."}
            </p>
          </div>
          {/* Auto-dismiss bar */}
          <div className="h-1 w-40 rounded-full overflow-hidden bg-muted">
            <div
              className="h-full rounded-full animate-[shrink_4s_linear_forwards]"
              style={{ background: "#ef4444", width: "100%" }}
            />
          </div>
          <p className="text-xs text-muted-foreground">Returning to packages…</p>
        </div>
      )}
    </div>
  );
}

export function CaptivePortalClient() {
  const params = useSearchParams();
  const routerId = params.get("router") ?? "";
  const mac = params.get("mac") ?? "";

  const [config, setConfig] = useState<TenantPortalSettings>(DEFAULT_CONFIG);
  const [packages, setPackages] = useState<Package[]>([]);
  const [loading, setLoading] = useState(true);

  // Payment state machine
  const [payState, setPayState] = useState<PayState>("idle");
  const [payCtx, setPayCtx] = useState<PayContext>({ pkgName: "", amount: 0, phone: "", method: "mpesa" });

  useEffect(() => {
    async function init() {
      try {
        const [cfg, pkgs] = await Promise.all([
          apiClient.portal.getConfig(routerId),
          apiClient.portal.getPackages(routerId),
        ]);
        setConfig(cfg);
        setPackages(pkgs.packages ?? pkgs);
      } catch {
        setConfig(DEFAULT_CONFIG);
        setPackages(MOCK_PACKAGES);
      } finally {
        setLoading(false);
      }
    }
    init();
  }, [routerId]);

  const handlePay = useCallback(async ({
    pkg,
    phone,
  }: {
    pkg: Package;
    phone: string;
  }) => {
    const ctx: PayContext = { pkgName: pkg.name, amount: pkg.price, phone, method: "mpesa" };
    setPayCtx(ctx);
    setPayState("processing");

    try {
      await apiClient.portal.initiatePayment({
        packageId: pkg._id,
        routerId,
        mac,
        phone,
        paymentMethod: method,
      });
      setPayCtx(c => ({
        ...c,
        message: `${pkg.name} activated! Enjoy your browsing.`,
      }));
      setPayState("success");

      // After 4 s on success screen, fade the whole page out — user is connected
      setTimeout(() => {
        document.body.style.transition = "opacity 1s";
        document.body.style.opacity = "0";
      }, 4000);
    } catch (err: unknown) {
      setPayCtx(c => ({
        ...c,
        error: err instanceof Error ? err.message : "Payment failed. Please try again.",
      }));
      setPayState("failure");
    }
  }, [routerId, mac]);

  const handleDismissFailure = useCallback(() => {
    setPayState("idle");
  }, []);

  const { primaryColor, secondaryColor } = config.branding;
  const { displayMode } = config.portalSettings;

  const portalVars = {
    "--portal-primary": primaryColor,
    "--portal-secondary": secondaryColor,
    "--portal-primary-10": `${primaryColor}1a`,
  } as React.CSSProperties;

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div
          className="h-8 w-8 rounded-full border-[3px] animate-spin"
          style={{ borderColor: `${primaryColor}33`, borderTopColor: primaryColor }}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background" style={portalVars}>
      {/* Payment overlay — sits above everything */}
      {payState !== "idle" && (
        <PaymentOverlay
          state={payState}
          ctx={payCtx}
          primaryColor={primaryColor}
          onDismissFailure={handleDismissFailure}
        />
      )}

      <PortalHeader config={config} />

      <div className="mx-auto max-w-md w-full px-4 py-6 flex flex-col gap-5">
        {config.portalSettings.welcomeMessage && (
          <p className="text-sm text-muted-foreground text-center leading-relaxed">
            {config.portalSettings.welcomeMessage}
          </p>
        )}

        {displayMode === "packages_only" && (
          <PackageGrid
            packages={packages}
            routerId={routerId}
            mac={mac}
            primaryColor={primaryColor}
            onPay={handlePay}
          />
        )}

        {displayMode === "vouchers_only" && (
          <VoucherInput
            routerId={routerId}
            mac={mac}
            primaryColor={primaryColor}
            onSuccess={(msg) => {
              setPayCtx(c => ({ ...c, message: msg }));
              setPayState("success");
              setTimeout(() => {
                document.body.style.transition = "opacity 1s";
                document.body.style.opacity = "0";
              }, 4000);
            }}
          />
        )}

        {displayMode === "both" && (
          <Tabs defaultValue="packages">
            <TabsList className="w-full">
              <TabsTrigger value="packages" className="flex-1">Buy Access</TabsTrigger>
              <TabsTrigger value="voucher" className="flex-1">Have a Voucher?</TabsTrigger>
            </TabsList>
            <TabsContent value="packages" className="mt-4">
              <PackageGrid
                packages={packages}
                routerId={routerId}
                mac={mac}
                primaryColor={primaryColor}
                onPay={handlePay}
              />
            </TabsContent>
            <TabsContent value="voucher" className="mt-4">
              <VoucherInput
                routerId={routerId}
                mac={mac}
                primaryColor={primaryColor}
                onSuccess={(msg) => {
                  setPayCtx(c => ({ ...c, message: msg }));
                  setPayState("success");
                  setTimeout(() => {
                    document.body.style.transition = "opacity 1s";
                    document.body.style.opacity = "0";
                  }, 4000);
                }}
              />
            </TabsContent>
          </Tabs>
        )}

        {config.portalSettings.termsUrl && (
          <p className="text-center text-xs text-muted-foreground">
            By connecting you agree to our{" "}
            <a
              href={config.portalSettings.termsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="underline"
              style={{ color: primaryColor }}
            >
              Terms of Service
            </a>
          </p>
        )}
      </div>

      {config.support.showOnPortal && (
        <SupportInfo support={config.support} primaryColor={primaryColor} />
      )}

      {config.portalSettings.showPoweredBy && (
        <p className="text-center text-xs text-muted-foreground/50 py-4">Powered by NetBill</p>
      )}
    </div>
  );
}
