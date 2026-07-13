import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { DeleteRestaurantDialog } from "@/components/dashboard/DeleteRestaurantDialog";

const deleteRestaurantMock = vi.fn();

vi.mock("@/lib/data/restaurant-actions", () => ({
  deleteRestaurant: (...args: unknown[]) => deleteRestaurantMock(...args),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

function openDialog() {
  render(
    <DeleteRestaurantDialog restaurantId="rest-1" restaurantName="Layout Test 1" />
  );
  fireEvent.click(screen.getByRole("button", { name: /delete this restaurant/i }));
}

describe("DeleteRestaurantDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    deleteRestaurantMock.mockResolvedValue({ ok: true });
  });

  it("spells out the consequences when opened", () => {
    openDialog();
    expect(screen.getByText(/permanently deletes the restaurant/i)).toBeInTheDocument();
    expect(screen.getByText(/reviews and branding/i)).toBeInTheDocument();
  });

  it("keeps the delete button disabled until the exact name is typed", () => {
    openDialog();
    const confirm = screen.getByRole("button", { name: /delete permanently/i });
    expect(confirm).toBeDisabled();

    fireEvent.change(screen.getByLabelText(/to confirm/i), {
      target: { value: "Layout Test" },
    });
    expect(confirm).toBeDisabled();

    fireEvent.change(screen.getByLabelText(/to confirm/i), {
      target: { value: "Layout Test 1" },
    });
    expect(confirm).toBeEnabled();
  });

  it("calls deleteRestaurant with the restaurant id once confirmed", async () => {
    openDialog();
    fireEvent.change(screen.getByLabelText(/to confirm/i), {
      target: { value: "Layout Test 1" },
    });
    fireEvent.click(screen.getByRole("button", { name: /delete permanently/i }));

    await waitFor(() => {
      expect(deleteRestaurantMock).toHaveBeenCalledWith("rest-1");
    });
  });

  it("shows the action error message in a toast", async () => {
    const { toast } = await import("sonner");
    deleteRestaurantMock.mockResolvedValue({
      ok: false,
      message: "This restaurant has an active subscription.",
    });

    openDialog();
    fireEvent.change(screen.getByLabelText(/to confirm/i), {
      target: { value: "Layout Test 1" },
    });
    fireEvent.click(screen.getByRole("button", { name: /delete permanently/i }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        "This restaurant has an active subscription."
      );
    });
  });
});
