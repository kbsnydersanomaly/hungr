"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { renameMenu } from "@/lib/data/menu-actions";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Pencil, Check, X, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface MenuNameEditorProps {
  menuId: string;
  name: string;
  /** Classes applied to the displayed name text. */
  className?: string;
}

/**
 * Inline click-to-edit menu name. Enter submits, Escape cancels.
 * Only the display name is editable — the slug (used in public URLs and QR
 * codes) is never changed by a rename.
 */
export function MenuNameEditor({ menuId, name, className }: MenuNameEditorProps) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [value, setValue] = useState(name);

  async function handleSave() {
    const trimmed = value.trim();
    if (!trimmed || trimmed === name) {
      setValue(name);
      setEditing(false);
      return;
    }

    setSaving(true);
    const result = await renameMenu(menuId, trimmed);
    setSaving(false);

    if (!result.ok) {
      toast.error(result.message ?? "Failed to rename menu.");
      return;
    }

    toast.success("Menu renamed.");
    setEditing(false);
    router.refresh();
  }

  function handleCancel() {
    setValue(name);
    setEditing(false);
  }

  if (editing) {
    return (
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSave();
        }}
        className="flex items-center gap-2"
      >
        <Input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") handleCancel();
          }}
          maxLength={80}
          autoFocus
          disabled={saving}
          aria-label="Menu name"
          className="h-8 text-sm max-w-xs"
        />
        <Button
          type="submit"
          size="icon"
          variant="ghost"
          className="h-8 w-8"
          disabled={saving}
          aria-label="Save name"
        >
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Check className="h-4 w-4" />
          )}
        </Button>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="h-8 w-8"
          disabled={saving}
          onClick={handleCancel}
          aria-label="Cancel"
        >
          <X className="h-4 w-4" />
        </Button>
      </form>
    );
  }

  return (
    <span className="group inline-flex items-center gap-1.5 min-w-0 max-w-full">
      <span className={cn("truncate", className)}>{name}</span>
      <button
        type="button"
        onClick={() => {
          setValue(name);
          setEditing(true);
        }}
        aria-label="Rename menu"
        className="shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 focus:opacity-100"
      >
        <Pencil className="h-3.5 w-3.5" />
      </button>
    </span>
  );
}
