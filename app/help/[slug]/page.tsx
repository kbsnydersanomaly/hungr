import { notFound } from "next/navigation";
import { getHelpArticleBySlug } from "@/lib/data/help-actions";
import { HelpArticleContent } from "@/components/help/HelpArticleContent";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Play } from "lucide-react";
import Link from "next/link";

export const dynamic = "force-dynamic";

interface HelpArticlePageProps {
  params: Promise<{ slug: string }>;
}

function embedUrl(url: string): string {
  try {
    const parsed = new URL(url);
    if (parsed.hostname.includes("youtube.com") && parsed.searchParams.has("v")) {
      return `https://www.youtube.com/embed/${parsed.searchParams.get("v")}`;
    }
    if (parsed.hostname.includes("youtu.be")) {
      return `https://www.youtube.com/embed${parsed.pathname}`;
    }
  } catch {
    // fall back to original URL
  }
  return url;
}

export default async function HelpArticlePage({
  params,
}: HelpArticlePageProps) {
  const { slug } = await params;
  const result = await getHelpArticleBySlug(slug);

  if (!result.ok) {
    notFound();
  }

  const article = result.data!;

  return (
    <div className="container max-w-3xl mx-auto px-4 py-12 space-y-6">
      <Button asChild variant="ghost" className="-ml-2">
        <Link href="/help">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to help
        </Link>
      </Button>

      <div className="space-y-2">
        <div className="flex flex-wrap gap-2">
          {article.category_name ? (
            <Badge variant="secondary">{article.category_name}</Badge>
          ) : null}
          {article.topics.map((topic) => (
            <Badge key={topic} variant="outline">
              {topic}
            </Badge>
          ))}
        </div>
        <h1 className="text-2xl font-bold font-heading">{article.title}</h1>
      </div>

      <HelpArticleContent content={article.content} />

      {article.screenshots.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold">Screenshots</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {article.screenshots.map((url, index) => (
              <a
                key={index}
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="block overflow-hidden rounded-lg ring-1 ring-foreground/10 hover:ring-primary/50"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={url}
                  alt={`Screenshot ${index + 1}`}
                  className="w-full h-auto object-cover"
                />
              </a>
            ))}
          </div>
        </div>
      )}

      {article.video_url && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold flex items-center gap-2">
            <Play className="h-4 w-4" />
            Video
          </h2>
          <div className="aspect-video w-full overflow-hidden rounded-lg ring-1 ring-foreground/10">
            <iframe
              src={embedUrl(article.video_url)}
              title={article.title}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              className="h-full w-full border-0"
            />
          </div>
        </div>
      )}
    </div>
  );
}
