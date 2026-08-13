import { Link, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { MODULES } from "@/lib/entitlements/modules";

export default function NoAccessPage() {
  const { moduleId } = useParams();
  const module = MODULES.find((m) => m.id === moduleId);

  return (
    <div className="mx-auto max-w-xl px-[clamp(18px,4vw,56px)] py-20 text-center">
      <h1 className="text-2xl font-semibold text-[var(--navy)]">
        {module ? module.name : "Module"} isn't in your package
      </h1>
      <p className="mt-3 text-sm text-[var(--muted)]">
        Talk to Oravio to add it, or head back to the modules you already have.
      </p>
      <div className="mt-6 flex justify-center gap-3">
        <Button asChild>
          <Link to="/hub">Back to hub</Link>
        </Button>
        <Button variant="outline" asChild>
          <a href="mailto:wael@oravio.co?subject=Add%20a%20module">Talk to Oravio</a>
        </Button>
      </div>
    </div>
  );
}
