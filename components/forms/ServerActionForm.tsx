"use client";

import { useTransition, type ReactNode } from "react";
import { toast } from "sonner";
import { isRedirectError } from "@/lib/errors";

type ActionResult = { ok: boolean; message?: string };

export interface ServerActionFormProps {
  action: (formData: FormData) => Promise<ActionResult | void>;
  // Plain nodes work from Server Components. A render prop is also supported,
  // but only from Client Components — functions can't cross the RSC boundary.
  children: ReactNode | ((state: { isPending: boolean }) => ReactNode);
  onSuccess?: () => void;
  successMessage?: string;
  className?: string;
}

export function ServerActionForm({
  action,
  children,
  onSuccess,
  successMessage,
  className,
}: ServerActionFormProps) {
  const [isPending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      try {
        const result = await action(formData);
        if (result && !result.ok) {
          toast.error(result.message ?? "Something went wrong.");
          return;
        }
        if (successMessage) toast.success(successMessage);
        onSuccess?.();
      } catch (err) {
        if (isRedirectError(err)) {
          return;
        }
        toast.error(err instanceof Error ? err.message : "Something went wrong.");
      }
    });
  }

  return (
    <form action={handleSubmit} className={className}>
      {typeof children === "function" ? children({ isPending }) : children}
    </form>
  );
}
