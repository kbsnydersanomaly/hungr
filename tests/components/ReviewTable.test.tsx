import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ReviewTable } from "@/app/(dashboard)/restaurants/[restaurantId]/reviews/review-table";

const moderateReview = vi.fn();
const deleteReview = vi.fn();
const bulkModerateReviews = vi.fn();
const refresh = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh }),
}));

vi.mock("@/lib/data/review-actions", () => ({
  moderateReview: (...args: unknown[]) => moderateReview(...args),
  deleteReview: (...args: unknown[]) => deleteReview(...args),
  bulkModerateReviews: (...args: unknown[]) => bulkModerateReviews(...args),
}));

const longMessage = Array.from(
  { length: 50 },
  (_, i) => `Sentence ${i + 1} of a long review with some words`
).join(". "); // ~2000 chars, no trailing space

const review = {
  id: "rev-1",
  customer_name: "Jane Doe",
  message: longMessage,
  rating: 4,
  status: "pending" as const,
  created_at: "2026-01-15T12:00:00Z",
  menu_items: { name: "Margherita Pizza" },
};

describe("ReviewTable detail dialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    moderateReview.mockResolvedValue(undefined);
  });

  it("opens a dialog with the full message when the truncated cell is clicked", () => {
    render(<ReviewTable reviews={[review]} restaurantId="rest-1" />);

    fireEvent.click(screen.getByText(longMessage));

    const dialog = screen.getByRole("dialog");
    expect(dialog).toBeInTheDocument();
    expect(dialog).toHaveTextContent("Jane Doe");
    expect(dialog).toHaveTextContent("Margherita Pizza");
    // The entire untruncated message is present.
    expect(dialog).toHaveTextContent(longMessage);
  });

  it("approves from the dialog footer using the row handler and closes", async () => {
    render(<ReviewTable reviews={[review]} restaurantId="rest-1" />);

    fireEvent.click(screen.getByRole("button", { name: /view review/i }));
    fireEvent.click(screen.getByRole("button", { name: /^approve$/i }));

    await waitFor(() =>
      expect(moderateReview).toHaveBeenCalledWith("rev-1", "approved")
    );
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    );
  });
});
