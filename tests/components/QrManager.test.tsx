import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { QrDownloadLinks, qrDownloadUrl } from "@/components/dashboard/QrManager";

const menus = [
  {
    id: "menu-1",
    name: "Dinner Menu",
    slug: "dinner",
    status: "published",
    qr_assigned: true,
    qr_url: "/qr/dinner.png",
  },
  {
    id: "menu-2",
    name: "Lunch Menu",
    slug: "lunch",
    status: "published",
    qr_assigned: false,
    qr_url: null,
  },
];

describe("QrDownloadLinks", () => {
  it("renders PNG and SVG download links for menus with assigned QR codes", () => {
    render(<QrDownloadLinks menus={menus} />);

    expect(screen.getByText("Dinner Menu")).toBeInTheDocument();
    expect(screen.queryByText("Lunch Menu")).not.toBeInTheDocument();

    const pngLink = screen.getByRole("link", { name: /download png/i });
    const svgLink = screen.getByRole("link", { name: /download svg/i });

    expect(pngLink).toHaveAttribute("href", qrDownloadUrl("menu-1", "png"));
    expect(pngLink).toHaveAttribute("download");
    expect(svgLink).toHaveAttribute("href", qrDownloadUrl("menu-1", "svg"));
    expect(svgLink).toHaveAttribute("download");
  });

  it("renders nothing when no menus have assigned QR codes", () => {
    const { container } = render(
      <QrDownloadLinks menus={[{ ...menus[1] }]} />
    );

    expect(container.firstChild).toBeNull();
  });
});

describe("qrDownloadUrl", () => {
  it("returns the expected API URL for each format", () => {
    expect(qrDownloadUrl("abc", "png")).toBe("/api/qr/abc?format=png");
    expect(qrDownloadUrl("abc", "svg")).toBe("/api/qr/abc?format=svg");
  });
});
