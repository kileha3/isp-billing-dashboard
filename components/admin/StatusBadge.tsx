import { cn } from "@/lib/utils";
import { CheckCircle2, Clock, XCircle, RefreshCw, WifiOff, MinusCircle, Languages, Globe, GlobeX, GlobeLock, Users, UserX } from "lucide-react";

interface StatusConfig {
  classes: string;
  icon?: React.ReactNode;
  label?: string;
}

const STATUS_MAP: Record<string, StatusConfig> = {
  active:       { classes: "bg-[oklch(0.65_0.2_142)]/12 text-[oklch(0.38_0.16_142)] border-[oklch(0.65_0.2_142)]/25", icon: <CheckCircle2 className="h-3 w-3" /> },
  online:       { classes: "bg-[oklch(0.65_0.2_142)]/12 text-[oklch(0.38_0.16_142)] border-[oklch(0.65_0.2_142)]/25", icon: <CheckCircle2 className="h-3 w-3" /> },
  connected:    { classes: "bg-[oklch(0.65_0.2_142)]/12 text-[oklch(0.38_0.16_142)] border-[oklch(0.65_0.2_142)]/25", icon: <CheckCircle2 className="h-3 w-3" /> },
  paid:         { classes: "bg-[oklch(0.65_0.2_142)]/12 text-[oklch(0.38_0.16_142)] border-[oklch(0.65_0.2_142)]/25", icon: <CheckCircle2 className="h-3 w-3" />, label: "Completed" },
  success:      { classes: "bg-[oklch(0.65_0.2_142)]/12 text-[oklch(0.38_0.16_142)] border-[oklch(0.65_0.2_142)]/25", icon: <CheckCircle2 className="h-3 w-3" /> },
  unused:       { classes: "bg-muted text-muted-foreground border-border", icon: <CheckCircle2 className="h-3 w-3" /> },
  pending:      { classes: "bg-[oklch(0.78_0.17_75)]/12 text-[oklch(0.52_0.17_60)] border-[oklch(0.78_0.17_75)]/30", icon: <Clock className="h-3 w-3" /> },
  used:     { classes: "bg-primary/10 text-primary border-primary/20", icon: <CheckCircle2 className="h-3 w-3" /> },
  offline:      { classes: "bg-destructive/10 text-destructive border-destructive/20", icon: <WifiOff className="h-3 w-3" /> },
  suspended:    { classes: "bg-destructive/10 text-destructive border-destructive/20", icon: <XCircle className="h-3 w-3" /> },
  failed:       { classes: "bg-destructive/10 text-destructive border-destructive/20", icon: <XCircle className="h-3 w-3" /> },
  expired:      { classes: "bg-destructive/10 text-destructive border-destructive/20", icon: <XCircle className="h-3 w-3" /> },
  inactive:     { classes: "bg-muted text-muted-foreground border-border", icon: <MinusCircle className="h-3 w-3" /> },
  disconnected: { classes: "bg-muted text-muted-foreground border-border", icon: <MinusCircle className="h-3 w-3" /> },
  "in progress": { classes: "bg-primary/10 text-primary border-primary/20", icon: <RefreshCw className="h-3 w-3" /> },
  private: { classes: "bg-[oklch(0.78_0.17_75)]/12 text-[oklch(0.52_0.17_60)] border-[oklch(0.78_0.17_75)]/30", icon: <GlobeLock className="h-3 w-3" /> },
  public: { classes: "bg-primary/10 text-primary border-primary/20", icon: <Globe className="h-3 w-3" /> },
  free: { classes: "bg-[oklch(0.65_0.2_142)]/12 text-[oklch(0.38_0.16_142)] border-[oklch(0.65_0.2_142)]/25", icon: <Users className="h-3 w-3" /> },
  payment: { classes: "bg-primary/10 text-primary border-primary/20", icon: <UserX className="h-3 w-3" /> },
};

interface StatusBadgeProps {
  status: string;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const key = status.toLowerCase();
  const config = STATUS_MAP[key] ?? { classes: "bg-muted text-muted-foreground border-border" };
  const displayLabel = config.label ?? status;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold capitalize",
        config.classes,
        className
      )}
    >
      {config.icon}
      {displayLabel}
    </span>
  );
}
