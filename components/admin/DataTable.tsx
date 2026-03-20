"use client";

import { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";
import { cn } from "@/lib/utils";

export interface Column<T> {
  key: keyof T | string;
  label: string;
  render?: (value: unknown, row: T) => React.ReactNode;
  className?: string;
}

interface DataTableProps<T> {
  data: T[];
  columns: Column<T>[];
  searchable?: boolean;
  searchKeys?: (keyof T)[];
  actions?: (row: T) => React.ReactNode;
  loading?: boolean;
  emptyMessage?: string;
  pageSize?: number;
  /** Optional slot rendered inline with the search bar (e.g. filter dropdowns, action buttons) */
  filterSlot?: React.ReactNode;
  /** Placeholder suffix for the search input, e.g. "tenants" → "Search tenants…" */
  searchPlaceholder?: string;
}

export function DataTable<T extends Record<string, unknown>>({
  data,
  columns,
  searchable = true,
  searchKeys = [],
  actions,
  loading = false,
  emptyMessage = "No records found.",
  pageSize = 10,
  filterSlot,
  searchPlaceholder,
}: DataTableProps<T>) {
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);

  const filtered = searchable && query
    ? data.filter((row) =>
        searchKeys.some((key) =>
          String(row[key] ?? "").toLowerCase().includes(query.toLowerCase())
        )
      )
    : data;

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePageSize = pageSize;
  const paginated = filtered.slice((page - 1) * safePageSize, page * safePageSize);

  function getCellValue(row: T, key: string): unknown {
    return key.split(".").reduce((obj: unknown, k) => {
      if (obj && typeof obj === "object") return (obj as Record<string, unknown>)[k];
      return undefined;
    }, row);
  }

  const pageNumbers: number[] = [];
  const delta = 1;
  for (let i = Math.max(1, page - delta); i <= Math.min(totalPages, page + delta); i++) {
    pageNumbers.push(i);
  }

  return (
    <div className="flex flex-col gap-0">
      {/* Filter bar — search full-width left, filters/actions right */}
      {(searchable || filterSlot) && (
        <div className="flex items-center gap-3 px-4 py-3 bg-card border border-border rounded-t-xl border-b-0">
          {searchable && (
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              <Input
                placeholder={`Search${searchPlaceholder ? " " + searchPlaceholder : ""}…`}
                value={query}
                onChange={(e) => { setQuery(e.target.value); setPage(1); }}
                className="pl-9 h-10 bg-background border-border"
              />
            </div>
          )}
          {filterSlot && (
            <div className="flex items-center gap-2 shrink-0">
              {filterSlot}
            </div>
          )}
        </div>
      )}

      {/* Table */}
      <div className={cn(
        "bg-card border border-border overflow-hidden",
        (searchable || filterSlot) ? "rounded-b-xl" : "rounded-xl"
      )}>
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent border-b border-border">
              {columns.map((col) => (
                <TableHead
                  key={String(col.key)}
                  className={cn("text-xs font-semibold text-muted-foreground uppercase tracking-wide h-11 px-5", col.className)}
                >
                  {col.label}
                </TableHead>
              ))}
              {actions && (
                <TableHead className="text-xs font-semibold text-muted-foreground uppercase tracking-wide h-11 px-5 text-right">
                  Actions
                </TableHead>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: pageSize }).map((_, i) => (
                <TableRow key={i} className="border-b border-border/60">
                  {columns.map((col, j) => (
                    <TableCell key={String(col.key)} className="px-5 py-4">
                      <div
                        className="h-4 bg-muted animate-pulse rounded"
                        style={{ width: j === 0 ? "60%" : j % 3 === 0 ? "40%" : "55%", animationDelay: `${i * 60}ms` }}
                      />
                    </TableCell>
                  ))}
                  {actions && (
                    <TableCell className="px-5 py-4">
                      <div className="h-6 w-6 bg-muted animate-pulse rounded ml-auto" style={{ animationDelay: `${i * 60}ms` }} />
                    </TableCell>
                  )}
                </TableRow>
              ))
            ) : paginated.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={columns.length + (actions ? 1 : 0)}
                  className="text-center text-muted-foreground py-14 text-sm"
                >
                  {emptyMessage}
                </TableCell>
              </TableRow>
            ) : (
              paginated.map((row, i) => (
                <TableRow
                  key={i}
                  className="border-b border-border/60 last:border-0 hover:bg-muted/30 transition-colors"
                >
                  {columns.map((col) => {
                    const val = getCellValue(row, String(col.key));
                    return (
                      <TableCell key={String(col.key)} className={cn("px-5 py-4 text-sm", col.className)}>
                        {col.render ? col.render(val, row) : String(val ?? "—")}
                      </TableCell>
                    );
                  })}
                  {actions && (
                    <TableCell className="px-5 py-4 text-right">
                      {actions(row)}
                    </TableCell>
                  )}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-border">
            <span className="text-sm text-muted-foreground">
              Page {page} of {totalPages}
            </span>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={() => setPage(1)}
                disabled={page === 1}
              >
                <ChevronsLeft className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </Button>
              {pageNumbers.map((n) => (
                <Button
                  key={n}
                  variant={n === page ? "default" : "outline"}
                  size="icon"
                  className="h-8 w-8 text-sm"
                  onClick={() => setPage(n)}
                >
                  {n}
                </Button>
              ))}
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={() => setPage(totalPages)}
                disabled={page === totalPages}
              >
                <ChevronsRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
