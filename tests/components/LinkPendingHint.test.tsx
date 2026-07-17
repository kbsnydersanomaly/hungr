import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { LinkPendingHint } from "@/components/dashboard/LinkPendingHint";
import { SidebarNavLink } from "@/components/dashboard/SidebarNavLink";

const { mockUseLinkStatus } = vi.hoisted(() => ({ mockUseLinkStatus: vi.fn() }));

vi.mock("next/link", async (importOriginal) => {
  const actual = await importOriginal<typeof import("next/link")>();
  return { ...actual, useLinkStatus: () => mockUseLinkStatus() };
});

vi.mock("next/navigation", () => ({
  usePathname: () => "/dashboard",
}));

describe("LinkPendingHint", () => {
  it("stays hidden when no navigation is pending", () => {
    mockUseLinkStatus.mockReturnValue({ pending: false });
    const { container } = render(<LinkPendingHint />);
    expect(container.querySelector(".link-hint")).not.toHaveClass("is-pending");
  });

  it("gets the is-pending style while its link is navigating", () => {
    mockUseLinkStatus.mockReturnValue({ pending: true });
    const { container } = render(<LinkPendingHint />);
    expect(container.querySelector(".link-hint")).toHaveClass("is-pending");
  });
});

describe("SidebarNavLink", () => {
  it("renders a pending hint inside the link", () => {
    mockUseLinkStatus.mockReturnValue({ pending: false });
    const { container } = render(
      <SidebarNavLink href="/dashboard" label="Overview">
        <svg data-testid="icon" />
      </SidebarNavLink>
    );
    const link = screen.getByRole("link", { name: /overview/i });
    expect(link).toHaveAttribute("href", "/dashboard");
    expect(container.querySelector(".link-hint")).not.toBeNull();
  });
});
