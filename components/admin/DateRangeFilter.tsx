"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Input } from "@/components/ui/input";

export function DateRangeFilter() {
  const router = useRouter();
  const searchParams = useSearchParams();

  function setDate(key: "from" | "to", value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    params.set("page", "1");
    router.push(`?${params.toString()}`, { scroll: false });
  }

  return (
    <div className="flex items-center gap-2">
      <Input type="date" className="w-auto" value={searchParams.get("from") ?? ""} onChange={(e) => setDate("from", e.target.value)} />
      <span className="text-sm text-muted-foreground">to</span>
      <Input type="date" className="w-auto" value={searchParams.get("to") ?? ""} onChange={(e) => setDate("to", e.target.value)} />
    </div>
  );
}
