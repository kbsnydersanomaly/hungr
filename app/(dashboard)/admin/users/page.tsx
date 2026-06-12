import { listUsers } from "@/lib/data/admin-actions";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Mail, Calendar } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const sp = await searchParams;
  const search = typeof sp?.search === "string" ? sp.search : undefined;

  const users = await listUsers(search);

  return (
    <div className="space-y-6">
      <PageHeader title="Users" description={`${users.length} total users`} />

      {users.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No users found.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {users.map((user) => (
            <Card key={user.id}>
              <CardContent className="py-4">
                <div className="flex items-start gap-4">
                  <Avatar className="h-10 w-10">
                    <AvatarFallback className="text-xs">
                      {(user.display_name ?? user.email ?? "?")
                        .slice(0, 2)
                        .toUpperCase()}
                    </AvatarFallback>
                  </Avatar>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-sm">
                        {user.display_name ?? "Unnamed"}
                      </h3>
                      {user.is_super_admin && (
                        <Badge variant="secondary" className="text-xs">
                          Super Admin
                        </Badge>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-3 mt-2">
                      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                        <Mail className="h-3 w-3" />
                        {user.email}
                      </span>
                      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                        <Calendar className="h-3 w-3" />
                        {new Date(user.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
