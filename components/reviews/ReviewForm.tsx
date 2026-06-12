"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Star, MessageSquarePlus } from "lucide-react";
import { toast } from "sonner";
import { submitReviewAction } from "@/lib/data/review-actions";

interface ReviewFormProps {
  menuItemId: string;
  restaurantId: string;
}

export function ReviewForm({ menuItemId, restaurantId }: ReviewFormProps) {
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState(5);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  if (submitted) {
    return (
      <div className="rounded-lg border bg-muted/30 p-4 text-center">
        <p className="text-sm font-medium">Thanks for your review!</p>
        <p className="text-xs text-muted-foreground mt-1">
          It will appear after moderation.
        </p>
      </div>
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" className="w-full" />}>
        <MessageSquarePlus className="h-4 w-4 mr-2" />
        Leave a review
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Leave a review</DialogTitle>
          <DialogDescription>
            Tell us what you thought of this item.
          </DialogDescription>
        </DialogHeader>
        <form
          action={async (formData: FormData) => {
            setSubmitting(true);
            const result = await submitReviewAction({
              menu_item_id: menuItemId,
              restaurant_id: restaurantId,
              customer_name: String(formData.get("customer_name")),
              message: String(formData.get("message")),
              rating,
            });
            if (result.ok) {
              setOpen(false);
              setSubmitted(true);
              toast.success("Review submitted");
            } else {
              toast.error(result.message || "Failed to submit review");
            }
            setSubmitting(false);
          }}
          className="space-y-3"
        >
          <div className="space-y-2">
            <Label>Rating</Label>
            <div
              className="flex gap-1"
              role="radiogroup"
              aria-label="Rating out of 5 stars"
            >
              {Array.from({ length: 5 }).map((_, i) => (
                <button
                  key={i}
                  type="button"
                  role="radio"
                  aria-checked={rating === i + 1}
                  aria-label={`${i + 1} star${i === 0 ? "" : "s"}`}
                  onClick={() => setRating(i + 1)}
                  className="p-1"
                >
                  <Star
                    aria-hidden="true"
                    className={`h-6 w-6 transition-colors ${
                      i < rating
                        ? "fill-primary text-primary"
                        : "text-muted-foreground"
                    }`}
                  />
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="customer_name">Your name</Label>
            <Input id="customer_name" name="customer_name" required minLength={2} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="message">Review</Label>
            <Textarea
              id="message"
              name="message"
              required
              minLength={10}
              rows={3}
              placeholder="What did you think?"
            />
          </div>

          <Button type="submit" disabled={submitting} className="w-full">
            {submitting ? "Submitting..." : "Submit review"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
