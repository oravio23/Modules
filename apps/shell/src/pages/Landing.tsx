import { Navigate, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { AuroraBackdrop } from "@/components/oravio/AuroraBackdrop";
import { Eyebrow } from "@/components/oravio/Eyebrow";
import { DisplayHeading } from "@/components/oravio/DisplayHeading";
import { Logo } from "@/components/oravio/Logo";
import { HairlineGrid } from "@/components/oravio/HairlineGrid";
import { ModuleCard } from "@/components/oravio/ModuleCard";
import { FlowDiagram } from "@/components/oravio/FlowDiagram";
import { Reveal } from "@/components/oravio/Reveal";
import { stagger, fadeUp, useMotionSafe } from "@/components/oravio/motion";
import { LoginCard } from "@/lib/auth/LoginCard";
import { useSession } from "@/lib/auth/AuthProvider";
import { safeNextPath, isShellRoute } from "@/lib/auth/nextTarget";
import { MODULES } from "@/lib/entitlements/modules";

const TRUST_STRIP = ["27+ years logistics leadership", "Lebanon, Levant, GCC", "Six modules, one platform"];

const STATUS_LABEL: Record<string, string> = {
  live: "Live",
  beta: "Beta",
  planned: "Coming Q3 2026",
};

// Hoisted, not called inline as `stagger()` in JSX — see Hub.tsx's comment on the same
// pattern: a fresh object on every render can make framer-motion keep resetting the
// animation instead of ever letting it settle at "visible".
const heroStagger = stagger();

/**
 * Reuses oravio.co's own hero language (eyebrow + h1) so a customer arriving here
 * recognizes the same product they saw on the marketing site — this is the "unified UI"
 * requirement in practice, not just shared colors.
 */
export default function LandingPage() {
  const { session, loading } = useSession();
  const [params] = useSearchParams();
  const motionSafe = useMotionSafe();

  // Check loading FIRST and render nothing — not the hero — while it's true. Checking
  // `!loading && session` let a signed-in user's hard refresh paint the full login form
  // for a tick before getSession() resolved and bounced them to /hub: a login-screen flash
  // for someone already logged in, the exact failure ProtectedRoute's own null-while-loading
  // pattern exists to avoid.
  if (loading) return null;

  if (session) {
    // A module deep link (/m5/...) isn't a route this router owns, so <Navigate> would land
    // on the shell's 404 — hand those to the browser instead. See lib/auth/nextTarget.ts.
    const target = safeNextPath(params.get("next"));
    if (!isShellRoute(target)) {
      window.location.assign(target);
      return null;
    }
    return <Navigate to={target} replace />;
  }

  return (
    <AuroraBackdrop className="min-h-svh">
      <div className="mx-auto max-w-[1180px] px-[clamp(18px,4vw,56px)] py-6">
        <Logo />
      </div>

      <motion.div
        initial={motionSafe ? "hidden" : "visible"}
        animate="visible"
        variants={heroStagger}
        className="mx-auto grid max-w-[1180px] gap-12 px-[clamp(18px,4vw,56px)] pb-16 pt-8 lg:grid-cols-[minmax(0,0.95fr)_minmax(380px,1.05fr)] lg:items-center"
      >
        <div>
          <motion.div variants={fadeUp}>
            <Eyebrow>Trade operations software for MENA</Eyebrow>
            <DisplayHeading level={1}>Trade, orchestrated.</DisplayHeading>
            <p className="mt-6 max-w-[520px] text-lg leading-relaxed text-[var(--muted)]">
              Sign in to reach the modules included in your package — sourcing, booking,
              shipment visibility, customs, documents, and landed cost, all on one shared
              operating record.
            </p>
          </motion.div>

          <motion.div
            variants={fadeUp}
            className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-xs font-semibold uppercase tracking-[0.06em] text-[var(--muted)]"
          >
            {TRUST_STRIP.map((item) => (
              <span key={item}>{item}</span>
            ))}
          </motion.div>
        </div>

        <motion.div variants={fadeUp}>
          <LoginCard />
        </motion.div>
      </motion.div>

      <div className="mx-auto max-w-[1180px] px-[clamp(18px,4vw,56px)] pb-16">
        <Reveal>
          <FlowDiagram />
        </Reveal>
      </div>

      <div className="mx-auto max-w-[1180px] px-[clamp(18px,4vw,56px)] pb-20">
        <Reveal>
          <Eyebrow>The platform</Eyebrow>
          <DisplayHeading level={2} className="mt-2">
            Six modules. One shared record.
          </DisplayHeading>
        </Reveal>
        <HairlineGrid cols={3} className="mt-8 border border-[var(--line)]">
          {MODULES.map((module, index) => (
            <ModuleCard
              key={module.id}
              moduleId={module.id}
              index={index}
              eyebrow={`Module ${module.sortOrder.toString().padStart(2, "0")}`}
              title={module.name}
              personas={module.personas}
              description={module.tagline}
              status={module.status}
              statusLabel={STATUS_LABEL[module.status]}
            />
          ))}
        </HairlineGrid>
      </div>
    </AuroraBackdrop>
  );
}
