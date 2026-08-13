import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { MODULES, type ModuleDefinition } from "./modules";

export interface EntitledModule extends ModuleDefinition {
  granted: boolean;
}

/** Raw shape of a platform.my_modules() row — Postgres/PostgREST convention is snake_case,
 * unlike the camelCase EntitledModule the rest of the app expects. Map at this boundary,
 * not by renaming either side. */
interface MyModulesRow {
  id: string;
  slug: string;
  name: string;
  tagline: string;
  personas: string[];
  status: "live" | "beta" | "planned";
  route: string;
  sort_order: number;
  granted: boolean;
}

/**
 * One RPC call resolves every module's grant state for the signed-in user. Falls back to
 * MODULES with granted:false while loading/on error, rather than an empty grid — a locked
 * card is a better failure mode than a blank hub.
 */
export function useEntitlements() {
  const query = useQuery({
    queryKey: ["platform", "my_modules"],
    queryFn: async (): Promise<EntitledModule[]> => {
      const { data, error } = await supabase.schema("platform").rpc("my_modules");
      if (error) throw error;
      return (data as MyModulesRow[])
        .map((row) => ({
          id: row.id,
          slug: row.slug,
          name: row.name,
          tagline: row.tagline,
          personas: row.personas,
          status: row.status,
          route: row.route,
          sortOrder: row.sort_order,
          granted: row.granted,
        }))
        .sort((a, b) => a.sortOrder - b.sortOrder);
    },
    staleTime: 60_000,
  });

  const modules: EntitledModule[] =
    query.data ?? MODULES.map((m) => ({ ...m, granted: false }));

  return { ...query, modules };
}

/** Convenience for a single-module gate check without pulling in the full list. */
export function useHasModule(moduleId: string): { granted: boolean; loading: boolean } {
  const { modules, isLoading } = useEntitlements();
  return { granted: modules.find((m) => m.id === moduleId)?.granted ?? false, loading: isLoading };
}
