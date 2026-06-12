import Link from "next/link";

export default function Home() {
  return (
    <div className="flex flex-col items-center justify-center py-24 px-6 text-center">
      <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
        Digital menus that just work
      </h1>
      <p className="mt-4 text-lg text-muted-foreground max-w-xl">
        Create, manage, and share beautiful menus for your restaurant. No app downloads needed.
      </p>
      <div className="mt-8 flex gap-4">
        <Link
          href="/sign-up"
          className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-6 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90"
        >
          Get started
        </Link>
        <Link
          href="/pricing"
          className="inline-flex h-10 items-center justify-center rounded-md border border-input bg-background px-6 text-sm font-medium shadow-sm hover:bg-accent hover:text-accent-foreground"
        >
          View pricing
        </Link>
      </div>
    </div>
  );
}
