import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "./AuthProvider";

/**
 * Wraps platform.is_platform_admin() (0011_platform_admins.sql) — the only server-side
 * source of truth for "is this person Oravio staff". There is no client-side mirror to keep
 * in sync (unlike modules.ts for entitlements): staff status can't be hardcoded, since the
 * one path that grants it is a by-hand service-role INSERT.
 */
export function useIsPlatformAdmin(): { isStaff: boolean; loading: boolean } {
  const { session, loading: sessionLoading } = useSession();
  const query = useQuery({
    queryKey: ["platform", "is_platform_admin", session?.user.id],
    queryFn: async (): Promise<boolean> => {
      const { data, error } = await supabase.schema("platform").rpc("is_platform_admin");
      if (error) throw error;
      return Boolean(data);
    },
    enabled: Boolean(session),
    staleTime: 60_000,
  });

  return { isStaff: query.data ?? false, loading: sessionLoading || (Boolean(session) && query.isLoading) };
}
