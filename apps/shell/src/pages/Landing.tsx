import { Navigate, useSearchParams } from "react-router-dom";
import { GridBackdrop } from "@/components/oravio/GridBackdrop";
import { Eyebrow } from "@/components/oravio/Eyebrow";
import { DisplayHeading } from "@/components/oravio/DisplayHeading";
import { Logo } from "@/components/oravio/Logo";
import { LoginCard } from "@/lib/auth/LoginCard";
import { useSession } from "@/lib/auth/AuthProvider";

/**
 * Reuses oravio.co's own hero language (eyebrow + h1) so a customer arriving here
 * recognizes the same product they saw on the marketing site — this is the "unified UI"
 * requirement in practice, not just shared colors.
 */
export default function LandingPage() {
  const { session, loading } = useSession();
  const [params] = useSearchParams();

  if (!loading && session) {
    const next = params.get("next");
    return <Navigate to={next && next.startsWith("/") ? next : "/hub"} replace />;
  }

  return (
    <GridBackdrop className="min-h-svh">
      <div className="mx-auto max-w-[1180px] px-[clamp(18px,4vw,56px)] py-6">
        <Logo />
      </div>

      <div className="mx-auto grid max-w-[1180px] gap-12 px-[clamp(18px,4vw,56px)] pb-16 pt-8 lg:grid-cols-[minmax(0,0.95fr)_minmax(380px,1.05fr)] lg:items-center">
        <div>
          <Eyebrow>Trade operations software for MENA</Eyebrow>
          <DisplayHeading level={1}>Trade, orchestrated.</DisplayHeading>
          <p className="mt-6 max-w-[520px] text-lg leading-relaxed text-[var(--muted)]">
            Sign in to reach the modules included in your package — sourcing, booking,
            shipment visibility, customs, documents, and landed cost, all on one shared
            operating record.
          </p>
        </div>

        <div>
          <LoginCard />
        </div>
      </div>
    </GridBackdrop>
  );
}
