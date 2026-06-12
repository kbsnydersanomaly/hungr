"use client";

import { useState } from "react";
import { saveAboutPage } from "@/lib/data/about-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent } from "@/components/ui/card";
import { MediaPicker } from "./MediaPicker";
import { Loader2 } from "lucide-react";
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
  about: AboutPage | null;
}

export function AboutEditor({ restaurantId, about }: AboutEditorProps) {
  const [loading, setLoading] = useState(false);
  const [aboutText, setAboutText] = useState(about?.about_text ?? "");
  const [businessHours, setBusinessHours] = useState(about?.business_hours ?? "");
  const [email, setEmail] = useState(about?.email ?? "");
  const [phone, setPhone] = useState(about?.phone ?? "");
  const [mainImageUrl, setMainImageUrl] = useState(about?.main_image_url ?? "");
  const [showBusinessHours, setShowBusinessHours] = useState(
    about?.show_business_hours ?? true
  );
  const [showContact, setShowContact] = useState(about?.show_contact ?? true);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    const formData = new FormData();
    formData.set("about_text", aboutText);
    formData.set("business_hours", businessHours);
    formData.set("email", email);
    formData.set("phone", phone);
    formData.set("main_image_url", mainImageUrl);
    formData.set("gallery_urls", JSON.stringify([]));
    formData.set("show_business_hours", showBusinessHours ? "on" : "");
    formData.set("show_contact", showContact ? "on" : "");

    try {
      await saveAboutPage(restaurantId, formData);
      toast.success("About page saved.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save.");
    } finally {
      setLoading(false);
    }
  }

  return (
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
}
