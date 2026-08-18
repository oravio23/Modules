import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { adminApi } from "@/lib/admin/adminApi";

/**
 * /admin/users — every account on the platform (auth.users, via the admin API — there's no
 * PostgREST access to that schema, so this always goes through admin-api's list_users
 * action). Mainly useful for finding who an unfamiliar email belongs to, and for the
 * "assign to org" shortcut when onboarding someone who already has an account but no org.
 */
export default function AdminUsersPage() {
  const queryClient = useQueryClient();
  const [orgIdByUser, setOrgIdByUser] = React.useState<Record<string, string>>({});

  const usersQuery = useQuery({
    queryKey: ["admin", "users"],
    queryFn: () => adminApi.listUsers(),
  });

  const orgsQuery = useQuery({
    queryKey: ["admin", "orgs"],
    queryFn: () => adminApi.listOrgs(),
  });

  const assignMutation = useMutation({
    mutationFn: ({ userId, orgId }: { userId: string; orgId: string }) => adminApi.addMember(orgId, "member", { userId }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin", "orgs"] }),
  });

  return (
    <div className="mx-auto max-w-5xl px-[clamp(18px,4vw,56px)] py-12">
      <h1 className="text-2xl font-semibold text-[var(--app-text)]">Users</h1>
      <p className="mt-1 text-sm text-[var(--app-text-muted)]">
        Every account on the platform. Assign someone to an org they already have an account
        for but aren't a member of yet — for a new invite, use an org's own Invite form instead.
      </p>

      <Card className="mt-6 border-[var(--app-line)] bg-[var(--app-surface)] text-[var(--app-text)]">
        <CardHeader>
          <CardTitle className="text-[var(--app-text)]">All users</CardTitle>
        </CardHeader>
        <CardContent>
          {usersQuery.isLoading ? (
            <Skeleton className="h-40 bg-[var(--app-surface-2)]" />
          ) : usersQuery.isError ? (
            <p className="text-sm text-[var(--destructive)]">Failed to load users.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Email</TableHead>
                    <TableHead>Confirmed</TableHead>
                    <TableHead>Last sign-in</TableHead>
                    <TableHead>Assign to org</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {usersQuery.data?.users.map((u) => (
                    <TableRow key={u.id}>
                      <TableCell className="text-[var(--app-text)]">{u.email}</TableCell>
                      <TableCell className="text-[var(--app-text-muted)]">{u.confirmedAt ? "yes" : "no"}</TableCell>
                      <TableCell className="text-[var(--app-text-muted)]">
                        {u.lastSignInAt ? new Date(u.lastSignInAt).toLocaleDateString() : "never"}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Select
                            value={orgIdByUser[u.id] ?? ""}
                            onValueChange={(v) => setOrgIdByUser((prev) => ({ ...prev, [u.id]: v }))}
                          >
                            <SelectTrigger className="w-48">
                              <SelectValue placeholder="Choose an org" />
                            </SelectTrigger>
                            <SelectContent>
                              {orgsQuery.data?.orgs.map((org) => (
                                <SelectItem key={org.id} value={org.id}>
                                  {org.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={!orgIdByUser[u.id] || assignMutation.isPending}
                            onClick={() => assignMutation.mutate({ userId: u.id, orgId: orgIdByUser[u.id] })}
                          >
                            Add
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
