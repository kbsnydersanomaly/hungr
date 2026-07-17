import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { DeleteAccountDialog } from "@/components/dashboard/DeleteAccountDialog";

const deleteOwnAccountMock = vi.fn();

vi.mock("@/lib/data/profile-actions", () => ({
  deleteOwnAccount: (...args: unknown[]) => deleteOwnAccountMock(...args),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

function openDialog() {
  render(<DeleteAccountDialog email="owner@example.com" />);
  fireEvent.click(screen.getByRole("button", { name: /delete account/i }));
}

describe("DeleteAccountDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    deleteOwnAccountMock.mockResolvedValue({ ok: true });
  });

  it("spells out the consequences when opened", () => {
    openDialog();
    expect(
      screen.getByText(/permanently deletes your account/i)
    ).toBeInTheDocument();
    expect(screen.getByText(/cannot be undone/i)).toBeInTheDocument();
  });

  it("keeps the delete button disabled until the exact email is typed", () => {
    openDialog();
    const confirm = screen.getByRole("button", { name: /delete permanently/i });
    expect(confirm).toBeDisabled();

    fireEvent.change(screen.getByLabelText(/to confirm/i), {
      target: { value: "owner@example" },
    });
    expect(confirm).toBeDisabled();

    fireEvent.change(screen.getByLabelText(/to confirm/i), {
      target: { value: "owner@example.com" },
    });
    expect(confirm).toBeEnabled();
  });

  it("calls deleteOwnAccount with the typed email once confirmed", async () => {
    openDialog();
    fireEvent.change(screen.getByLabelText(/to confirm/i), {
      target: { value: "owner@example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: /delete permanently/i }));

    await waitFor(() => {
      expect(deleteOwnAccountMock).toHaveBeenCalledWith("owner@example.com");
    });
  });

  it("shows the action error message in a toast", async () => {
    const { toast } = await import("sonner");
    deleteOwnAccountMock.mockResolvedValue({
      ok: false,
      message: "Email does not match your account email.",
    });

    openDialog();
    fireEvent.change(screen.getByLabelText(/to confirm/i), {
      target: { value: "owner@example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: /delete permanently/i }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        "Email does not match your account email."
      );
    });
  });
});
