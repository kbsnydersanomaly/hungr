import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { StatusFilter } from "@/components/admin/StatusFilter";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => new URLSearchParams("category=cat-uuid-123"),
}));

const options = [
  { value: "cat-uuid-123", label: "Billing" },
  { value: "cat-uuid-456", label: "Menus" },
];

describe("StatusFilter", () => {
  it("shows the option label, not the raw value, for the selected value", () => {
    render(
      <StatusFilter
        options={options}
        paramName="category"
        placeholder="Filter by category"
      />,
    );
    expect(screen.getByText("Billing")).toBeInTheDocument();
    expect(screen.queryByText("cat-uuid-123")).not.toBeInTheDocument();
  });

  it("shows the placeholder when no value is selected", () => {
    render(
      <StatusFilter
        options={options}
        paramName="missing"
        placeholder="Filter by category"
      />,
    );
    expect(screen.getByText("Filter by category")).toBeInTheDocument();
  });
});
