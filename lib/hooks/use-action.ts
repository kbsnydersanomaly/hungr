"use client";

import { useTransition, useCallback } from "react";
import { toast } from "sonner";
import type { ActionResult } from "@/lib/errors";

export type { ActionResult };

export function useAction<TArgs extends unknown[], TData>(
  action: (...args: TArgs) => Promise<ActionResult<TData>>,
  options?: {
    onSuccess?: (data: TData) => void;
    onError?: (message: string) => void;
    successMessage?: string;
  }
) {
  const [isPending, startTransition] = useTransition();

  const execute = useCallback(
    async (...args: TArgs): Promise<ActionResult<TData>> => {
      const result = await action(...args);
      if (!result.ok) {
        const msg = result.message || "Something went wrong.";
        if (options?.onError) {
          options.onError(msg);
        } else {
          toast.error(msg);
        }
      } else {
        if (options?.onSuccess && result.data !== undefined) {
          options.onSuccess(result.data);
        }
        if (options?.successMessage) {
          toast.success(options.successMessage);
        }
      }
      return result;
    },
    [action, options]
  );

  const run = useCallback(
    (...args: TArgs) => {
      startTransition(() => {
        execute(...args);
      });
    },
    [execute]
  );

  return { execute, run, isPending };
}
