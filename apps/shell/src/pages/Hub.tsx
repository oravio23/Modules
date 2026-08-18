import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { HairlineGrid } from "@/components/oravio/HairlineGrid";
import { ModuleCard } from "@/components/oravio/ModuleCard";
import { Eyebrow } from "@/components/oravio/Eyebrow";
import { DisplayHeading } from "@/components/oravio/DisplayHeading";
import { AnimatedNumber } from "@/components/oravio/AnimatedNumber";
import { stagger, fadeUp, useMotionSafe } from "@/components/oravio/motion";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useEntitlements } from "@/lib/entitlements/useEntitlements";
import { supabase } from "@/integrations/supabase/client";

const STATUS_LABEL: Record<string, string> = {
  live: "Live",
  beta: "Beta",
  planned: "Coming Q3 2026",
};

// Hoisted rather than called inline as `stagger()` in JSX: that would build a fresh variants
// object on every render, and framer-motion treats a changed `variants` reference as cause
// to re-evaluate the animation — with an actively re-rendering query (retries, refetches),
// that repeatedly snapped the grid back toward its hidden state instead of ever settling at
// visible. One stable object, reused across renders, fixes it.
const gridStagger = stagger();

function useMyOrgName() {
  return useQuery({
    queryKey: ["platform", "orgs", "hub-greeting"],
    queryFn: async (): Promise<string | null> => {
      const { data, error } = await supabase.schema("platform").from("orgs").select("name").limit(1);
      if (error) throw error;
      return data?.[0]?.name ?? null;
    },
    staleTime: 60_000,
  });
}

export default function HubPage() {
  const { modules, isLoading, isError } = useEntitlements();
  const { data: orgName } = useMyOrgName();
  const motionSafe = useMotionSafe();

  const grantedCount = modules.filter((m) => m.granted).length;
  const liveCount = modules.filter((m) => m.granted && m.status === "live").length;
  const comingCount = modules.filter((m) => m.status === "planned").length;

  return (
    <div className="mx-auto max-w-[1180px] px-[clamp(18px,4vw,56px)] py-12">
      <motion.div
        initial={motionSafe ? "hidden" : "visible"}
        animate="visible"
        variants={gridStagger}
      >
        <motion.div variants={fadeUp}>
          <Eyebrow tone="inverted">{orgName ? orgName : "Your platform"}</Eyebrow>
          <DisplayHeading level={2} className="text-[var(--app-text)]">
            Every module, one sign-in.
          </DisplayHeading>
          <p className="mt-4 max-w-[680px] text-base text-[var(--app-text-muted)]">
            Modules included in your package open directly. Anything else stays visible — talk to
            Oravio if your team needs it.
          </p>
        </motion.div>

        <motion.div variants={fadeUp} className="mt-8 flex flex-wrap gap-8 border-y border-[var(--app-line)] py-5">
          {[
            { label: "In your package", value: grantedCount },
            { label: "Live now", value: liveCount },
            { label: "Coming soon", value: comingCount },
          ].map((stat) => (
            <div key={stat.label}>
              <div className="text-2xl font-extrabold text-[var(--app-text)]">
                <AnimatedNumber value={stat.value} />
              </div>
              <div className="text-xs uppercase tracking-[0.06em] text-[var(--app-text-muted)]">
                {stat.label}
              </div>
            </div>
          ))}
        </motion.div>
      </motion.div>

      {isError && (
        // useEntitlements falls back to every module marked ungranted on a query error, so
        // without this the grid below looks identical to "your package genuinely has none
        // of these" — most commonly a cloud project where the platform schema hasn't been
        // added under Dashboard -> API Settings -> Exposed schemas yet (see
        // docs/deploy-checklist.md). Surfacing it here means a locked card is never mistaken
        // for a config problem, or vice versa. Explicit light background: Alert's
        // destructive variant is text+border only, which reads poorly on the dark portal.
        <Alert variant="destructive" className="mt-6 bg-[var(--panel)]">
          <AlertTitle>Couldn't check your access</AlertTitle>
          <AlertDescription>
            We couldn't verify which modules are in your package, so everything below is
            shown as locked whether or not it actually is. Try reloading — if it keeps
            happening, contact Oravio.
          </AlertDescription>
        </Alert>
      )}

      {isLoading ? (
        <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton
              key={i}
              className="h-[250px] border border-[var(--app-line)] bg-[var(--app-surface)]"
            />
          ))}
        </div>
      ) : (
        <motion.div initial={motionSafe ? "hidden" : "visible"} animate="visible" variants={gridStagger}>
          <HairlineGrid cols={3} className="mt-10 border border-[var(--app-line)] bg-[var(--app-line)]">
            {modules.map((module, index) => {
              const isOpenable = module.granted && module.status !== "planned";
              return (
                <ModuleCard
                  key={module.id}
                  moduleId={module.id}
                  tone="dark"
                  index={index}
                  eyebrow={`Module ${module.sortOrder.toString().padStart(2, "0")}`}
                  title={module.name}
                  personas={module.personas}
                  description={module.tagline}
                  status={
                    !module.granted
                      ? "locked"
                      : module.status === "live"
                        ? "live"
                        : module.status === "beta"
                          ? "beta"
                          : "planned"
                  }
                  statusLabel={!module.granted ? "Not in your package" : STATUS_LABEL[module.status]}
                  href={isOpenable ? module.route : undefined}
                />
              );
            })}
          </HairlineGrid>
        </motion.div>
      )}
    </div>
  );
}
