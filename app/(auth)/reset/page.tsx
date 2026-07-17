"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { resetPasswordAction } from "@/lib/auth/actions";

export default function ResetPasswordPage() {
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const result = await resetPasswordAction(formData);

    setLoading(false);
    if (!result.ok) {
      setError(result.message ?? "Something went wrong");
      return;
    }

    setSuccess(true);
    setTimeout(() => {
      router.push("/sign-in");
    }, 2000);
  }

  if (success) {
    return (
      <div className="space-y-4 text-center">
        <h2 className="text-lg font-semibold font-heading">Password updated</h2>
        <p className="text-sm text-muted-foreground">
          Your password has been reset. Redirecting to sign in...
        </p>
        <Link href="/sign-in" className="text-sm text-primary hover:underline">
          Sign in now
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2 text-center">
        <h1 className="text-xl font-semibold font-heading">Choose a new password</h1>
        <p className="text-sm text-muted-foreground">
          Enter your new password below
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="password">New password</Label>
          <Input id="password" name="password" type="password" required minLength={8} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="confirmPassword">Confirm password</Label>
          <Input id="confirmPassword" name="confirmPassword" type="password" required />
        </div>

        {error && (
          <p className="text-sm text-destructive">{error}</p>
        )}

        <Button type="submit" className="w-full" disabled={loading}>
          {loading && <Loader2 className="h-4 w-4 animate-spin" />}
          {loading ? "Updating..." : "Update password"}
        </Button>
      </form>
    </div>
  );
}
