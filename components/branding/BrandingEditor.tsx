"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MediaPicker } from "@/components/dashboard/MediaPicker";
import { MultiImagePicker } from "@/components/dashboard/MultiImagePicker";
import {
  saveDraftAction,
  publishAction,
  discardAction,
} from "@/lib/data/branding-actions";
import { brandingToCssVars, brandingFontFamilies } from "@/lib/theme/cssVars";
import { GOOGLE_FONT_OPTIONS } from "@/lib/theme/fonts";
import {
  BRANDING_PREVIEW_MESSAGE,
  BRANDING_PREVIEW_READY_MESSAGE,
} from "./BrandingPreviewBridge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Check, Loader2, Undo2, Redo2 } from "lucide-react";
import { toast } from "sonner";

type BrandingJsonField = Record<string, string> | null;

interface BrandingData {
  primary_color?: string | null;
  secondary_color?: string | null;
  accent_color?: string | null;
  nav_bar_color?: string | null;
  background_color?: string | null;
  logo_media_id?: string | null;
  logo_url?: string | null;
  banner_image_urls?: string[];
  primary_button?: BrandingJsonField;
  secondary_button?: BrandingJsonField;
  main_heading?: BrandingJsonField;
  sub_heading?: BrandingJsonField;
  body?: BrandingJsonField;
}

interface BrandingEditorProps {
  restaurantId: string;
  restaurantSlug: string;
  live: BrandingData | null;
  draft: BrandingData | null;
  children?: React.ReactNode;
}

type Page = "menu" | "about";

// One step in the undo/redo stack. `key` identifies which field changed so
// consecutive edits to the same field can be coalesced into a single step.
interface HistoryEntry {
  state: BrandingData;
  key: string;
}

// The public menu is always phone-width, so the preview is too.
const PREVIEW_WIDTH = "375px";

interface ColorRole {
  key: keyof BrandingData | "heading_color" | "body_color";
  label: string;
  description: string;
  fallback: string;
}

// Color roles, grouped by where they appear in the editor.
const NAV_COLOR_ROLES: ColorRole[] = [
  {
    key: "nav_bar_color",
    label: "Nav bar",
    description: "Top header bar behind your logo and name",
    fallback: "#FFFFFF",
  },
];

const GENERAL_COLOR_ROLES: ColorRole[] = [
  {
    key: "background_color",
    label: "Background",
    description: "Page background behind the whole menu",
    fallback: "#FFFFFF",
  },
  {
    key: "primary_color",
    label: "Primary",
    description: "Buttons, prices, active nav and key accents",
    fallback: "#FE1B54",
  },
  {
    key: "secondary_color",
    label: "Secondary",
    description: "Labels and badges (e.g. vegan, spicy)",
    fallback: "#16D3D2",
  },
  {
    key: "accent_color",
    label: "Accent",
    description: "Decorative highlights and illustrations",
    fallback: "#3CE1AF",
  },
];

const TYPOGRAPHY_COLOR_ROLES: ColorRole[] = [
  {
    key: "heading_color",
    label: "Heading color",
    description: "Item names, category and section headings",
    fallback: "#181818",
  },
  {
    key: "body_color",
    label: "Body text color",
    description: "Descriptions and general text",
    fallback: "#181818",
  },
];

const FONT_ITEMS = GOOGLE_FONT_OPTIONS.map((f) => ({ value: f, label: f }));

function isValidHex(value: string): boolean {
  return /^#[0-9a-fA-F]{6}$/.test(value);
}

export function BrandingEditor({
  restaurantId,
  restaurantSlug,
  live,
  draft,
  children,
}: BrandingEditorProps) {
  const [page, setPage] = useState<Page>("menu");
  const [draftState, setDraftState] = useState<BrandingData>(
    draft ?? live ?? {}
  );
  // Serialized snapshot of the last successfully persisted draft. `dirty` is
  // derived by comparing the current state against it, so edits made while a
  // save is in flight are never falsely marked as saved.
  const [savedSnapshot, setSavedSnapshot] = useState<string>(
    JSON.stringify(draft ?? live ?? {})
  );
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [discarding, setDiscarding] = useState(false);
  const [confirmResetOpen, setConfirmResetOpen] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Undo/redo history. Each user edit pushes a snapshot; consecutive edits to
  // the same field coalesce into one step so typing a colour is a single undo.
  const [history, setHistory] = useState<HistoryEntry[]>([
    { state: draft ?? live ?? {}, key: "__init__" },
  ]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const canUndo = historyIndex > 0;
  const canRedo = historyIndex < history.length - 1;

  const serializedDraft = JSON.stringify(draftState);
  const dirty = serializedDraft !== savedSnapshot;

  // Push the current draft styles into the preview iframe.
  const postPreview = useCallback(
    (state: BrandingData) => {
      const target = iframeRef.current?.contentWindow;
      if (!target) return;
      target.postMessage(
        {
          type: BRANDING_PREVIEW_MESSAGE,
          vars: brandingToCssVars(state as Record<string, unknown>),
          fonts: brandingFontFamilies(state as Record<string, unknown>),
        },
        window.location.origin
      );
    },
    []
  );

  // Live-update the preview whenever the draft changes.
  useEffect(() => {
    postPreview(draftState);
  }, [draftState, postPreview]);

  // The iframe announces readiness after hydration; reply with the current
  // draft styles (the iframe's `load` event can fire before its listener
  // is attached, so this handshake avoids losing the first update).
  const draftStateRef = useRef(draftState);
  useEffect(() => {
    draftStateRef.current = draftState;
  }, [draftState]);
  useEffect(() => {
    function handleReady(event: MessageEvent) {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type !== BRANDING_PREVIEW_READY_MESSAGE) return;
      postPreview(draftStateRef.current);
    }
    window.addEventListener("message", handleReady);
    return () => window.removeEventListener("message", handleReady);
  }, [postPreview]);

  const handleSave = useCallback(async () => {
    if (!dirty) return;
    // Capture exactly what we're persisting so we only mark this snapshot as
    // saved — any edits that land during the await stay dirty.
    const snapshot = serializedDraft;
    setSaving(true);
    try {
      const result = await saveDraftAction(
        restaurantId,
        draftState as Record<string, unknown>
      );
      if (result && !result.ok) {
        toast.error(result.message ?? "Failed to save draft");
        return;
      }
      setSavedSnapshot(snapshot);
      toast.success("Draft saved");
    } catch {
      toast.error("Failed to save draft");
    } finally {
      setSaving(false);
    }
  }, [dirty, serializedDraft, draftState, restaurantId]);

  // Debounced autosave
  useEffect(() => {
    if (!dirty) return;
    const t = setTimeout(() => {
      handleSave();
    }, 800);
    return () => clearTimeout(t);
  }, [dirty, handleSave]);

  const handlePublish = async () => {
    setPublishing(true);
    try {
      // Make sure the latest edits are in the draft before publishing.
      if (dirty) {
        const snapshot = serializedDraft;
        const saveResult = await saveDraftAction(
          restaurantId,
          draftState as Record<string, unknown>
        );
        if (saveResult && !saveResult.ok) {
          toast.error(saveResult.message ?? "Failed to save draft");
          return;
        }
        setSavedSnapshot(snapshot);
      }
      const publishResult = await publishAction(restaurantId);
      if (publishResult && !publishResult.ok) {
        toast.error(publishResult.message ?? "Failed to publish");
        return;
      }
      toast.success("Branding published");
    } catch {
      toast.error("Failed to publish");
    } finally {
      setPublishing(false);
    }
  };

  const handleDiscard = async () => {
    setDiscarding(true);
    try {
      const result = await discardAction(restaurantId);
      if (result && !result.ok) {
        toast.error(result.message ?? "Failed to reset branding");
        return;
      }
      const reverted = live ?? {};
      setDraftState(reverted);
      setSavedSnapshot(JSON.stringify(reverted));
      // Resetting establishes a new baseline, so clear the undo history.
      setHistory([{ state: reverted, key: "__init__" }]);
      setHistoryIndex(0);
      postPreview(reverted);
      setConfirmResetOpen(false);
      toast.success("Branding reset to published");
    } catch {
      toast.error("Failed to reset branding");
    } finally {
      setDiscarding(false);
    }
  };

  // Apply an edit and record it on the undo stack. Editing the same field as
  // the previous step replaces that step (coalescing) instead of adding a new
  // one; editing after an undo discards the now-orphaned redo branch.
  const commit = (next: BrandingData, fieldKey: string) => {
    const base = history.slice(0, historyIndex + 1);
    const atTip = historyIndex === history.length - 1;
    const last = base[base.length - 1];
    const newHistory =
      atTip && last && last.key === fieldKey
        ? [...base.slice(0, -1), { state: next, key: fieldKey }]
        : [...base, { state: next, key: fieldKey }];
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
    setDraftState(next);
  };

  const update = (changes: Partial<BrandingData>, fieldKey?: string) => {
    commit(
      { ...draftState, ...changes },
      fieldKey ?? Object.keys(changes).join(",")
    );
  };

  const updateNested = (
    parent: "main_heading" | "sub_heading" | "body" | "primary_button" | "secondary_button",
    key: string,
    value: string
  ) => {
    const next = {
      ...draftState,
      [parent]: {
        ...((draftState[parent] as Record<string, string> | null) ?? {}),
        [key]: value,
      },
    };
    commit(next, `${parent}.${key}`);
  };

  const handleUndo = () => {
    if (!canUndo) return;
    const idx = historyIndex - 1;
    setHistoryIndex(idx);
    setDraftState(history[idx].state);
  };

  const handleRedo = () => {
    if (!canRedo) return;
    const idx = historyIndex + 1;
    setHistoryIndex(idx);
    setDraftState(history[idx].state);
  };

  // Resetting reverts the draft to the published branding, which removes an
  // uploaded logo that hasn't been published yet.
  const resetRemovesLogo =
    Boolean(draftState.logo_url) &&
    draftState.logo_url !== (live?.logo_url ?? null);

  function roleValue(role: ColorRole): string {
    if (role.key === "heading_color") return draftState.main_heading?.color ?? "";
    if (role.key === "body_color") return draftState.body?.color ?? "";
    return (draftState[role.key] as string | null) ?? "";
  }

  function setRoleValue(role: ColorRole, value: string) {
    if (role.key === "heading_color") {
      updateNested("main_heading", "color", value);
    } else if (role.key === "body_color") {
      updateNested("body", "color", value);
    } else {
      update({ [role.key]: value } as Partial<BrandingData>, role.key);
    }
  }

  const previewUrl = `/m/${restaurantSlug}${page === "about" ? "/about" : ""}`;

  const renderColorRow = (role: ColorRole) => {
    const value = roleValue(role);
    return (
      <div key={role.key} className="space-y-1">
        <div className="flex items-center justify-between gap-2">
          <Label className="text-sm">{role.label}</Label>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={isValidHex(value) ? value : role.fallback}
              onChange={(e) => setRoleValue(role, e.target.value)}
              className="h-10 w-10 cursor-pointer rounded-md border-0 bg-transparent p-0"
              aria-label={`${role.label} color`}
            />
            <Input
              value={value}
              onChange={(e) => setRoleValue(role, e.target.value)}
              placeholder={role.fallback}
              className="w-28 h-7 text-xs"
            />
          </div>
        </div>
        <p className="text-xs text-muted-foreground">{role.description}</p>
      </div>
    );
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_auto] gap-6 h-full min-h-0">
      {/* Controls */}
      <div className="flex h-full min-h-0 min-w-0 flex-col">
        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto pr-2 pb-20 lg:pb-4">
        {children}
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-muted-foreground">
            {saving ? "Saving..." : dirty ? "Unsaved changes" : "All changes saved"}
          </span>
          <div className="flex gap-1">
            <Button
              size="sm"
              variant="ghost"
              onClick={handleUndo}
              disabled={!canUndo}
              aria-label="Undo"
              title="Undo"
            >
              <Undo2 className="h-3.5 w-3.5" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={handleRedo}
              disabled={!canRedo}
              aria-label="Redo"
              title="Redo"
            >
              <Redo2 className="h-3.5 w-3.5" />
            </Button>
            <Button size="sm" variant="ghost" onClick={handleSave} disabled={!dirty || saving}>
              {saving ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Check className="h-3.5 w-3.5" />
              )}
              Save
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setConfirmResetOpen(true)}
              disabled={discarding}
            >
              Reset
            </Button>
          </div>
        </div>

        {/* Nav bar & logo */}
        <div className="space-y-3">
          <Label className="text-xs font-semibold uppercase tracking-wider">
            Nav bar &amp; logo
          </Label>
          <p className="text-xs text-muted-foreground">
            Shown in the menu nav bar instead of the letter avatar.
          </p>
          <MediaPicker
            restaurantId={restaurantId}
            value={draftState.logo_url ?? null}
            aspect="logo"
            onChange={(url, mediaId) =>
              update({ logo_url: url, logo_media_id: mediaId ?? null }, "logo")
            }
          />
          {NAV_COLOR_ROLES.map(renderColorRow)}
        </div>

        {/* Homepage banner */}
        <div className="space-y-3">
          <Label className="text-xs font-semibold uppercase tracking-wider">
            Homepage banner
          </Label>
          <p className="text-xs text-muted-foreground">
            Optional hero images shown at the top of the public menu. Active specials with images are also added automatically.
          </p>
          <MultiImagePicker
            restaurantId={restaurantId}
            value={draftState.banner_image_urls ?? []}
            onChange={(urls) => update({ banner_image_urls: urls })}
          />
        </div>

        {/* Colors */}
        <div className="space-y-3">
          <Label className="text-xs font-semibold uppercase tracking-wider">Colors</Label>
          <div className="space-y-3 lg:grid lg:grid-cols-2 lg:gap-x-8 lg:space-y-0 lg:gap-y-3">
            {GENERAL_COLOR_ROLES.map(renderColorRow)}
          </div>
        </div>

        {/* Typography */}
        <div className="space-y-3">
          <Label className="text-xs font-semibold uppercase tracking-wider">Typography</Label>
          <div className="space-y-2">
            <Label className="text-sm">Heading font</Label>
            <Select
              items={FONT_ITEMS}
              value={draftState.main_heading?.typeface ?? ""}
              onValueChange={(v) => updateNested("main_heading", "typeface", v ?? "")}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Default (Figtree)" />
              </SelectTrigger>
              <SelectContent>
                {FONT_ITEMS.map((f) => (
                  <SelectItem key={f.value} value={f.value}>
                    {f.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {renderColorRow(TYPOGRAPHY_COLOR_ROLES[0])}
          <div className="space-y-2">
            <Label className="text-sm">Body font</Label>
            <Select
              items={FONT_ITEMS}
              value={draftState.body?.typeface ?? ""}
              onValueChange={(v) => updateNested("body", "typeface", v ?? "")}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Default (Poppins)" />
              </SelectTrigger>
              <SelectContent>
                {FONT_ITEMS.map((f) => (
                  <SelectItem key={f.value} value={f.value}>
                    {f.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {renderColorRow(TYPOGRAPHY_COLOR_ROLES[1])}
        </div>
        </div>

        <div className="fixed inset-x-0 bottom-0 z-20 border-t bg-background/95 px-4 py-3 backdrop-blur lg:static lg:z-auto lg:shrink-0 lg:border-t lg:bg-background lg:px-0 lg:py-0 lg:pt-3 lg:backdrop-blur-none">
          <div className="flex gap-2">
            <Button
              onClick={handlePublish}
              className="flex-1"
              disabled={publishing || discarding}
            >
              {publishing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Publish changes
            </Button>
            <Button
              onClick={() => setConfirmResetOpen(true)}
              variant="outline"
              className="flex-1"
              disabled={publishing || discarding}
            >
              {discarding && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Reset to published
            </Button>
          </div>
        </div>
      </div>

      {/* Preview */}
      <div className="flex flex-col lg:sticky lg:top-0 lg:self-start shrink-0">
        <div className="flex items-center justify-end mb-3">
          <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
            {(["menu", "about"] as Page[]).map((p) => (
              <button
                key={p}
                onClick={() => setPage(p)}
                className={`px-3 py-1.5 rounded-md text-sm transition-colors ${
                  page === p ? "bg-background shadow-sm font-medium" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {p === "menu" ? "Menu" : "About"}
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-lg border bg-muted/30">
          <div className="flex items-center justify-between px-3 py-2 border-b">
            <span className="text-xs font-medium text-muted-foreground">Preview</span>
            <span className="text-xs text-muted-foreground">{previewUrl}</span>
          </div>
          <div className="p-4 flex justify-center">
            <div
              className="max-w-full aspect-9/16 overflow-hidden rounded-lg border bg-white shadow-sm"
              style={{ width: PREVIEW_WIDTH }}
            >
              <iframe
                ref={iframeRef}
                src={previewUrl}
                title="Menu preview"
                className="h-full w-full border-0"
                onLoad={() => postPreview(draftState)}
              />
            </div>
          </div>
        </div>
      </div>

      <Dialog open={confirmResetOpen} onOpenChange={setConfirmResetOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset branding changes?</DialogTitle>
            <DialogDescription>
              This discards all unsaved branding edits and reverts to your
              currently published branding.
              {resetRemovesLogo
                ? " The logo you uploaded but haven't published yet will be removed from the draft."
                : ""}
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="ghost"
              onClick={() => setConfirmResetOpen(false)}
              disabled={discarding}
            >
              Never mind
            </Button>
            <Button
              variant="destructive"
              onClick={handleDiscard}
              disabled={discarding}
            >
              {discarding && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Reset changes
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
