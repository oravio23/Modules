import * as React from "react";
import { Link, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { adminApi } from "@/lib/admin/adminApi";

type MemberRole = "owner" | "admin" | "member" | "viewer";

interface PlanRow {
  id: string;
  name: string;
}
interface EntitlementRow {
  module_id: string;
  name: string;
  status: string;
  entitled: boolean;
  source: "plan" | "override" | "none";
}
interface MatrixRow {
  user_id: string;
  email: string;
  role: MemberRole;
  module_id: string;
  org_entitled: boolean;
  user_granted: boolean;
  effective: boolean;
}

/**
 * /admin/orgs/:orgId — staff's actual entitlement console: set the plan, override individual
 * modules (inherit from plan / force-grant / force-deny), and manage the team the same way
 * the org's own admins can from /org. Every write goes through admin-api (see
 * lib/admin/adminApi.ts) — service-role, audited — never a direct table write.
 */
export default function AdminOrgDetailPage() {
  const { orgId } = useParams<{ orgId: string }>();
  const queryClient = useQueryClient();
  const [addEmail, setAddEmail] = React.useState("");
  const [addRole, setAddRole] = React.useState<MemberRole>("member");
  const [addError, setAddError] = React.useState<string | null>(null);

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ["admin", "org", orgId] });
    queryClient.invalidateQueries({ queryKey: ["admin", "orgs"] });
  }

  const orgQuery = useQuery({
    queryKey: ["admin", "org", orgId, "meta"],
    enabled: !!orgId,
    queryFn: async () => {
      const { orgs } = await adminApi.listOrgs();
      const org = orgs.find((o) => o.id === orgId);
      if (!org) throw new Error("Org not found");
      return org;
    },
  });

  const plansQuery = useQuery({
    queryKey: ["platform", "plans"],
    queryFn: async (): Promise<PlanRow[]> => {
      const { data, error } = await supabase.schema("platform").from("plans").select("id, name");
      if (error) throw error;
      return data as PlanRow[];
    },
  });

  const entitlementsQuery = useQuery({
    queryKey: ["admin", "org", orgId, "entitlements"],
    enabled: !!orgId,
    queryFn: async (): Promise<EntitlementRow[]> => {
      const { data, error } = await supabase.schema("platform").rpc("org_entitlements", { p_org: orgId });
      if (error) throw error;
      return data as EntitlementRow[];
    },
  });

  const matrixQuery = useQuery({
    queryKey: ["admin", "org", orgId, "matrix"],
    enabled: !!orgId,
    queryFn: async (): Promise<MatrixRow[]> => {
      const { data, error } = await supabase.schema("platform").rpc("org_module_matrix", { p_org: orgId });
      if (error) throw error;
      return data as MatrixRow[];
    },
  });

  const setPlanMutation = useMutation({
    mutationFn: (planId: string) => adminApi.setOrgPlan(orgId!, planId, "active"),
    onSuccess: invalidate,
  });

  const setOverrideMutation = useMutation({
    mutationFn: ({ moduleId, granted }: { moduleId: string; granted: boolean | null }) =>
      adminApi.setOrgOverride(orgId!, moduleId, granted),
    onSuccess: invalidate,
  });

  const setModulesMutation = useMutation({
    mutationFn: ({ userId, moduleIds }: { userId: string; moduleIds: string[] }) =>
      adminApi.setUserModules(orgId!, userId, moduleIds),
    onSuccess: invalidate,
  });

  const setRoleMutation = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: MemberRole }) => adminApi.setMemberRole(orgId!, userId, role),
    onSuccess: invalidate,
  });

  const removeMemberMutation = useMutation({
    mutationFn: (userId: string) => adminApi.removeMember(orgId!, userId),
    onSuccess: invalidate,
  });

  const addMemberMutation = useMutation({
    mutationFn: () => adminApi.addMember(orgId!, addRole, { email: addEmail }),
    onSuccess: () => {
      setAddEmail("");
      setAddError(null);
      invalidate();
    },
    onError: (err: unknown) => setAddError(err instanceof Error ? err.message : "Failed to add member."),
  });

  if (!orgId) return null;
  if (orgQuery.isLoading) {
    return (
      <div className="mx-auto max-w-5xl px-[clamp(18px,4vw,56px)] py-12">
        <Skeleton className="h-40 bg-[var(--app-surface)]" />
      </div>
    );
  }
  if (orgQuery.isError || !orgQuery.data) {
    return (
      <div className="mx-auto max-w-5xl px-[clamp(18px,4vw,56px)] py-12">
        <p className="text-sm text-[var(--destructive)]">Org not found.</p>
      </div>
    );
  }

  const org = orgQuery.data;
  const entitledModules = (entitlementsQuery.data ?? []).filter((m) => m.entitled);

  const membersById = new Map<string, { email: string; role: MemberRole; modules: MatrixRow[] }>();
  for (const row of matrixQuery.data ?? []) {
    const existing = membersById.get(row.user_id);
    if (existing) existing.modules.push(row);
    else membersById.set(row.user_id, { email: row.email, role: row.role, modules: [row] });
  }

  function handleAddMember(e: React.FormEvent) {
    e.preventDefault();
    if (!addEmail) return;
    addMemberMutation.mutate();
  }

  return (
    <div className="mx-auto max-w-5xl px-[clamp(18px,4vw,56px)] py-12">
      <Link to="/admin" className="text-sm text-[var(--app-text-muted)] hover:underline">
        ← All orgs
      </Link>
      <h1 className="mt-2 text-2xl font-semibold text-[var(--app-text)]">{org.name}</h1>
      <p className="text-sm text-[var(--app-text-muted)]">{org.slug}</p>

      <div className="mt-6 space-y-6">
        <Card className="border-[var(--app-line)] bg-[var(--app-surface)] text-[var(--app-text)]">
          <CardHeader>
            <CardTitle className="text-[var(--app-text)]">Plan</CardTitle>
          </CardHeader>
          <CardContent className="flex items-end gap-3">
            <div className="space-y-2">
              <Label>Current plan</Label>
              <Select value={org.subscription?.plan_id ?? undefined} onValueChange={(v) => setPlanMutation.mutate(v)}>
                <SelectTrigger className="w-56">
                  <SelectValue placeholder="No plan" />
                </SelectTrigger>
                <SelectContent>
                  {plansQuery.data?.map((plan) => (
                    <SelectItem key={plan.id} value={plan.id}>
                      {plan.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {org.subscription && (
              <Badge variant={org.subscription.status === "active" ? "default" : "secondary"}>
                {org.subscription.status}
              </Badge>
            )}
          </CardContent>
        </Card>

        <Card className="border-[var(--app-line)] bg-[var(--app-surface)] text-[var(--app-text)]">
          <CardHeader>
            <CardTitle className="text-[var(--app-text)]">Module overrides</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-3 text-sm text-[var(--app-text-muted)]">
              Inherit follows the plan above. Grant/Deny force the module on or off regardless
              of plan — use for pilot one-offs.
            </p>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Module</TableHead>
                    <TableHead>Entitled</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead>Override</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {entitlementsQuery.data?.map((m) => (
                    <TableRow key={m.module_id}>
                      <TableCell className="text-[var(--app-text)]">{m.name}</TableCell>
                      <TableCell>
                        <Badge variant={m.entitled ? "default" : "secondary"}>{m.entitled ? "yes" : "no"}</Badge>
                      </TableCell>
                      <TableCell className="text-[var(--app-text-muted)]">{m.source}</TableCell>
                      <TableCell>
                        <Select
                          value={m.source === "override" ? (m.entitled ? "grant" : "deny") : "inherit"}
                          onValueChange={(v) =>
                            setOverrideMutation.mutate({
                              moduleId: m.module_id,
                              granted: v === "inherit" ? null : v === "grant",
                            })
                          }
                        >
                          <SelectTrigger className="w-32">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="inherit">Inherit</SelectItem>
                            <SelectItem value="grant">Grant</SelectItem>
                            <SelectItem value="deny">Deny</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        <Card className="border-[var(--app-line)] bg-[var(--app-surface)] text-[var(--app-text)]">
          <CardHeader>
            <CardTitle className="text-[var(--app-text)]">Team &amp; per-user modules</CardTitle>
          </CardHeader>
          <CardContent>
            {entitledModules.length === 0 ? (
              <p className="text-sm text-[var(--app-text-muted)]">Set a plan above to see module columns here.</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Member</TableHead>
                      <TableHead>Role</TableHead>
                      {entitledModules.map((m) => (
                        <TableHead key={m.module_id} className="text-center">
                          {m.name}
                        </TableHead>
                      ))}
                      <TableHead />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {[...membersById.entries()].map(([userId, member]) => {
                      const grantedModuleIds = member.modules.filter((mm) => mm.user_granted).map((mm) => mm.module_id);
                      const alwaysOn = member.role === "owner" || member.role === "admin";
                      return (
                        <TableRow key={userId}>
                          <TableCell className="text-[var(--app-text)]">{member.email}</TableCell>
                          <TableCell>
                            <Select
                              value={member.role}
                              onValueChange={(role) => setRoleMutation.mutate({ userId, role: role as MemberRole })}
                            >
                              <SelectTrigger className="h-8 w-28">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {(["owner", "admin", "member", "viewer"] as MemberRole[]).map((role) => (
                                  <SelectItem key={role} value={role}>
                                    {role}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </TableCell>
                          {entitledModules.map((m) => {
                            const row = member.modules.find((r) => r.module_id === m.module_id);
                            return (
                              <TableCell key={m.module_id} className="text-center">
                                <Checkbox
                                  checked={alwaysOn || Boolean(row?.user_granted)}
                                  // Also disabled mid-save: each click posts the member's whole
                                  // grant set from the last fetched matrix, so two fast clicks
                                  // race and the second silently erases the first.
                                  disabled={alwaysOn || setModulesMutation.isPending}
                                  onCheckedChange={(checked) => {
                                    const next = checked
                                      ? [...grantedModuleIds, m.module_id]
                                      : grantedModuleIds.filter((id) => id !== m.module_id);
                                    setModulesMutation.mutate({ userId, moduleIds: next });
                                  }}
                                />
                              </TableCell>
                            );
                          })}
                          <TableCell>
                            {member.role !== "owner" && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-[var(--destructive)]"
                                onClick={() => removeMemberMutation.mutate(userId)}
                              >
                                Remove
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}

            <form onSubmit={handleAddMember} className="mt-4 flex flex-wrap items-end gap-3">
              <div className="space-y-2">
                <Label htmlFor="add-member-email">Add existing user by email</Label>
                <Input
                  id="add-member-email"
                  type="email"
                  value={addEmail}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAddEmail(e.target.value)}
                  className="w-64"
                />
              </div>
              <Select value={addRole} onValueChange={(v) => setAddRole(v as MemberRole)}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(["admin", "member", "viewer"] as MemberRole[]).map((role) => (
                    <SelectItem key={role} value={role}>
                      {role}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button type="submit" disabled={addMemberMutation.isPending}>
                Add
              </Button>
            </form>
            {addError && <p className="mt-2 text-sm text-[var(--destructive)]">{addError}</p>}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
