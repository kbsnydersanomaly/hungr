"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search } from "lucide-react";

// "all" is a UI-only sentinel — it clears the status param so the server
// returns every transaction.
const STATUS_ITEMS = [
  { value: "all", label: "All statuses" },
  { value: "COMPLETE", label: "Completed" },
  { value: "FAILED", label: "Failed" },
  { value: "PENDING", label: "Pending" },
  { value: "CANCELLED", label: "Cancelled" },
];

/**
 * Filter bar for the billing transaction history. Writes filters into the
 * URL search params so the (server-rendered) table refetches.
 */
export function TransactionFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [q, setQ] = useState(searchParams.get("q") ?? "");

  function apply(changes: Record<string, string>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(changes)) {
      if (value) params.set(key, value);
      else params.delete(key);
    }
    params.delete("page"); // filters reset pagination
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  // Debounce free-text search.
  useEffect(() => {
    const current = searchParams.get("q") ?? "";
    if (q === current) return;
    const t = setTimeout(() => apply({ q }), 400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative min-w-44 flex-1">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search payment ID…"
          className="pl-8"
        />
      </div>
      <Select
        items={STATUS_ITEMS}
        value={searchParams.get("status") ?? "all"}
        onValueChange={(v) => apply({ status: v && v !== "all" ? v : "" })}
      >
        <SelectTrigger className="w-36">
          <SelectValue placeholder="All statuses" />
        </SelectTrigger>
        <SelectContent>
          {STATUS_ITEMS.map((s) => (
            <SelectItem key={s.value} value={s.value}>
              {s.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Input
        type="date"
        value={searchParams.get("from") ?? ""}
        onChange={(e) => apply({ from: e.target.value })}
        className="w-36"
        aria-label="From date"
      />
      <span className="text-xs text-muted-foreground">to</span>
      <Input
        type="date"
        value={searchParams.get("to") ?? ""}
        onChange={(e) => apply({ to: e.target.value })}
        className="w-36"
        aria-label="To date"
      />
    </div>
  );
}
