import { describe, it, expect, beforeEach } from "vitest";
import { applyLogoToDocument } from "@/components/branding/BrandingPreviewBridge";

// Fixtures mirror the two server-rendered header branches from
// components/menu/Header.tsx (logo present vs. letter avatar fallback).
function renderLogoHeader() {
  document.body.innerHTML = `
    <header>
      <div class="flex items-center gap-3">
        <div class="flex items-center gap-2" data-branding-logo>
          <img src="https://cdn.test/old.png" srcset="https://cdn.test/old.png 1x" alt="Testaurant" class="max-h-8 w-auto object-contain" />
        </div>
      </div>
    </header>
  `;
}

function renderAvatarHeader() {
  document.body.innerHTML = `
    <header>
      <div class="flex items-center gap-3">
        <div class="flex items-center gap-3" data-branding-avatar>
          <div>T</div>
          <div class="flex flex-col">
            <h1 style="color: inherit">Testaurant</h1>
          </div>
        </div>
      </div>
    </header>
  `;
}

const logo = () => document.querySelector<HTMLElement>("[data-branding-logo]")!;
const avatar = () =>
  document.querySelector<HTMLElement>("[data-branding-avatar]")!;

describe("applyLogoToDocument", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  it("swaps the src on an existing logo and drops Next Image's srcset", () => {
    renderLogoHeader();

    applyLogoToDocument(document, "https://cdn.test/new.png");

    const img = logo().querySelector("img")!;
    expect(img.getAttribute("src")).toBe("https://cdn.test/new.png");
    expect(img).not.toHaveAttribute("srcset");
    expect(logo().hidden).toBe(false);
  });

  it("injects a logo and hides the avatar when none existed", () => {
    renderAvatarHeader();

    applyLogoToDocument(document, "https://cdn.test/new.png");

    const img = logo().querySelector("img")!;
    expect(img.getAttribute("src")).toBe("https://cdn.test/new.png");
    expect(img).toHaveClass("max-h-8", "w-auto", "object-contain");
    // Alt comes from the scraped restaurant name.
    expect(img).toHaveAttribute("alt", "Testaurant");
    expect(avatar().hidden).toBe(true);
  });

  it("reveals the existing avatar when the logo is removed", () => {
    renderAvatarHeader();
    applyLogoToDocument(document, "https://cdn.test/new.png");
    expect(avatar().hidden).toBe(true);

    applyLogoToDocument(document, null);

    expect(avatar().hidden).toBe(false);
    expect(logo().hidden).toBe(true);
  });

  it("injects an avatar on removal when the server only rendered the logo", () => {
    renderLogoHeader();
    expect(document.querySelector("[data-branding-avatar]")).toBeNull();

    applyLogoToDocument(document, null);

    // The header must never be blank: logo hidden, avatar injected with the
    // name scraped from the logo's alt text.
    expect(logo().hidden).toBe(true);
    expect(avatar().hidden).toBe(false);
    expect(avatar().querySelector("h1")?.textContent).toBe("Testaurant");
    expect(avatar().textContent).toContain("T");
  });

  it("round-trips: injected avatar is hidden again when a logo is re-added", () => {
    renderLogoHeader();
    applyLogoToDocument(document, null);
    applyLogoToDocument(document, "https://cdn.test/new.png");

    expect(avatar().hidden).toBe(true);
    expect(logo().hidden).toBe(false);
    expect(logo().querySelector("img")!.getAttribute("src")).toBe(
      "https://cdn.test/new.png"
    );
  });
});
