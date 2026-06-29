import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { env } from "@/lib/env";
import type { Database } from "@/lib/database.types";

const PUBLIC_EXACT = ["/sign-in", "/forgot", "/reset", "/verify", "/api/health"];

const PUBLIC_PREFIXES = [
  "/m/",
  "/sign-in",
  "/forgot",
  "/reset",
  "/verify",
  "/accept-invite/",
  "/api/webhooks/",
  "/api/qr/",
  "/api/cron/", // protected by CRON_SECRET in the route handler
];

function isPublicPath(pathname: string): boolean {
  return (
    PUBLIC_EXACT.includes(pathname) ||
    PUBLIC_PREFIXES.some(
      (p) => pathname === p.replace(/\/$/, "") || pathname.startsWith(p)
    )
  );
}

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Legacy sign-up route now lives inside /sign-in.
  if (pathname === "/sign-up" || pathname.startsWith("/sign-up/")) {
    return NextResponse.redirect(new URL("/sign-in", req.url));
  }

  // Create a Supabase client bound to the request/response so that
  // refreshed session cookies are forwarded to both the server
  // components (via the mutated request) and the browser.
  let response = NextResponse.next({ request: req });

  const supabase = createServerClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return req.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            req.cookies.set(name, value);
          }
          response = NextResponse.next({ request: req });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Authenticated users hitting the removed homepage go to the dashboard.
  if (user && pathname === "/") {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  if (isPublicPath(pathname)) {
    return response;
  }

  if (!user) {
    const url = req.nextUrl.clone();
    url.pathname = "/sign-in";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  if (pathname.startsWith("/admin")) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("is_super_admin")
      .eq("id", user.id)
      .single();
    if (!profile?.is_super_admin) {
      return NextResponse.redirect(new URL("/dashboard", req.url));
    }
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|js|css|woff2?)$).*)",
  ],
};
