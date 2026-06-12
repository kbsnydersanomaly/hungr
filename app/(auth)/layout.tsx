import Image from "next/image";
import Link from "next/link";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-full flex-col items-center justify-center px-6 py-12 bg-muted/30">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <Link href="/" className="inline-block">
            <Image src="/Logo.svg" alt="Hungr" width={180} height={60} className="h-14 w-auto mx-auto" priority />
          </Link>
        </div>
        {children}
      </div>
    </div>
  );
}
