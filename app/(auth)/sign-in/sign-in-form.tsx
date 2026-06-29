"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { signInAction, resendVerificationEmail } from "@/lib/auth/actions";

const RESEND_COOLDOWN_SECONDS = 60;

interface SignInFormProps {
  onSwitchToSignUp: () => void;
}

export default function SignInForm({
  onSwitchToSignUp,
}: SignInFormProps) {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [resendLoading, setResendLoading] = useState(false);
  const [resendCountdown, setResendCountdown] = useState(0);
  const [resendMessage, setResendMessage] = useState<string | null>(null);
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextParam = searchParams.get("next");
  // Only allow same-site relative paths to prevent open redirects.
  const next =
    nextParam?.startsWith("/") && !nextParam.startsWith("//")
      ? nextParam
      : "/dashboard";

  useEffect(() => {
    if (resendCountdown <= 0) return;
    const timer = setTimeout(() => {
      setResendCountdown((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearTimeout(timer);
  }, [resendCountdown]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setResendMessage(null);
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const result = await signInAction(formData);

    setLoading(false);
    if (!result.ok) {
      setError(result.message ?? "Something went wrong");
      return;
    }

    router.push(next);
    router.refresh();
  }

  const isUnconfirmedError =
    error?.toLowerCase().includes("not confirmed") ?? false;

  async function handleResend() {
    if (!email || !password || resendCountdown > 0 || resendLoading) return;

    setResendLoading(true);
    setResendMessage(null);
    const result = await resendVerificationEmail(email, password);
    setResendLoading(false);

    if (!result.ok) {
      setResendMessage(result.message ?? "Failed to resend email");
      return;
    }

    setResendCountdown(RESEND_COOLDOWN_SECONDS);
    setResendMessage("Verification email sent.");
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2 text-center">
        <h1 className="text-xl font-semibold font-heading">Log in</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            name="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Password</Label>
            <Link
              href="/forgot"
              className="text-sm text-muted-foreground hover:text-primary"
            >
              Forgot Password?
            </Link>
          </div>
          <Input
            id="password"
            name="password"
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>

        {error && (
          <div className="flex items-start justify-between gap-3 text-sm">
            <p className="text-destructive">{error}</p>
            {isUnconfirmedError && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-auto shrink-0 px-2 py-1 text-xs"
                onClick={handleResend}
                disabled={
                  resendLoading || resendCountdown > 0 || !email || !password
                }
              >
                {resendLoading
                  ? "Sending..."
                  : resendCountdown > 0
                  ? `Resend in ${resendCountdown}s`
                  : "Resend email"}
              </Button>
            )}
          </div>
        )}

        {resendMessage && !error && (
          <p className="text-sm text-muted-foreground">{resendMessage}</p>
        )}

        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? "Signing in..." : "Log in"}
        </Button>
      </form>

      <p className="text-center text-sm text-muted-foreground">
        Don&apos;t have an account?{" "}
        <button
          type="button"
          onClick={onSwitchToSignUp}
          className="text-primary hover:underline"
        >
          Sign up
        </button>
      </p>
    </div>
  );
}
