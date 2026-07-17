import type { Metadata } from "next";
import { Poppins, Figtree } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { PostHogProvider } from "@/components/analytics/PostHogProvider";
import { NavigationProgress } from "@/components/NavigationProgress";
import "./globals.css";

const poppins = Poppins({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  display: "swap",
});

const figtree = Figtree({
  variable: "--font-heading",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Hungr — Digital Menus Made Simple",
  description: "Create beautiful digital menus for your restaurant.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${poppins.variable} ${figtree.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col font-body">
        <PostHogProvider
          apiKey={process.env.NEXT_PUBLIC_POSTHOG_KEY}
          apiHost={process.env.NEXT_PUBLIC_POSTHOG_HOST}
        >
          {children}
        </PostHogProvider>
        <NavigationProgress />
        <Toaster position="bottom-right" richColors />
      </body>
    </html>
  );
}
