"use client";

import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { apiClient, imageUrl } from "@/lib/api";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { TenantPortalSettings, Package } from "@/lib/types";
import { appName } from "@/lib/utils";
import SocketClient from "@/lib/socket.util";
import { CalendarDays, Crown, Gauge, Gift, Mail, Network, Phone, ShieldCheck, ShoppingCart, Signal, Star, Ticket, Timer, WifiOff, Zap } from "lucide-react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Wifi, Clock, ChevronUp } from "lucide-react";
import { formatData, formatDuration } from "@/lib/utils";

export const DEFAULT_CONFIG: TenantPortalSettings = {
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
  currency: "TZS",
  language: "en",
  active: false,
  template: "default",
};

export const labels: any = {
  en: {
    buyPackage: "Buy Package",
    noHuduma: "No Service",
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
    duration: { minutes: "minutes", hours: "hours", days: "days", week: "week", weeks: "weeks", months: "months" },
    unlimited: "Unlimited",
    phoneError: "Enter a valid phone number (e.g. 0712 XXX XXX)",
    tryError: "Service Not Available",
    tryErrorDescription: "You have already tried our service, please purchase a package to continue.",
    connectionLabel: "Connect to the internet",
    needHelp: "Need help?",
    outOfService: "Service Temporarily Unavailable",
    outOfServiceDescription:
      "Our service is currently unavailable. We are handling technical faults, Please contact our support team for assistance.",
    placeholder: "e.g XYZ12ABC",
  },
  sw: {
    buyPackage: "Nunua Bando",
    noHuduma: "Hakuna Huduma",
    haveVoucher: "Tumia Vocha",
    poweredBy: "Imedhaminiwa na",
    terms: "Miongozo na masharti",
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
    paymentConfirmation: "Weka PIN kwenye simu yako kuthibitisha malipo.",
    duration: { minutes: "Dakika", hours: "Saa", days: "Siku", week: "Wiki", weeks: "Wiki", months: "Mwezi" },
    unlimited: "Bila Kikomo",
    phoneError: "Weka namba ya simu sahihi (mfano 0712 XXX XXX)",
    tryError: "Huduma haipatikani",
    tryErrorDescription: "Umekwishajaribu huduma yetu tayari, tafadhali nunua bando kupata huduma",
    connectionLabel: "Peruzi bila Kikomo",
    needHelp: "Wahitaji Msaada?",
    outOfService: "Huduma Haipatikani Kwa Sasa",
    outOfServiceDescription:
      "Huduma yetu haipatikani kwa sasa. Kuna matatizo ya kiufundi tunarekebisha, tafadhali wasiliana na timu yetu ya usaidizi kwa msaada wa haraka.",
    placeholder: "Mfano. XYZ12ABC",
  },
};

interface VoucherInputProps {
  primaryColor: string;
  loading: boolean;
  language: string;
  onRedeem: (voucher: string) => void;
}

export function VoucherInputDefault({ primaryColor, onRedeem, loading, language }: VoucherInputProps) {
  const [code, setCode] = useState("");

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col items-center gap-2 py-2">
        <div className="flex h-12 w-12 items-center justify-center rounded-full" style={{ background: `${primaryColor}15` }}>
          <Ticket className="h-6 w-6" style={{ color: primaryColor }} />
        </div>
        <p className="text-sm font-medium text-foreground">{labels[language]?.enterVoucher || "Enter your voucher code"}</p>
        <p className="text-xs text-muted-foreground text-center">
          {labels[language]?.enterVoucherDescription || "Scratched from a card or provided by your ISP"}
        </p>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label className="text-xs font-medium">{labels[language]?.voucherCode || "Voucher Code"}</Label>
        <Input
          placeholder={labels[language]?.placeholder}
          value={code}
          onChange={(e) => {
            setCode(e.target.value.replace(/\s/g, "").toUpperCase());
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              onRedeem(code);
            }
          }}
          /* className="h-10 focus-visible:outline-none focus-visible:ring-2 text-center font-mono text-lg tracking-widest uppercase" */
          className="h-10 bg-background text-foreground placeholder:text-muted-foreground text-center font-mono text-lg tracking-widest uppercase"
          style={{
            borderColor: primaryColor,
            boxShadow: `0 0 0 2px ${primaryColor}33`,
          }}
          maxLength={20}
        />
      </div>

      <Button
        onClick={(e) => {
          e.preventDefault();
          onRedeem(code.trim());
        }}
        disabled={loading || !code.trim() || code.length < 8 || code.length > 10}
        className="w-full h-11 font-semibold text-sm"
        style={{ background: primaryColor, color: "white" }}
      >
        {loading ? labels[language]?.checking || "Checking..." : labels[language]?.redeemVoucher || "Redeem Voucher"}
      </Button>
    </div>
  );
}

function VoucherInputTemplateOne({ primaryColor, loading, language, onRedeem }: VoucherInputProps) {
  const [code, setCode] = useState("");

  return (
    <div className="rounded-3xl border border-[var(--border)] bg-[var(--card)] p-5 shadow-sm">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col items-center text-center">
          <div
            className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl"
            style={{
              background: `${primaryColor}90`,
            }}
          >
            <Ticket
              className="cp-ticket-icon h-7 w-7"
            />
          </div>

          <h3 className="text-base font-semibold text-foreground">{labels[language]?.enterVoucher}</h3>

          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{labels[language]?.enterVoucherDescription}</p>
        </div>

        <div className="space-y-2">
          <Label className="text-xs font-medium">{labels[language]?.voucherCode}</Label>

          <Input
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\s/g, "").toUpperCase())}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                onRedeem(code);
              }
            }}
            placeholder={labels[language]?.placeholder}
            className="h-11 rounded-2xl border bg-background text-center text-sm font-medium tracking-[0.2em]"
            style={{
              borderColor: `${primaryColor}40`,
              boxShadow: `0 0 0 2px ${primaryColor}22`,
            }}
            maxLength={20}
          />
        </div>

        <Button
          disabled={loading || !code.trim() || code.length < 8 || code.length > 10}
          onClick={() => onRedeem(code.trim())}
          className="cp-voucher-btn h-11 rounded-2xl text-sm font-semibold text-white"
          
        >
          {loading ? labels[language]?.checking : labels[language]?.redeemVoucher}
        </Button>
      </div>
    </div>
  );
}

interface PortalHeaderProps {
  config: TenantPortalSettings;
  connectionLabel: string;
}

export function PortalHeaderDefault({ config, connectionLabel }: PortalHeaderProps) {
  const { primaryColor, secondaryColor, logo, businessName } = config.branding;

  return (
    <header
      className="w-full px-6 py-5 flex items-center gap-4 text-white"
      style={{
        background: `linear-gradient(135deg, ${primaryColor}, ${secondaryColor})`,
      }}
    >
      {/* Logo */}
      <div
        className={`flex h-${logo && logo.length > 9 ? "13" : "12"} w-${logo && logo.length > 9 ? "13" : "12"} items-center justify-center rounded-${logo && logo.length > 9 ? "3xl" : "xl"} bg-white/20 shrink-0 overflow-hidden`}
      >
        {logo && logo.length > 9 ? (
          <img src={imageUrl(logo)} alt={businessName} className="h-13 w-13 object-contain rounded-3xl" />
        ) : (
          <Wifi className="h-6 w-6 text-white" />
        )}
      </div>

      <div>
        <h1 className="text-lg font-bold text-white leading-tight">{businessName || `${appName}`}</h1>
        <p className="text-sm text-white/70">{connectionLabel}</p>
      </div>
    </header>
  );
}

function PortalHeaderTemplateOne({ config }: { config: TenantPortalSettings }) {
  const { primaryColor, secondaryColor, logo, businessName } = config.branding;

  return (
    <div
      className="relative overflow-hidden"
      style={{
        background: `linear-gradient(135deg, ${secondaryColor}, ${primaryColor})`,
      }}
    >
      {logo && (
        <div
          className="absolute inset-0 bg-cover bg-center opacity-15"
          style={{
            backgroundImage: `url(${imageUrl(logo)})`,
          }}
        />
      )}

      <div className="absolute inset-0 bg-black/20" />

      <div className="absolute inset-0 opacity-20">
        <div className="absolute -left-10 top-28 h-52 w-52 rounded-full border border-white/20" />
        <div className="absolute -right-10 top-12 h-52 w-52 rounded-full border border-white/10" />
      </div>

      <div className="relative mx-auto max-w-md px-5 pt-8 pb-20 text-center text-white">
        <div className="mb-4 flex justify-center">
          <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-3xl bg-white/10 backdrop-blur">
            {logo ? <img src={imageUrl(logo)} alt={businessName} className="h-full w-full object-contain" /> : <Wifi className="h-7 w-7" />}
          </div>
        </div>

        <h1 className="text-3xl font-black leading-none tracking-tight">{businessName || appName}</h1>
      </div>
    </div>
  );
}

type PayState = "idle" | "processing" | "success" | "failure";

export interface PayResult {
  success: boolean;
  voucher: string | null | undefined;
}

interface PackageGridProps {
  packages: Package[];
  primaryColor: string;
  currency: string;
  language: string;
  onPay: (params: { pkg: Package; phone: string }) => void;
}

export const phoneSchemaDef = (params?: { min?: number; max?: number; language: string }) => {
  const min = params?.min ?? 10;
  const max = params?.max ?? 15;

  return z.string().refine(
    (val) => {
      const phoneRegex = new RegExp(`^\\+?[\\d\\s\\-\\(]{${min},${max}}$`);
      return phoneRegex.test(val);
    },
    {
      message: labels[params!.language]?.phoneError || `Enter a valid phone number (e.g. 0712 XXX XXX)`,
    },
  );
};

interface SupportInfoProps {
  support: TenantPortalSettings["support"];
  language: string;
  primaryColor: string;
}

export function SupportInfoDefault({ support, primaryColor, language }: SupportInfoProps) {
  if (!support.phone && !support.email && !support.whatsapp) return null;

  return (
    <div className="mx-auto max-w-md px-4 pb-6">
      <div className="rounded-xl border border-border p-4 flex flex-col gap-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{labels[language]?.needHelp}</p>
        <div className="flex flex-wrap gap-3">
          {support.phone && (
            <a
              href={`tel:${support.phone}`}
              className="flex items-center gap-1.5 text-sm font-medium hover:underline"
              style={{ color: primaryColor }}
            >
              <Phone className="h-3.5 w-3.5" />
              {support.phone}
            </a>
          )}
          {support.email && (
            <a
              href={`mailto:${support.email}`}
              className="flex items-center gap-1.5 text-sm font-medium hover:underline"
              style={{ color: primaryColor }}
            >
              <Mail className="h-3.5 w-3.5" />
              {support.email}
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

function SupportInfoTemplateOne({ support, language }: { support: TenantPortalSettings["support"]; language: string }) {
  if (!support.phone && !support.email) return null;

  return (
    <div className="mx-auto max-w-md px-4 pb-4">
      <div className="rounded-3xl border border-[var(--border)] bg-[var(--card)] p-4 shadow-sm">
        <h3 className="text-sm font-bold leading-tight text-foreground">{labels[language]?.needHelp}</h3>

        <div className="mt-3 flex flex-row gap-2">
          {support.phone && (
            <a href={`tel:${support.phone}`} className="flex min-w-0 flex-1 items-center gap-2 px-3 py-2">
              <Phone className="h-3.5 w-3.5 shrink-0 text-emerald-600" />

              <p className="truncate text-[13px] font-medium">{support.phone}</p>
            </a>
          )}

          {support.email && (
            <a href={`mailto:${support.email}`} className="flex min-w-0 flex-1 items-center gap-2 px-3 py-2">
              <Mail className="h-3.5 w-3.5 shrink-0 text-blue-600" />

              <p className="truncate text-[13px] font-medium">{support.email}</p>
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

export function PackageGridDefault({ packages, primaryColor, onPay, currency, language }: PackageGridProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [phone, setPhone] = useState("");
  const phoneSchema = phoneSchemaDef({ min: 10, max: 13, language: language });

  const phoneResult = phoneSchema.safeParse(phone);
  const phoneError = phone.length >= 10 && !phoneResult.success ? phoneResult.error.errors[0]?.message : null;
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
        <p className="text-sm text-muted-foreground">{labels[language]?.noPackages || "No packages available on this network."}</p>
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
            className="rounded-2xl border-2 overflow-hidden transition-all portal-card"
            style={{
              borderColor: isOpen ? primaryColor : "var(--border)",
              /* background: "var(--card)", */
            }}
          >
            {/* Package row */}
            <div className="flex items-center justify-between gap-3 p-4">
              <div className="flex flex-col gap-1 min-w-0">
                <span className="font-semibold text-sm text-foreground leading-tight">{pkg.name}</span>
                {pkg.description && <span className="text-xs text-muted-foreground leading-snug">{pkg.description}</span>}
                <div className="flex items-center gap-3 mt-1 flex-wrap">
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    {formatDuration(pkg.duration, labels[language]?.duration[pkg.durationUnit], language)}
                  </span>
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Wifi className="h-3 w-3" />
                    {formatData(pkg.dataLimit, pkg.dataLimitUnit, labels[language]?.unlimited)}
                  </span>
                  {/* <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Zap className="h-3 w-3" />
                    {formatSpeed(pkg.speedLimit, labels[language]?.unlimited)}
                  </span> */}
                </div>
              </div>

              <div className="flex flex-col items-end gap-2 shrink-0">
                {!pkg.isFree && (
                  <div className="px-3 py-1.5 text-center">
                    <p className="portal-price text-2xl leading-none">
                      <span className="portal-currency text-xs font-medium leading-none mb-0.5">{currency}</span>
                      {pkg.price.toLocaleString()}
                    </p>
                  </div>
                )}
                <Button
                  size="sm"
                  onClick={() => handleSelect(pkg)}
                  className="portal-button h-8 px-4 text-xs font-semibold flex items-center gap-1"
                  style={isOpen ? { background: "var(--muted)", color: "var(--muted-foreground)" } : { background: primaryColor, color: "#fff" }}
                >
                  {pkg.isFree ? (
                    labels[language]?.connect || "Connect"
                  ) : isOpen ? (
                    <>
                      <ChevronUp className="h-3 w-3" />
                      {labels[language]?.close || "Close"}
                    </>
                  ) : (
                    labels[language]?.select || "Select"
                  )}
                </Button>
              </div>
            </div>

            {/* Inline phone input section */}
            {isOpen && (
              <div
                className="border-t px-4 pb-4 pt-4 flex flex-col gap-3"
                style={{ borderColor: `${primaryColor}30`, background: `${primaryColor}06` }}
              >
                <p className="text-xs font-semibold text-foreground">
                  {labels[language]?.payFor || "Paying for"}:<span style={{ color: primaryColor }}>{pkg.name}</span>
                  <span className="text-muted-foreground font-normal">
                    {" "}
                    - {currency} {pkg.price.toLocaleString()}
                  </span>
                </p>

                {/* Phone input */}
                <div className="flex flex-col gap-1.5">
                  <Label className="text-xs font-medium">{labels[language]?.phone || "Phone Number"}</Label>
                  <Input
                    type="tel"
                    placeholder="0712 XXX XXX"
                    value={phone}
                    autoFocus
                    onChange={(e) => setPhone(e.target.value.replace(/\s/g, ""))}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && canPay) {
                        e.preventDefault();
                        onPay({ pkg, phone });
                      }
                    }}
                    /* className="h-10 focus-visible:outline-none focus-visible:ring-2" */
                    className="h-10 bg-background text-foreground placeholder:text-muted-foreground"
                    style={{
                      borderColor: primaryColor,
                      boxShadow: `0 0 0 2px ${primaryColor}33`,
                    }}
                  />
                  {phoneError && <p className="text-xs text-destructive">{phoneError}</p>}
                </div>

                <Button
                  onClick={(e) => {
                    e.preventDefault();
                    onPay({ pkg, phone });
                  }}
                  disabled={!canPay}
                  className="portal-button w-full h-11 font-semibold text-sm"
                  style={canPay ? { background: primaryColor, color: "#fff" } : { background: `${primaryColor}2a`, color: "#000" }}
                >
                  {`${labels[language]?.pay || "Pay Now"} ${currency} ${pkg.price.toLocaleString()}`}
                </Button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function PackageGridTemplateOne({ packages, onPay, currency, language }: PackageGridProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [phone, setPhone] = useState("");

  const phoneSchema = phoneSchemaDef({
    min: 10,
    max: 13,
    language,
  });

  const phoneResult = phoneSchema.safeParse(phone);

  const phoneError = phone.length >= 10 && !phoneResult.success ? phoneResult.error.errors[0]?.message : null;

  const canPay = phoneResult.success;

  if (packages.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 py-12 text-center">
        <Wifi className="h-10 w-10 text-muted-foreground/40" />

        <p className="text-sm text-muted-foreground">{labels[language]?.noPackages}</p>
      </div>
    );
  }

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

  const packageIcons = [Clock, CalendarDays, Timer, Wifi, Signal, Gauge, Zap, ShieldCheck, Star, Crown];

  const packageColors = ["#10B981", "#3B82F6", "#6366F1", "#06B6D4", "#14B8A6", "#F59E0B", "#EF4444", "#8B5CF6", "#EC4899", "#00B894"];

  return (
    <div className="space-y-3">
      {packages.map((pkg, index) => {
        const isOpen = selectedId === pkg._id;

        const Icon = packageIcons[index % packageIcons.length];

        const accent = packageColors[index % packageColors.length];

        return (
          <div key={pkg._id} className="overflow-hidden rounded-3xl border border-[var(--border)] bg-[var(--card)] shadow-sm transition-all">
            <div className="p-4">
              <div className="flex items-center justify-between gap-4">
                <div className="flex min-w-0 items-center gap-3">
                  <div
                    className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl"
                    style={{
                      background: `${accent}14`,
                    }}
                  >
                    {pkg.isFree ? (
                      <Gift
                        className="h-6 w-6"
                        style={{
                          color: accent,
                        }}
                      />
                    ) : (
                      <Icon
                        className="h-6 w-6"
                        style={{
                          color: accent,
                        }}
                      />
                    )}
                  </div>

                  <div className="min-w-0">
                    <h3 className="truncate text-base font-bold text-foreground">{pkg.name}</h3>

                    {pkg.description && <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{pkg.description}</p>}

                    <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5" />

                        <span>{formatDuration(pkg.duration, labels[language]?.duration[pkg.durationUnit], language)}</span>
                      </div>

                      <div className="flex items-center gap-1">
                        <Wifi className="h-3.5 w-3.5" />

                        <span>{formatData(pkg.dataLimit, pkg.dataLimitUnit, labels[language]?.unlimited)}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="shrink-0 text-right">
                  {!pkg.isFree && (
                    <div
                      className="text-[22px] font-black leading-none tracking-tight"
                      style={{
                        color: accent,
                      }}
                    >
                      <span className="mr-0.5 text-[11px] font-medium text-muted-foreground">{currency}</span>

                      {pkg.price.toLocaleString()}
                    </div>
                  )}

                  <Button
                    size="sm"
                    onClick={() => handleSelect(pkg)}
                    className="mt-3 h-8 rounded-xl px-4 text-xs font-semibold text-white shadow-none"
                    style={{
                      background: isOpen ? "var(--muted)" : accent,

                      color: isOpen ? "var(--muted-foreground)" : "#fff",
                    }}
                  >
                    {pkg.isFree ? (
                      labels[language]?.connect
                    ) : isOpen ? (
                      <>
                        <ChevronUp className="mr-1 h-3 w-3" />
                        {labels[language]?.close}
                      </>
                    ) : (
                      labels[language]?.select
                    )}
                  </Button>
                </div>
              </div>

              {isOpen && (
                <div className="mt-4 border-t border-[var(--border)] pt-4">
                  <div className="space-y-3">
                    <div>
                      <p className="mb-3 text-xs font-semibold text-foreground">
                        {labels[language]?.payFor}{" "}
                        <span
                          style={{
                            color: accent,
                          }}
                        >
                          {pkg.name}
                        </span>
                      </p>

                      <Label className="mb-2 block text-xs font-medium">{labels[language]?.phone}</Label>

                      <Input
                        autoFocus
                        type="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value.replace(/\s/g, ""))}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && canPay) {
                            e.preventDefault();

                            onPay({
                              pkg,
                              phone,
                            });
                          }
                        }}
                        placeholder="0712 XXX XXX"
                        className="h-11 rounded-2xl text-sm"
                        style={{
                          borderColor: `${accent}40`,
                          boxShadow: `0 0 0 2px ${accent}15`,
                        }}
                      />

                      {phoneError && <p className="mt-1 text-xs text-destructive">{phoneError}</p>}
                    </div>

                    <Button
                      disabled={!canPay}
                      onClick={() =>
                        onPay({
                          pkg,
                          phone,
                        })
                      }
                      className="h-11 w-full rounded-2xl text-sm font-semibold text-white"
                      style={{
                        background: canPay ? accent : `${accent}40`,
                      }}
                    >
                      {labels[language]?.pay} {currency} {pkg.price.toLocaleString()}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function SpinnerRing({ color }: { color: string }) {
  return (
    <div className="relative h-24 w-24">
      <div className="absolute inset-0 rounded-full" style={{ border: "6px solid", borderColor: `${color}22` }} />
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
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center px-6 text-center bg-background/95 backdrop-blur">
      {isProcessing && (
        <div className="flex flex-col items-center gap-6">
          <SpinnerRing color={primaryColor} />
          {!isFree && (
            <div className="flex flex-col gap-2">
              <p className="text-lg font-bold text-foreground">{isVoucher ? labels[language]?.processVoucher : labels[language]?.processPay}</p>
              <p className="text-sm text-muted-foreground leading-relaxed max-w-xs">
                {isVoucher ? labels[language]?.processVoucherDescription : labels[language]?.processPayDescription}
              </p>
              <p className="text-xs text-muted-foreground">
                {isVoucher ? labels[language]?.voucherConfirmation : labels[language]?.paymentConfirmation}
              </p>
            </div>
          )}
        </div>
      )}

      {isSuccess && (
        <div className="flex flex-col items-center gap-6 animate-in fade-in zoom-in-95 duration-300">
          <div className="flex h-24 w-24 items-center justify-center rounded-full" style={{ background: "#22c55e20" }}>
            <svg className="h-12 w-12 text-emerald-500" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
            </svg>
          </div>

          <div className="flex flex-col gap-2">
            <p className="text-2xl font-bold text-foreground">{labels[language]?.connected || "You're Connected!"}</p>
            <p className="text-sm text-muted-foreground leading-relaxed max-w-xs">
              {labels[language]?.connectedDescription || "Your package has been activated successfully."}
            </p>
          </div>

          <div className="h-1 w-40 rounded-full overflow-hidden bg-muted">
            <div className="h-full rounded-full animate-[shrink_4s_linear_forwards]" style={{ background: "#22c55e", width: "100%" }} />
          </div>

          <p className="text-xs text-muted-foreground">{labels[language]?.connectedFooter || "This page will close automatically…"}</p>
        </div>
      )}

      {isFailure && (
        <div className="flex flex-col items-center gap-6 animate-in fade-in zoom-in-95 duration-300">
          <div className="flex h-24 w-24 items-center justify-center rounded-full" style={{ background: "#ef444420" }}>
            <svg className="h-12 w-12 text-red-500" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>

          <div className="flex flex-col gap-2">
            <p className="text-2xl font-bold text-foreground">
              {isVoucher ? labels[language]?.redeemError : isFree ? labels[language]?.tryError : labels[language]?.payError}
            </p>
            <p className="text-sm text-muted-foreground leading-relaxed max-w-xs">
              {isVoucher
                ? labels[language]?.redeemErrorDescription
                : isFree
                  ? labels[language]?.tryErrorDescription
                  : labels[language]?.payErrorDescription}
              {`${isFree ? "" : `, ${labels[language]?.tryAgain}`}`}.
            </p>
          </div>

          <div className="h-1 w-40 rounded-full overflow-hidden bg-muted">
            <div className="h-full rounded-full animate-[shrink_4s_linear_forwards]" style={{ background: "#ef4444", width: "100%" }} />
          </div>

          <p className="text-xs text-muted-foreground">{isVoucher ? labels[language]?.returnVoucher : labels[language]?.returnPay}</p>
        </div>
      )}
    </div>
  );
}

function OutOfServiceNotificationDefault({ config }: { config: TenantPortalSettings }) {
  const primaryColor = "#EF4444";

  return (
    <div className="mt-4">
      {/* Main Card */}
      <div className="overflow-hidden">
        {/* Gradient Header */}
        <div className="px-2 py-8 text-center">
          <div
            className="mx-auto flex h-20 w-20 items-center justify-center rounded-2xl mb-4 mt-5"
            style={{
              background: primaryColor,
              boxShadow: `0 10px 25px -5px ${primaryColor}40`,
            }}
          >
            <WifiOff className="text-white h-10 w-14" />
          </div>

          <h2 className="text-2xl font-bold py-6" style={{ color: config.branding.primaryColor }}>
            {labels[config.language]?.outOfService || "Service Temporarily Unavailable"}
          </h2>

          <p className="text-muted-foreground text-sm max-w-sm mx-auto">
            {labels[config.language]?.outOfServiceDescription ||
              "Our service is currently unavailable. Please contact our support team for assistance."}
          </p>
        </div>
      </div>
    </div>
  );
}

function OutOfServiceNotificationTemplateOne({ config }: { config: TenantPortalSettings }) {
  return (
    <div className="rounded-3xl border border-[var(--border)] bg-[var(--card)] p-8 text-center shadow-sm">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-red-100">
        <WifiOff className="h-8 w-8 text-red-500" />
      </div>

      <h2 className="mt-5 text-xl font-bold text-foreground">{labels[config.language]?.outOfService}</h2>

      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{labels[config.language]?.outOfServiceDescription}</p>
    </div>
  );
}

export function CaptivePortalClient() {
  const params = useSearchParams();
  const nasName = decodeURIComponent(params.get("nasname") ?? "");
  const deviceMac = decodeURIComponent(params.get("mac") ?? "");
  const deviceIp = decodeURIComponent(params.get("ip") ?? "");
  const deviceName = decodeURIComponent(params.get("hostName") ?? "");
  const authToken = decodeURIComponent(params.get("token") ?? "");

  const [config, setConfig] = useState<TenantPortalSettings>(DEFAULT_CONFIG);
  const [packages, setPackages] = useState<Package[]>([]);
  const [loading, setLoading] = useState(true);
  const [isVoucher, setIsVoucher] = useState(false);
  const [isFree, setIsFree] = useState(false);
  const [payState, setPayState] = useState<PayState>("idle");
  const [views, setViews] = useState<{ header: any; grid: any; suportInfo: any }>();

  const loadingCompleted = () => {
    window.parent.postMessage(
      {
        type: "HIDE_LOADING",
      },
      "*",
    );
  };

  const reflectOnUI = (success: boolean, voucher: string | null | undefined) => {
    if (success && voucher) setTimeout(() => grantAccess(voucher), 1500);
    setPayState(success && voucher ? "success" : "failure");
  };

  const grantAccess = (voucher: string) => {
    window.parent.postMessage(
      {
        type: "AUTH_SUCCESS",
        username: voucher,
        password: voucher,
      },
      "*",
    );
  };

  const handleRedeem = useCallback(
    async (voucher: string) => {
      setIsVoucher(true);
      setPayState("processing");

      try {
        const { success, voucher: _voucher } = await apiClient.portal.redeemVoucher({
          code: voucher,
          nasName,
          deviceIp,
          deviceName,
          deviceMac,
          authToken,
        });
        reflectOnUI(success, _voucher);
      } catch (err: unknown) {
        setPayState("failure");
      }
    },
    [nasName, deviceMac],
  );

  const handlePay = useCallback(
    async ({ pkg, phone }: { pkg: Package; phone: string }) => {
      setIsVoucher(false);
      setPayState("processing");
      setIsFree(pkg.isFree);
      try {
        if (pkg.isFree) {
          const { voucher, success } = await apiClient.portal.connectFreePackage({
            packageId: pkg._id,
            nasName,
            deviceIp,
            deviceMac,
            deviceName,
            authToken,
          });
          reflectOnUI(success, voucher);
          return;
        } else {
          const { orderId, success } = await apiClient.portal.initiatePayment({
            packageId: pkg._id,
            nasName,
            deviceIp,
            deviceMac,
            deviceName,
            authToken,
            phoneNumber: phone,
          });
          if (success && orderId) {
            SocketClient.waitFor<PayResult>(
              SocketClient.event_payment_completed,
              orderId,
              ({ success, voucher }) => reflectOnUI(success, voucher),
              24 * 1000,
              () =>
                apiClient.portal.checkStatus({
                  orderId,
                  nasName,
                  authToken,
                }),
            );
          } else {
            reflectOnUI(false, null);
          }
        }
      } catch (err: unknown) {
        setPayState("failure");
      }
    },
    [nasName, deviceMac],
  );

  const handleDismissFailure = useCallback(() => {
    setPayState("idle");
  }, []);

  useEffect(() => {
    const init = async () => {
      try {
        setLoading(true);
        const [cfg, pkgs, session] = await Promise.all([
          apiClient.portal.getConfig(nasName, authToken),
          apiClient.portal.getPackages({ nasName, authToken, deviceMac }),
          apiClient.portal.checkSession({ deviceMac, nasName, authToken }),
        ]);
        if (session.success && session.voucher) {
          grantAccess(session.voucher);
          return;
        }
        setConfig(cfg.data ?? cfg);
        pkgs.sort((a, b) => a.price - b.price);
        setPackages(pkgs ?? pkgs);
      } catch {
        setConfig(DEFAULT_CONFIG);
        setPackages([]);
      } finally {
        setLoading(false);
        loadingCompleted();
      }
    };
    init();
  }, [nasName, deviceMac, authToken]);

  const { primaryColor, secondaryColor } = config.branding;
  const { displayMode } = config.portalSettings;

  const resolvedMode = displayMode === "packages_only" ? "packages" : displayMode === "vouchers_only" ? "voucher" : "both";

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

  const HeaderSection = () => {
    switch (config.template) {
      case "default":
        return <PortalHeaderDefault config={config} connectionLabel={labels[config.language]?.connectionLabel || "Connect to the internet"} />;
      case "template_one":
        return <PortalHeaderTemplateOne config={config} />;
      default:
        return <div />;
    }
  };

  const OutOfServiceSection = () => {
    switch (config.template) {
      case "default":
        return <OutOfServiceNotificationDefault config={config} />;
      case "template_one":
        return <OutOfServiceNotificationTemplateOne config={config} />;
      default:
        return <div />;
    }
  };

  const 
  PackageView = () => {
    if(!config.active) return OutOfServiceSection();
    switch (config.template) {
      case "default":
        return (
          <PackageGridDefault
            packages={packages}
            currency={config.currency}
            primaryColor={primaryColor}
            language={config.language}
            onPay={handlePay}
          />
        );
      case "template_one":
        return (
          <PackageGridTemplateOne
            packages={packages}
            currency={config.currency}
            primaryColor={primaryColor}
            language={config.language}
            onPay={handlePay}
          />
        );
      default:
        return <div />;
    }
  };

  const VoucherView = () => {
    switch (config.template) {
      case "default":
        return (
          <VoucherInputDefault primaryColor={primaryColor} loading={payState === "processing"} language={config.language} onRedeem={handleRedeem} />
        );
      case "template_one":
        return (
          <VoucherInputTemplateOne
            primaryColor={config.branding.primaryColor}
            loading={payState === "processing"}
            language={config.language}
            onRedeem={handleRedeem}
          />
        );
      default:
        return <div />;
    }
  };

  const TabsView = () => {
    switch (config.template) {
      case "default":
        return (
          <Tabs defaultValue="packages">
            <TabsList className="portal-tabs w-full">
              <TabsTrigger value="packages" className="flex-1">
                {(!config.active ? labels[config.language]?.noHuduma: labels[config.language]?.buyPackage) || "Buy Package"}
              </TabsTrigger>
              <TabsTrigger value="voucher" className="flex-1">
                {labels[config.language]?.haveVoucher || "Have a Voucher?"}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="packages" className="mt-4">
              {PackageView()}
            </TabsContent>

            <TabsContent value="voucher" className="mt-4">
              {VoucherView()}
            </TabsContent>
          </Tabs>
        );
      case "template_one":
        return (
          <Tabs defaultValue="packages">
            <TabsList className="h-14 w-full rounded-[24px] border border-[var(--border)] bg-[var(--card)] p-1 shadow-lg">
              <TabsTrigger value="packages" className="flex-1 rounded-[18px] text-sm font-semibold">
                {!config.active ? (<Network className="mr-2 h-4 w-4" />): (<ShoppingCart className="mr-2 h-4 w-4" />)}
                {(!config.active ? labels[config.language]?.noHuduma: labels[config.language]?.buyPackage) || "Buy Package"}
              </TabsTrigger>

              <TabsTrigger value="voucher" className="flex-1 rounded-[18px] text-sm font-semibold">
                <Ticket className="mr-2 h-4 w-4" />
                {labels[config.language]?.haveVoucher}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="packages" className="mt-4">
              {PackageView()}
            </TabsContent>

            <TabsContent value="voucher" className="mt-4">
              {VoucherView()}
            </TabsContent>
          </Tabs>
        );
      default:
        return <div />;
    }
  };

  const TermsView = () => {
    switch (config.template) {
      case "default":
        return (
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
        );
      case "template_one":
        return (
          <div className="mt-4 flex items-center  gap-3 rounded-2xl px-4 py-4 text-center">
            <ShieldCheck className="h-5 w-5 shrink-0 text-emerald-600" />

            <p className="text-xs leading-relaxed text-foreground">
              {labels[config.language]?.connecting}{" "}
              <a href={`/terms-and-conditions?${params.toString()}&ref=portal`} className="font-semibold text-emerald-700">
                {labels[config.language]?.terms}
              </a>
            </p>
          </div>
        );
      default:
        return <div />;
    }
  };

  const SupportView = () => {
    switch (config.template) {
      case "default":
        return <SupportInfoDefault support={config.support} language={config.language} primaryColor={primaryColor} />;
      case "template_one":
        return <SupportInfoTemplateOne support={config.support} language={config.language} />;
      default:
        return <div />;
    }
  };


  const WelcomView = () => {
    switch (config.template) {
      case "default":
        return (
          <p className="text-sm text-muted-foreground text-center leading-relaxed">{config.portalSettings.welcomeMessage}</p>
        );
      case "template_one":
        return <p className="mb-7 text-center text-lg leading-relaxed text-white/80">
            {config.portalSettings.welcomeMessage}
          </p>
      default:
        return <div />;
    }
  };

  const mainClass = () => {
    
    switch (config.template) {
      case "default":
        return "mx-auto max-w-md w-full px-4 py-6 flex flex-col gap-5"
      case "template_one":
        return "relative z-10 mx-auto -mt-18 max-w-md px-4 pb-6"
      default:
        return "";
    }
  }

  return (
    <div className="cp-theme min-h-screen bg-background" style={config.template === "default" ? portalVars: {}}>
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

      {HeaderSection()}

      
      <div className={mainClass()}>
        {config.portalSettings.welcomeMessage && config.active && WelcomView()}

        <div className="mt-4">
          {resolvedMode === "both"
              ? TabsView()
              : resolvedMode === "packages"
                ? PackageView()
                : VoucherView()}
        </div>

        {config.portalSettings.termsUrl && config.active && TermsView()}
      </div>

      {config.support.showOnPortal && SupportView()}

      {config.portalSettings.showPoweredBy && (
        <p className="text-center text-sm text-muted-foreground/50 py-4">
          {labels[config.language]?.poweredBy || "Powered by"} {appName}
        </p>
      )}
    </div>
  );
}
