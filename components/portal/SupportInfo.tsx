import { Phone, Mail, MessageCircle } from "lucide-react";
import type { TenantPortalSettings } from "@/lib/types";
import { labels } from "./CaptivePortalClient";

interface SupportInfoProps {
  support: TenantPortalSettings["support"];
  language: string;
  primaryColor: string;
}

export function SupportInfo({ support, primaryColor, language }: SupportInfoProps) {
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
