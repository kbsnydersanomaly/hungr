import Link from "next/link";
import Image from "next/image";
import { Info } from "lucide-react";
import { publicAboutHref } from "@/lib/menu/public-routes";
import { MobileNav } from "./MobileNav";

interface HeaderProps {
  restaurantName: string;
  logoUrl?: string | null;
  children?: React.ReactNode;
  restaurantSlug: string;
  currentMenuSlug: string;
  menus?: Array<{ id: string; name: string; slug: string }>;
  categories?: Array<{ id: string; name: string }>;
}

export function Header({
  restaurantName,
  logoUrl,
  children,
  restaurantSlug,
  currentMenuSlug,
  menus = [],
  categories = [],
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
          <Image
            src={logoUrl}
            alt={restaurantName}
            width={32}
            height={32}
            className="h-8 w-8 rounded-full object-cover"
          />
        ) : (
          <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary">
            {restaurantName.charAt(0)}
          </div>
        )}
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
      <div className="flex items-center gap-2">
        <Link
          href={publicAboutHref(restaurantSlug, currentMenuSlug)}
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
        />
      </div>
    </header>
  );
}
