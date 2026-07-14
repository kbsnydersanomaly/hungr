"use client";

import { useState, useRef, useSyncExternalStore } from "react";
import { saveAboutPage } from "@/lib/data/about-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent } from "@/components/ui/card";
import { MediaPicker } from "./MediaPicker";
import { MultiImagePicker } from "./MultiImagePicker";
import { Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";

interface AboutPage {
  about_text: string | null;
  business_hours: string | null;
  email: string | null;
  phone: string | null;
  main_image_url: string | null;
  gallery_urls: string[];
  show_business_hours: boolean;
  show_contact: boolean;
}

interface AboutEditorProps {
  restaurantId: string;
  restaurantSlug: string;
  about: AboutPage | null;
}

type Tab = "editor" | "preview";

function useIsLg(): boolean {
  return useSyncExternalStore(
    (callback) => {
      const update = () => callback();
      window.addEventListener("resize", update);
      return () => window.removeEventListener("resize", update);
    },
    () => (typeof window === "undefined" ? false : window.innerWidth >= 1024),
    () => false
  );
}

// The public about page is phone-width, so the preview is too.
const PREVIEW_WIDTH = "375px";

export function AboutEditor({
  restaurantId,
  restaurantSlug,
  about,
}: AboutEditorProps) {
  const [loading, setLoading] = useState(false);
  const [aboutText, setAboutText] = useState(about?.about_text ?? "");
  const [businessHours, setBusinessHours] = useState(about?.business_hours ?? "");
  const [email, setEmail] = useState(about?.email ?? "");
  const [phone, setPhone] = useState(about?.phone ?? "");
  const [mainImageUrl, setMainImageUrl] = useState(about?.main_image_url ?? "");
  const [galleryUrls, setGalleryUrls] = useState<string[]>(
    about?.gallery_urls ?? []
  );
  const [showBusinessHours, setShowBusinessHours] = useState(
    about?.show_business_hours ?? true
  );
  const [showContact, setShowContact] = useState(about?.show_contact ?? true);

  const iframeRef = useRef<HTMLIFrameElement>(null);
  const previewUrl = `/m/${restaurantSlug}/about`;
  const [activeTab, setActiveTab] = useState<Tab>("editor");
  const isLg = useIsLg();

  function refreshPreview() {
    const iframe = iframeRef.current;
    if (!iframe) return;
    // Re-assigning src forces a reload without leaving the page.
    iframe.src = previewUrl;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    const formData = new FormData();
    formData.set("about_text", aboutText);
    formData.set("business_hours", businessHours);
    formData.set("email", email);
    formData.set("phone", phone);
    formData.set("main_image_url", mainImageUrl);
    formData.set("gallery_urls", JSON.stringify(galleryUrls));
    formData.set("show_business_hours", showBusinessHours ? "on" : "");
    formData.set("show_contact", showContact ? "on" : "");

    try {
      await saveAboutPage(restaurantId, formData);
      toast.success("About page saved.");
      refreshPreview();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save.");
    } finally {
      setLoading(false);
    }
  }

  const editorForm = (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Card>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="about-text">About text</Label>
            <Textarea
              id="about-text"
              value={aboutText}
              onChange={(e) => setAboutText(e.target.value)}
              placeholder="Tell your customers about your restaurant..."
              rows={6}
            />
          </div>

          <div className="space-y-2">
            <Label>Main image</Label>
            <MediaPicker
              restaurantId={restaurantId}
              value={mainImageUrl}
              onChange={(url) => setMainImageUrl(url ?? "")}
            />
          </div>

          <div className="space-y-2">
            <Label>Gallery</Label>
            <MultiImagePicker
              restaurantId={restaurantId}
              value={galleryUrls}
              onChange={setGalleryUrls}
              showCover={false}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="business-hours">Business hours</Label>
            <Textarea
              id="business-hours"
              value={businessHours}
              onChange={(e) => setBusinessHours(e.target.value)}
              placeholder="e.g. Mon–Fri: 9am–10pm, Sat–Sun: 10am–11pm"
              rows={3}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="hello@restaurant.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+27 12 345 6789"
              />
            </div>
          </div>

          <div className="space-y-4 rounded-lg border p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-sm">Show business hours</p>
                <p className="text-xs text-muted-foreground">
                  Display business hours on the public about page
                </p>
              </div>
              <Switch
                checked={showBusinessHours}
                onCheckedChange={setShowBusinessHours}
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-sm">Show contact details</p>
                <p className="text-xs text-muted-foreground">
                  Display email and phone on the public about page
                </p>
              </div>
              <Switch
                checked={showContact}
                onCheckedChange={setShowContact}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button type="submit" disabled={loading}>
          {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          Save about page
        </Button>
      </div>
    </form>
  );

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_auto] gap-6 h-full min-h-0">
      {/* Small-screen tab switcher + refresh */}
      {!isLg && (
        <div className="col-span-full flex items-center justify-between">
          <div className="flex items-center gap-1 bg-muted rounded-lg p-1" role="tablist" aria-label="Editor view">
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "editor"}
              aria-controls="editor-panel"
              id="editor-tab"
              onClick={() => setActiveTab("editor")}
              className={`px-3 py-1.5 rounded-md text-sm transition-colors ${
                activeTab === "editor"
                  ? "bg-background shadow-sm font-medium"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Editor
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "preview"}
              aria-controls="preview-panel"
              id="preview-tab"
              onClick={() => setActiveTab("preview")}
              className={`px-3 py-1.5 rounded-md text-sm transition-colors ${
                activeTab === "preview"
                  ? "bg-background shadow-sm font-medium"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Preview
            </button>
          </div>
          <Button
            size="sm"
            variant="ghost"
            onClick={refreshPreview}
            type="button"
          >
            <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
            Refresh preview
          </Button>
        </div>
      )}

      {/* Editor */}
      <div
        id="editor-panel"
        role="tabpanel"
        aria-labelledby="editor-tab"
        className={`min-h-0 min-w-0 ${
          activeTab === "editor" ? "block" : "hidden"
        } lg:block`}
      >
        {editorForm}
      </div>

      {/* Preview */}
      <div
        id="preview-panel"
        role="tabpanel"
        aria-labelledby="preview-tab"
        className={`flex flex-col lg:sticky lg:top-0 lg:self-start shrink-0 ${
          activeTab === "preview" ? "flex" : "hidden"
        } lg:flex`}
      >
        {isLg && (
          <div className="flex items-center justify-end mb-3 gap-2">
            <Button
              size="sm"
              variant="ghost"
              onClick={refreshPreview}
              type="button"
            >
              <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
              Refresh preview
            </Button>
          </div>
        )}

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
                title="About preview"
                className="h-full w-full border-0"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
