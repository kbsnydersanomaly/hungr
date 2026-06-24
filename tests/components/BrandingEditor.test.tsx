import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { BrandingEditor } from "@/components/branding/BrandingEditor";

vi.mock("@/lib/supabase/client", () => ({
  createBrowserClient: vi.fn(),
}));

vi.mock("@/lib/data/branding-actions", () => ({
  saveDraftAction: vi.fn().mockResolvedValue({ ok: true }),
  publishAction: vi.fn().mockResolvedValue({ ok: true }),
  discardAction: vi.fn().mockResolvedValue({ ok: true }),
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

import {
  saveDraftAction,
  publishAction,
  discardAction,
} from "@/lib/data/branding-actions";
import { toast } from "sonner";

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

  it("marks a successful save as 'All changes saved'", async () => {
    render(<BrandingEditor {...baseProps} />);
    const hexInput = screen.getByDisplayValue("#FE1B54");
    fireEvent.change(hexInput, { target: { value: "#00FF00" } });
    expect(screen.getByText("Unsaved changes")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /^Save$/ }));

    await waitFor(() =>
      expect(screen.getByText("All changes saved")).toBeInTheDocument()
    );
    expect(saveDraftAction).toHaveBeenCalled();
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("reports a failed save and keeps the draft dirty", async () => {
    vi.mocked(saveDraftAction).mockResolvedValueOnce({
      ok: false,
      message: "DB exploded",
    });
    render(<BrandingEditor {...baseProps} />);
    const hexInput = screen.getByDisplayValue("#FE1B54");
    fireEvent.change(hexInput, { target: { value: "#00FF00" } });

    fireEvent.click(screen.getByRole("button", { name: /^Save$/ }));

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("DB exploded")
    );
    // The status must not falsely claim the changes were saved.
    expect(screen.getByText("Unsaved changes")).toBeInTheDocument();
    expect(screen.queryByText("All changes saved")).not.toBeInTheDocument();
  });

  it("confirms before resetting and warns about an unpublished logo", async () => {
    render(
      <BrandingEditor
        {...baseProps}
        live={{ logo_url: null }}
        draft={{ logo_url: "https://cdn.test/new-logo.png" }}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Reset to published" }));

    expect(
      await screen.findByText("Reset branding changes?")
    ).toBeInTheDocument();
    expect(screen.getByText(/logo you uploaded/i)).toBeInTheDocument();
    // Nothing is discarded until the user confirms.
    expect(discardAction).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Reset changes" }));
    await waitFor(() => expect(discardAction).toHaveBeenCalledWith("rest-1"));
  });

  it("does not warn about logo removal when no extra logo exists", async () => {
    render(
      <BrandingEditor
        {...baseProps}
        live={{ logo_url: null }}
        draft={{ logo_url: null }}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Reset to published" }));

    expect(
      await screen.findByText("Reset branding changes?")
    ).toBeInTheDocument();
    expect(screen.queryByText(/logo you uploaded/i)).not.toBeInTheDocument();
  });

  it("undo and redo are disabled until there is history", () => {
    render(<BrandingEditor {...baseProps} />);
    expect(screen.getByRole("button", { name: "Undo" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Redo" })).toBeDisabled();
  });

  it("steps back and forward through edits with undo/redo", () => {
    render(<BrandingEditor {...baseProps} />);

    fireEvent.change(screen.getByDisplayValue("#FE1B54"), {
      target: { value: "#00FF00" },
    });
    expect(screen.getByDisplayValue("#00FF00")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Undo" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Redo" })).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    expect(screen.getByDisplayValue("#FE1B54")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Redo" })).toBeEnabled();

    fireEvent.click(screen.getByRole("button", { name: "Redo" }));
    expect(screen.getByDisplayValue("#00FF00")).toBeInTheDocument();
  });

  it("coalesces consecutive edits to the same field into one undo step", () => {
    render(<BrandingEditor {...baseProps} />);

    fireEvent.change(screen.getByDisplayValue("#FE1B54"), {
      target: { value: "#00FF00" },
    });
    fireEvent.change(screen.getByDisplayValue("#00FF00"), {
      target: { value: "#000000" },
    });

    // A single undo returns to the original value, not the intermediate one.
    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    expect(screen.getByDisplayValue("#FE1B54")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Undo" })).toBeDisabled();
  });
});
