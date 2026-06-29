import { Suspense } from "react";
import { CaptivePortalClient } from "@/components/portal/CaptivePortalClient";
import { LogRocketInit } from "../LogRocketInit";

export default function PayPage() {
  return (
    <div className="cp-theme min-h-screen">
      <Suspense fallback={<PortalSkeleton />}>
      <LogRocketInit />
        <CaptivePortalClient />
      </Suspense>
    </div>
  );
}

function PortalSkeleton() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div
        className="h-8 w-8 rounded-full border-2 animate-spin"
        style={{
          borderColor: "var(--muted)",
          borderTopColor: "var(--foreground)",
        }}
      />
    </div>
  );
}
