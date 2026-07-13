import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ReviewForm } from "@/components/reviews/ReviewForm";

const submitReviewAction = vi.fn();
const toastSuccess = vi.fn();
const toastError = vi.fn();

vi.mock("@/lib/data/review-actions", () => ({
  submitReviewAction: (...args: unknown[]) => submitReviewAction(...args),
}));

vi.mock("sonner", () => ({
  toast: {
    success: (...args: unknown[]) => toastSuccess(...args),
    error: (...args: unknown[]) => toastError(...args),
  },
}));

function openAndFill() {
  render(<ReviewForm menuItemId="item-1" restaurantId="rest-1" />);
  fireEvent.click(screen.getByRole("button", { name: /leave a review/i }));
  fireEvent.change(screen.getByLabelText(/your name/i), { target: { value: "Jane Doe" } });
  fireEvent.change(screen.getByLabelText(/^review$/i), {
    target: { value: "Great food, friendly staff." },
  });
}

describe("ReviewForm submit UX", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("disables the submit button while the action is in flight", async () => {
    let resolveAction: (value: { ok: boolean }) => void;
    submitReviewAction.mockImplementation(
      () => new Promise((resolve) => (resolveAction = resolve))
    );
    openAndFill();

    fireEvent.click(screen.getByRole("button", { name: /submit review/i }));

    await waitFor(() =>
      expect(screen.getByRole("button", { name: /submitting/i })).toBeDisabled()
    );

    resolveAction!({ ok: true });
    await waitFor(() => expect(toastSuccess).toHaveBeenCalled());
  });

  it("warns against resubmitting and re-enables the button after a network error", async () => {
    submitReviewAction.mockRejectedValue(new Error("network error"));
    openAndFill();

    fireEvent.click(screen.getByRole("button", { name: /submit review/i }));

    await waitFor(() =>
      expect(toastError).toHaveBeenCalledWith(
        expect.stringMatching(/may have been submitted/i)
      )
    );
    // The button is re-enabled only after the error toast rendered, and the
    // "thanks" state is not shown.
    const button = screen.getByRole("button", { name: /submit review/i });
    expect(button).not.toBeDisabled();
    expect(screen.queryByText(/thanks for your review/i)).not.toBeInTheDocument();
  });

  it("shows the server error message and re-enables the button on a failed result", async () => {
    submitReviewAction.mockResolvedValue({ ok: false, message: "Failed to submit review" });
    openAndFill();

    fireEvent.click(screen.getByRole("button", { name: /submit review/i }));

    await waitFor(() => expect(toastError).toHaveBeenCalledWith("Failed to submit review"));
    expect(screen.getByRole("button", { name: /submit review/i })).not.toBeDisabled();
  });

  it("closes the dialog and thanks the diner on success", async () => {
    submitReviewAction.mockResolvedValue({ ok: true, data: { submitted: true } });
    openAndFill();

    fireEvent.click(screen.getByRole("button", { name: /submit review/i }));

    await waitFor(() => expect(toastSuccess).toHaveBeenCalledWith("Review submitted"));
    expect(screen.getByText(/thanks for your review/i)).toBeInTheDocument();
  });
});
