"use client";

import { useRef, useTransition, useState } from "react";
import { toast } from "sonner";
import { Loader2, Plus, Check, X } from "lucide-react";
import { upsertCategory } from "@/lib/data/menu-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface AddCategoryFormProps {
  menuId: string;
  /** When set, the new category is created as a sub-category of this parent. */
  parentId?: string;
  /** Toggle-button style for inline use (e.g. inside a category card). */
  inline?: boolean;
  placeholder?: string;
  /** Label for the inline trigger button. */
  buttonLabel?: string;
}

export function AddCategoryForm({
  menuId,
  parentId,
  inline = false,
  placeholder = "Category name",
  buttonLabel,
}: AddCategoryFormProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      const result = await upsertCategory(menuId, formData);
      if (!result.ok) {
        toast.error(result.message ?? "Failed to save category.");
        return;
      }
      toast.success(parentId ? "Sub-category added." : "Category added.");
      formRef.current?.reset();
      if (inline) setOpen(false);
    });
  }

  if (inline && !open) {
    return (
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="w-full justify-start text-muted-foreground"
        onClick={() => setOpen(true)}
      >
        <Plus className="h-4 w-4 mr-2" />
        {buttonLabel ?? "Add sub-category"}
      </Button>
    );
  }

  return (
    <form ref={formRef} action={handleSubmit} className="flex gap-2">
      {parentId && <input type="hidden" name="parent_id" value={parentId} />}
      <Input
        name="name"
        placeholder={placeholder}
        required
        className="flex-1"
        autoFocus={inline}
        disabled={isPending}
      />
      <Button type="submit" size="icon" disabled={isPending}>
        {isPending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : inline ? (
          <Check className="h-4 w-4" />
        ) : (
          <Plus className="h-4 w-4" />
        )}
      </Button>
      {inline && (
        <Button
          type="button"
          size="icon"
          variant="ghost"
          onClick={() => setOpen(false)}
          disabled={isPending}
        >
          <X className="h-4 w-4" />
        </Button>
      )}
    </form>
  );
}
