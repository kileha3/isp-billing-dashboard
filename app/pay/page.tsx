import { Suspense } from "react";
import { CaptivePortalClient } from "@/components/portal/CaptivePortalClient";

export default function PayPage() {
  return (
    <Suspense fallback={<PortalSkeleton />}>
      <CaptivePortalClient />
    </Suspense>
  );
}

function PortalSkeleton() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
    </div>
  );
}
