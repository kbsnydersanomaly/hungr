import { redirect } from "next/navigation";
import { getActiveOrg } from "@/lib/auth/active-org";
import { createServerClient } from "@/lib/supabase/server";
import { updateOrganizationName } from "@/lib/data/organization-actions";
import { PageHeader } from "@/components/PageHeader";
import { ServerActionForm } from "@/components/forms/ServerActionForm";
import { SubmitButton } from "@/components/forms/SubmitButton";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default async function OrganizationSettingsPage() {
  const activeOrg = await getActiveOrg();
  if (!activeOrg?.orgId) redirect("/dashboard");
  // Organization settings are owner/admin only.
  if (activeOrg.role !== "owner" && activeOrg.role !== "admin") {
    redirect("/settings/profile");
  }

  const supabase = await createServerClient();
  const { data: org } = await supabase
    .from("organizations")
    .select("name")
    .eq("id", activeOrg.orgId)
    .single();

  return (
    <div className="space-y-6 max-w-xl">
      <PageHeader
        title="Organization"
        description="Manage your organization settings"
      />
      <Card>
        <CardContent className="space-y-4">
          <ServerActionForm
            action={updateOrganizationName}
            successMessage="Organization name updated."
          >
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Organization name</Label>
                <Input
                  id="name"
                  name="name"
                  defaultValue={org?.name ?? ""}
                  placeholder="e.g. Acme Inc."
                  required
                />
              </div>
              <SubmitButton>Save changes</SubmitButton>
            </div>
          </ServerActionForm>
        </CardContent>
      </Card>
    </div>
  );
}
