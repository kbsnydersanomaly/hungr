"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";
import { sanitizePhoneInput } from "@/lib/utils/phone";

type PhoneInputProps = Omit<
  React.ComponentProps<typeof Input>,
  "type" | "inputMode" | "autoComplete"
>;

export function PhoneInput({ onChange, onInput, ...props }: PhoneInputProps) {
  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const sanitized = sanitizePhoneInput(e.target.value);
    if (sanitized !== e.target.value) {
      e.target.value = sanitized;
    }
    onChange?.(e);
  }

  function handleInput(e: React.InputEvent<HTMLInputElement>) {
    const input = e.currentTarget;
    const sanitized = sanitizePhoneInput(input.value);
    if (sanitized !== input.value) {
      input.value = sanitized;
    }
    onInput?.(e);
  }

  return (
    <Input
      type="tel"
      inputMode="tel"
      autoComplete="tel"
      onChange={handleChange}
      onInput={handleInput}
      {...props}
    />
  );
}
