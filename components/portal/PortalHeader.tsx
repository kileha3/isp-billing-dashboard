import { Wifi } from "lucide-react";
import type { TenantPortalSettings } from "@/lib/types";
import { BASE } from "@/lib/api";

interface PortalHeaderProps {
  config: TenantPortalSettings;
}

export function PortalHeader({ config }: PortalHeaderProps) {
  const { primaryColor, secondaryColor, logo, businessName } = config.branding;

  const logoUrl = `${BASE.replace("v1",`logos/${logo}`)}`;

  return (
    <header
      className="w-full px-6 py-5 flex items-center gap-4"
      style={{ background: `linear-gradient(135deg, ${primaryColor}, ${secondaryColor})` }}
    >
      {/* Logo */}
      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/20 shrink-0 overflow-hidden">
        {logo && logo.length > 9 ? (
          <img src={logoUrl} alt={businessName} className="h-10 w-10 object-contain" />
        ) : (
          <Wifi className="h-6 w-6 text-white" />
        )}
      </div>

      <div>
        <h1 className="text-lg font-bold text-white leading-tight">{businessName || "WiFi Portal"}</h1>
        <p className="text-sm text-white/70">Connect to the internet</p>
      </div>
    </header>
  );
}
