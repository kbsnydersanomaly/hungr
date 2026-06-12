"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

interface FormFieldProps extends React.InputHTMLAttributes<HTMLInputElement | HTMLTextAreaElement> {
  label: string;
  error?: string;
  hint?: string;
  as?: "input" | "textarea" | "select";
  children?: React.ReactNode;
}

export function FormField({
  label,
  error,
  hint,
  as = "input",
  className,
  children,
  id,
  ...props
}: FormFieldProps) {
  const inputId = id ?? props.name;
  const hasError = Boolean(error);

  const inputProps = {
    id: inputId,
    name: props.name,
    className: cn(hasError && "border-destructive focus-visible:ring-destructive/20"),
    "aria-invalid": hasError,
    ...props,
  };

  return (
    <div className={cn("space-y-2", className)}>
      <Label htmlFor={inputId} className={cn(hasError && "text-destructive")}>
        {label}
      </Label>
      {as === "textarea" ? (
        <Textarea {...(inputProps as React.TextareaHTMLAttributes<HTMLTextAreaElement>)} />
      ) : as === "select" ? (
        <div className="relative">
          <select
            {...(inputProps as React.SelectHTMLAttributes<HTMLSelectElement>)}
            className={cn(
              "flex h-9 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
              inputProps.className
            )}
          >
            {children}
          </select>
        </div>
      ) : (
        <Input {...(inputProps as React.InputHTMLAttributes<HTMLInputElement>)} />
      )}
      {hint && !hasError && <p className="text-xs text-muted-foreground">{hint}</p>}
      {hasError && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
