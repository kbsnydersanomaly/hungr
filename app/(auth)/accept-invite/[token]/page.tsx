import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { signOutAction } from "@/lib/auth/actions";
import { loadInvitationByToken } from "@/lib/data/invitations";
import { acceptInvitation, acceptInviteAndSignUp } from "@/lib/auth/invitations";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Clock, CheckCircle, XCircle, AlertCircle } from "lucide-react";

export default async function AcceptInvitePage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { token } = await params;
  const { error } = await searchParams;
  const inv = await loadInvitationByToken(token);

  // Invalid invitation
  if (!inv) {
    return (
      <Card className="w-full max-w-md mx-auto">
        <CardHeader className="text-center">
          <XCircle className="h-12 w-12 text-destructive mx-auto mb-2" />
          <CardTitle>Invitation not found</CardTitle>
          <CardDescription>
            This invitation link is invalid or has been removed.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  // Already accepted
  if (inv.accepted_at) {
    return (
      <Card className="w-full max-w-md mx-auto">
        <CardHeader className="text-center">
          <CheckCircle className="h-12 w-12 text-accent mx-auto mb-2" />
          <CardTitle>Already accepted</CardTitle>
          <CardDescription>
            You have already accepted this invitation to <strong>{inv.organizations?.name}</strong>.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild className="w-full">
            <Link href="/dashboard">Go to dashboard</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Revoked
  if (inv.revoked_at) {
    return (
      <Card className="w-full max-w-md mx-auto">
        <CardHeader className="text-center">
          <XCircle className="h-12 w-12 text-destructive mx-auto mb-2" />
          <CardTitle>Invitation revoked</CardTitle>
          <CardDescription>
            This invitation to <strong>{inv.organizations?.name}</strong> has been revoked by the sender.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  // Expired
  if (new Date(inv.expires_at) < new Date()) {
    return (
      <Card className="w-full max-w-md mx-auto">
        <CardHeader className="text-center">
          <Clock className="h-12 w-12 text-muted-foreground mx-auto mb-2" />
          <CardTitle>Invitation expired</CardTitle>
          <CardDescription>
            This invitation to <strong>{inv.organizations?.name}</strong> expired on{" "}
            {new Date(inv.expires_at).toLocaleDateString()}.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const session = await getSession();

  // Signed in with matching email → one-click accept
  if (session && session.user.email?.toLowerCase() === inv.email.toLowerCase()) {
    return (
      <Card className="w-full max-w-md mx-auto">
        <CardHeader className="text-center">
          <AlertCircle className="h-12 w-12 text-primary mx-auto mb-2" />
          <CardTitle>You&apos;ve been invited</CardTitle>
          <CardDescription>
            You have been invited to join <strong>{inv.organizations?.name}</strong> as a{" "}
            <strong>{inv.role}</strong>.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {error && <p className="text-sm text-destructive text-center">{error}</p>}
          <form
            action={async () => {
              "use server";
              const result = await acceptInvitation(token);
              if (result.ok) {
                redirect("/dashboard");
              }
              redirect(
                `/accept-invite/${token}?error=${encodeURIComponent(
                  result.message ?? "Failed to accept invitation."
                )}`
              );
            }}
          >
            <Button type="submit" className="w-full">
              Accept invitation
            </Button>
          </form>
        </CardContent>
      </Card>
    );
  }

  // Signed in with different email
  if (session && session.user.email?.toLowerCase() !== inv.email.toLowerCase()) {
    return (
      <Card className="w-full max-w-md mx-auto">
        <CardHeader className="text-center">
          <AlertCircle className="h-12 w-12 text-primary mx-auto mb-2" />
          <CardTitle>Wrong account</CardTitle>
          <CardDescription>
            This invitation was sent to <strong>{inv.email}</strong>, but you are signed in as{" "}
            <strong>{session.user.email}</strong>.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <form action={signOutAction}>
            <Button type="submit" variant="outline" className="w-full">
              Sign out and use the correct email
            </Button>
          </form>
        </CardContent>
      </Card>
    );
  }

  // Not signed in → sign-up form (invitation acts as pre-validation)
  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader className="text-center">
        <AlertCircle className="h-12 w-12 text-primary mx-auto mb-2" />
        <CardTitle>You&apos;ve been invited</CardTitle>
        <CardDescription>
          Create your account to join <strong>{inv.organizations?.name}</strong> as a{" "}
          <strong>{inv.role}</strong>.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {error && <p className="text-sm text-destructive text-center">{error}</p>}
        <SignUpForm token={token} email={inv.email} />
      </CardContent>
    </Card>
  );
}

function SignUpForm({ token, email }: { token: string; email: string }) {
  return (
    <form
      action={async (formData: FormData) => {
        "use server";
        const result = await acceptInviteAndSignUp(token, formData);
        if (result.ok) {
          redirect("/dashboard");
        }
        redirect(
          `/accept-invite/${token}?error=${encodeURIComponent(
            result.message ?? "Failed to create your account."
          )}`
        );
      }}
      className="space-y-4"
    >
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input id="email" value={email} disabled />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="firstName">First name</Label>
          <Input id="firstName" name="firstName" required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="lastName">Last name</Label>
          <Input id="lastName" name="lastName" required />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <Input id="password" name="password" type="password" required minLength={8} />
      </div>

      <Button type="submit" className="w-full">
        Create account &amp; accept
      </Button>
    </form>
  );
}
