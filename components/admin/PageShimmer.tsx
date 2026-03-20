import { cn } from "@/lib/utils";

function Shimmer({ className }: { className?: string }) {
  return (
    <div className={cn("animate-pulse rounded-md bg-muted", className)} />
  );
}

/** Shimmer placeholder for a stat-card row (3 cards). */
export function StatCardShimmer({ count = 3 }: { count?: number }) {
  return (
    <div className={`grid gap-4`} style={{ gridTemplateColumns: `repeat(${count}, minmax(0,1fr))` }}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="rounded-xl border border-border bg-card p-5 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <Shimmer className="h-4 w-28" />
            <Shimmer className="h-8 w-8 rounded-lg" />
          </div>
          <Shimmer className="h-8 w-24" />
          <Shimmer className="h-3 w-20" />
        </div>
      ))}
    </div>
  );
}

/** Shimmer placeholder for a full list/table card. */
export function TableShimmer({ rows = 5, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      {/* Filter bar shimmer */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
        <Shimmer className="h-10 flex-1" />
        <Shimmer className="h-10 w-40" />
      </div>
      {/* Header row */}
      <div className="flex items-center gap-4 px-5 py-3 border-b border-border">
        {Array.from({ length: cols }).map((_, i) => (
          <Shimmer key={i} className={`h-3 ${i === 0 ? "w-24" : i === cols - 1 ? "w-16 ml-auto" : "w-20"}`} />
        ))}
      </div>
      {/* Data rows */}
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 px-5 py-4 border-b border-border/60 last:border-0">
          {Array.from({ length: cols }).map((_, j) => (
            <Shimmer
              key={j}
              className={`h-4 ${j === 0 ? "w-32" : j === cols - 1 ? "w-8 ml-auto rounded-full" : j % 2 === 0 ? "w-24" : "w-16"}`}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

/** Shimmer placeholder for the dashboard page layout. */
export function DashboardShimmer() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <Shimmer className="h-7 w-36" />
      </div>
      <StatCardShimmer count={3} />
      <div className="grid grid-cols-2 gap-6">
        <div className="rounded-xl border border-border bg-card p-5 flex flex-col gap-4">
          <Shimmer className="h-5 w-40" />
          <Shimmer className="h-48 w-full" />
        </div>
        <div className="rounded-xl border border-border bg-card p-5 flex flex-col gap-4">
          <Shimmer className="h-5 w-40" />
          <Shimmer className="h-48 w-full" />
        </div>
      </div>
    </div>
  );
}

/** Generic page shimmer: header + optional stat cards + table. */
export function PageShimmer({
  title = true,
  statCards = 0,
  tableRows = 8,
  tableCols = 5,
}: {
  title?: boolean;
  statCards?: number;
  tableRows?: number;
  tableCols?: number;
}) {
  return (
    <div className="flex flex-col gap-6">
      {title && (
        <div className="flex items-center justify-between">
          <div className="flex flex-col gap-2">
            <Shimmer className="h-7 w-40" />
            <Shimmer className="h-4 w-56" />
          </div>
          <Shimmer className="h-9 w-28 rounded-md" />
        </div>
      )}
      {statCards > 0 && <StatCardShimmer count={statCards} />}
      <TableShimmer rows={tableRows} cols={tableCols} />
    </div>
  );
}
