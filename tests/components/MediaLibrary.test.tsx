import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MediaLibrary } from "@/components/dashboard/MediaLibrary";
import { renameMedia } from "@/lib/data/media-actions";

vi.mock("@/lib/data/media-actions", () => ({
  deleteMedia: vi.fn().mockResolvedValue({ deleted: true }),
  renameMedia: vi.fn().mockResolvedValue({ ok: true, data: { name: "1-tasty-burger.jpg" } }),
}));

vi.mock("next/image", () => ({
  default: (props: Record<string, unknown>) => {
    const { fill, priority, sizes, ...rest } = props as {
      fill?: boolean;
      priority?: boolean;
      sizes?: string;
      [key: string]: unknown;
    };
    void fill;
    void priority;
    void sizes;
    // eslint-disable-next-line jsx-a11y/alt-text, @next/next/no-img-element
    return <img {...(rest as React.ImgHTMLAttributes<HTMLImageElement>)} />;
  },
}));

const media = [
  { id: "1", url: "/burger.jpg", name: "burger.jpg", mime: "image/jpeg", size: 1024, created_at: "2024-01-01" },
  { id: "2", url: "/fries.jpg", name: "fries.jpg", mime: "image/jpeg", size: 2048, created_at: "2024-01-02" },
  { id: "3", url: "/salad.jpg", name: "salad.jpg", mime: "image/jpeg", size: 3072, created_at: "2024-01-03" },
];

describe("MediaLibrary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders all media items by default", () => {
    render(<MediaLibrary restaurantId="r1" media={media} />);

    expect(screen.getByText("3 images")).toBeInTheDocument();
    expect(screen.getByAltText("burger.jpg")).toBeInTheDocument();
    expect(screen.getByAltText("fries.jpg")).toBeInTheDocument();
    expect(screen.getByAltText("salad.jpg")).toBeInTheDocument();
  });

  it("filters media by filename as the user types", () => {
    render(<MediaLibrary restaurantId="r1" media={media} />);

    const searchInput = screen.getByLabelText("Search media");
    fireEvent.change(searchInput, { target: { value: "bur" } });

    expect(screen.getByAltText("burger.jpg")).toBeInTheDocument();
    expect(screen.queryByAltText("fries.jpg")).not.toBeInTheDocument();
    expect(screen.queryByAltText("salad.jpg")).not.toBeInTheDocument();
    expect(screen.getByText("1 image")).toBeInTheDocument();
  });

  it("shows an updated empty state when no media matches", () => {
    render(<MediaLibrary restaurantId="r1" media={media} />);

    const searchInput = screen.getByLabelText("Search media");
    fireEvent.change(searchInput, { target: { value: "pizza" } });

    expect(screen.getByText("No media matches your search.")).toBeInTheDocument();
    expect(screen.queryByAltText("burger.jpg")).not.toBeInTheDocument();
  });

  it("clears the search query when the clear button is clicked", () => {
    render(<MediaLibrary restaurantId="r1" media={media} />);

    const searchInput = screen.getByLabelText("Search media");
    fireEvent.change(searchInput, { target: { value: "bur" } });
    expect(screen.queryByAltText("fries.jpg")).not.toBeInTheDocument();

    fireEvent.click(screen.getByLabelText("Clear search"));

    expect(searchInput).toHaveValue("");
    expect(screen.getByAltText("burger.jpg")).toBeInTheDocument();
    expect(screen.getByAltText("fries.jpg")).toBeInTheDocument();
    expect(screen.getByAltText("salad.jpg")).toBeInTheDocument();
  });

  it("performs case-insensitive filtering", () => {
    render(<MediaLibrary restaurantId="r1" media={media} />);

    const searchInput = screen.getByLabelText("Search media");
    fireEvent.change(searchInput, { target: { value: "BUR" } });

    expect(screen.getByAltText("burger.jpg")).toBeInTheDocument();
    expect(screen.queryByAltText("fries.jpg")).not.toBeInTheDocument();
  });

  it("trims whitespace from the search query", () => {
    render(<MediaLibrary restaurantId="r1" media={media} />);

    const searchInput = screen.getByLabelText("Search media");
    fireEvent.change(searchInput, { target: { value: "  bur  " } });

    expect(screen.getByAltText("burger.jpg")).toBeInTheDocument();
  });

  it("opens an inline rename input prefilled with the current name", () => {
    render(<MediaLibrary restaurantId="r1" media={media} />);

    fireEvent.click(screen.getByLabelText("Rename burger.jpg"));

    expect(screen.getByLabelText("Rename media")).toHaveValue("burger.jpg");
  });

  it("saves the new name and shows the server-returned (possibly deduped) name immediately", async () => {
    render(<MediaLibrary restaurantId="r1" media={media} />);

    fireEvent.click(screen.getByLabelText("Rename burger.jpg"));
    fireEvent.change(screen.getByLabelText("Rename media"), {
      target: { value: "tasty-burger.jpg" },
    });
    fireEvent.click(screen.getByLabelText("Save name"));

    await waitFor(() => {
      expect(renameMedia).toHaveBeenCalledWith("1", "tasty-burger.jpg");
    });
    // The server deduped the name; the card must show what was actually saved.
    expect(await screen.findByText("1-tasty-burger.jpg")).toBeInTheDocument();
    expect(screen.queryByText("tasty-burger.jpg")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Rename media")).not.toBeInTheDocument();
  });

  it("does not call the action when the name is unchanged", async () => {
    render(<MediaLibrary restaurantId="r1" media={media} />);

    fireEvent.click(screen.getByLabelText("Rename burger.jpg"));
    fireEvent.click(screen.getByLabelText("Save name"));

    expect(renameMedia).not.toHaveBeenCalled();
    expect(screen.queryByLabelText("Rename media")).not.toBeInTheDocument();
  });

  it("cancels the rename on Escape without calling the action", () => {
    render(<MediaLibrary restaurantId="r1" media={media} />);

    fireEvent.click(screen.getByLabelText("Rename burger.jpg"));
    fireEvent.change(screen.getByLabelText("Rename media"), {
      target: { value: "something-else.jpg" },
    });
    fireEvent.keyDown(screen.getByLabelText("Rename media"), { key: "Escape" });

    expect(renameMedia).not.toHaveBeenCalled();
    expect(screen.queryByLabelText("Rename media")).not.toBeInTheDocument();
    expect(screen.getByText("burger.jpg")).toBeInTheDocument();
  });
});
