"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Ticket } from "lucide-react";

interface VoucherInputProps {
  primaryColor: string;
  loading: boolean;
  onRedeem: (voucher: string) => void;
}

export function VoucherInput({ primaryColor, onRedeem, loading }: VoucherInputProps) {
  const [code, setCode] = useState("");

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
        <Label className="text-xs font-medium">Voucher Code</Label>
        <Input
          placeholder="e.g. NB1234"
          value={code}
          onChange={(e) => { setCode(e.target.value.toUpperCase()); }}
          onKeyDown={(e) => e.key === "Enter" && onRedeem(code)}
          className="h-10 focus-visible:outline-none focus-visible:ring-2 text-center font-mono text-lg tracking-widest uppercase"
          style={{
            borderColor: primaryColor,
            boxShadow: `0 0 0 2px ${primaryColor}33`,
          }}
          maxLength={20}
        />
      </div>

      <Button
        onClick={() => onRedeem(code)}
        disabled={loading || !code.trim() || code.length < 6}
        className="w-full h-11 font-semibold text-sm"
        style={{ background: primaryColor, color: "white" }}
      >
        {loading ? "Checking…" : "Redeem Voucher"}
      </Button>
    </div>
  );
}
