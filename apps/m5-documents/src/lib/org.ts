import { supabase } from "@/integrations/supabase/client";

/**
 * Resolves the signed-in user's org for storage-path and row-ownership purposes. This
 * pilot assumes single-org membership — multi-org account switching isn't built yet, so a
 * user with more than one org membership gets the first one, ordered by when they joined.
 */
export async function getCurrentOrgId(): Promise<string> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in.");

  const { data, error } = await supabase
    .schema("platform")
    .from("org_members")
    .select("org_id")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new Error("You aren't a member of an organization yet — contact Oravio to get set up.");
  return data.org_id as string;
}
