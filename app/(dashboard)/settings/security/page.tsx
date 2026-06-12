import { redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
import { getActiveOrg } from "@/lib/auth/active-org";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Lock } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function SecuritySettingsPage() {
  const activeOrg = await getActiveOrg();
  if (!activeOrg?.orgId) redirect("/dashboard");

  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div className="space-y-6 max-w-xl">
      <PageHeader
        title="Security"
        description="Manage your account security"
      />

      <Card>
        <CardContent className="space-y-6">
          <div className="flex items-center gap-3">
            <Lock className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="font-medium text-sm">Change password</p>
              <p className="text-xs text-muted-foreground">
                {user?.email}
              </p>
            </div>
          </div>

          <form
            action="/api/auth/reset-password"
            method="POST"
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label htmlFor="current">Current password</Label>
              <Input id="current" name="current" type="password" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new">New password</Label>
              <Input id="new" name="new" type="password" required minLength={8} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm">Confirm new password</Label>
              <Input id="confirm" name="confirm" type="password" required />
            </div>
            <Button type="submit">Update password</Button>
          </form>

          <p className="text-xs text-muted-foreground">
            Password changes are handled by Supabase Auth. If you have forgotten
            your password, sign out and use the forgot password flow.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
