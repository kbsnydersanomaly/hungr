import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { toast } from "sonner";
import { BulkUploadModal } from "@/components/menu/BulkUploadModal";

const bulkUpsertItems = vi.fn();
const exportMenuCsv = vi.fn();

vi.mock("@/lib/data/menu-actions", () => ({
  bulkUpsertItems: (...args: unknown[]) => bulkUpsertItems(...args),
}));

vi.mock("@/lib/data/menu-export-actions", () => ({
  exportMenuCsv: (...args: unknown[]) => exportMenuCsv(...args),
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
    expect(await screen.findByText("Row 2")).toBeInTheDocument();
    expect(
      screen.getByText(/name · Item name is required\./i)
    ).toBeInTheDocument();
    // The valid row is still previewed.
    expect(screen.getByText("Salad")).toBeInTheDocument();
  });

  it("renders every validation error (no 20-item slice) with a count header", async () => {
    openModal();
    const badRows = Array.from({ length: 25 }, () => ",89,Mains").join("\n");
    uploadCsv(`name,price,category\n${badRows}\n`);

    expect(await screen.findByText("25 errors found")).toBeInTheDocument();
    // First and last rows are both visible — nothing was sliced off.
    expect(screen.getByText("Row 2")).toBeInTheDocument();
    expect(screen.getByText("Row 26")).toBeInTheDocument();
    expect(
      screen.getAllByText(/name · Item name is required\./i)
    ).toHaveLength(25);
    expect(screen.queryByText(/…and \d+ more\./)).not.toBeInTheDocument();
  });

  it("groups multiple errors for the same row under one row header", async () => {
    openModal();
    // Row 2 is missing both name and price → two errors, one header.
    uploadCsv("name,price,category\n,,Mains\n");

    expect(await screen.findByText("2 errors found")).toBeInTheDocument();
    expect(screen.getAllByText("Row 2")).toHaveLength(1);
    expect(
      screen.getByText(/name · Item name is required\./i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/price · Price is required\./i)
    ).toBeInTheDocument();
  });

  it("downloads an error report CSV with the failing rows", async () => {
    const createObjectURL = vi.fn(() => "blob:mock");
    URL.createObjectURL = createObjectURL;
    URL.revokeObjectURL = vi.fn();
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => {});

    openModal();
    uploadCsv("name,price,category\n,89,Mains\nSalad,,Starters\n");

    fireEvent.click(
      await screen.findByRole("button", { name: /download error report/i })
    );

    expect(createObjectURL).toHaveBeenCalledTimes(1);
    expect(click).toHaveBeenCalled();
    const blob = createObjectURL.mock.calls[0][0] as Blob;
    const csv = await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.readAsText(blob);
    });
    expect(csv).toBe(
      "row,column,message\r\n" +
        "2,name,Item name is required.\r\n" +
        "3,price,Price is required."
    );
    click.mockRestore();
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

  it("downloads the current menu as <menu-slug>.csv", async () => {
    exportMenuCsv.mockResolvedValue({
      ok: true,
      data: { csv: "id,name,price,category\n", slug: "dinner" },
    });
    const createObjectURL = vi.fn(() => "blob:mock");
    const revokeObjectURL = vi.fn();
    URL.createObjectURL = createObjectURL;
    URL.revokeObjectURL = revokeObjectURL;
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});

    openModal();
    fireEvent.click(
      await screen.findByRole("button", { name: /download current menu/i })
    );

    await waitFor(() => expect(exportMenuCsv).toHaveBeenCalledWith("menu-1"));
    await waitFor(() => expect(createObjectURL).toHaveBeenCalled());
    expect(click).toHaveBeenCalled();
    click.mockRestore();
  });

  it("toasts an error when the export fails", async () => {
    exportMenuCsv.mockResolvedValue({ ok: false, message: "nope" });

    openModal();
    fireEvent.click(
      await screen.findByRole("button", { name: /download current menu/i })
    );

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("nope"));
  });
});
