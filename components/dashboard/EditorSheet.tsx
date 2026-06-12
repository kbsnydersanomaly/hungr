"use client";

import * as React from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetTrigger,
} from "@/components/ui/sheet";

interface EditorSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Optional element rendered as the sheet trigger. */
  trigger?: React.ReactElement;
  title: string;
  description?: string;
  children: React.ReactNode;
}

/**
 * Shared wide offcanvas panel for add/edit forms (menu items, specials, ...)
 * so every editor in the dashboard looks and behaves the same.
 */
export function EditorSheet({
  open,
  onOpenChange,
  trigger,
  title,
  description,
  children,
}: EditorSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      {trigger && <SheetTrigger render={trigger} />}
      <SheetContent
        side="right"
        className="w-full sm:w-[60vw] data-[side=right]:sm:max-w-[60vw] overflow-y-auto"
      >
        <SheetHeader>
          <SheetTitle>{title}</SheetTitle>
          {description && <SheetDescription>{description}</SheetDescription>}
        </SheetHeader>
        <div className="px-4 pb-6 sm:px-6">{children}</div>
      </SheetContent>
    </Sheet>
  );
}
