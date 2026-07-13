import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MediaUploadDialog } from "@/components/dashboard/MediaUploadDialog";

const uploadMock = vi.fn();
const getPublicUrlMock = vi.fn(() => ({
  data: { publicUrl: "https://cdn.example.com/img.png" },
}));
const recordMediaUploadMock = vi.fn();

vi.mock("@/lib/supabase/client", () => ({
  createBrowserClient: () => ({
    storage: {
      from: () => ({
        upload: uploadMock,
        getPublicUrl: getPublicUrlMock,
      }),
    },
  }),
}));

vi.mock("@/lib/data/media-actions", () => ({
  recordMediaUpload: (...args: unknown[]) => recordMediaUploadMock(...args),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

function mediaFor(name: string) {
  return {
    id: `media-${name}`,
    url: `https://cdn.example.com/${name}`,
    name,
    mime: "image/png",
    size: 100,
    created_at: "2024-01-01",
  };
}

function imageFile(name: string) {
  return new File(["x".repeat(100)], name, { type: "image/png" });
}

function openDialog(onUpload?: () => void) {
  render(<MediaUploadDialog restaurantId="r1" onUpload={onUpload} />);
  fireEvent.click(screen.getByRole("button", { name: /upload/i }));
}

function pickFiles(files: File[]) {
  const input = document.querySelector('input[type="file"]') as HTMLInputElement;
  fireEvent.change(input, { target: { files } });
}

describe("MediaUploadDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    uploadMock.mockResolvedValue({ error: null });
    recordMediaUploadMock.mockImplementation((_restaurantId: string, formData: FormData) => {
      const name = String(formData.get("name"));
      if (name === "corrupt.png") {
        return Promise.resolve({ ok: false, message: "Corrupt image data." });
      }
      return Promise.resolve({ ok: true, data: { media: mediaFor(name) } });
    });
  });

  it("closes and calls onUpload when the whole batch succeeds", async () => {
    const onUpload = vi.fn();
    openDialog(onUpload);

    pickFiles([imageFile("a.png"), imageFile("b.png")]);

    await waitFor(() => expect(onUpload).toHaveBeenCalledTimes(1));
    // The dialog closed, so the queue is gone.
    expect(screen.queryByText("2 of 2 uploaded")).not.toBeInTheDocument();
  });

  it("stays open when some files fail so the per-file errors remain visible", async () => {
    const onUpload = vi.fn();
    openDialog(onUpload);

    pickFiles([imageFile("a.png"), imageFile("corrupt.png")]);

    expect(await screen.findByText("1 of 2 uploaded")).toBeInTheDocument();
    // The dialog did not close: the failed row and its error are still shown.
    expect(screen.getByText("corrupt.png")).toBeInTheDocument();
    expect(screen.getByText(/Corrupt image data\./)).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /upload image/i })
    ).toBeInTheDocument();
    expect(onUpload).not.toHaveBeenCalled();
  });
});
