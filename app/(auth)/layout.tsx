import Image from "next/image";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen grid grid-cols-1 md:grid-cols-2">
      <div className="relative hidden md:block">
        <Image
          src="/login.webp"
          alt="Hungr dashboard and mobile menu preview"
          fill
          className="object-cover"
          sizes="(max-width: 768px) 0vw, 50vw"
          priority
        />
      </div>
      <div className="flex flex-col items-center justify-center px-6 py-12 bg-background">
        <div className="w-full max-w-sm">
          <div className="mb-8 text-center">
            <Image
              src="/Logo.svg"
              alt="Hungr"
              width={180}
              height={60}
              className="h-14 w-auto mx-auto"
              priority
            />
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}
