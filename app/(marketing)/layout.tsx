import Link from "next/link";

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col min-h-full">
      <header className="border-b px-6 py-4 flex items-center justify-between">
        <Link href="/" className="font-bold text-lg">
          Hungr
        </Link>
        <nav className="flex gap-4 text-sm">
          <Link href="/pricing" className="hover:underline">Pricing</Link>
          <Link href="/sign-in" className="hover:underline">Sign in</Link>
        </nav>
      </header>
      <main className="flex-1">{children}</main>
      <footer className="border-t px-6 py-4 text-xs text-muted-foreground">
        &copy; {new Date().getFullYear()} Hungr
      </footer>
    </div>
  );
}
