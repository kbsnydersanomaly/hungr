"use client";

import { useState } from "react";
import { listUsers } from "@/lib/data/admin-actions";
import { impersonateUser } from "@/lib/auth/impersonation";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Loader2, Search, UserCircle } from "lucide-react";

interface User {
  id: string;
  email: string;
  display_name: string | null;
  is_super_admin: boolean;
  created_at: string;
}

export default function ImpersonatePage() {
  const [search, setSearch] = useState("");
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [impersonatingId, setImpersonatingId] = useState<string | null>(null);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const { data } = await listUsers({ search });
      setUsers(data as User[]);
    } catch {
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }

  async function handleImpersonate(userId: string) {
    setImpersonatingId(userId);
    try {
      await impersonateUser(userId);
    } catch {
      setImpersonatingId(null);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Impersonate"
        description="Search for a user and impersonate them"
      />

      <form onSubmit={handleSearch} className="flex gap-2">
        <Input
          placeholder="Search by email or name..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-md"
        />
        <Button type="submit" disabled={loading}>
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Search className="h-4 w-4" />
          )}
        </Button>
      </form>

      {users.length === 0 && !loading && search && (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            No users found.
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4">
        {users.map((user) => (
          <Card key={user.id}>
            <CardContent className="py-4">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <Avatar className="h-9 w-9">
                    <AvatarFallback className="text-xs">
                      {(user.display_name ?? user.email ?? "?")
                        .slice(0, 2)
                        .toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="text-sm font-medium">
                      {user.display_name ?? "Unnamed"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {user.email}
                    </p>
                  </div>
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleImpersonate(user.id)}
                  disabled={impersonatingId === user.id}
                >
                  {impersonatingId === user.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <UserCircle className="h-4 w-4 mr-2" />
                      Impersonate
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
