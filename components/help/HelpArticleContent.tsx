"use client";

import { cn } from "@/lib/utils";

interface HelpArticleContentProps {
  content: string;
  className?: string;
}

function renderInline(text: string) {
  const parts: React.ReactNode[] = [];
  const linkPattern = /\[([^\]]+)\]\(([^)]+)\)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = linkPattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    const [, label, href] = match;
    parts.push(
      <a
        key={match.index}
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="text-primary underline underline-offset-2 hover:text-foreground"
      >
        {label}
      </a>
    );
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts;
}

function parseBlocks(content: string) {
  return content.split(/\n{2,}/).filter(Boolean);
}

export function HelpArticleContent({ content, className }: HelpArticleContentProps) {
  const blocks = parseBlocks(content);

  return (
    <div className={cn("space-y-4 text-sm leading-relaxed", className)}>
      {blocks.length === 0 ? (
        <p className="text-muted-foreground">No content yet.</p>
      ) : (
        blocks.map((block, index) => {
          const lines = block.split("\n").filter((line) => line.trim() !== "");

          if (lines[0]?.startsWith("### ")) {
            return (
              <h4 key={index} className="text-base font-semibold mt-4">
                {renderInline(lines[0].slice(4))}
              </h4>
            );
          }

          if (lines[0]?.startsWith("## ")) {
            return (
              <h3 key={index} className="text-lg font-semibold mt-6">
                {renderInline(lines[0].slice(3))}
              </h3>
            );
          }

          if (lines[0]?.startsWith("# ")) {
            return (
              <h2 key={index} className="text-xl font-semibold mt-6">
                {renderInline(lines[0].slice(2))}
              </h2>
            );
          }

          if (lines[0]?.match(/^[-*]\s/)) {
            return (
              <ul key={index} className="list-disc space-y-1 pl-5">
                {lines.map((line, i) => (
                  <li key={i}>{renderInline(line.replace(/^[-*]\s*/, ""))}</li>
                ))}
              </ul>
            );
          }

          if (lines[0]?.match(/^\d+\.\s/)) {
            return (
              <ol key={index} className="list-decimal space-y-1 pl-5">
                {lines.map((line, i) => (
                  <li key={i}>{renderInline(line.replace(/^\d+\.\s*/, ""))}</li>
                ))}
              </ol>
            );
          }

          return (
            <p key={index} className="text-muted-foreground">
              {renderInline(block.replace(/\n/g, " "))}
            </p>
          );
        })
      )}
    </div>
  );
}
