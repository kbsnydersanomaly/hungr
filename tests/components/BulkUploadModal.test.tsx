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

function getDropZone() {
  return screen.getByTestId("bulk-upload-dropzone");
}

function dropFile(name: string, type: string, content: string) {
  const file = new File([content], name, { type });
  fireEvent.drop(getDropZone(), { dataTransfer: { files: [file] } });
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
    expect(
      await screen.findByText(/Row 2 · name · Item name is required\./i)
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
    expect(
      screen.getByText(/Row 2 · name · Item name is required\./i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Row 26 · name · Item name is required\./i)
    ).toBeInTheDocument();
    expect(
      screen.getAllByText(/Row \d+ · name · Item name is required\./i)
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

  it("highlights the drop zone while a file is dragged over it", () => {
    openModal();
    const zone = getDropZone();

    expect(zone).not.toHaveAttribute("data-dragging");
    expect(zone.className).toContain("border-muted-foreground/20");

    fireEvent.dragEnter(zone);
    expect(zone).toHaveAttribute("data-dragging", "true");
    expect(zone.className).toContain("border-primary");

    fireEvent.dragLeave(zone);
    expect(zone).not.toHaveAttribute("data-dragging");
    expect(zone.className).toContain("border-muted-foreground/20");
  });

  it("clears the highlight after a drop", async () => {
    openModal();
    const zone = getDropZone();

    fireEvent.dragEnter(zone);
    expect(zone).toHaveAttribute("data-dragging", "true");

    dropFile("menu.csv", "text/csv", "name,price,category\nPizza,89,Mains\n");
    await screen.findByText("Pizza");
    expect(zone).not.toHaveAttribute("data-dragging");
  });

  it("runs the same validation flow for a dropped CSV as the file picker", async () => {
    openModal();
    fireEvent.dragOver(getDropZone());
    dropFile(
      "menu.csv",
      "text/csv",
      "name,price,category\nPizza,89,Mains\nSalad,55,Starters\n"
    );

    expect(await screen.findByText("Pizza")).toBeInTheDocument();
    expect(screen.getByText("Salad")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /upload 2 items/i })
    ).toBeEnabled();
  });

  it("shows the parse error styling when a non-spreadsheet file is dropped", async () => {
    openModal();
    dropFile("notes.txt", "text/plain", "hello");

    expect(
      await screen.findByText(
        "Unsupported file type. Upload a .csv, .xlsx, or .xls file."
      )
    ).toBeInTheDocument();
    // The file name is shown but no preview renders.
    expect(screen.getByText("notes.txt")).toBeInTheDocument();
    expect(screen.queryByText(/valid row/i)).not.toBeInTheDocument();
  });

  it("shows the parse error styling when an image is dropped", async () => {
    openModal();
    dropFile("photo.png", "image/png", "fake-png-bytes");

    expect(
      await screen.findByText(
        "Unsupported file type. Upload a .csv, .xlsx, or .xls file."
      )
    ).toBeInTheDocument();
  });

  it("keeps the highlight when dragging across child elements (bubbled leave)", () => {
    openModal();
    const zone = getDropZone();
    const child = screen.getByRole("button", { name: /choose file/i });

    fireEvent.dragEnter(zone);
    // Entering a child bubbles another dragEnter to the zone.
    fireEvent.dragEnter(child);
    // Leaving the child bubbles a dragLeave — the pointer is still inside
    // the zone, so the highlight must stay on.
    fireEvent.dragLeave(child);
    expect(zone).toHaveAttribute("data-dragging", "true");

    // Finally leaving the zone itself clears the highlight.
    fireEvent.dragLeave(zone);
    expect(zone).not.toHaveAttribute("data-dragging");
  });

  it("clears the file input value after picking so the same file can be re-picked", async () => {
    openModal();
    const input = document.querySelector(
      'input[type="file"]'
    ) as HTMLInputElement;

    uploadCsv("name,price,category\nPizza,89,Mains\n");
    await screen.findByText("Pizza");
    expect(input.value).toBe("");

    // Drop a different file, then re-pick the original one — the cleared
    // value means onChange fires again and the preview updates.
    dropFile("other.csv", "text/csv", "name,price,category\nBurger,99,Mains\n");
    await screen.findByText("Burger");
    expect(screen.queryByText("Pizza")).not.toBeInTheDocument();

    uploadCsv("name,price,category\nPizza,89,Mains\n");
    expect(await screen.findByText("Pizza")).toBeInTheDocument();
    expect(screen.queryByText("Burger")).not.toBeInTheDocument();
  });
});
