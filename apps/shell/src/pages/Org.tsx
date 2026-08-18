import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
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
import { useUser } from "@/lib/auth/AuthProvider";
import { fadeUp, useMotionSafe } from "@/components/oravio/motion";

type MemberRole = "owner" | "admin" | "member" | "viewer";
const ASSIGNABLE_ROLES: MemberRole[] = ["admin", "member", "viewer"];

interface OrgRow {
  id: string;
  name: string;
  slug: string;
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
interface InviteRow {
  id: string;
  email: string;
  role: MemberRole;
  status: string;
  created_at: string;
  expires_at: string;
}

/**
 * Team management for the org's own admins — replaces the read-only member badge list.
 * Deliberately plain (tables, selects, checkboxes): this repo's frontend is headed for a
 * Lovable rebuild, so the value here is the backend calls being right, not the polish.
 * Plan/module CHOICE still isn't self-serve (platform.org_entitlements is read-only here —
 * that's the staff console's job at /admin), but who on the team gets which of the org's
 * already-entitled modules now is.
 */
export default function OrgPage() {
  const motionSafe = useMotionSafe();
  const user = useUser();
  const queryClient = useQueryClient();
  const [inviteEmail, setInviteEmail] = React.useState("");
  const [inviteRole, setInviteRole] = React.useState<MemberRole>("member");
  const [inviteError, setInviteError] = React.useState<string | null>(null);
  const [inviteNotice, setInviteNotice] = React.useState<string | null>(null);

  const orgsQuery = useQuery({
    queryKey: ["platform", "orgs"],
    queryFn: async (): Promise<OrgRow[]> => {
      const { data, error } = await supabase.schema("platform").from("orgs").select("id, name, slug");
      if (error) throw error;
      return data as OrgRow[];
    },
  });
  const org = orgsQuery.data?.[0];
  const orgId = org?.id;

  const isAdminQuery = useQuery({
    queryKey: ["platform", "is_org_admin", orgId],
    enabled: !!orgId,
    queryFn: async (): Promise<boolean> => {
      const { data, error } = await supabase.schema("platform").rpc("is_org_admin", { p_org: orgId });
      if (error) throw error;
      return Boolean(data);
    },
  });
  const isAdmin = isAdminQuery.data ?? false;

  const entitlementsQuery = useQuery({
    queryKey: ["platform", "org_entitlements", orgId],
    enabled: !!orgId && isAdmin,
    queryFn: async (): Promise<EntitlementRow[]> => {
      const { data, error } = await supabase.schema("platform").rpc("org_entitlements", { p_org: orgId });
      if (error) throw error;
      return data as EntitlementRow[];
    },
  });
  const entitledModules = (entitlementsQuery.data ?? []).filter((m) => m.entitled);

  const matrixQuery = useQuery({
    queryKey: ["platform", "org_module_matrix", orgId],
    enabled: !!orgId && isAdmin,
    queryFn: async (): Promise<MatrixRow[]> => {
      const { data, error } = await supabase.schema("platform").rpc("org_module_matrix", { p_org: orgId });
      if (error) throw error;
      return data as MatrixRow[];
    },
  });

  const invitesQuery = useQuery({
    queryKey: ["platform", "org_invites", orgId],
    enabled: !!orgId && isAdmin,
    queryFn: async (): Promise<InviteRow[]> => {
      const { data, error } = await supabase
        .schema("platform")
        .from("org_invites")
        .select("id, email, role, status, created_at, expires_at")
        .eq("org_id", orgId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as InviteRow[];
    },
  });

  function invalidateOrgData() {
    queryClient.invalidateQueries({ queryKey: ["platform", "org_module_matrix", orgId] });
    queryClient.invalidateQueries({ queryKey: ["platform", "org_invites", orgId] });
  }

  const setRoleMutation = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: MemberRole }) => {
      const { error } = await supabase
        .schema("platform")
        .from("org_members")
        .update({ role })
        .eq("org_id", orgId)
        .eq("user_id", userId);
      if (error) throw error;
    },
    onSuccess: invalidateOrgData,
  });

  const removeMemberMutation = useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await supabase
        .schema("platform")
        .from("org_members")
        .delete()
        .eq("org_id", orgId)
        .eq("user_id", userId);
      if (error) throw error;
    },
    onSuccess: invalidateOrgData,
  });

  const setModulesMutation = useMutation({
    mutationFn: async ({ userId, moduleIds }: { userId: string; moduleIds: string[] }) => {
      const { error } = await supabase
        .schema("platform")
        .rpc("set_user_modules", { p_org: orgId, p_user: userId, p_module_ids: moduleIds });
      if (error) throw error;
    },
    onSuccess: invalidateOrgData,
  });

  const inviteMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("org-invite", {
        body: { action: "create", orgId, email: inviteEmail, role: inviteRole },
      });
      if (error) throw error;
      return data as { emailSent: boolean; existingAccount: boolean };
    },
    onSuccess: (data) => {
      setInviteEmail("");
      setInviteNotice(
        data.existingAccount
          ? "That person already has an account — let them know directly; they'll see the invite next time they sign in."
          : "Invite sent.",
      );
      invalidateOrgData();
    },
    onError: (err: unknown) => {
      setInviteError(err instanceof Error ? err.message : "Failed to send invite.");
    },
  });

  const revokeInviteMutation = useMutation({
    mutationFn: async (inviteId: string) => {
      const { error } = await supabase.functions.invoke("org-invite", {
        body: { action: "revoke", inviteId },
      });
      if (error) throw error;
    },
    onSuccess: invalidateOrgData,
  });

  function handleInviteSubmit(e: React.FormEvent) {
    e.preventDefault();
    setInviteError(null);
    setInviteNotice(null);
    if (!inviteEmail) return;
    inviteMutation.mutate();
  }

  function toggleModule(userId: string, currentModuleIds: string[], moduleId: string, checked: boolean) {
    const next = checked ? [...currentModuleIds, moduleId] : currentModuleIds.filter((id) => id !== moduleId);
    setModulesMutation.mutate({ userId, moduleIds: next });
  }

  if (orgsQuery.isLoading) {
    return (
      <div className="mx-auto max-w-4xl px-[clamp(18px,4vw,56px)] py-12">
        <Skeleton className="h-8 w-48 bg-[var(--app-surface)]" />
        <Skeleton className="mt-6 h-40 bg-[var(--app-surface)]" />
      </div>
    );
  }

  if (!org) {
    return (
      <div className="mx-auto max-w-4xl px-[clamp(18px,4vw,56px)] py-12">
        <p className="text-sm text-[var(--app-text-muted)]">
          You aren't a member of an organization yet — contact Oravio to get set up.
        </p>
      </div>
    );
  }

  // Group matrix rows by member for rendering.
  const membersById = new Map<string, { email: string; role: MemberRole; modules: MatrixRow[] }>();
  for (const row of matrixQuery.data ?? []) {
    const existing = membersById.get(row.user_id);
    if (existing) existing.modules.push(row);
    else membersById.set(row.user_id, { email: row.email, role: row.role, modules: [row] });
  }

  return (
    <div className="mx-auto max-w-4xl px-[clamp(18px,4vw,56px)] py-12">
      <h1 className="text-2xl font-semibold text-[var(--app-text)]">{org.name}</h1>

      <motion.div
        initial={motionSafe ? "hidden" : "visible"}
        animate="visible"
        variants={fadeUp}
        className="mt-6 space-y-6"
      >
        {!isAdmin ? (
          <Card className="border-[var(--app-line)] bg-[var(--app-surface)] text-[var(--app-text)]">
            <CardHeader>
              <CardTitle className="text-[var(--app-text)]">Members</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-[var(--app-text-muted)]">
                Only an org owner or admin can manage the team here. Contact one of them if you
                need a change.
              </p>
            </CardContent>
          </Card>
        ) : (
          <>
            <Card className="border-[var(--app-line)] bg-[var(--app-surface)] text-[var(--app-text)]">
              <CardHeader>
                <CardTitle className="text-[var(--app-text)]">Members &amp; module access</CardTitle>
              </CardHeader>
              <CardContent>
                {entitledModules.length === 0 ? (
                  <p className="text-sm text-[var(--app-text-muted)]">
                    Your org isn't entitled to any modules yet — talk to Oravio about a plan.
                  </p>
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
                          const grantedModuleIds = member.modules.filter((m) => m.user_granted).map((m) => m.module_id);
                          const isSelf = userId === user?.id;
                          return (
                            <TableRow key={userId}>
                              <TableCell className="text-[var(--app-text)]">
                                {member.email} {isSelf && <span className="text-[var(--app-text-muted)]">(you)</span>}
                              </TableCell>
                              <TableCell>
                                {member.role === "owner" || isSelf ? (
                                  <Badge variant="secondary">{member.role}</Badge>
                                ) : (
                                  <Select
                                    value={member.role}
                                    onValueChange={(role) => setRoleMutation.mutate({ userId, role: role as MemberRole })}
                                  >
                                    <SelectTrigger className="h-8 w-28">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {ASSIGNABLE_ROLES.map((role) => (
                                        <SelectItem key={role} value={role}>
                                          {role}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                )}
                              </TableCell>
                              {entitledModules.map((m) => {
                                const row = member.modules.find((r) => r.module_id === m.module_id);
                                // Owners/admins always get everything the org pays for
                                // (platform.has_module's own rule) — show as checked and
                                // disabled rather than lying with an unchecked box.
                                const alwaysOn = member.role === "owner" || member.role === "admin";
                                return (
                                  <TableCell key={m.module_id} className="text-center">
                                    <Checkbox
                                      checked={alwaysOn || Boolean(row?.user_granted)}
                                      disabled={alwaysOn}
                                      onCheckedChange={(checked) =>
                                        toggleModule(userId, grantedModuleIds, m.module_id, checked === true)
                                      }
                                    />
                                  </TableCell>
                                );
                              })}
                              <TableCell>
                                {!isSelf && member.role !== "owner" && (
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
              </CardContent>
            </Card>

            <Card className="border-[var(--app-line)] bg-[var(--app-surface)] text-[var(--app-text)]">
              <CardHeader>
                <CardTitle className="text-[var(--app-text)]">Invite someone</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <form onSubmit={handleInviteSubmit} className="flex flex-wrap items-end gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="invite-email">Email</Label>
                    <Input
                      id="invite-email"
                      type="email"
                      required
                      placeholder="teammate@company.com"
                      value={inviteEmail}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setInviteEmail(e.target.value)}
                      className="w-64"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="invite-role">Role</Label>
                    <Select value={inviteRole} onValueChange={(v) => setInviteRole(v as MemberRole)}>
                      <SelectTrigger id="invite-role" className="w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ASSIGNABLE_ROLES.map((role) => (
                          <SelectItem key={role} value={role}>
                            {role}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button type="submit" disabled={inviteMutation.isPending}>
                    {inviteMutation.isPending ? "Sending…" : "Send invite"}
                  </Button>
                </form>
                {inviteError && <p className="text-sm text-[var(--destructive)]">{inviteError}</p>}
                {inviteNotice && <p className="text-sm text-[var(--app-text-muted)]">{inviteNotice}</p>}

                {(invitesQuery.data ?? []).length > 0 && (
                  <div className="overflow-x-auto pt-2">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Email</TableHead>
                          <TableHead>Role</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Expires</TableHead>
                          <TableHead />
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(invitesQuery.data ?? []).map((invite) => (
                          <TableRow key={invite.id}>
                            <TableCell className="text-[var(--app-text)]">{invite.email}</TableCell>
                            <TableCell>{invite.role}</TableCell>
                            <TableCell>
                              <Badge variant={invite.status === "pending" ? "secondary" : "outline"}>
                                {invite.status}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-[var(--app-text-muted)]">
                              {new Date(invite.expires_at).toLocaleDateString()}
                            </TableCell>
                            <TableCell>
                              {invite.status === "pending" && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => revokeInviteMutation.mutate(invite.id)}
                                >
                                  Revoke
                                </Button>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </motion.div>
    </div>
  );
}
