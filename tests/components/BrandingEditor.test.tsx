import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { BrandingEditor } from "@/components/branding/BrandingEditor";

vi.mock("@/lib/supabase/client", () => ({
  createBrowserClient: vi.fn(),
}));

vi.mock("@/lib/data/branding-actions", () => ({
  saveDraftAction: vi.fn().mockResolvedValue(undefined),
  publishAction: vi.fn().mockResolvedValue(undefined),
  discardAction: vi.fn().mockResolvedValue(undefined),
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

import { publishAction } from "@/lib/data/branding-actions";

const baseProps = {
  restaurantId: "rest-1",
  restaurantSlug: "testaurant",
  live: null,
  draft: {
    nav_bar_color: "#181818",
    primary_color: "#FE1B54",
    main_heading: { color: "#222222" },
    body: { color: "#333333" },
  },
};

describe("BrandingEditor", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("groups controls into Nav bar & logo, Colors and Typography sections", () => {
    render(<BrandingEditor {...baseProps} />);

    const sectionLabels = ["Nav bar & logo", "Colors", "Typography"];
    for (const label of sectionLabels) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }

    // Section order matches the grouped layout.
    const positions = sectionLabels.map((label) => {
      const el = screen.getByText(label);
      return el.compareDocumentPosition(screen.getByText("Typography"));
    });
    // The first two labels precede "Typography" in the document.
    expect(positions[0] & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(positions[1] & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("keeps the nav bar color with the logo controls", () => {
    render(<BrandingEditor {...baseProps} />);
    const navColorPicker = screen.getByLabelText("Nav bar color");
    const navSection = screen.getByText("Nav bar & logo").closest("div");
    expect(navSection).toContainElement(navColorPicker);
  });

  it("keeps typography colors with the font selects", () => {
    render(<BrandingEditor {...baseProps} />);
    const typographySection = screen.getByText("Typography").closest("div");
    expect(typographySection).toContainElement(
      screen.getByLabelText("Heading color color")
    );
    expect(typographySection).toContainElement(
      screen.getByLabelText("Body text color color")
    );
    expect(typographySection).toContainElement(screen.getByText("Heading font"));
    expect(typographySection).toContainElement(screen.getByText("Body font"));
  });

  it("shows general color roles in the Colors section", () => {
    render(<BrandingEditor {...baseProps} />);
    const colorsSection = screen.getByText("Colors").closest("div");
    for (const label of ["Background", "Primary", "Secondary", "Accent"]) {
      expect(colorsSection).toContainElement(screen.getByLabelText(`${label} color`));
    }
    // Nav bar lives in its own group now, not under Colors.
    expect(colorsSection).not.toContainElement(screen.getByLabelText("Nav bar color"));
  });

  it("marks the draft dirty when a color changes", () => {
    render(<BrandingEditor {...baseProps} />);
    expect(screen.getByText("All changes saved")).toBeInTheDocument();

    const hexInput = screen.getByDisplayValue("#FE1B54");
    fireEvent.change(hexInput, { target: { value: "#00FF00" } });

    expect(screen.getByText("Unsaved changes")).toBeInTheDocument();
  });

  it("posts updated CSS vars to the preview iframe when a color changes", async () => {
    render(<BrandingEditor {...baseProps} />);
    const iframe = screen.getByTitle("Menu preview") as HTMLIFrameElement;
    const postMessage = vi.spyOn(iframe.contentWindow!, "postMessage");

    const hexInput = screen
      .getAllByDisplayValue("#181818")
      .find((el) => (el as HTMLInputElement).type !== "color")!;
    fireEvent.change(hexInput, { target: { value: "#FFFFFF" } });

    await waitFor(() => {
      expect(postMessage).toHaveBeenCalled();
    });
    const lastCall = postMessage.mock.calls.at(-1)![0] as {
      type: string;
      vars: Record<string, string>;
    };
    expect(lastCall.type).toBe("hungr-branding-preview");
    expect(lastCall.vars["--color-nav-bar"]).toBe("#FFFFFF");
    // Contrast foreground follows the new nav color (light bg → dark icons).
    expect(lastCall.vars["--color-nav-bar-foreground"]).toBe("#181818");
  });

  it("publishes via the publish action", async () => {
    render(<BrandingEditor {...baseProps} />);
    fireEvent.click(screen.getByRole("button", { name: "Publish changes" }));
    await waitFor(() => {
      expect(publishAction).toHaveBeenCalledWith("rest-1");
    });
  });
});
