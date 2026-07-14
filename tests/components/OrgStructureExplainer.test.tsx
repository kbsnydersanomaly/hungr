import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { OrgStructureExplainer } from "@/components/dashboard/OrgStructureExplainer";

const STORAGE_KEY = "hungr:org-structure-explainer:dismissed";

function createStorage() {
  const store = new Map<string, string>();
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => store.set(key, value),
    removeItem: (key: string) => store.delete(key),
    clear: () => store.clear(),
  };
}

describe("OrgStructureExplainer", () => {
  beforeEach(() => {
    vi.stubGlobal("localStorage", createStorage());
  });

  it("renders the explainer card", async () => {
    render(<OrgStructureExplainer orgName="Acme Inc." />);
    await waitFor(() => {
      expect(
        screen.getByText("Your organisation contains restaurants")
      ).toBeInTheDocument();
    });
    expect(screen.getByText(/Acme Inc./)).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /Learn more/i })
    ).toHaveAttribute(
      "href",
      "/help/how-organisations-restaurants-and-teams-fit-together"
    );
  });

  it("hides the card when dismissed and persists to localStorage", async () => {
    render(<OrgStructureExplainer orgName="Acme Inc." />);
    await waitFor(() => {
      expect(
        screen.getByText("Your organisation contains restaurants")
      ).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /Dismiss/i }));

    await waitFor(() => {
      expect(
        screen.queryByText("Your organisation contains restaurants")
      ).not.toBeInTheDocument();
    });
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe("true");
  });

  it("does not render when localStorage marks it dismissed", async () => {
    window.localStorage.setItem(STORAGE_KEY, "true");
    render(<OrgStructureExplainer orgName="Acme Inc." />);
    await waitFor(() => {
      expect(
        screen.queryByText("Your organisation contains restaurants")
      ).not.toBeInTheDocument();
    });
  });
});
