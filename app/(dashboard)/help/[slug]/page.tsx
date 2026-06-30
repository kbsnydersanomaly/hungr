import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { getHelpArticleBySlug } from "@/lib/data/help-actions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Video } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function HelpArticlePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const res = await getHelpArticleBySlug(slug);

  if (!res.ok || !res.data) {
    notFound();
  }

  const article = res.data;

  return (
    <article className="space-y-6 max-w-3xl">
      <Button variant="ghost" size="sm" asChild className="-ml-2">
        <Link href="/help">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to help
        </Link>
      </Button>

      <header className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-bold font-heading">{article.title}</h1>
          {article.category_name && (
            <Badge variant="outline">{article.category_name}</Badge>
          )}
        </div>
        {article.topics.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {article.topics.map((topic) => (
              <span key={topic} className="text-xs text-muted-foreground">
                #{topic}
              </span>
            ))}
          </div>
        )}
      </header>

      {article.content && (
        <div className="text-sm leading-relaxed whitespace-pre-line">
          {article.content}
        </div>
      )}

      {article.video_url && (
        <Button variant="outline" asChild>
          <a href={article.video_url} target="_blank" rel="noopener noreferrer">
            <Video className="h-4 w-4 mr-2" />
            Watch video
          </a>
        </Button>
      )}

      {article.screenshots.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2">
          {article.screenshots.map((url) => (
            <div
              key={url}
              className="relative aspect-video w-full overflow-hidden rounded-lg border bg-muted"
            >
              <Image
                src={url}
                alt={article.title}
                fill
                sizes="(max-width: 768px) 100vw, 50vw"
                className="object-cover"
              />
            </div>
          ))}
        </div>
      )}
    </article>
  );
}
