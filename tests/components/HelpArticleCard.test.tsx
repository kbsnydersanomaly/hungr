import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { HelpArticleCard } from "@/components/help/HelpArticleCard";
import type { HelpArticleWithCategory } from "@/lib/data/help-actions";

const baseArticle: HelpArticleWithCategory = {
  id: "article-1",
  title: "How to Reset Your Password",
  slug: "reset-password",
  category_id: "cat-1",
  category_name: "Account",
  topics: ["account", "security"],
  content:
    "If you forgot your password, you can request a reset link from the sign-in page.",
  screenshots: [],
  video_url: null,
  published: true,
  created_at: "2026-06-24T00:00:00Z",
  updated_at: "2026-06-24T00:00:00Z",
};

describe("HelpArticleCard", () => {
  it("renders the title, category badge and topic badges", () => {
    render(<HelpArticleCard article={baseArticle} />);

    expect(screen.getByText(baseArticle.title)).toBeInTheDocument();
    expect(screen.getByText("Account")).toBeInTheDocument();
    expect(screen.getByText("account")).toBeInTheDocument();
    expect(screen.getByText("security")).toBeInTheDocument();
  });

  it("links to the article detail page", () => {
    render(<HelpArticleCard article={baseArticle} />);
    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("href", "/help/reset-password");
  });
});
