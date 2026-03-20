"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiClient } from "@/lib/api";
import { Ticket } from "lucide-react";

interface VoucherInputProps {
  routerId: string;
  mac: string;
  primaryColor: string;
  onSuccess: (message: string) => void;
}

export function VoucherInput({ routerId, mac, primaryColor, onSuccess }: VoucherInputProps) {
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleRedeem() {
    const trimmed = code.trim().toUpperCase();
    if (!trimmed) {
      setError("Please enter a voucher code.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const data = await apiClient.portal.redeemVoucher({ code: trimmed, routerId, mac });
      const pkg = data.package;
      onSuccess(
        pkg
          ? `Voucher redeemed! You now have access for ${pkg.name}. Enjoy browsing!`
          : "Voucher redeemed! You are now connected."
      );
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Invalid or expired voucher code.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col items-center gap-2 py-2">
        <div className="flex h-12 w-12 items-center justify-center rounded-full" style={{ background: `${primaryColor}15` }}>
          <Ticket className="h-6 w-6" style={{ color: primaryColor }} />
        </div>
        <p className="text-sm font-medium text-foreground">Enter your voucher code</p>
        <p className="text-xs text-muted-foreground text-center">Scratched from a card or provided by your ISP</p>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label>Voucher Code</Label>
        <Input
          placeholder="e.g. NB-ABC123"
          value={code}
          onChange={(e) => { setCode(e.target.value.toUpperCase()); setError(""); }}
          onKeyDown={(e) => e.key === "Enter" && handleRedeem()}
          className="text-center font-mono text-lg tracking-widest uppercase"
          maxLength={20}
        />
      </div>

      {error && (
        <div className="rounded-lg bg-destructive/10 border border-destructive/20 px-3 py-2">
          <p className="text-xs text-destructive-foreground">{error}</p>
        </div>
      )}

      <Button
        onClick={handleRedeem}
        disabled={loading || !code.trim()}
        className="w-full font-semibold"
        style={{ background: primaryColor, color: "white" }}
      >
        {loading ? "Checking…" : "Redeem Voucher"}
      </Button>
    </div>
  );
}
