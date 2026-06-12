"use client";

import { useState } from "react";
import { submitContactSales } from "@/lib/data/contact-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

export function ContactSalesForm() {
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const result = await submitContactSales(formData);

    if (result.ok) {
      setSent(true);
      toast.success("Message sent. We'll be in touch within 24 hours.");
    } else {
      toast.error(result.message ?? "Failed to send message.");
    }

    setLoading(false);
  }

  if (sent) {
    return (
      <Card>
        <CardContent className="text-center py-12">
          <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto mb-4" />
          <h2 className="text-lg font-semibold">Message sent</h2>
          <p className="text-sm text-muted-foreground mt-2">
            We&apos;ll be in touch within 24 hours.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input id="name" name="name" placeholder="Your name" required />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" placeholder="you@company.com" required />
          </div>

          <div className="space-y-2">
            <Label htmlFor="company">Company</Label>
            <Input id="company" name="company" placeholder="Acme Inc. (optional)" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="message">Message</Label>
            <Textarea
              id="message"
              name="message"
              placeholder="Tell us about your needs..."
              rows={4}
              required
            />
          </div>

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Sending..." : "Send message"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
