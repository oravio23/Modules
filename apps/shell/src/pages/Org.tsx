import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { stagger, fadeUp, useMotionSafe } from "@/components/oravio/motion";

interface OrgRow {
  id: string;
  name: string;
  slug: string;
}
interface MemberRow {
  user_id: string;
  role: string;
}

// Hoisted, not called inline as `stagger(0.05)` in JSX — see Hub.tsx's comment on the same
// pattern: a fresh object on every render can make framer-motion keep resetting the
// animation instead of ever letting it settle at "visible".
const memberRowStagger = stagger(0.05);

/**
 * Read-only in the pilot, deliberately — no billing UI. Plan/module changes happen by hand
 * against platform.org_subscriptions / platform.org_module_overrides until pricing exists.
 */
export default function OrgPage() {
  const motionSafe = useMotionSafe();

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
        <Skeleton className="h-8 w-48 bg-[var(--app-surface)]" />
        <Skeleton className="mt-6 h-40 bg-[var(--app-surface)]" />
      </div>
    );
  }

  const org = orgsQuery.data?.[0];

  if (!org) {
    return (
      <div className="mx-auto max-w-2xl px-[clamp(18px,4vw,56px)] py-12">
        <p className="text-sm text-[var(--app-text-muted)]">
          You aren't a member of an organization yet — contact Oravio to get set up.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-[clamp(18px,4vw,56px)] py-12">
      <h1 className="text-2xl font-semibold text-[var(--app-text)]">{org.name}</h1>
      <Card className="mt-6 border-[var(--app-line)] bg-[var(--app-surface)] text-[var(--app-text)]">
        <CardHeader>
          <CardTitle className="text-[var(--app-text)]">Members</CardTitle>
        </CardHeader>
        <CardContent>
          <motion.div
            initial={motionSafe ? "hidden" : "visible"}
            animate="visible"
            variants={memberRowStagger}
            className="space-y-1"
          >
            {membersQuery.data?.map((m) => (
              <motion.div
                key={m.user_id}
                variants={fadeUp}
                className="flex items-center justify-between gap-3 rounded-md px-2 py-2 hover:bg-[var(--app-surface-2)]"
              >
                <div className="flex items-center gap-3">
                  <Avatar className="h-7 w-7">
                    <AvatarFallback className="text-xs">
                      {m.user_id.slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-sm text-[var(--app-text)]">{m.user_id}</span>
                </div>
                <Badge variant="secondary">{m.role}</Badge>
              </motion.div>
            ))}
          </motion.div>
        </CardContent>
      </Card>
    </div>
  );
}
