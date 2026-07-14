import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { AboutEditor } from "@/components/dashboard/AboutEditor";

vi.mock("@/lib/supabase/client", () => ({
  createBrowserClient: vi.fn(),
}));

vi.mock("@/lib/data/about-actions", () => ({
  // safeAction result shape — the editor checks `ok` before toasting success.
  saveAboutPage: vi.fn().mockResolvedValue({ ok: true, data: { saved: true } }),
}));

vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
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

import { saveAboutPage } from "@/lib/data/about-actions";

const baseProps = {
  restaurantId: "rest-1",
  restaurantSlug: "testaurant",
  about: {
    about_text: "We serve great food.",
    business_hours: "Mon–Sun: 9am–10pm",
    email: "hello@testaurant.com",
    phone: "+27 12 345 6789",
    main_image_url: "https://cdn.test/main.png",
    gallery_urls: ["https://cdn.test/g1.png", "https://cdn.test/g2.png"],
    show_business_hours: true,
    show_contact: true,
  },
};

describe("AboutEditor", () => {
  let originalWidth: number;

  beforeEach(() => {
    originalWidth = window.innerWidth;
    vi.clearAllMocks();
  });

  afterEach(() => {
    window.innerWidth = originalWidth;
  });

  it("renders the editor form and preview iframe", () => {
    render(<AboutEditor {...baseProps} />);

    expect(
      screen.getByPlaceholderText("Tell your customers about your restaurant...")
    ).toHaveValue("We serve great food.");
    expect(screen.getByTitle("About preview")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Refresh preview" })
    ).toBeInTheDocument();
  });

  it("preserves existing gallery_urls on save", async () => {
    render(<AboutEditor {...baseProps} />);

    fireEvent.click(screen.getByRole("button", { name: "Save about page" }));

    await waitFor(() => expect(saveAboutPage).toHaveBeenCalled());

    const [, formData] = vi.mocked(saveAboutPage).mock.calls[0];
    expect(formData.get("gallery_urls")).toBe(
      JSON.stringify(baseProps.about.gallery_urls)
    );
  });

  it("reloads the preview iframe after a successful save", async () => {
    render(<AboutEditor {...baseProps} />);

    const iframe = screen.getByTitle("About preview") as HTMLIFrameElement;
    const reloadSpy = vi.spyOn(iframe, "src", "set");

    fireEvent.click(screen.getByRole("button", { name: "Save about page" }));

    await waitFor(() => expect(reloadSpy).toHaveBeenCalledWith("/m/testaurant/about"));
  });

  it("reloads the preview iframe when refresh is clicked", () => {
    render(<AboutEditor {...baseProps} />);

    const iframe = screen.getByTitle("About preview") as HTMLIFrameElement;
    const reloadSpy = vi.spyOn(iframe, "src", "set");

    fireEvent.click(screen.getByRole("button", { name: "Refresh preview" }));

    expect(reloadSpy).toHaveBeenCalledWith("/m/testaurant/about");
  });

  it("reflects updated gallery_urls in the save payload", async () => {
    const { container } = render(<AboutEditor {...baseProps} />);

    // Remove the first gallery image via the remove button.
    const removeButtons = container.querySelectorAll(
      "button[aria-label='Remove image']"
    );
    expect(removeButtons.length).toBeGreaterThan(0);
    fireEvent.click(removeButtons[0]);

    fireEvent.click(screen.getByRole("button", { name: "Save about page" }));

    await waitFor(() => expect(saveAboutPage).toHaveBeenCalled());

    const [, formData] = vi.mocked(saveAboutPage).mock.calls[0];
    expect(formData.get("gallery_urls")).toBe(
      JSON.stringify(["https://cdn.test/g2.png"])
    );
  });

  it("shows Editor/Preview tabs and a refresh button on small viewports", () => {
    window.innerWidth = 375;
    render(<AboutEditor {...baseProps} />);

    expect(screen.getByRole("tab", { name: "Editor" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Preview" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Refresh preview" })
    ).toBeInTheDocument();
  });

  it("switches the active tab on small viewports", () => {
    window.innerWidth = 375;
    render(<AboutEditor {...baseProps} />);

    const editorTab = screen.getByRole("tab", { name: "Editor" });
    const previewTab = screen.getByRole("tab", { name: "Preview" });

    expect(editorTab).toHaveAttribute("aria-selected", "true");
    expect(editorTab).toHaveAttribute("aria-controls", "editor-panel");
    expect(previewTab).toHaveAttribute("aria-selected", "false");
    expect(previewTab).toHaveAttribute("aria-controls", "preview-panel");
    expect(editorTab).toHaveClass("bg-background");
    expect(previewTab).not.toHaveClass("bg-background");

    fireEvent.click(previewTab);

    expect(editorTab).toHaveAttribute("aria-selected", "false");
    expect(previewTab).toHaveAttribute("aria-selected", "true");
    expect(editorTab).not.toHaveClass("bg-background");
    expect(previewTab).toHaveClass("bg-background");
  });
});
