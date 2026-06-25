import { redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
import { TabNav, type TabNavItem } from "@/components/dashboard/TabNav";

const adminNav: TabNavItem[] = [
  { href: "/admin/orgs", label: "Organizations", icon: "building" },
  { href: "/admin/users", label: "Users", icon: "users" },
  { href: "/admin/plans", label: "Plans", icon: "credit-card" },
  { href: "/admin/subscriptions", label: "Subscriptions", icon: "receipt" },
  { href: "/admin/transactions", label: "Transactions", icon: "file-text" },
  { href: "/admin/help", label: "Help", icon: "help-circle" },
  { href: "/admin/health", label: "Health", icon: "shield" },
  { href: "/admin/settings", label: "Settings", icon: "settings" },
];

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/sign-in");

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_super_admin")
    .eq("id", user.id)
    .single();

  if (!profile?.is_super_admin) redirect("/dashboard");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold font-heading">Super Admin</h1>
      </div>

      <TabNav items={adminNav} />

      <div>{children}</div>
    </div>
  );
}
