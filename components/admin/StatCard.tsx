import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface StatCardProps {
  label: string;
  value: string | number;
  icon: LucideIcon;
  change?: string;
  changePositive?: boolean;
  hero?: boolean;
  className?: string;
}

export function StatCard({ label, value, icon: Icon, change, changePositive, hero, className }: StatCardProps) {
  return (
    <div
      className={cn(
        "rounded-xl border p-5 flex flex-col gap-3 relative overflow-hidden",
        hero
          ? "bg-primary border-primary text-primary-foreground"
          : "bg-card border-border text-card-foreground",
        className
      )}
    >
      <div className="flex items-center justify-between">
        <div
          className={cn(
            "flex h-9 w-9 items-center justify-center rounded-lg",
            hero ? "bg-primary-foreground/15" : "bg-primary/10"
          )}
        >
          <Icon className={cn("h-4 w-4", hero ? "text-primary-foreground" : "text-primary")} />
        </div>
        {change && (
          <span
            className={cn(
              "text-xs font-semibold px-2 py-0.5 rounded-full",
              hero
                ? "bg-primary-foreground/15 text-primary-foreground"
                : changePositive
                  ? "bg-[oklch(0.65_0.2_142)]/15 text-[oklch(0.42_0.18_142)]"
                  : "bg-destructive/10 text-destructive"
            )}
          >
            {change}
          </span>
        )}
      </div>
      <div className="flex flex-col gap-0.5">
        <span className={cn("text-xs font-medium uppercase tracking-wide", hero ? "text-primary-foreground/70" : "text-muted-foreground")}>
          {label}
        </span>
        <span className={cn("text-2xl font-bold tracking-tight", hero ? "text-primary-foreground" : "text-foreground")}>
          {value}
        </span>
      </div>
    </div>
  );
}
