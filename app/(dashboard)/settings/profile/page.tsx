import { requireSession } from "@/lib/auth/session";
import { createServerClient } from "@/lib/supabase/server";
import { updateProfile } from "@/lib/data/profile-actions";
import { PageHeader } from "@/components/PageHeader";
import { ServerActionForm } from "@/components/forms/ServerActionForm";
import { FormFieldset } from "@/components/forms/FormFieldset";
import { SubmitButton } from "@/components/forms/SubmitButton";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DeleteAccountDialog } from "@/components/dashboard/DeleteAccountDialog";

export default async function ProfileSettingsPage() {
  const { user } = await requireSession();

  const supabase = await createServerClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, first_name, last_name, phone")
    .eq("id", user.id)
    .single();

  return (
    <div className="space-y-6 max-w-xl">
      <PageHeader title="Profile" description="Manage your account settings" />
      <Card>
        <CardContent className="space-y-4">
          <ServerActionForm
            action={updateProfile}
            successMessage="Profile updated."
          >
            <FormFieldset className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" value={user.email ?? ""} disabled />
              </div>
              <div className="space-y-2">
                <Label htmlFor="display_name">Display name</Label>
                <Input
                  id="display_name"
                  name="display_name"
                  defaultValue={profile?.display_name ?? ""}
                  placeholder="Your display name"
                  required
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="first_name">First name</Label>
                  <Input
                    id="first_name"
                    name="first_name"
                    defaultValue={profile?.first_name ?? ""}
                    placeholder="First name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="last_name">Last name</Label>
                  <Input
                    id="last_name"
                    name="last_name"
                    defaultValue={profile?.last_name ?? ""}
                    placeholder="Last name"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Cellphone</Label>
                <Input
                  id="phone"
                  name="phone"
                  type="tel"
                  defaultValue={profile?.phone ?? ""}
                  placeholder="082 123 4567"
                />
              </div>
              <SubmitButton>Save changes</SubmitButton>
            </FormFieldset>
          </ServerActionForm>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="flex items-center justify-between gap-4">
          <div className="space-y-1">
            <p className="font-medium">Delete account</p>
            <p className="text-sm text-muted-foreground">
              Permanently delete your account and everything you own.
            </p>
          </div>
          <DeleteAccountDialog email={user.email ?? ""} />
        </CardContent>
      </Card>
    </div>
  );
}
