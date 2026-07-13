import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { toast } from "sonner";
import { BulkUploadModal } from "@/components/menu/BulkUploadModal";

const bulkUpsertItems = vi.fn();

vi.mock("@/lib/data/menu-actions", () => ({
  bulkUpsertItems: (...args: unknown[]) => bulkUpsertItems(...args),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

function openModal() {
  render(<BulkUploadModal menuId="menu-1" restaurantId="rest-1" />);
  fireEvent.click(screen.getByRole("button", { name: /bulk upload/i }));
}

function uploadCsv(content: string) {
  const input = document.querySelector(
    'input[type="file"]'
  ) as HTMLInputElement;
  const file = new File([content], "menu.csv", { type: "text/csv" });
  fireEvent.change(input, { target: { files: [file] } });
}

describe("BulkUploadModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("previews valid rows after a file is selected", async () => {
    openModal();
    uploadCsv("name,price,category\nPizza,89,Mains\nSalad,55,Starters\n");

    // Both rows show up in the preview table, and the submit button reflects
    // the valid count via its accessible name.
    expect(await screen.findByText("Pizza")).toBeInTheDocument();
    expect(screen.getByText("Salad")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /upload 2 items/i })
    ).toBeEnabled();
  });

  it("shows a row/field/reason error for a malformed row", async () => {
    openModal();
    uploadCsv("name,price,category\n,89,Mains\nSalad,55,Starters\n");

    // The first data row (file row 2) is missing a name.
    expect(await screen.findByText(/Row 2 · name ·/i)).toBeInTheDocument();
    // The valid row is still previewed.
    expect(screen.getByText("Salad")).toBeInTheDocument();
  });

  it("submits raw rows to the server action and shows a summary", async () => {
    bulkUpsertItems.mockResolvedValue({
      ok: true,
      data: {
        added: 2,
        updated: 0,
        skipped: 0,
        failed: 0,
        categoriesCreated: 1,
        errors: [],
        warnings: [],
      },
    });

    openModal();
    uploadCsv("name,price,category\nPizza,89,Mains\nSalad,55,Starters\n");

    const submit = await screen.findByRole("button", {
      name: /upload 2 items/i,
    });
    fireEvent.click(submit);

    await waitFor(() => expect(bulkUpsertItems).toHaveBeenCalledTimes(1));
    const [menuId, payload] = bulkUpsertItems.mock.calls[0];
    expect(menuId).toBe("menu-1");
    expect(payload.mode).toBe("add");
    expect(payload.rows).toHaveLength(2);

    await waitFor(() =>
      expect(screen.getByText("Upload another")).toBeInTheDocument()
    );
    expect(screen.getByText(/1 new category created/i)).toBeInTheDocument();
  });

  it("shows pairing warnings in the summary", async () => {
    bulkUpsertItems.mockResolvedValue({
      ok: true,
      data: {
        added: 1,
        updated: 0,
        skipped: 0,
        failed: 0,
        categoriesCreated: 0,
        errors: [],
        warnings: [
          {
            row: 2,
            field: "pairings",
            reason: 'Unknown item "Ghost Item" — no item with that name exists on this menu.',
          },
        ],
      },
    });

    openModal();
    uploadCsv("name,price,category,pairings\nPizza,89,Mains,Ghost Item\n");

    const submit = await screen.findByRole("button", { name: /upload 1 item/i });
    fireEvent.click(submit);

    await waitFor(() =>
      expect(screen.getByText("Upload another")).toBeInTheDocument()
    );
    expect(screen.getByText(/1 warning/i)).toBeInTheDocument();
    expect(screen.getByText(/Row 2 · pairings ·/i)).toBeInTheDocument();
    expect(toast.success).toHaveBeenCalledWith(expect.stringContaining("1 warning"));
  });
});
