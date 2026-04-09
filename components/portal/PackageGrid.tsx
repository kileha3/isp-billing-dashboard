"use client";

import { useState } from "react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Package } from "@/lib/types";
import { Wifi, Clock, Database, Zap, ChevronUp } from "lucide-react";
import { formatData, formatDuration, formatSpeed } from "@/app/(admin)/dashboard/packages/page";

interface PackageGridProps {
  packages: Package[];
  primaryColor: string;
  currency: string;
  onPay: (params: { pkg: Package; phone: string }) => void;
}

const phoneSchema = z
  .string()
  .min(1, "Phone number is required")
  .regex(/^\+?[\d\s\-(]{10,15}$/, "Enter a valid phone number (e.g. 0712 345 678)");


export function PackageGrid({ packages, primaryColor, onPay, currency }: PackageGridProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [phone, setPhone] = useState("");

  const phoneResult = phoneSchema.safeParse(phone);
  const phoneError = phone.length > 0 && !phoneResult.success
    ? phoneResult.error.errors[0]?.message
    : "";
  const canPay = phoneResult.success;

  function handleSelect(pkg: Package) {
    if (selectedId === pkg._id) {
      setSelectedId(null);
      setPhone("");
    } else {
      setSelectedId(pkg._id);
      setPhone("");
    }
  }

  if (packages.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 py-12 text-center">
        <Wifi className="h-10 w-10 text-muted-foreground/40" />
        <p className="text-sm text-muted-foreground">No packages available on this network.</p>
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
                    {formatDuration(pkg.duration, pkg.durationUnit)}
                  </span>
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Database className="h-3 w-3" />
                    {formatData(pkg.dataLimit, pkg.dataLimitUnit)}
                  </span>
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Zap className="h-3 w-3" />
                    {formatSpeed(pkg.speedLimit)}
                  </span>
                </div>
              </div>

              <div className="flex flex-col items-end gap-2 shrink-0">
                <div
                  className="px-3 py-1.5 text-center"

                >
                  <p className="text-xl font-bold leading-none" style={{ color: primaryColor }}><span className="text-xs font-medium leading-none mb-0.5" style={{ color: primaryColor }}>{currency}</span> {pkg.price.toLocaleString()}</p>
                </div>
                <Button
                  size="sm"
                  onClick={() => handleSelect(pkg)}
                  className="h-8 px-4 text-xs font-semibold flex items-center gap-1"
                  style={
                    isOpen
                      ? { background: "var(--muted)", color: "var(--muted-foreground)" }
                      : { background: primaryColor, color: "#fff" }
                  }
                >
                  {isOpen ? <><ChevronUp className="h-3 w-3" />Close</> : "Select"}
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
                  Paying for: <span style={{ color: primaryColor }}>{pkg.name}</span>
                  <span className="text-muted-foreground font-normal"> - {currency} {pkg.price.toLocaleString()}</span>
                </p>

                {/* Phone input */}
                <div className="flex flex-col gap-1.5">
                  <Label className="text-xs font-medium">Phone Number</Label>
                  <Input
                    type="tel"
                    placeholder="0712 XXX XXX"
                    value={phone}
                    autoFocus
                    onChange={(e) => setPhone(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && canPay && onPay({ pkg, phone })}
                    className="h-10 focus-visible:outline-none focus-visible:ring-2"
                    style={{
                      borderColor: primaryColor,
                      boxShadow: `0 0 0 2px ${primaryColor}33`,
                    }}
                  />
                  {phoneError && <p className="text-xs text-destructive">{phoneError}</p>}
                </div>

                <Button
                  onClick={() => onPay({ pkg, phone })}
                  disabled={!canPay}
                  className="w-full h-11 font-semibold text-sm"
                  style={canPay ? { background: primaryColor, color: "#fff" } : { background: `${primaryColor}2a`, color: "#000" }}
                >
                  {`Pay Now ${currency} ${pkg.price.toLocaleString()}`}
                </Button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
