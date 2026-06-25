import { redirect } from "next/navigation";
import { getActiveOrg } from "@/lib/auth/active-org";
import { getNotificationPrefs, updateNotificationPrefs } from "@/lib/data/notification-actions";
import { PageHeader } from "@/components/PageHeader";
import { ServerActionForm } from "@/components/forms/ServerActionForm";
import { SubmitButton } from "@/components/forms/SubmitButton";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Bell } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function NotificationsSettingsPage() {
  const activeOrg = await getActiveOrg();
  if (!activeOrg?.orgId) redirect("/dashboard");

  const prefsResult = await getNotificationPrefs();
  const prefs = prefsResult.ok ? (prefsResult.data ?? {}) : {};

  return (
    <div className="space-y-6 max-w-xl">
      <PageHeader
        title="Notifications"
        description="Choose what you want to be notified about"
      />

      <Card>
        <CardContent className="space-y-6">
          <ServerActionForm
            action={updateNotificationPrefs}
            successMessage="Notification preferences updated."
          >
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Bell className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="font-medium text-sm">Review notifications</p>
                    <p className="text-xs text-muted-foreground">
                      Email when a new review is submitted
                    </p>
                  </div>
                </div>
                <Switch
                  name="review_emails"
                  defaultChecked={prefs.review_emails !== false}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Bell className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="font-medium text-sm">Payment notifications</p>
                    <p className="text-xs text-muted-foreground">
                      Email on successful or failed payments
                    </p>
                  </div>
                </div>
                <Switch
                  name="payment_emails"
                  defaultChecked={prefs.payment_emails !== false}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Bell className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="font-medium text-sm">Team updates</p>
                    <p className="text-xs text-muted-foreground">
                      Email when team members join or leave
                    </p>
                  </div>
                </div>
                <Switch
                  name="team_emails"
                  defaultChecked={prefs.team_emails !== false}
                />
              </div>

              <SubmitButton>Save preferences</SubmitButton>
            </div>
          </ServerActionForm>
        </CardContent>
      </Card>
    </div>
  );
}
