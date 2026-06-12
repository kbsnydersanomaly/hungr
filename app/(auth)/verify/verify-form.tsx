"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { createBrowserClient } from "@/lib/supabase/client";

export default function VerifyForm() {
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const searchParams = useSearchParams();

  useEffect(() => {
    async function verify() {
      const code = searchParams.get("code");
      if (!code) {
        setStatus("error");
        return;
      }

      const supabase = createBrowserClient();
      const { error } = await supabase.auth.exchangeCodeForSession(code);

      if (error) {
        setStatus("error");
        return;
      }

      setStatus("success");
    }

    verify();
  }, [searchParams]);

  if (status === "loading") {
    return (
      <div className="text-center space-y-4">
        <h2 className="text-lg font-semibold font-heading">Verifying your email...</h2>
        <p className="text-sm text-muted-foreground">Just a moment</p>
      </div>
    );
  }

  if (status === "success") {
    return (
      <div className="text-center space-y-4">
        <h2 className="text-lg font-semibold font-heading">Email verified</h2>
        <p className="text-sm text-muted-foreground">
          Your account is ready. You can now sign in.
        </p>
        <Link
          href="/sign-in"
          className="inline-flex h-8 items-center justify-center rounded-lg bg-primary px-2.5 text-sm font-medium text-primary-foreground whitespace-none transition-all hover:bg-primary/80 w-full"
        >
          Sign in
        </Link>
      </div>
    );
  }

  return (
    <div className="text-center space-y-4">
      <h2 className="text-lg font-semibold font-heading">Verification failed</h2>
      <p className="text-sm text-muted-foreground">
        The verification link is invalid or has expired.
      </p>
      <Link
        href="/sign-up"
        className="inline-flex h-8 items-center justify-center rounded-lg border border-border bg-background px-2.5 text-sm font-medium transition-all hover:bg-muted w-full"
      >
        Back to sign up
      </Link>
    </div>
  );
}
