"use client";

import { use } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
// Re-use the portal customization component but scoped to a specific tenant
import PortalCustomizationPage from "@/app/(admin)/dashboard/portal/page";

export default function TenantPortalPage({ params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = use(params);
  const router = useRouter();

  return (
    <div className="flex flex-col gap-4">
      <Button variant="ghost" size="sm" className="w-fit -ml-2" onClick={() => router.push("/dashboard/tenants")}>
        <ArrowLeft className="h-4 w-4 mr-1.5" />
        Back to Tenants
      </Button>
      <PortalCustomizationPage tenantId={tenantId} />
    </div>
  );
}
