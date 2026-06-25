import Link from "next/link";
import { ArrowLeft } from "lucide-react";

interface MenuBackLinkProps {
  href: string;
  label?: string;
}

export function MenuBackLink({ href, label = "Back to menu" }: MenuBackLinkProps) {
  return (
    <Link
      href={href}
      className="inline-flex min-h-9 items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
    >
      <ArrowLeft className="h-4 w-4 shrink-0" aria-hidden="true" />
      {label}
    </Link>
  );
}
