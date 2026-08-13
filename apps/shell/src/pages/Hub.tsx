import { HairlineGrid } from "@/components/oravio/HairlineGrid";
import { ModuleCard } from "@/components/oravio/ModuleCard";
import { Eyebrow } from "@/components/oravio/Eyebrow";
import { DisplayHeading } from "@/components/oravio/DisplayHeading";
import { Skeleton } from "@/components/ui/skeleton";
import { useEntitlements } from "@/lib/entitlements/useEntitlements";

const STATUS_LABEL: Record<string, string> = {
  live: "Live",
  beta: "Beta",
  planned: "Coming Q3 2026",
};

export default function HubPage() {
  const { modules, isLoading } = useEntitlements();

  return (
    <div className="mx-auto max-w-[1180px] px-[clamp(18px,4vw,56px)] py-12">
      <Eyebrow>Your platform</Eyebrow>
      <DisplayHeading level={2}>Every module, one sign-in.</DisplayHeading>
      <p className="mt-4 max-w-[680px] text-base text-[var(--muted)]">
        Modules included in your package open directly. Anything else stays visible — talk to
        Oravio if your team needs it.
      </p>

      {isLoading ? (
        <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-[250px]" />
          ))}
        </div>
      ) : (
        <HairlineGrid cols={3} className="mt-10 border border-[var(--line)]">
          {modules.map((module, index) => {
            const isOpenable = module.granted && module.status !== "planned";
            return (
              <ModuleCard
                key={module.id}
                index={index}
                eyebrow={`Module ${module.sortOrder.toString().padStart(2, "0")}`}
                title={module.name}
                personas={module.personas}
                description={module.tagline}
                status={
                  !module.granted ? "locked" : module.status === "live" ? "live" : module.status === "beta" ? "beta" : "planned"
                }
                statusLabel={
                  !module.granted ? "Not in your package" : STATUS_LABEL[module.status]
                }
                href={isOpenable ? module.route : undefined}
              />
            );
          })}
        </HairlineGrid>
      )}
    </div>
  );
}
