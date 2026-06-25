"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import {
  deleteHelpArticle,
  toggleHelpArticlePublished,
  type HelpArticleWithCategory,
} from "@/lib/data/help-actions";
import { Pencil, Trash2 } from "lucide-react";

interface AdminArticleActionsProps {
  article: HelpArticleWithCategory;
}

export function AdminArticleActions({ article }: AdminArticleActionsProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [showDelete, setShowDelete] = useState(false);

  function handleToggle(checked: boolean) {
    startTransition(async () => {
      const result = await toggleHelpArticlePublished(article.id, checked);
      if (result.ok) {
        toast.success(checked ? "Article published" : "Article unpublished");
        router.refresh();
      } else {
        toast.error(result.message ?? "Failed to update article");
      }
    });
  }

  function handleDelete() {
    startTransition(async () => {
      const result = await deleteHelpArticle(article.id);
      if (result.ok) {
        toast.success("Article deleted");
        setShowDelete(false);
        router.refresh();
      } else {
        toast.error(result.message ?? "Failed to delete article");
      }
    });
  }

  return (
    <div className="flex items-center justify-end gap-2">
      <Switch
        checked={article.published}
        onCheckedChange={handleToggle}
        disabled={isPending}
        aria-label={article.published ? "Unpublish article" : "Publish article"}
      />

      <Button asChild size="icon" variant="ghost">
        <Link href={`/admin/help/${article.id}`}>
          <Pencil className="h-4 w-4" />
          <span className="sr-only">Edit</span>
        </Link>
      </Button>

      <Dialog open={showDelete} onOpenChange={setShowDelete}>
        <DialogTrigger
          render={
            <Button size="icon" variant="ghost" aria-label="Delete article">
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          }
        />
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete article?</DialogTitle>
            <DialogDescription>
              This will permanently delete “{article.title}”. This action cannot
              be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose render={<Button variant="outline">Cancel</Button>} />
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={isPending}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
