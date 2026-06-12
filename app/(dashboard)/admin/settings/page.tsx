import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { isBottomNavEnabled } from "@/lib/data/platform-settings";
import { BottomNavToggle } from "@/components/admin/BottomNavToggle";

export const dynamic = "force-dynamic";

export default async function AdminSettingsPage() {
  const bottomNavEnabled = await isBottomNavEnabled();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Platform settings"
        description="Global toggles that apply to every restaurant's public menu"
      />

      <Card>
        <CardContent>
          <div className="flex items-center justify-between gap-4">
            <div className="space-y-1">
              <p className="font-medium">Public menu bottom navigation</p>
              <p className="text-sm text-muted-foreground">
                Show the Menu / Order / History bar at the bottom of public
                menus. Order and History are not live yet, so this can be
                switched off platform-wide.
              </p>
            </div>
            <BottomNavToggle initialEnabled={bottomNavEnabled} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
