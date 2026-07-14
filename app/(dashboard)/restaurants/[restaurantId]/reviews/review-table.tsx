"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  moderateReview,
  deleteReview,
  bulkModerateReviews,
} from "@/lib/data/review-actions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Star, CheckCircle, XCircle, Trash2, Loader2, Eye } from "lucide-react";

type ReviewStatus = "pending" | "approved" | "rejected";

interface Review {
  id: string;
  customer_name: string;
  message: string;
  rating: number;
  status: ReviewStatus;
  created_at: string;
  menu_items: { name: string } | null;
}

export function ReviewTable({
  reviews,
}: {
  reviews: Review[];
  restaurantId: string;
}) {
  const router = useRouter();
  const [filter, setFilter] = useState<ReviewStatus | "all">("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState<Set<string>>(new Set());
  const [focusedIndex, setFocusedIndex] = useState<number>(-1);
  const [showDelete, setShowDelete] = useState<string | null>(null);
  const [detailReview, setDetailReview] = useState<Review | null>(null);

  const filtered = useMemo(() => {
    if (filter === "all") return reviews;
    return reviews.filter((r) => r.status === filter);
  }, [reviews, filter]);

  const handleModerate = useCallback(
    async (id: string, status: "approved" | "rejected") => {
      setLoading((prev) => new Set(prev).add(id));
      await moderateReview(id, status);
      setLoading((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      router.refresh();
    },
    [router]
  );

  const allSelected = filtered.length > 0 && filtered.every((r) => selected.has(r.id));

  function toggleSelectAll() {
    if (allSelected) {
      setSelected((prev) => {
        const next = new Set(prev);
        filtered.forEach((r) => next.delete(r.id));
        return next;
      });
    } else {
      setSelected((prev) => {
        const next = new Set(prev);
        filtered.forEach((r) => next.add(r.id));
        return next;
      });
    }
  }

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleBulkModerate(status: "approved" | "rejected") {
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    setLoading(new Set(ids));
    await bulkModerateReviews(ids, status);
    setLoading(new Set());
    setSelected(new Set());
    router.refresh();
  }

  async function handleModerateFromDetail(status: "approved" | "rejected") {
    if (!detailReview) return;
    await handleModerate(detailReview.id, status);
    setDetailReview(null);
  }

  async function handleDelete(id: string) {
    setLoading((prev) => new Set(prev).add(id));
    await deleteReview(id);
    setLoading((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
    setShowDelete(null);
    router.refresh();
  }

  // Keyboard shortcuts
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (detailReview || showDelete) return;

      if (e.key === "j" || e.key === "J") {
        e.preventDefault();
        setFocusedIndex((i) => Math.min(i + 1, filtered.length - 1));
      } else if (e.key === "k" || e.key === "K") {
        e.preventDefault();
        setFocusedIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === "a" || e.key === "A") {
        const focused = filtered[focusedIndex];
        if (focused) handleModerate(focused.id, "approved");
      } else if (e.key === "r" || e.key === "R") {
        const focused = filtered[focusedIndex];
        if (focused) handleModerate(focused.id, "rejected");
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [filtered, focusedIndex, handleModerate, detailReview, showDelete]);

  const statusColors: Record<ReviewStatus, string> = {
    pending: "bg-yellow-100 text-yellow-800 border-yellow-200",
    approved: "bg-green-100 text-green-800 border-green-200",
    rejected: "bg-red-100 text-red-800 border-red-200",
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        {(["all", "pending", "approved", "rejected"] as const).map((s) => (
          <Button
            key={s}
            variant={filter === s ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter(s)}
          >
            {s === "all" ? "All" : s.charAt(0).toUpperCase() + s.slice(1)}
            {s !== "all" && (
              <span className="ml-1.5 text-xs">
                ({reviews.filter((r) => r.status === s).length})
              </span>
            )}
          </Button>
        ))}
      </div>

      {/* Bulk actions */}
      {selected.size > 0 && (
        <div className="flex flex-wrap items-center gap-2 p-2 rounded-lg bg-muted">
          <span className="text-sm">{selected.size} selected</span>
          <Button size="sm" variant="outline" onClick={() => handleBulkModerate("approved")}>
            <CheckCircle className="h-4 w-4 mr-1" />
            Approve
          </Button>
          <Button size="sm" variant="outline" onClick={() => handleBulkModerate("rejected")}>
            <XCircle className="h-4 w-4 mr-1" />
            Reject
          </Button>
        </div>
      )}

      {/* Table */}
      <div className="rounded-md border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <Checkbox checked={allSelected} onCheckedChange={toggleSelectAll} />
              </TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Item</TableHead>
              <TableHead>Rating</TableHead>
              <TableHead>Message</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Date</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length > 0 ? (
              filtered.map((review, index) => (
                <TableRow
                  key={review.id}
                  className={focusedIndex === index ? "bg-muted/50" : ""}
                  onClick={() => setFocusedIndex(index)}
                >
                  <TableCell>
                    <Checkbox
                      checked={selected.has(review.id)}
                      onCheckedChange={() => toggleSelect(review.id)}
                    />
                  </TableCell>
                  <TableCell className="font-medium">{review.customer_name}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {review.menu_items?.name ?? "—"}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-0.5">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star
                          key={i}
                          className={`h-3.5 w-3.5 ${
                            i < review.rating
                              ? "fill-primary text-primary"
                              : "text-muted-foreground"
                          }`}
                        />
                      ))}
                    </div>
                  </TableCell>
                  <TableCell
                    className="max-w-xs truncate cursor-pointer hover:underline"
                    title={review.message}
                    onClick={() => setDetailReview(review)}
                  >
                    {review.message}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={`capitalize ${statusColors[review.status]}`}
                    >
                      {review.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {new Date(review.created_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8"
                        aria-label="View review"
                        onClick={() => setDetailReview(review)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      {review.status !== "approved" && (
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-green-600"
                          onClick={() => handleModerate(review.id, "approved")}
                          disabled={loading.has(review.id)}
                        >
                          {loading.has(review.id) ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <CheckCircle className="h-4 w-4" />
                          )}
                        </Button>
                      )}
                      {review.status !== "rejected" && (
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-red-600"
                          onClick={() => handleModerate(review.id, "rejected")}
                          disabled={loading.has(review.id)}
                        >
                          <XCircle className="h-4 w-4" />
                        </Button>
                      )}
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-destructive"
                        onClick={() => setShowDelete(review.id)}
                        disabled={loading.has(review.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                  No reviews found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Review detail dialog */}
      <Dialog
        open={!!detailReview}
        onOpenChange={(open) => !open && setDetailReview(null)}
      >
        <DialogContent className="sm:max-w-lg">
          {detailReview && (
            <>
              <DialogHeader>
                <DialogTitle>{detailReview.customer_name}</DialogTitle>
                <DialogDescription>
                  {detailReview.menu_items?.name ?? "General review"} ·{" "}
                  {new Date(detailReview.created_at).toLocaleDateString()}
                </DialogDescription>
              </DialogHeader>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-0.5">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star
                      key={i}
                      className={`h-4 w-4 ${
                        i < detailReview.rating
                          ? "fill-primary text-primary"
                          : "text-muted-foreground"
                      }`}
                    />
                  ))}
                </div>
                <Badge
                  variant="outline"
                  className={`capitalize ${statusColors[detailReview.status]}`}
                >
                  {detailReview.status}
                </Badge>
              </div>
              <p className="max-h-72 overflow-y-auto whitespace-pre-wrap break-words text-sm">
                {detailReview.message}
              </p>
              <DialogFooter>
                {detailReview.status !== "rejected" && (
                  <Button
                    variant="outline"
                    className="text-red-600"
                    onClick={() => handleModerateFromDetail("rejected")}
                    disabled={loading.has(detailReview.id)}
                  >
                    <XCircle className="h-4 w-4 mr-1" />
                    Reject
                  </Button>
                )}
                {detailReview.status !== "approved" && (
                  <Button
                    onClick={() => handleModerateFromDetail("approved")}
                    disabled={loading.has(detailReview.id)}
                  >
                    {loading.has(detailReview.id) ? (
                      <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                    ) : (
                      <CheckCircle className="h-4 w-4 mr-1" />
                    )}
                    Approve
                  </Button>
                )}
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete dialog */}
      <Dialog open={!!showDelete} onOpenChange={() => setShowDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete review</DialogTitle>
            <DialogDescription>
              Are you sure you want to permanently delete this review?
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setShowDelete(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => showDelete && handleDelete(showDelete)}
            >
              Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
