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
import { appName } from "@/lib/utils";
import { Polling } from "@/lib/pooling";
import { useSocketEvents } from "@/hooks/use-socket-event";

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
    welcomeMessage:
      "Welcome! Select a package or enter your voucher code to get connected.",
    termsUrl: "",
    showPoweredBy: true,
  },
  currency: "TZS"
};

type PayState = "idle" | "processing" | "success" | "failure";

function SpinnerRing({ color }: { color: string }) {
  return (
    <div className="relative h-24 w-24">
      <div
        className="absolute inset-0 rounded-full"
        style={{ border: "6px solid", borderColor: `${color}22` }}
      />
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

function PaymentOverlay({
  state,
  primaryColor,
  isVoucher,
  onDismissFailure,
}: {
  state: PayState;
  isVoucher: boolean;
  primaryColor: string;
  onDismissFailure: () => void;
}) {
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
      style={{
        background: "rgba(255,255,255,0.97)",
        backdropFilter: "blur(6px)",
      }}
    >
      {isProcessing && (
        <div className="flex flex-col items-center gap-6">
          <SpinnerRing color={primaryColor} />
          <div className="flex flex-col gap-2">
            <p className="text-lg font-bold text-foreground">
              {isVoucher ? "Processing Voucher" : "Processing Payment"}
            </p>
            <p className="text-sm text-muted-foreground leading-relaxed max-w-xs">
              {isVoucher ? "Redeeming your voucher" : "A payment push has been initialized"}
            </p>
            <p className="text-xs text-muted-foreground">
              {isVoucher ? "Please wait for confirmation..." : "Enter your PIN on your phone to confirm."}
            </p>
          </div>
        </div>
      )}

      {isSuccess && (
        <div className="flex flex-col items-center gap-6 animate-in fade-in zoom-in-95 duration-300">
          <div
            className="flex h-24 w-24 items-center justify-center rounded-full"
            style={{ background: "#22c55e20" }}
          >
            <svg
              className="h-12 w-12 text-emerald-500"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2.5}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M4.5 12.75l6 6 9-13.5"
              />
            </svg>
          </div>

          <div className="flex flex-col gap-2">
            <p className="text-2xl font-bold text-foreground">
              You're Connected!
            </p>
            <p className="text-sm text-muted-foreground leading-relaxed max-w-xs">
              Package activated successfully. Enjoy your browsing
            </p>
          </div>

          <div className="h-1 w-40 rounded-full overflow-hidden bg-muted">
            <div
              className="h-full rounded-full animate-[shrink_4s_linear_forwards]"
              style={{ background: "#22c55e", width: "100%" }}
            />
          </div>

          <p className="text-xs text-muted-foreground">
            This page will close automatically…
          </p>
        </div>
      )}

      {isFailure && (
        <div className="flex flex-col items-center gap-6 animate-in fade-in zoom-in-95 duration-300">
          <div
            className="flex h-24 w-24 items-center justify-center rounded-full"
            style={{ background: "#ef444420" }}
          >
            <svg
              className="h-12 w-12 text-red-500"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2.5}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </div>

          <div className="flex flex-col gap-2">
            <p className="text-2xl font-bold text-foreground">
              {isVoucher ? "Failed to redeem" : "Payment Failed"}
            </p>
            <p className="text-sm text-muted-foreground leading-relaxed max-w-xs">
              {isVoucher ? "Failed to redeem your voucher" : "Failed to pay for your package"}, try again later.
            </p>
          </div>

          <div className="h-1 w-40 rounded-full overflow-hidden bg-muted">
            <div
              className="h-full rounded-full animate-[shrink_4s_linear_forwards]"
              style={{ background: "#ef4444", width: "100%" }}
            />
          </div>

          <p className="text-xs text-muted-foreground">
            {isVoucher ? "Return to voucher page..." : "Returning to packages…"}
          </p>
        </div>
      )}
    </div>
  );
}

export function CaptivePortalClient() {
  const params = useSearchParams();
  const nasName = params.get("nasname") ?? "";
  const deviceMac = params.get("mac") ?? "";
  const deviceIp = params.get("ip") ?? "";
  const authToken = params.get("token") ?? "";

  const [config, setConfig] =
    useState<TenantPortalSettings>(DEFAULT_CONFIG);
  const [packages, setPackages] = useState<Package[]>([]);
  const [loading, setLoading] = useState(true);
  const [isVoucher, setIsVoucher] = useState(false);
  const [transactionId, setTransactionId] = useState<string | null>(null);
  const [payState, setPayState] = useState<PayState>("idle");
  const {socketEvent, isConnected} = useSocketEvents("payment_state_changed",nasName);

  const polling = new Polling({
    interval: 40 * 1000,
    timeout: 120 * 1000,

    task: async () => {
      const res = await apiClient.portal.checkStatus({ transactionId: transactionId!, nasName, authToken });
      return res;
    },
    backoff: { enabled: false },
    isSuccess: (res) => res.success === true && res.voucher !== null,
  });

  const reflectOnUI = (success: boolean, voucher: string | null | undefined) => {
    if (success && voucher) setTimeout(() => grantAccess(voucher), 3000)
    setPayState(success && voucher ? "success" : "failure");
    setTimeout(() => resetUi, 4000);
  }

  useEffect(() => {
    if(socketEvent && socketEvent.id === nasName) alert("Payment completed");
  }, [socketEvent, isConnected]);


  useEffect(() => {
    const init = async () => {
      try {
        const [cfg, pkgs, session] = await Promise.all([
          apiClient.portal.getConfig(nasName, authToken),
          apiClient.portal.getPackages(nasName, authToken),
          apiClient.portal.checkSession({ deviceMac, nasName, authToken }),
        ]);
        if (session.success && session.voucher) {
          grantAccess(session.voucher);
          return;
        }
        setConfig(cfg.data ?? cfg);
        setPackages(pkgs.data ?? pkgs);
      } catch {
        setConfig(DEFAULT_CONFIG);
        setPackages([]);
      } finally {
        setLoading(false);
      }
    }
    init();
  }, [nasName, deviceMac, deviceIp, authToken]);

  const resetUi = () => {
    document.body.style.transition = "opacity 1s";
    document.body.style.opacity = "0";
  }

  const grantAccess = (voucher: string) => {
    window.parent.postMessage({
      type: "AUTH_SUCCESS",
      username: voucher,
      password: voucher
    }, "*");
  }

  const handleRedeem = useCallback(
    async (voucher: string) => {
      setIsVoucher(true);
      setPayState("processing");

      try {
        const { success, appliedVoucher } = await apiClient.portal.redeemVoucher({
          code: voucher,
          nasName,
          deviceIp,
          deviceMac,
          authToken,
        });
        reflectOnUI(success, appliedVoucher)
      } catch (err: unknown) {
        setPayState("failure");
      }
    },
    [nasName, deviceMac]
  );

  const handlePay = useCallback(
    async ({ pkg, phone }: { pkg: Package; phone: string }) => {
      setIsVoucher(false);
      setPayState("processing");
      try {
        const { transactionId, success } = await apiClient.portal.initiatePayment({
          packageId: pkg._id,
          nasName,
          deviceIp,
          deviceMac,
          authToken,
          phoneNumber: phone,
        });
        if (success) {
          setTransactionId(transactionId);
          const { result } = await polling.startAsync();
          reflectOnUI(result?.success === true, result?.voucher)
        }
      } catch (err: unknown) {
        setPayState("failure");
        polling.stop();
      }
    },
    [nasName, deviceMac]
  );


  const handleDismissFailure = useCallback(() => {
    setPayState("idle");
  }, []);

  const { primaryColor, secondaryColor } = config.branding;
  const { displayMode } = config.portalSettings;

  const resolvedMode =
    displayMode === "packages_only"
      ? "packages"
      : displayMode === "vouchers_only"
        ? "voucher"
        : "both";

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
          style={{
            borderColor: `${primaryColor}33`,
            borderTopColor: primaryColor,
          }}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background" style={portalVars}>
      {payState !== "idle" && (
        <PaymentOverlay
          state={payState}
          isVoucher={isVoucher}
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

        <div className="mt-4">
          {resolvedMode === "both" ? (
            <Tabs defaultValue="packages">
              <TabsList className="w-full">
                <TabsTrigger value="packages" className="flex-1">
                  Buy Package
                </TabsTrigger>
                <TabsTrigger value="voucher" className="flex-1">
                  Have a Voucher?
                </TabsTrigger>
              </TabsList>

              <TabsContent value="packages" className="mt-4">
                <PackageGrid
                  packages={packages}
                  primaryColor={primaryColor}
                  currency={config.currency}
                  onPay={handlePay}
                />
              </TabsContent>

              <TabsContent value="voucher" className="mt-4">
                <VoucherInput
                  primaryColor={primaryColor}
                  loading={payState === "processing"}
                  onRedeem={handleRedeem}
                />
              </TabsContent>
            </Tabs>
          ) : resolvedMode === "packages" ? (
            <PackageGrid
              packages={packages}
              currency={config.currency}
              primaryColor={primaryColor}
              onPay={handlePay}
            />
          ) : (
            <VoucherInput
              primaryColor={primaryColor}
              loading={payState === "processing"}
              onRedeem={handleRedeem}
            />
          )}
        </div>

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
        <p className="text-center text-xs text-muted-foreground/50 py-4">
          Powered by {appName}
        </p>
      )}
    </div>
  );
}