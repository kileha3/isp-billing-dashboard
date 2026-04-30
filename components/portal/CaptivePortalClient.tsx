"use client";

import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { apiClient, BASE } from "@/lib/api";
import { PortalHeader } from "@/components/portal/PortalHeader";
import { PackageGrid } from "@/components/portal/PackageGrid";
import { VoucherInput } from "@/components/portal/VoucherInput";
import { SupportInfo } from "@/components/portal/SupportInfo";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { TenantPortalSettings, Package } from "@/lib/types";
import { appName } from "@/lib/utils";
import SocketClient from "@/lib/socket.util";

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
  currency: "TZS",
  language: "en"
};

export const labels: any = {
  en: {
    buyPackage: "Buy Package",
    haveVoucher: "Have a voucher?",
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
    enterVoucher: "Enter your voucher code",
    enterVoucherDescription: "Scratched from a card or provided by your ISP",
    voucherCode: "Voucher Code",
    checking: "Checking...",
    redeemVoucher: "Redeem Voucher",
    connected: "You're Connected!",
    connectedDescription: "Your package has been activated successfully.",
    connectedFooter: "This page will close automatically…",
    returnVoucher: "Return to Voucher Page",
    returnPay: "Return to Payment Page",
    redeemErrorDescription: "Failed to redeem your voucher",
    redeemError: "Failed to redeem ",
    payError: "Payment Failed",
    payErrorDescription: "Failed to pay for your package",
    tryAgain: "try again later",
    processVoucher: "Processing Voucher",
    processPay: "Processing Payment",
    voucherConfirmation: "Please wait for confirmation...",
    paymentConfirmation: "Enter your PIN on your phone to confirm.",
    duration: { minutes: "minutes", hours: "hours", days: "days", week:"week", weeks:"weeks", months: "months" },
    unlimited: "Unlimited",
    phoneError: "Enter a valid phone number (e.g. 0712 XXX XXX)",
    tryError: "Service Not Available",
    tryErrorDescription: "You have already tried our service, please purchase a package to continue.",
    connectionLabel: "Connect to the internet",
    needHelp:"Need help?"
  },
  sw: {
    buyPackage: "Nunua Bando",
    haveVoucher: "Tumia Vocha",
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
    enterVoucher: "Weka namba ya vocha",
    enterVoucherDescription: "Vocha hii unaweza kuwa umeipata kwa wakala au mtoa huduma wako",
    voucherCode: "Namba ya Vocha",
    checking: "Inaangalia...",
    redeemVoucher: "Komboa Vocha...",
    connected: "Umeunganishwa!",
    connectedDescription: "Bando lako limeunganishwa, waweza tumia mtandao sasa.",
    connectedFooter: "Ukurasa huu utajifunga wenyewe...",
    returnPay: "Rudi kwenye ukurasa wa malipo",
    returnVoucher: "Rudi kwenye ukurasa wa vocha",
    redeemErrorDescription: "Imeshindwa kukomboa vocha yako",
    redeemError: "Imeshindikana",
    payError: "Imeshindwa kulipa",
    payErrorDescription: "Imeshindwa kulipa bando lako",
    tryAgain: "jaribu tena",
    processVoucher: "Chakata Vocha",
    processPay: "Inachakata Malipo",
    voucherConfirmation: "Tafadhali subiri uthibitisho...",
    paymentConfirmation: "Weka PIN yako kwenye simu yako kuthibitisha.",
    duration: { minutes: "dakika", hours: "saa", days: "siku",week:"wiki", weeks:"wiki", months: "mwezi" },
    unlimited: "Bila Kikomo",
    phoneError: "Weka namba ya simu sahihi (mfano 0712 XXX XXX)",
    tryError: "Huduma haipatikani",
    tryErrorDescription: "Umekwishajaribu huduma yetu tayari, tafadhali nunua bando kupata huduma",
    connectionLabel: "Peruzi bila Kikomo",
    needHelp:"Wahitaji Msaada?"
  }
}

type PayState = "idle" | "processing" | "success" | "failure";

export interface PayResult {
  success: boolean;
  voucher: string | null | undefined
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
  isVoucher,
  isFree,
  language,
  onDismissFailure,
}: {
  state: PayState;
  isVoucher: boolean;
  isFree: boolean;
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
          {!isFree && (<div className="flex flex-col gap-2">
            <p className="text-lg font-bold text-foreground">
              {isVoucher ? labels[language]?.processVoucher : labels[language]?.processPay}
            </p>
            <p className="text-sm text-muted-foreground leading-relaxed max-w-xs">
              {isVoucher ? labels[language]?.processVoucherDescription : labels[language]?.processPayDescription}
            </p>
            <p className="text-xs text-muted-foreground">
              {isVoucher ? labels[language]?.voucherConfirmation : labels[language]?.paymentConfirmation}
            </p>
          </div>)}
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
              {labels[language]?.connected || "You're Connected!"}
            </p>
            <p className="text-sm text-muted-foreground leading-relaxed max-w-xs">
              {labels[language]?.connectedDescription || "Your package has been activated successfully."}
            </p>
          </div>

          <div className="h-1 w-40 rounded-full overflow-hidden bg-muted">
            <div
              className="h-full rounded-full animate-[shrink_4s_linear_forwards]"
              style={{ background: "#22c55e", width: "100%" }}
            />
          </div>

          <p className="text-xs text-muted-foreground">
            {labels[language]?.connectedFooter || "This page will close automatically…"}
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
              {isVoucher ? labels[language]?.redeemError : isFree ? labels[language]?.tryError : labels[language]?.payError}
            </p>
            <p className="text-sm text-muted-foreground leading-relaxed max-w-xs">
              {isVoucher ? labels[language]?.redeemErrorDescription : isFree ? labels[language]?.tryErrorDescription : labels[language]?.payErrorDescription}{`${isFree ? "" : `, ${labels[language]?.tryAgain}`}`}.
            </p>
          </div>

          <div className="h-1 w-40 rounded-full overflow-hidden bg-muted">
            <div
              className="h-full rounded-full animate-[shrink_4s_linear_forwards]"
              style={{ background: "#ef4444", width: "100%" }}
            />
          </div>

          <p className="text-xs text-muted-foreground">
            {isVoucher ? labels[language]?.returnVoucher : labels[language]?.returnPay}
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
  const [isFree, setIsFree] = useState(false);
  const [payState, setPayState] = useState<PayState>("idle");



  const reflectOnUI = (success: boolean, voucher: string | null | undefined) => {
    if (success && voucher) setTimeout(() => grantAccess(voucher), 3000)
    setPayState(success && voucher ? "success" : "failure");
    setTimeout(() => resetUi, 4000);
  }

  useEffect(() => {
    const init = async () => {
      try {
        const [cfg, pkgs, session] = await Promise.all([
          apiClient.portal.getConfig(nasName, authToken),
          apiClient.portal.getPackages({nasName, authToken, deviceMac}),
          apiClient.portal.checkSession({ deviceMac, nasName, authToken }),
        ]);
        if (session.success && session.voucher) {
          grantAccess(session.voucher);
          return;
        }
        setConfig(cfg.data ?? cfg);
        (pkgs).sort((a, b) => a.price - b.price);
        setPackages(pkgs ?? pkgs);
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
      setIsFree(pkg.isFree);
      try {
        if (pkg.isFree) {
          const { appliedVoucher, success } = await apiClient.portal.connectFreePackage({
            packageId: pkg._id,
            nasName,
            deviceIp,
            deviceMac,
            authToken,
          });
          reflectOnUI(success, appliedVoucher)
          return;
        } else {
          const { orderId, success } = await apiClient.portal.initiatePayment({
            packageId: pkg._id,
            nasName,
            deviceIp,
            deviceMac,
            authToken,
            phoneNumber: phone,
          });
          if (success && orderId) {
            SocketClient.waitFor<PayResult>(SocketClient.event_payment_completed, orderId,
              ({ success, voucher }) => reflectOnUI(success, voucher), 60 * 1000, () => apiClient.portal.checkStatus({
                orderId, nasName, authToken
              }))
          }
        }



      } catch (err: unknown) {
        setPayState("failure");
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
          isFree={isFree}
          primaryColor={primaryColor}
          language={config.language}
          onDismissFailure={handleDismissFailure}
        />
      )}

      <PortalHeader config={config} connectionLabel={labels[config.language]?.connectionLabel || "Connect to the internet"} />

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
                  {labels[config.language]?.buyPackage || "Buy Package"}
                </TabsTrigger>
                <TabsTrigger value="voucher" className="flex-1">
                  {labels[config.language]?.haveVoucher || "Have a Voucher?"}
                </TabsTrigger>
              </TabsList>

              <TabsContent value="packages" className="mt-4">
                <PackageGrid
                  packages={packages}
                  primaryColor={primaryColor}
                  currency={config.currency}
                  language={config.language}
                  onPay={handlePay}
                />
              </TabsContent>

              <TabsContent value="voucher" className="mt-4">
                <VoucherInput
                  primaryColor={primaryColor}
                  loading={payState === "processing"}
                  language={config.language}
                  onRedeem={handleRedeem}
                />
              </TabsContent>
            </Tabs>
          ) : resolvedMode === "packages" ? (
            <PackageGrid
              packages={packages}
              currency={config.currency}
              primaryColor={primaryColor}
              language={config.language}
              onPay={handlePay}
            />
          ) : (
            <VoucherInput
              primaryColor={primaryColor}
              loading={payState === "processing"}
              language={config.language}
              onRedeem={handleRedeem}
            />
          )}
        </div>

        {config.portalSettings.termsUrl && (
          <p className="text-center text-xs text-muted-foreground">
            {labels[config.language]?.connecting || "By connecting you agree to our"}{" "}
            <a
              href={`/terms-and-conditions?${params.toString()}&ref=portal`}
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

      {config.support.showOnPortal && (
        <SupportInfo support={config.support} language={config.language} primaryColor={primaryColor} />
      )}

      {config.portalSettings.showPoweredBy && (
        <p className="text-center text-sm text-muted-foreground/50 py-4">
          {labels[config.language]?.poweredBy || "Powered by"} {appName}
        </p>
      )}
    </div>
  );
}