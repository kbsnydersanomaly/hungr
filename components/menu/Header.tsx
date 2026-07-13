import Link from "next/link";
import Image from "next/image";
import { Info } from "lucide-react";
import { MobileNav } from "./MobileNav";

interface HeaderProps {
  restaurantName: string;
  logoUrl?: string | null;
  children?: React.ReactNode;
  restaurantSlug: string;
  currentMenuSlug: string;
  menus?: Array<{ id: string; name: string; slug: string }>;
  categories?: Array<{ id: string; name: string }>;
  /** Forwarded to MobileNav for in-page category filtering. */
  onCategorySelect?: (id: string) => void;
}

export function Header({
  restaurantName,
  logoUrl,
  children,
  restaurantSlug,
  currentMenuSlug,
  menus = [],
  categories = [],
  onCategorySelect,
}: HeaderProps) {
  return (
    <header
      className="sticky top-0 z-10 flex items-center justify-between px-4 py-3"
      style={{
        backgroundColor: "var(--color-nav-bar, #fff)",
        // Icons and text use currentColor, so they flip between black and
        // white based on the nav bar color's luminance (see brandingToCssVars).
        color: "var(--color-nav-bar-foreground, #181818)",
      }}
    >
      <div className="flex items-center gap-3">
        {logoUrl ? (
          // The preview bridge injects equivalent markup live when a logo is
          // first picked (see applyLogoToDocument) — keep both in sync.
          <div className="flex items-center gap-2" data-branding-logo>
            <Image
              src={logoUrl}
              alt={restaurantName}
              width={160}
              height={32}
              className="max-h-8 w-auto object-contain"
            />
            {children && <div className="text-xs">{children}</div>}
          </div>
        ) : (
          // data-branding-* hooks let the branding editor's preview bridge
          // swap the avatar for a logo (and back) live, without a reload.
          <div className="flex items-center gap-3" data-branding-avatar>
            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary">
              {restaurantName.charAt(0)}
            </div>
            <div className="flex flex-col">
              {/* Inline color beats the .branding-scope heading rule so the name
                  stays readable against the chosen nav bar color. */}
              <h1
                className="text-base font-semibold font-heading leading-tight"
                style={{ color: "inherit" }}
              >
                {restaurantName}
              </h1>
              {children && <div className="text-xs">{children}</div>}
            </div>
          </div>
        )}
      </div>
      <div className="flex items-center gap-2">
        <Link
          href={`/m/${restaurantSlug}/about`}
          aria-label={`About ${restaurantName}`}
          className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-current/10"
        >
          <Info className="h-5 w-5" aria-hidden="true" />
        </Link>
        <MobileNav
          restaurantSlug={restaurantSlug}
          restaurantName={restaurantName}
          currentMenuSlug={currentMenuSlug}
          menus={menus}
          categories={categories}
          onCategorySelect={onCategorySelect}
        />
      </div>
    </header>
  );
}
