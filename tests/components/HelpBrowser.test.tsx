import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { HelpBrowser } from "@/components/help/HelpBrowser";

const categories = [
  { id: "cat-uuid-123", name: "Billing" },
  { id: "cat-uuid-456", name: "Menus" },
];

const articles = [
  {
    id: "a1",
    slug: "how-to-pay",
    title: "How to pay",
    content: "Pay with card.",
    topics: [],
    category_id: "cat-uuid-123",
    category_name: "Billing",
  },
];

describe("HelpBrowser", () => {
  it("shows 'All categories' in the closed category select instead of the raw value", () => {
    render(<HelpBrowser articles={articles} categories={categories} />);
    expect(screen.getByText("All categories")).toBeInTheDocument();
    expect(screen.queryByText("cat-uuid-123")).not.toBeInTheDocument();
  });
});
