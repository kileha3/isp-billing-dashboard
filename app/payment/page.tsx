"use client";

import { Suspense, useState, useEffect, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Wifi, Clock, Database, Zap, ChevronUp } from "lucide-react";
import SocketClient from "@/lib/socket.util";
import { apiClient, imageUrl } from "@/lib/api";
import type { TenantPortalSettings, Package } from "@/lib/types";
import { appName } from "@/lib/utils";
import { phoneSchemaDef } from "@/components/portal/PackageGrid";
import { formatData, formatDuration, formatSpeed } from "@/lib/utils";

// Labels with English and Swahili translations
export const labels: any = {
  en: {
    buyPackage: "Buy Package",
    poweredBy: "Powered by",
    terms: "Terms and Conditions",
    connecting: "By connecting you agree to our",
    noPackages: "No packages available on this network.",
    close: "Close",
    select: "Select",
    payFor: "Paying for",
    phone: "Phone Number",
    pay: "Pay Now",
    connect: "Connect",
    connected: "You're Connected!",
    connectedDescription: "Your package has been activated successfully.",
    connectedFooter: "This page will close automatically…",
    returnPay: "Return to Payment Page",
    payError: "Payment Failed",
    payErrorDescription: "Failed to pay for your package",
    tryAgain: "try again later",
    processPay: "Processing Payment",
    paymentConfirmation: "Enter your PIN on your phone to confirm.",
    duration: {
      minute: "minute",
      minutes: "minutes",
      hour: "hour",
      hours: "hours",
      day: "day",
      week:"week",
      weeks:"weeks",
      days: "days",
      month: "month",
      months: "months",
    },
    unlimited: "Unlimited",
    phoneError: "Enter a valid phone number (e.g. 0712 XXX XXX)",
    connectionLabel: "Connect to the internet",
    welcomeMessage: "Welcome! Select a package to get connected.",
    support: "Support",
    call: "Call",
    email: "Email",
    whatsapp: "WhatsApp"
  },
  sw: {
    buyPackage: "Nunua Bando",
    poweredBy: "Imedhaminiwa na",
    terms: "Miongozo na Sharti",
    connecting: "Ukiunganisha unakubali",
    noPackages: "Hakuna bando zinazopatikana kwenye mtandao huu.",
    close: "Funga",
    select: "Chagua",
    payFor: "Lipia",
    phone: "Namba ya simu",
    pay: "Lipa Sasa",
    connect: "Unganisha",
    connected: "Umeunganishwa!",
    connectedDescription: "Bando lako limeunganishwa, waweza tumia mtandao sasa.",
    connectedFooter: "Ukurasa huu utajifunga wenyewe...",
    returnPay: "Rudi kwenye ukurasa wa malipo",
    payError: "Imeshindwa kulipa",
    payErrorDescription: "Imeshindwa kulipa bando lako",
    tryAgain: "jaribu tena",
    processPay: "Inachakata Malipo",
    paymentConfirmation: "Weka PIN yako kwenye simu yako kuthibitisha.",
    duration: {
      minute: "dakika",
      minutes: "dakika",
      hour: "saa",
      hours: "saa",
      day: "siku",
      days: "siku",
      week:"wiki",
      weeks:"wiki",
      month: "mwezi",
      months: "miezi",
    },
    unlimited: "Bila Kikomo",
    phoneError: "Weka namba ya simu sahihi (mfano 0712 XXX XXX)",
    connectionLabel: "Peruzi bila kikomo",
    welcomeMessage: "Karibu! Chagua bando ili kuunganishwa.",
    support: "Msaada",
    call: "Piga",
    email: "Barua pepe",
    whatsapp: "WhatsApp",
  }
};

// Default configuration
const DEFAULT_CONFIG: TenantPortalSettings = {
  branding: {
    logo: "",
    primaryColor: "#3B82F6",
    secondaryColor: "#1E40AF",
    businessName: "NetBill WiFi",
  },
  support: {
    phone: "+255700000000",
    email: "support@example.com",
    whatsapp: "",
    showOnPortal: true,
  },
  portalSettings: {
    displayMode: "packages_only",
    welcomeMessage: "Welcome! Select a package to get connected.",
    termsUrl: "",
    showPoweredBy: true,
  },
  currency: "TZS",
  language: "en"
};


type PayState = "idle" | "processing" | "success" | "failure";

interface PayResult {
  success: boolean;
  voucher: string | null | undefined;
}

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
  language,
  onDismissFailure,
}: {
  state: PayState;
  primaryColor: string;
  language: string;
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
              {labels[language]?.processPay || labels.en.processPay}
            </p>
            <p className="text-sm text-muted-foreground leading-relaxed max-w-xs">
              {labels[language]?.paymentConfirmation || labels.en.paymentConfirmation}
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
              {labels[language]?.connected || labels.en.connected}
            </p>
            <p className="text-sm text-muted-foreground leading-relaxed max-w-xs">
              {labels[language]?.connectedDescription || labels.en.connectedDescription}
            </p>
          </div>

          <div className="h-1 w-40 rounded-full overflow-hidden bg-muted">
            <div
              className="h-full rounded-full animate-[shrink_4s_linear_forwards]"
              style={{ background: "#22c55e", width: "100%" }}
            />
          </div>

          <p className="text-xs text-muted-foreground">
            {labels[language]?.connectedFooter || labels.en.connectedFooter}
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
              {labels[language]?.payError || labels.en.payError}
            </p>
            <p className="text-sm text-muted-foreground leading-relaxed max-w-xs">
              {labels[language]?.payErrorDescription || labels.en.payErrorDescription}{" "}
              {labels[language]?.tryAgain || labels.en.tryAgain}
            </p>
          </div>

          <div className="h-1 w-40 rounded-full overflow-hidden bg-muted">
            <div
              className="h-full rounded-full animate-[shrink_4s_linear_forwards]"
              style={{ background: "#ef4444", width: "100%" }}
            />
          </div>

          <p className="text-xs text-muted-foreground">
            {labels[language]?.returnPay || labels.en.returnPay}
          </p>
        </div>
      )}
    </div>
  );
}

function PortalHeader({ config, connectionLabel }: { config: TenantPortalSettings; connectionLabel: string }) {
  const { branding } = config;

  return (
    <div className="bg-card border-b">
      <div className="mx-auto max-w-md w-full px-4 py-6">
        <div className="flex items-center gap-4">
          {branding.logo && (
            <div className="flex-shrink-0">
              <img src={imageUrl(branding.logo)} alt={branding.businessName} className="h-12 w-auto" />
            </div>
          )}
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-foreground">
              {branding.businessName}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {connectionLabel}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}



function PackageGrid({
  packages,
  primaryColor,
  currency,
  language,
  onPay,
  packageId,
  isProcessing
}: {
  packages: Package[];
  primaryColor: string;
  currency: string;
  language: string;
  packageId?: string;
  onPay: (params: { pkg: Package; phone: string }) => void;
  isProcessing: boolean;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(packageId || null);
  const [phone, setPhone] = useState("");
  const phoneSchema = phoneSchemaDef({ language });

  const phoneResult = phoneSchema.safeParse(phone);
  const phoneError = phone.length >= 10 && !phoneResult.success
    ? phoneResult.error.errors[0]?.message
    : null;
  const canPay = phoneResult.success;

  function handleSelect(pkg: Package) {
    if (pkg.isFree) {
      onPay({ pkg, phone: "" });
    } else {
      if (selectedId === pkg._id) {
        setSelectedId(null);
        setPhone("");
      } else {
        setSelectedId(pkg._id);
        setPhone("");
      }
    }
  }

  if (packages.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 py-12 text-center">
        <Wifi className="h-10 w-10 text-muted-foreground/40" />
        <p className="text-sm text-muted-foreground">
          {labels[language]?.noPackages || labels.en.noPackages}
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {packages.map((pkg) => {
        const isOpen = selectedId === pkg._id;

        return (
          <div
            key={pkg._id}
            className="rounded-2xl border-2 overflow-hidden transition-all"
            style={{
              borderColor: isOpen ? primaryColor : "var(--border)",
              background: "var(--card)",
            }}
          >
            {/* Package row */}
            <div className="flex items-center justify-between gap-3 p-4">
              <div className="flex flex-col gap-1 min-w-0">
                <span className="font-semibold text-sm text-foreground leading-tight">{pkg.name}</span>
                {pkg.description && (
                  <span className="text-xs text-muted-foreground leading-snug">{pkg.description}</span>
                )}
                <div className="flex items-center gap-3 mt-1 flex-wrap">
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    {formatDuration(pkg.duration, labels[language]?.duration[pkg.durationUnit], language)}
                  </span>
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Database className="h-3 w-3" />
                    {formatData(pkg.dataLimit, pkg.dataLimitUnit, labels[language]?.unlimited)}
                  </span>
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Zap className="h-3 w-3" />
                    {formatSpeed(pkg.speedLimit, labels[language]?.unlimited || labels.en.unlimited)}
                  </span>
                </div>
              </div>

              <div className="flex flex-col items-end gap-2 shrink-0">
                {!pkg.isFree && (
                  <div className="px-3 py-1.5 text-center">
                    <p className="text-xl font-bold leading-none" style={{ color: primaryColor }}>
                      <span className="text-xs font-medium leading-none mb-0.5" style={{ color: primaryColor }}>
                        {currency}
                      </span>
                      {pkg.price.toLocaleString()}
                    </p>
                  </div>
                )}
                <Button
                  size="sm"
                  onClick={() => handleSelect(pkg)}
                  className="h-8 px-4 text-xs font-semibold flex items-center gap-1"
                  disabled={isProcessing}
                  style={
                    isOpen
                      ? { background: "var(--muted)", color: "var(--muted-foreground)" }
                      : { background: primaryColor, color: "#fff" }
                  }
                >
                  {pkg.isFree ? (labels[language]?.connect || labels.en.connect) :
                    isOpen ? <><ChevronUp className="h-3 w-3" />{labels[language]?.close || labels.en.close}</> :
                      labels[language]?.select || labels.en.select}
                </Button>
              </div>
            </div>

            {/* Inline phone input section */}
            {isOpen && !pkg.isFree && (
              <div
                className="border-t px-4 pb-4 pt-4 flex flex-col gap-3"
                style={{ borderColor: `${primaryColor}30`, background: `${primaryColor}06` }}
              >
                <p className="text-xs font-semibold text-foreground">
                  {labels[language]?.payFor || labels.en.payFor}:
                  <span style={{ color: primaryColor }}> {pkg.name}</span>
                  <span className="text-muted-foreground font-normal"> - {currency} {pkg.price.toLocaleString()}</span>
                </p>

                {/* Phone input */}
                <div className="flex flex-col gap-1.5">
                  <Label className="text-xs font-medium">
                    {labels[language]?.phone || labels.en.phone}
                  </Label>
                  <Input
                    type="tel"
                    placeholder="0712 XXX XXX"
                    value={phone}
                    autoFocus
                    onChange={(e) => setPhone(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && canPay && !isProcessing && onPay({ pkg, phone })}
                    className="h-10 focus-visible:outline-none focus-visible:ring-2"
                    disabled={isProcessing}
                    style={{
                      borderColor: primaryColor,
                      boxShadow: `0 0 0 2px ${primaryColor}33`,
                    }}
                  />
                  {phoneError && <p className="text-xs text-destructive">{phoneError}</p>}
                </div>

                <Button
                  onClick={() => onPay({ pkg, phone })}
                  disabled={!canPay || isProcessing}
                  className="w-full h-11 font-semibold text-sm"
                  style={canPay && !isProcessing
                    ? { background: primaryColor, color: "#fff" }
                    : { background: `${primaryColor}2a`, color: "#000" }}
                >
                  {`${labels[language]?.pay || labels.en.pay} ${currency} ${pkg.price.toLocaleString()}`}
                </Button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// Main Payment Component
function PaymentContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const router = useRouter();
  const [config, setConfig] = useState<TenantPortalSettings>(DEFAULT_CONFIG);
  const [packages, setPackages] = useState<Package[]>([]);
  const [loading, setLoading] = useState(true);
  const [payState, setPayState] = useState<PayState>("idle");
  const [selectedPackage, setSelectedPackage] = useState<string | undefined>(undefined)


  const resetUi = () => {
    document.body.style.transition = "opacity 1s";
    document.body.style.opacity = "0";
  }

  const reflectOnUI = (success: boolean) => {
    setPayState(success ? "success" : "failure");
    setTimeout(() => resetUi, 4000);
  };

  useEffect(() => {
    const init = async () => {
      try {
        const { configs, packages, packageId } = await apiClient.portal.standAlonePaymentInfo(token!);
        setConfig(configs);
        if (packageId) setSelectedPackage(packageId);
        packages.sort((a, b) => a.price - b.price);
        setPackages(packages);
      } catch (error) {
        setConfig(DEFAULT_CONFIG);
        setPackages([]);
        router.push("/login");
      } finally {
        setLoading(false);
      }
    };

    if (token) {
      init();
    }
  }, [token]);

  const handlePay = useCallback(async ({ pkg, phone }: { pkg: Package; phone: string }) => {
    setPayState("processing");

    try {
      const { orderId, success } = await apiClient.portal.standAlonePayment(token!, pkg._id, phone);
      if (success && orderId) {
        SocketClient.waitFor<PayResult>(
          SocketClient.event_payment_completed,
          orderId,
          ({ success }) => reflectOnUI(success),
          60 * 1000,
          () => apiClient.portal.standAloneStatus({
            orderId, token: token!
          })
        );
      } else {
        setPayState("failure");
      }
    } catch (err: unknown) {
      setPayState("failure");
    }
  }, [token]);

  const handleDismissFailure = useCallback(() => {
    setPayState("idle");
  }, []);

  const { primaryColor } = config.branding;
  const portalVars = {
    "--portal-primary": primaryColor,
    "--portal-secondary": config.branding.secondaryColor,
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
          primaryColor={primaryColor}
          language={config.language}
          onDismissFailure={handleDismissFailure}
        />
      )}

      <PortalHeader
        config={config}
        connectionLabel={labels[config.language]?.connectionLabel || "Connect to the internet"}
      />

      <div className="mx-auto max-w-md w-full px-4 py-6 flex flex-col gap-5">
        {config.portalSettings.welcomeMessage && (
          <p className="text-sm text-muted-foreground text-center leading-relaxed">
            {config.portalSettings.welcomeMessage}
          </p>
        )}

        <PackageGrid
          packages={packages}
          primaryColor={primaryColor}
          currency={config.currency}
          language={config.language}
          onPay={handlePay}
          packageId={selectedPackage}
          isProcessing={payState === "processing"}
        />

        {config.portalSettings.termsUrl && (
          <p className="text-center text-xs text-muted-foreground">
            {labels[config.language]?.connecting || "By connecting you agree to our"}{" "}
            <a
              href={`/terms-and-conditions?${searchParams.toString()}&ref=stadalone`}
              target="_self"
              rel="noopener noreferrer"
              className="underline"
              style={{ color: primaryColor }}
            >
              {labels[config.language]?.terms || "Terms and Conditions"}
            </a>
          </p>
        )}
      </div>

      {config.portalSettings.showPoweredBy && (
        <p className="text-center text-sm text-muted-foreground/50 py-4">
          {labels[config.language]?.poweredBy || "Powered by"} {appName}
        </p>
      )}
    </div>
  );
}

// Main page component with Suspense boundary
export default function PaymentPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="h-8 w-8 rounded-full border-[3px] animate-spin border-primary/20 border-t-primary" />
      </div>
    }>
      <PaymentContent />
    </Suspense>
  );
}