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
import { brandingToCssVars, brandingFontFamilies } from "@/lib/theme/cssVars";
import { GOOGLE_FONT_OPTIONS } from "@/lib/theme/fonts";
import {
  BRANDING_PREVIEW_MESSAGE,
  BRANDING_PREVIEW_READY_MESSAGE,
} from "./BrandingPreviewBridge";
import { Check, RotateCcw } from "lucide-react";
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
}

type Page = "menu" | "about";

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

export function BrandingEditor({ restaurantId, restaurantSlug, live, draft }: BrandingEditorProps) {
  const [page, setPage] = useState<Page>("menu");
  const [draftState, setDraftState] = useState<BrandingData>(
    draft ?? live ?? {}
  );
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

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
    setSaving(true);
    try {
      const { saveDraftAction } = await import("@/lib/data/branding-actions");
      await saveDraftAction(restaurantId, draftState as Record<string, unknown>);
      setDirty(false);
      toast.success("Draft saved");
    } catch {
      toast.error("Failed to save draft");
    } finally {
      setSaving(false);
    }
  }, [dirty, draftState, restaurantId]);

  // Debounced autosave
  useEffect(() => {
    if (!dirty) return;
    const t = setTimeout(() => {
      handleSave();
    }, 800);
    return () => clearTimeout(t);
  }, [dirty, handleSave]);

  const handlePublish = async () => {
    try {
      // Make sure the latest edits are in the draft before publishing.
      if (dirty) {
        const { saveDraftAction } = await import("@/lib/data/branding-actions");
        await saveDraftAction(restaurantId, draftState as Record<string, unknown>);
        setDirty(false);
      }
      const { publishAction } = await import("@/lib/data/branding-actions");
      await publishAction(restaurantId);
      toast.success("Branding published");
    } catch {
      toast.error("Failed to publish");
    }
  };

  const handleDiscard = async () => {
    try {
      const { discardAction } = await import("@/lib/data/branding-actions");
      await discardAction(restaurantId);
      const reverted = live ?? {};
      setDraftState(reverted);
      setDirty(false);
      postPreview(reverted);
      toast.success("Draft discarded");
    } catch {
      toast.error("Failed to discard draft");
    }
  };

  const update = (changes: Partial<BrandingData>) => {
    setDraftState((prev) => ({ ...prev, ...changes }));
    setDirty(true);
  };

  const updateNested = (
    parent: "main_heading" | "sub_heading" | "body" | "primary_button" | "secondary_button",
    key: string,
    value: string
  ) => {
    setDraftState((prev) => ({
      ...prev,
      [parent]: {
        ...((prev[parent] as Record<string, string> | null) ?? {}),
        [key]: value,
      },
    }));
    setDirty(true);
  };

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
      update({ [role.key]: value } as Partial<BrandingData>);
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
              className="h-8 w-8 cursor-pointer rounded-md border-0 bg-transparent p-0"
              aria-label={`${role.label} color`}
            />
            <Input
              value={value}
              onChange={(e) => setRoleValue(role, e.target.value)}
              placeholder={role.fallback}
              className="w-24 h-7 text-xs"
            />
          </div>
        </div>
        <p className="text-xs text-muted-foreground">{role.description}</p>
      </div>
    );
  };

  return (
    <div className="grid grid-cols-[300px_1fr] gap-4 h-full">
      {/* Controls */}
      <div className="space-y-5 overflow-y-auto pr-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-muted-foreground">
            {saving ? "Saving..." : dirty ? "Unsaved changes" : "All changes saved"}
          </span>
          <div className="flex gap-1">
            <Button size="sm" variant="ghost" onClick={handleSave} disabled={!dirty}>
              <Check className="h-3.5 w-3.5" />
            </Button>
            <Button size="sm" variant="ghost" onClick={handleDiscard}>
              <RotateCcw className="h-3.5 w-3.5" />
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
              update({ logo_url: url, logo_media_id: mediaId ?? null })
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
          {GENERAL_COLOR_ROLES.map(renderColorRow)}
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

        <div className="pt-4 border-t space-y-2">
          <Button onClick={handlePublish} className="w-full">
            Publish changes
          </Button>
          <Button onClick={handleDiscard} variant="outline" className="w-full">
            Discard draft
          </Button>
        </div>
      </div>

      {/* Preview */}
      <div className="flex flex-col h-full min-h-0">
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

        <div className="flex flex-col flex-1 min-h-0 rounded-lg border bg-muted/30">
          <div className="flex items-center justify-between px-3 py-2 border-b">
            <span className="text-xs font-medium text-muted-foreground">Preview</span>
            <span className="text-xs text-muted-foreground">{previewUrl}</span>
          </div>
          <div className="flex-1 overflow-auto p-4 flex justify-center">
            <div style={{ width: PREVIEW_WIDTH, maxWidth: "100%", height: "100%" }}>
              <iframe
                ref={iframeRef}
                src={previewUrl}
                title="Menu preview"
                className="w-full h-full rounded-lg border bg-white"
                style={{ minHeight: "600px" }}
                onLoad={() => postPreview(draftState)}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
