import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MenuNameEditor } from "@/components/menu/MenuNameEditor";

const { renameMenu, refresh, toastSuccess, toastError } = vi.hoisted(() => ({
  renameMenu: vi.fn(),
  refresh: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock("@/lib/data/menu-actions", () => ({ renameMenu }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh }),
}));
vi.mock("sonner", () => ({
  toast: { success: toastSuccess, error: toastError },
}));

function openEditor() {
  fireEvent.click(screen.getByRole("button", { name: "Rename menu" }));
  return screen.getByRole("textbox", { name: "Menu name" });
}

describe("MenuNameEditor", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    renameMenu.mockResolvedValue({ ok: true, data: { name: "New Name" } });
  });

  it("renders the current name", () => {
    render(<MenuNameEditor menuId="menu-1" name="Dinner" />);
    expect(screen.getByText("Dinner")).toBeInTheDocument();
  });

  it("submits the trimmed name on Enter and refreshes", async () => {
    render(<MenuNameEditor menuId="menu-1" name="Dinner" />);
    const input = openEditor();
    fireEvent.change(input, { target: { value: "  New Name  " } });
    fireEvent.submit(input.closest("form")!);

    await waitFor(() => {
      expect(renameMenu).toHaveBeenCalledWith("menu-1", "New Name");
    });
    expect(toastSuccess).toHaveBeenCalledWith("Menu renamed.");
    expect(refresh).toHaveBeenCalled();
  });

  it("cancels on Escape without calling the action", () => {
    render(<MenuNameEditor menuId="menu-1" name="Dinner" />);
    const input = openEditor();
    fireEvent.change(input, { target: { value: "Something else" } });
    fireEvent.keyDown(input, { key: "Escape" });

    expect(renameMenu).not.toHaveBeenCalled();
    expect(screen.getByText("Dinner")).toBeInTheDocument();
  });

  it("does not call the action when the name is unchanged or empty", async () => {
    render(<MenuNameEditor menuId="menu-1" name="Dinner" />);
    const input = openEditor();
    fireEvent.change(input, { target: { value: "   " } });
    fireEvent.submit(input.closest("form")!);

    expect(renameMenu).not.toHaveBeenCalled();
  });

  it("shows an error toast and stays in edit mode when the action fails", async () => {
    renameMenu.mockResolvedValue({ ok: false, message: "Failed to rename menu: boom" });
    render(<MenuNameEditor menuId="menu-1" name="Dinner" />);
    const input = openEditor();
    fireEvent.change(input, { target: { value: "New Name" } });
    fireEvent.submit(input.closest("form")!);

    await waitFor(() => {
      expect(toastError).toHaveBeenCalledWith("Failed to rename menu: boom");
    });
    expect(screen.getByRole("textbox", { name: "Menu name" })).toBeInTheDocument();
    expect(refresh).not.toHaveBeenCalled();
  });
});
