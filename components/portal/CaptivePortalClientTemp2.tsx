"use client";

import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { apiClient, imageUrl } from "@/lib/api";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { TenantPortalSettings, Package } from "@/lib/types";
import { appName } from "@/lib/utils";
import SocketClient from "@/lib/socket.util";

import {
  Mail,
  Phone,
  Ticket,
  WifiOff,
  Wifi,
  Clock,
  ChevronUp,
  CalendarDays,
  Crown,
  ShieldCheck,
  ShoppingCart,
  Timer,
  Signal,
  Gauge,
  Star,
  Zap,
  Gift,
} from "lucide-react";

import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { formatData, formatDuration } from "@/lib/utils";
import { DEFAULT_CONFIG, labels } from "./CaptivePortalClientTemp1";

const packageIcons = [Clock, CalendarDays, Timer, Wifi, Signal, Gauge, Zap, ShieldCheck, Star, Crown];

const packageColors = [
  "#10B981",
  "#3B82F6",
  "#6366F1",
  "#06B6D4",
  "#14B8A6",
  "#F59E0B",
  "#EF4444",
  "#8B5CF6",
  "#EC4899",
  "#00B894",
];

/* -------------------------------------------------------------------------- */
/*                               PHONE SCHEMA                                 */
/* -------------------------------------------------------------------------- */

export const phoneSchemaDef = (params?: { min?: number; max?: number; language: string }) => {
  const min = params?.min ?? 10;
  const max = params?.max ?? 15;

  return z.string().refine(
    (val) => {
      const phoneRegex = new RegExp(`^\\+?[\\d\\s\\-\\(]{${min},${max}}$`);

      return phoneRegex.test(val);
    },
    {
      message: labels[params!.language]?.phoneError,
    },
  );
};

/* -------------------------------------------------------------------------- */
/*                               VOUCHER INPUT                                */
/* -------------------------------------------------------------------------- */

interface VoucherInputProps {
  primaryColor: string;
  loading: boolean;
  language: string;
  onRedeem: (voucher: string) => void;
}

function VoucherInput({ primaryColor, loading, language, onRedeem }: VoucherInputProps) {
  const [code, setCode] = useState("");

  return (
    <div className="rounded-3xl border border-[var(--border)] bg-[var(--card)] p-5 shadow-sm">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col items-center text-center">
          <div
            className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl"
            style={{
              background: `${primaryColor}14`,
            }}
          >
            <Ticket
              className="h-5 w-5"
              style={{
                color: primaryColor,
              }}
            />
          </div>

          <h3 className="text-base font-semibold text-foreground">{labels[language]?.enterVoucher}</h3>

          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            {labels[language]?.enterVoucherDescription}
          </p>
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
          className="h-11 rounded-2xl text-sm font-semibold text-white"
          style={{
            background: primaryColor,
          }}
        >
          {loading ? labels[language]?.checking : labels[language]?.redeemVoucher}
        </Button>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                                  HEADER                                    */
/* -------------------------------------------------------------------------- */

function PortalHeader({ config }: { config: TenantPortalSettings }) {
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
            {logo ? (
              <img src={imageUrl(logo)} alt={businessName} className="h-full w-full object-contain" />
            ) : (
              <Wifi className="h-7 w-7" />
            )}
          </div>
        </div>

        <h1 className="text-3xl font-black leading-none tracking-tight">{businessName || appName}</h1>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                               PACKAGE GRID                                 */
/* -------------------------------------------------------------------------- */

interface PackageGridProps {
  packages: Package[];
  primaryColor: string;
  currency: string;
  language: string;
  onPay: (params: { pkg: Package; phone: string }) => void;
}

function PackageGrid({ packages, onPay, currency, language }: PackageGridProps) {
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

  return (
    <div className="space-y-3">
      {packages.map((pkg, index) => {
        const isOpen = selectedId === pkg._id;

        const Icon = packageIcons[index % packageIcons.length];

        const accent = packageColors[index % packageColors.length];

        return (
          <div
            key={pkg._id}
            className="overflow-hidden rounded-3xl border border-[var(--border)] bg-[var(--card)] shadow-sm transition-all"
          >
            <div className="p-4">
              <div className="flex items-center justify-between gap-4">
                <div className="flex min-w-0 items-center gap-3">
                  <div
                    className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl"
                    style={{
                      background: `${accent}14`,
                    }}
                  >
                    {pkg.isFree ? (<Gift
                      className="h-6 w-6"
                      style={{
                        color: accent,
                      }}
                    />):(<Icon
                      className="h-6 w-6"
                      style={{
                        color: accent,
                      }}
                    />)}
                  </div>

                  <div className="min-w-0">
                    <h3 className="truncate text-base font-bold text-foreground">{pkg.name}</h3>

                    {pkg.description && (
                      <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{pkg.description}</p>
                    )}

                    <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5" />

                        <span>
                          {formatDuration(pkg.duration, labels[language]?.duration[pkg.durationUnit], language)}
                        </span>
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

/* -------------------------------------------------------------------------- */
/*                               SUPPORT INFO                                 */
/* -------------------------------------------------------------------------- */

function SupportInfo({ support, language }: { support: TenantPortalSettings["support"]; language: string }) {
  if (!support.phone && !support.email) return null;

  return (
    <div className="mx-auto max-w-md px-4 pb-4">
      <div className="rounded-3xl border border-[var(--border)] bg-[var(--card)] p-4 shadow-sm">
        <h3 className="text-sm font-bold leading-tight text-foreground">{labels[language]?.needHelp}</h3>

        <div className="mt-3 flex flex-row gap-2">
          {support.phone && (
            <a
              href={`tel:${support.phone}`}
              className="flex min-w-0 flex-1 items-center gap-2 px-3 py-2"
            >
              <Phone className="h-3.5 w-3.5 shrink-0 text-emerald-600" />

              <p className="truncate text-[13px] font-medium">{support.phone}</p>
            </a>
          )}

          {support.email && (
            <a
              href={`mailto:${support.email}`}
              className="flex min-w-0 flex-1 items-center gap-2 px-3 py-2"
            >
              <Mail className="h-3.5 w-3.5 shrink-0 text-blue-600" />

              <p className="truncate text-[13px] font-medium">{support.email}</p>
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                              PAYMENT OVERLAY                               */
/* -------------------------------------------------------------------------- */

type PayState = "idle" | "processing" | "success" | "failure";

export interface PayResult {
  success: boolean;
  voucher: string | null | undefined;
}

function SpinnerRing({ color }: { color: string }) {
  return (
    <div className="relative h-24 w-24">
      <div
        className="absolute inset-0 rounded-full"
        style={{
          border: "6px solid",
          borderColor: `${color}22`,
        }}
      />

      <div
        className="absolute inset-0 animate-spin rounded-full"
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
      className="fixed inset-0 z-50 flex flex-col items-center justify-center px-6 text-center bg-background/95 backdrop-blur"
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


/* -------------------------------------------------------------------------- */
/*                           OUT OF SERVICE CARD                              */
/* -------------------------------------------------------------------------- */

function OutOfServiceNotification({ config }: { config: TenantPortalSettings }) {
  return (
    <div className="rounded-3xl border border-[var(--border)] bg-[var(--card)] p-8 text-center shadow-sm">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-red-100">
        <WifiOff className="h-8 w-8 text-red-500" />
      </div>

      <h2 className="mt-5 text-xl font-bold text-foreground">{labels[config.language]?.outOfService}</h2>

      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
        {labels[config.language]?.outOfServiceDescription}
      </p>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                              MAIN COMPONENT                                */
/* -------------------------------------------------------------------------- */

export function CaptivePortalClientTemp2() {
  const params = useSearchParams();

  const nasName = decodeURIComponent(params.get("nasname") ?? "");

  const deviceMac = decodeURIComponent(params.get("mac") ?? "");

  const deviceIp = decodeURIComponent(params.get("ip") ?? "");

  const deviceName = decodeURIComponent(params.get("hostName") ?? "");

  const authToken = decodeURIComponent(params.get("token") ?? "");

  const [config, setConfig] = useState<TenantPortalSettings>(DEFAULT_CONFIG);

  const [packages, setPackages] = useState<Package[]>([]);

  const [loading, setLoading] = useState(true);

  const [payState, setPayState] = useState<PayState>("idle");

  const [isVoucher, setIsVoucher] = useState(false);

  const [isFree, setIsFree] = useState(false);

  const loadingCompleted = () => {
    window.parent.postMessage(
      {
        type: "HIDE_LOADING",
      },
      "*",
    );
  };

  const reflectOnUI = (success: boolean, voucher: string | null | undefined) => {
    if (success && voucher) setTimeout(() => grantAccess(voucher), 1500)
    setPayState(success && voucher ? "success" : "failure");
  }

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
        }

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

          apiClient.portal.getPackages({
            nasName,
            authToken,
            deviceMac,
          }),

          apiClient.portal.checkSession({
            deviceMac,
            nasName,
            authToken,
          }),
        ]);

        if (session.success && session.voucher) {
          grantAccess(session.voucher);

          return;
        }

        setConfig(cfg.data ?? cfg);

        pkgs.sort((a, b) => a.price - b.price);

        setPackages(pkgs ?? []);
      } catch {
        setConfig(DEFAULT_CONFIG);

        setPackages([]);
      } finally {
        setLoading(false);

        loadingCompleted();
      }
    };

    init();
  }, [nasName, authToken, deviceMac]);

  const { displayMode } = config.portalSettings;

  const resolvedMode =
    displayMode === "packages_only" ? "packages" : displayMode === "vouchers_only" ? "voucher" : "both";

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div
          className="h-10 w-10 animate-spin rounded-full border-[3px]"
          style={{
            borderColor: `${config.branding.primaryColor}20`,
            borderTopColor: config.branding.primaryColor,
          }}
        />
      </div>
    );
  }

  return (
    <div className="cp-theme min-h-screen bg-background">
      {payState !== "idle" && (
        <PaymentOverlay
          state={payState}
          isVoucher={isVoucher}
          isFree={isFree}
          primaryColor={config.branding.primaryColor}
          language={config.language}
          onDismissFailure={handleDismissFailure}
        />
      )}

      <PortalHeader config={config} />

      <div className="relative z-10 mx-auto -mt-18 max-w-md px-4 pb-6">
        {config.portalSettings.welcomeMessage && config.active && (
          <p className="mb-7 text-center text-lg leading-relaxed text-white/80">
            {config.portalSettings.welcomeMessage}
          </p>
        )}

        {config.active ? (
          <>
            {resolvedMode === "both" ? (
              <Tabs defaultValue="packages">
                <TabsList className="h-14 w-full rounded-[24px] border border-[var(--border)] bg-[var(--card)] p-1 shadow-lg">
                  <TabsTrigger value="packages" className="flex-1 rounded-[18px] text-sm font-semibold">
                    <ShoppingCart className="mr-2 h-4 w-4" />
                    {labels[config.language]?.buyPackage}
                  </TabsTrigger>

                  <TabsTrigger value="voucher" className="flex-1 rounded-[18px] text-sm font-semibold">
                    <Ticket className="mr-2 h-4 w-4" />
                    {labels[config.language]?.haveVoucher}
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="packages" className="mt-4">
                  <PackageGrid
                    packages={packages}
                    primaryColor={config.branding.primaryColor}
                    currency={config.currency}
                    language={config.language}
                    onPay={handlePay}
                  />
                </TabsContent>

                <TabsContent value="voucher" className="mt-4">
                  <VoucherInput
                    primaryColor={config.branding.primaryColor}
                    loading={payState === "processing"}
                    language={config.language}
                    onRedeem={handleRedeem}
                  />
                </TabsContent>
              </Tabs>
            ) : resolvedMode === "packages" ? (
              <PackageGrid
                packages={packages}
                primaryColor={config.branding.primaryColor}
                currency={config.currency}
                language={config.language}
                onPay={handlePay}
              />
            ) : (
              <VoucherInput
                primaryColor={config.branding.primaryColor}
                loading={payState === "processing"}
                language={config.language}
                onRedeem={handleRedeem}
              />
            )}

            {config.portalSettings.termsUrl && (
              <div className="mt-4 flex items-center  gap-3 rounded-2xl px-4 py-4 text-center">
                <ShieldCheck className="h-5 w-5 shrink-0 text-emerald-600" />

                <p className="text-xs leading-relaxed text-foreground">
                  {labels[config.language]?.connecting}{" "}
                  <a
                    href={`/terms-and-conditions?${params.toString()}&ref=portal`}
                    className="font-semibold text-emerald-700"
                  >
                    {labels[config.language]?.terms}
                  </a>
                </p>
              </div>
            )}
          </>
        ) : (
          <OutOfServiceNotification config={config} />
        )}
      </div>

      {config.support.showOnPortal && <SupportInfo support={config.support} language={config.language} />}

      {config.portalSettings.showPoweredBy && (
        <p className="pb-6 text-center text-xs text-muted-foreground">
          {labels[config.language]?.poweredBy} <span className="font-medium text-blue-600">{appName}</span>
        </p>
      )}
    </div>
  );
}
