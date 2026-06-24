"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const PROVINCES = [
  "Eastern Cape",
  "Free State",
  "Gauteng",
  "KwaZulu-Natal",
  "Limpopo",
  "Mpumalanga",
  "Northern Cape",
  "North West",
  "Western Cape",
];

interface ProvinceSelectProps {
  name?: string;
  defaultValue?: string;
  required?: boolean;
  disabled?: boolean;
}

export function ProvinceSelect({
  name = "province",
  defaultValue,
  required,
  disabled,
}: ProvinceSelectProps) {
  return (
    <Select name={name} defaultValue={defaultValue} required={required} disabled={disabled}>
      <SelectTrigger className="w-full">
        <SelectValue placeholder="Select province" />
      </SelectTrigger>
      <SelectContent>
        {PROVINCES.map((province) => (
          <SelectItem key={province} value={province}>
            {province}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
