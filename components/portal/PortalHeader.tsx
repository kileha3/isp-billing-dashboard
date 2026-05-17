import { Wifi } from "lucide-react";
import type { TenantPortalSettings } from "@/lib/types";
import { imageUrl } from "@/lib/api";
import { appName } from "@/lib/utils";

interface PortalHeaderProps {
  config: TenantPortalSettings;
  connectionLabel: string;
}

export function PortalHeader({ config, connectionLabel }: PortalHeaderProps) {
  const { primaryColor, secondaryColor, logo, businessName } = config.branding;


  return (
    <header
      className="w-full px-6 py-5 flex items-center gap-4 text-white"
      style={{
        background: `linear-gradient(135deg, ${primaryColor}, ${secondaryColor})`
      }}
    >
      {/* Logo */}
      <div className={`flex h-${logo && logo.length > 9 ? "13" : "12"} w-${logo && logo.length > 9 ? "13" : "12"} items-center justify-center rounded-${logo && logo.length > 9 ? "3xl" : "xl"} bg-white/20 shrink-0 overflow-hidden`}>
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
