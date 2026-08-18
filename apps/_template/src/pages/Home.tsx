import { Eyebrow } from "@/components/oravio/Eyebrow";
import { DisplayHeading } from "@/components/oravio/DisplayHeading";
import { Section } from "@/components/oravio/Section";
import { Reveal } from "@/components/oravio/Reveal";

/**
 * Replace this page — see CONTRIBUTING.md at the repo root for the module contract
 * (claiming a schema, RLS pattern, and where to register this module in
 * platform.modules). Left wired up to the design system (Eyebrow, DisplayHeading,
 * Section, Reveal) rather than a bare shadcn placeholder, so a new module starts on the
 * same visual and motion vocabulary as the shell instead of reinventing it.
 */
export default function HomePage() {
  return (
    <Section>
      <Reveal>
        <Eyebrow>Module scaffold</Eyebrow>
        <DisplayHeading level={2}>Start here.</DisplayHeading>
        <p className="mt-4 max-w-[560px] text-base text-[var(--muted)]">
          Replace this page. Claim your schema, follow the org-scoped RLS pattern in{" "}
          <code className="rounded bg-muted px-1 py-0.5 text-sm">
            supabase/migration.sql.example
          </code>
          , and register your module in{" "}
          <code className="rounded bg-muted px-1 py-0.5 text-sm">platform.modules</code> —
          see CONTRIBUTING.md at the repo root for the full module contract.
        </p>
      </Reveal>
    </Section>
  );
}
