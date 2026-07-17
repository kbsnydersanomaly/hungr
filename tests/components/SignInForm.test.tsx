import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import SignInForm from "@/app/(auth)/sign-in/sign-in-form";

const { mockSignInAction, mockPush, mockRefresh } = vi.hoisted(() => ({
  mockSignInAction: vi.fn(),
  mockPush: vi.fn(),
  mockRefresh: vi.fn(),
}));

vi.mock("@/lib/auth/actions", () => ({
  signInAction: mockSignInAction,
  resendVerificationEmail: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, refresh: mockRefresh }),
  useSearchParams: () => ({ get: () => null }),
}));

function renderAndFill() {
  render(<SignInForm onSwitchToSignUp={() => {}} />);
  fireEvent.change(screen.getByLabelText("Email"), {
    target: { value: "user@example.com" },
  });
  fireEvent.change(screen.getByLabelText("Password"), {
    target: { value: "password123" },
  });
}

describe("SignInForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows the error and re-enables the button when sign-in fails", async () => {
    mockSignInAction.mockResolvedValue({ ok: false, message: "Invalid login credentials" });
    renderAndFill();

    fireEvent.click(screen.getByRole("button", { name: "Log in" }));

    expect(await screen.findByText("Invalid login credentials")).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Log in" })).toBeEnabled()
    );
    expect(mockPush).not.toHaveBeenCalled();
  });

  it("stays disabled with a spinner after success until navigation completes", async () => {
    mockSignInAction.mockResolvedValue({ ok: true });
    renderAndFill();

    fireEvent.click(screen.getByRole("button", { name: "Log in" }));

    await waitFor(() => expect(mockPush).toHaveBeenCalledWith("/dashboard"));
    expect(mockRefresh).toHaveBeenCalled();

    const button = screen.getByRole("button", { name: /signing in/i });
    expect(button).toBeDisabled();
    expect(button.querySelector(".animate-spin")).not.toBeNull();
  });
});
