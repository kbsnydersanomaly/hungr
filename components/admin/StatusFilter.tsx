"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface StatusFilterProps {
  options: { value: string; label: string }[];
  paramName?: string;
  placeholder?: string;
}

export function StatusFilter({ options, paramName = "status", placeholder = "Filter by status" }: StatusFilterProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const value = searchParams.get(paramName) ?? "";

  function onChange(next: string | null) {
    const params = new URLSearchParams(searchParams.toString());
    if (next) params.set(paramName, next);
    else params.delete(paramName);
    params.set("page", "1");
    router.push(`?${params.toString()}`, { scroll: false });
  }

  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-[160px]"><SelectValue placeholder={placeholder} /></SelectTrigger>
      <SelectContent>
        <SelectItem value="">All</SelectItem>
        {options.map((opt) => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}
