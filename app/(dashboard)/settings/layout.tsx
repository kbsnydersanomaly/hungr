import { getActiveOrg } from "@/lib/auth/active-org";
import { TabNav, type TabNavItem } from "@/components/dashboard/TabNav";

// Org-level tabs (organization, team, billing) are only for owners/admins;
// managers and staff manage just their own account here.
const personalNav: TabNavItem[] = [
  { href: "/settings/profile", label: "Profile", icon: "user" },
  { href: "/settings/security", label: "Security", icon: "shield" },
  { href: "/settings/notifications", label: "Notifications", icon: "bell" },
];

const orgNav: TabNavItem[] = [
  { href: "/settings/organization", label: "Organization", icon: "building" },
  { href: "/settings/team", label: "Team", icon: "users" },
  { href: "/settings/billing", label: "Billing", icon: "credit-card" },
];

export default async function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const org = await getActiveOrg();
  const isOrgAdmin = org?.role === "owner" || org?.role === "admin";

  const settingsNav: TabNavItem[] = isOrgAdmin
    ? [personalNav[0], ...orgNav, ...personalNav.slice(1)]
    : personalNav;

  return (
    <div className="space-y-6">
      <TabNav items={settingsNav} />
      <div>{children}</div>
    </div>
  );
}
