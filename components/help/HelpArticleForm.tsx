"use client";

import { ServerActionForm } from "@/components/forms/ServerActionForm";
import { SubmitButton } from "@/components/forms/SubmitButton";
import { FormField } from "@/components/forms/FormField";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Database } from "@/lib/database.types";
import type { ActionResult } from "@/lib/errors";

type HelpCategoryRow = Database["public"]["Tables"]["help_categories"]["Row"];
type HelpArticleRow = Database["public"]["Tables"]["help_articles"]["Row"];

interface HelpArticleFormProps {
  categories: HelpCategoryRow[];
  article?: HelpArticleRow;
  action: (formData: FormData) => Promise<ActionResult<unknown>>;
  submitLabel: string;
  onCancel?: () => void;
  successMessage?: string;
}

export function HelpArticleForm({
  categories,
  article,
  action,
  submitLabel,
  onCancel,
  successMessage,
}: HelpArticleFormProps) {
  return (
    <ServerActionForm
      action={action}
      successMessage={successMessage}
      className="space-y-6"
    >
      {({ isPending }) => (
        <div className="space-y-4">
          <FormField
            label="Title"
            name="title"
            defaultValue={article?.title ?? ""}
            required
            disabled={isPending}
          />

          <FormField
            label="Slug"
            name="slug"
            hint="Leave blank to auto-generate from the title"
            defaultValue={article?.slug ?? ""}
            disabled={isPending}
          />

          <div className="space-y-2">
            <Label htmlFor="category_id">Category</Label>
            <Select
              name="category_id"
              defaultValue={article?.category_id ?? ""}
            >
              <SelectTrigger id="category_id" className="w-full">
                <SelectValue placeholder="No category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">No category</SelectItem>
                {categories.map((category) => (
                  <SelectItem key={category.id} value={category.id}>
                    {category.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <FormField
            label="Topics"
            name="topics"
            hint="Comma-separated tags (e.g. billing, menus)"
            defaultValue={article?.topics.join(", ") ?? ""}
            disabled={isPending}
          />

          <FormField
            as="textarea"
            label="Content"
            name="content"
            hint="Markdown-style formatting is supported"
            defaultValue={article?.content ?? ""}
            disabled={isPending}
          />

          <FormField
            as="textarea"
            label="Screenshots"
            name="screenshots"
            hint="One image URL per line"
            defaultValue={article?.screenshots.join("\n") ?? ""}
            disabled={isPending}
          />

          <FormField
            label="Video URL"
            name="video_url"
            type="url"
            defaultValue={article?.video_url ?? ""}
            disabled={isPending}
          />

          <div className="flex items-center justify-between rounded-lg border p-4">
            <div>
              <p className="font-medium text-sm">Published</p>
              <p className="text-xs text-muted-foreground">
                Make this article visible to the public
              </p>
            </div>
            <Switch
              name="published"
              defaultChecked={article?.published ?? false}
              disabled={isPending}
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            {onCancel && (
              <Button
                type="button"
                variant="outline"
                onClick={onCancel}
                disabled={isPending}
              >
                Cancel
              </Button>
            )}
            <SubmitButton>{submitLabel}</SubmitButton>
          </div>
        </div>
      )}
    </ServerActionForm>
  );
}
