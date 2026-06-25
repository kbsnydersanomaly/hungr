import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { PaymentPendingBanner } from "@/components/dashboard/PaymentPendingBanner";

vi.mock("@/lib/supabase/server", () => ({
  createServerClient: vi.fn(),
}));

vi.mock("@/components/dashboard/RetryPaymentButton", () => ({
  RetryPaymentButton: ({
    children,
  }: {
    children: React.ReactNode;
    subscriptionId: string;
  }) => <button type="button">{children}</button>,
}));

import { createServerClient } from "@/lib/supabase/server";

const mockedCreateServerClient = createServerClient as unknown as ReturnType<
  typeof vi.fn
>;

function mockSubscriptions(
  rows: Array<{
    id: string;
    status: string;
    current_period_end: string | null;
    scope: string;
    scope_id: string;
  }>
) {
  mockedCreateServerClient.mockResolvedValue({
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      in: vi.fn().mockResolvedValue({ data: rows, error: null }),
    })),
  });
}

describe("PaymentPendingBanner", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the pending payment retry banner", async () => {
    mockSubscriptions([
      {
        id: "sub-pending",
        status: "pending",
        current_period_end: null,
        scope: "restaurant",
        scope_id: "rest-1",
      },
    ]);

    render(
      await PaymentPendingBanner({
        restaurantId: "rest-1",
        orgId: "org-1",
      })
    );

    expect(
      screen.getByText("Payment pending — click here to retry")
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Retry payment" })
    ).toBeInTheDocument();
  });

  it("shows an info-only note (no retry button) for managers", async () => {
    render(
      await PaymentPendingBanner({
        restaurantId: "rest-1",
        orgId: "org-1",
        canManageBilling: false,
        subscriptions: [
          {
            id: "sub-pending",
            status: "pending",
            current_period_end: null,
            scope: "restaurant",
            scope_id: "rest-1",
          },
        ],
      })
    );

    expect(
      screen.getByText("Payment pending — click here to retry")
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Retry payment" })
    ).not.toBeInTheDocument();
    expect(
      screen.getByText("Contact your account owner to complete payment.")
    ).toBeInTheDocument();
  });

  it("uses pre-loaded subscriptions without querying", async () => {
    const result = await PaymentPendingBanner({
      restaurantId: "rest-1",
      orgId: "org-1",
      subscriptions: [
        {
          id: "sub-active",
          status: "active",
          current_period_end: "2026-07-01T12:00:00Z",
          scope: "restaurant",
          scope_id: "rest-1",
        },
      ],
    });

    expect(result).toBeNull();
    expect(mockedCreateServerClient).not.toHaveBeenCalled();
  });

  it("returns nothing when the subscription is active", async () => {
    mockSubscriptions([
      {
        id: "sub-active",
        status: "active",
        current_period_end: "2026-07-01T12:00:00Z",
        scope: "restaurant",
        scope_id: "rest-1",
      },
    ]);

    const result = await PaymentPendingBanner({
      restaurantId: "rest-1",
      orgId: "org-1",
    });

    expect(result).toBeNull();
  });
});
