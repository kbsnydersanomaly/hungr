import Link from "next/link";
import { listHelpMedia } from "@/lib/data/help-media-actions";
import { HelpMediaManager } from "@/components/help/HelpMediaManager";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function AdminHelpMediaPage() {
  const media = await listHelpMedia();

  return (
    <div className="space-y-6">
      <div>
        <Button asChild variant="ghost" size="sm" className="-ml-2">
          <Link href="/admin/help">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to help articles
          </Link>
        </Button>
        <h2 className="mt-2 text-lg font-semibold font-heading">Help media library</h2>
        <p className="text-sm text-muted-foreground">
          Upload and manage images used across help articles. Deleting an image
          also removes it from storage.
        </p>
      </div>

      <HelpMediaManager initialMedia={media} />
    </div>
  );
}
