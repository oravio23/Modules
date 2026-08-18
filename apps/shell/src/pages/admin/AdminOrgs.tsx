import * as React from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { adminApi } from "@/lib/admin/adminApi";

/**
 * /admin — the staff console's landing page. Every org on the platform, at a glance, with a
 * way to create a new one for a customer being onboarded. Deliberately plain, matching the
 * rest of this repo's "backend first, frontend is going to Lovable" scope.
 */
export default function AdminOrgsPage() {
  const queryClient = useQueryClient();
  const [name, setName] = React.useState("");
  const [slug, setSlug] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);

  const orgsQuery = useQuery({
    queryKey: ["admin", "orgs"],
    queryFn: () => adminApi.listOrgs(),
  });

  const createMutation = useMutation({
    mutationFn: () => adminApi.createOrg(name, slug),
    onSuccess: () => {
      setName("");
      setSlug("");
      setError(null);
      queryClient.invalidateQueries({ queryKey: ["admin", "orgs"] });
    },
    onError: (err: unknown) => setError(err instanceof Error ? err.message : "Failed to create org."),
  });

  function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!name || !slug) return;
    createMutation.mutate();
  }

  return (
    <div className="mx-auto max-w-5xl px-[clamp(18px,4vw,56px)] py-12">
      <h1 className="text-2xl font-semibold text-[var(--app-text)]">Organizations</h1>
      <p className="mt-1 text-sm text-[var(--app-text-muted)]">
        Every customer org on the platform. Open one to set its plan, module overrides, and team.
      </p>

      <Card className="mt-6 border-[var(--app-line)] bg-[var(--app-surface)] text-[var(--app-text)]">
        <CardHeader>
          <CardTitle className="text-[var(--app-text)]">All orgs</CardTitle>
        </CardHeader>
        <CardContent>
          {orgsQuery.isLoading ? (
            <Skeleton className="h-32 bg-[var(--app-surface-2)]" />
          ) : orgsQuery.isError ? (
            <p className="text-sm text-[var(--destructive)]">Failed to load orgs.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Slug</TableHead>
                    <TableHead>Plan</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Seats</TableHead>
                    <TableHead>Members</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orgsQuery.data?.orgs.map((org) => (
                    <TableRow key={org.id}>
                      <TableCell className="text-[var(--app-text)]">{org.name}</TableCell>
                      <TableCell className="text-[var(--app-text-muted)]">{org.slug}</TableCell>
                      <TableCell>{org.subscription?.plan_id ?? <span className="text-[var(--app-text-muted)]">none</span>}</TableCell>
                      <TableCell>
                        {org.subscription ? (
                          <Badge variant={org.subscription.status === "active" ? "default" : "secondary"}>
                            {org.subscription.status}
                          </Badge>
                        ) : (
                          <span className="text-[var(--app-text-muted)]">—</span>
                        )}
                      </TableCell>
                      <TableCell>{org.subscription?.seats ?? "—"}</TableCell>
                      <TableCell>{org.memberCount}</TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm" asChild>
                          <Link to={`/admin/orgs/${org.id}`}>Manage</Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="mt-6 border-[var(--app-line)] bg-[var(--app-surface)] text-[var(--app-text)]">
        <CardHeader>
          <CardTitle className="text-[var(--app-text)]">Create an org</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCreate} className="flex flex-wrap items-end gap-3">
            <div className="space-y-2">
              <Label htmlFor="org-name">Name</Label>
              <Input id="org-name" value={name} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setName(e.target.value)} className="w-64" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="org-slug">Slug</Label>
              <Input id="org-slug" value={slug} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSlug(e.target.value)} className="w-48" />
            </div>
            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending ? "Creating…" : "Create org"}
            </Button>
          </form>
          {error && <p className="mt-2 text-sm text-[var(--destructive)]">{error}</p>}
        </CardContent>
      </Card>
    </div>
  );
}
