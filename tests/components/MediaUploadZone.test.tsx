import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { toast } from "sonner";
import { MediaUploadZone } from "@/components/dashboard/MediaUploadZone";

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

function imageFile(name: string, size = 100) {
  return new File(["x".repeat(size)], name, { type: "image/png" });
}

function getFileInput() {
  return document.querySelector('input[type="file"]') as HTMLInputElement;
}

function pickFiles(files: File[]) {
  fireEvent.change(getFileInput(), { target: { files } });
}

function dropFiles(files: File[]) {
  const zone = getFileInput().parentElement as HTMLElement;
  fireEvent.drop(zone, { dataTransfer: { files } });
}

describe("MediaUploadZone", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    uploadMock.mockResolvedValue({ error: null });
    recordMediaUploadMock.mockImplementation((_restaurantId: string, formData: FormData) =>
      Promise.resolve({ ok: true, data: { media: mediaFor(String(formData.get("name"))) } })
    );
  });

  it("allows selecting multiple files", () => {
    render(<MediaUploadZone restaurantId="r1" />);

    expect(getFileInput()).toHaveAttribute("multiple");
  });

  it("uploads every selected file and reports the overall count", async () => {
    const onUploaded = vi.fn();
    const onUploadComplete = vi.fn();
    render(
      <MediaUploadZone
        restaurantId="r1"
        onUploaded={onUploaded}
        onUploadComplete={onUploadComplete}
      />
    );

    pickFiles([imageFile("a.png"), imageFile("b.png"), imageFile("c.png")]);

    await waitFor(() =>
      expect(recordMediaUploadMock).toHaveBeenCalledTimes(3)
    );
    expect(uploadMock).toHaveBeenCalledTimes(3);
    expect(onUploaded).toHaveBeenCalledTimes(3);
    expect(onUploadComplete).toHaveBeenCalledTimes(1);

    expect(await screen.findByText("3 of 3 uploaded")).toBeInTheDocument();
    expect(screen.getByText("a.png")).toBeInTheDocument();
    expect(screen.getByText("b.png")).toBeInTheDocument();
    expect(screen.getByText("c.png")).toBeInTheDocument();
    expect(toast.success).toHaveBeenCalledWith("3 images uploaded successfully.");
  });

  it("shows per-file progress while the batch is uploading", async () => {
    let resolveSecond!: (value: unknown) => void;
    recordMediaUploadMock.mockImplementation((_restaurantId: string, formData: FormData) => {
      const name = String(formData.get("name"));
      if (name === "b.png") {
        return new Promise((resolve) => {
          resolveSecond = resolve;
        });
      }
      return Promise.resolve({ ok: true, data: { media: mediaFor(name) } });
    });

    render(<MediaUploadZone restaurantId="r1" />);
    pickFiles([imageFile("a.png"), imageFile("b.png"), imageFile("c.png")]);

    // First file done, second in flight, third still queued.
    expect(
      await screen.findByText("Uploading... 1 of 3 uploaded")
    ).toBeInTheDocument();

    resolveSecond({ ok: true, data: { media: mediaFor("b.png") } });

    expect(await screen.findByText("3 of 3 uploaded")).toBeInTheDocument();
  });

  it("continues past a failed file and shows its error without aborting the rest", async () => {
    recordMediaUploadMock.mockImplementation((_restaurantId: string, formData: FormData) => {
      const name = String(formData.get("name"));
      if (name === "corrupt.png") {
        return Promise.resolve({ ok: false, message: "Corrupt image data." });
      }
      return Promise.resolve({ ok: true, data: { media: mediaFor(name) } });
    });

    const onUploadComplete = vi.fn();
    render(
      <MediaUploadZone restaurantId="r1" onUploadComplete={onUploadComplete} />
    );

    pickFiles([imageFile("a.png"), imageFile("corrupt.png"), imageFile("c.png")]);

    expect(await screen.findByText("2 of 3 uploaded")).toBeInTheDocument();
    expect(recordMediaUploadMock).toHaveBeenCalledTimes(3);
    // The failed file shows its per-file error in the queue.
    expect(screen.getByText("corrupt.png")).toBeInTheDocument();
    expect(screen.getByText(/Corrupt image data\./)).toBeInTheDocument();
    // The batch still completed and the good files uploaded.
    expect(toast.error).toHaveBeenCalledWith("1 of 3 uploads failed.");
    expect(onUploadComplete).toHaveBeenCalledTimes(1);
  });

  it("does not call onUploadComplete when every file fails", async () => {
    uploadMock.mockResolvedValue({ error: { message: "Storage exploded." } });
    const onUploadComplete = vi.fn();
    render(
      <MediaUploadZone restaurantId="r1" onUploadComplete={onUploadComplete} />
    );

    pickFiles([imageFile("a.png"), imageFile("b.png")]);

    expect(await screen.findByText("0 of 2 uploaded")).toBeInTheDocument();
    expect(toast.error).toHaveBeenCalledWith("2 of 2 uploads failed.");
    expect(onUploadComplete).not.toHaveBeenCalled();
  });

  it("fails fast when the batch would exceed the remaining storage", async () => {
    render(<MediaUploadZone restaurantId="r1" remainingBytes={150} />);

    pickFiles([imageFile("a.png", 100), imageFile("b.png", 100)]);

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        expect.stringContaining("Not enough storage")
      )
    );
    expect(uploadMock).not.toHaveBeenCalled();
    expect(recordMediaUploadMock).not.toHaveBeenCalled();
    expect(screen.queryByText(/of \d+ uploaded/)).not.toBeInTheDocument();
  });

  it("uploads the batch when the total size fits in the remaining storage", async () => {
    render(<MediaUploadZone restaurantId="r1" remainingBytes={250} />);

    pickFiles([imageFile("a.png", 100), imageFile("b.png", 100)]);

    expect(await screen.findByText("2 of 2 uploaded")).toBeInTheDocument();
    expect(recordMediaUploadMock).toHaveBeenCalledTimes(2);
  });

  it("marks non-image files as failed and still uploads the images", async () => {
    render(<MediaUploadZone restaurantId="r1" />);

    const text = new File(["hello"], "notes.txt", { type: "text/plain" });
    pickFiles([text, imageFile("a.png")]);

    expect(await screen.findByText("1 of 2 uploaded")).toBeInTheDocument();
    expect(recordMediaUploadMock).toHaveBeenCalledTimes(1);
    expect(screen.getByText("notes.txt")).toBeInTheDocument();
    expect(screen.getByText(/Only image files are allowed\./)).toBeInTheDocument();
  });

  it("uploads multiple dropped files", async () => {
    render(<MediaUploadZone restaurantId="r1" />);

    dropFiles([imageFile("drop-a.png"), imageFile("drop-b.png")]);

    expect(await screen.findByText("2 of 2 uploaded")).toBeInTheDocument();
    expect(recordMediaUploadMock).toHaveBeenCalledTimes(2);
    expect(screen.getByText("drop-a.png")).toBeInTheDocument();
    expect(screen.getByText("drop-b.png")).toBeInTheDocument();
  });

  it("keeps the single-file success toast", async () => {
    render(<MediaUploadZone restaurantId="r1" />);

    pickFiles([imageFile("solo.png")]);

    expect(await screen.findByText("1 of 1 uploaded")).toBeInTheDocument();
    expect(toast.success).toHaveBeenCalledWith("Image uploaded successfully.");
  });
});
