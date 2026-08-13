import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";

interface OrgRow {
  id: string;
  name: string;
  slug: string;
}
interface MemberRow {
  user_id: string;
  role: string;
}

/**
 * Read-only in the pilot, deliberately — no billing UI. Plan/module changes happen by hand
 * against platform.org_subscriptions / platform.org_module_overrides until pricing exists.
 */
export default function OrgPage() {
  const orgsQuery = useQuery({
    queryKey: ["platform", "orgs"],
    queryFn: async (): Promise<OrgRow[]> => {
      const { data, error } = await supabase.schema("platform").from("orgs").select("id, name, slug");
      if (error) throw error;
      return data as OrgRow[];
    },
  });

  const orgId = orgsQuery.data?.[0]?.id;

  const membersQuery = useQuery({
    queryKey: ["platform", "org_members", orgId],
    enabled: !!orgId,
    queryFn: async (): Promise<MemberRow[]> => {
      const { data, error } = await supabase
        .schema("platform")
        .from("org_members")
        .select("user_id, role")
        .eq("org_id", orgId);
      if (error) throw error;
      return data as MemberRow[];
    },
  });

  if (orgsQuery.isLoading) {
    return (
      <div className="mx-auto max-w-2xl px-[clamp(18px,4vw,56px)] py-12">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="mt-6 h-40" />
      </div>
    );
  }

  const org = orgsQuery.data?.[0];

  if (!org) {
    return (
      <div className="mx-auto max-w-2xl px-[clamp(18px,4vw,56px)] py-12">
        <p className="text-sm text-[var(--muted)]">
          You aren't a member of an organization yet — contact Oravio to get set up.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-[clamp(18px,4vw,56px)] py-12">
      <h1 className="text-2xl font-semibold text-[var(--navy)]">{org.name}</h1>
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Members</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {membersQuery.data?.map((m) => (
            <div key={m.user_id} className="flex items-center justify-between text-sm">
              <span className="text-[var(--ink)]">{m.user_id}</span>
              <Badge variant="secondary">{m.role}</Badge>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
