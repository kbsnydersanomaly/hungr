"use client";

import { useRef, useTransition } from "react";
import { toast } from "sonner";
import { Loader2, Plus } from "lucide-react";
import { upsertCategory } from "@/lib/data/menu-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface AddCategoryFormProps {
  menuId: string;
}

export function AddCategoryForm({ menuId }: AddCategoryFormProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      const result = await upsertCategory(menuId, formData);
      if (!result.ok) {
        toast.error(result.message ?? "Failed to save category.");
        return;
      }
      toast.success("Category added.");
      formRef.current?.reset();
    });
  }

  return (
    <form
      ref={formRef}
      action={handleSubmit}
      className="flex gap-2"
    >
      <Input
        name="name"
        placeholder="Category name"
        required
        className="flex-1"
        disabled={isPending}
      />
      <Button type="submit" size="icon" disabled={isPending}>
        {isPending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Plus className="h-4 w-4" />
        )}
      </Button>
    </form>
  );
}
