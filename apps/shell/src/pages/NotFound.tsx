import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

export default function NotFoundPage() {
  return (
    <div className="mx-auto max-w-xl px-[clamp(18px,4vw,56px)] py-20 text-center">
      <h1 className="text-2xl font-semibold text-[var(--navy)]">Page not found</h1>
      <p className="mt-3 text-sm text-[var(--muted)]">
        That page doesn't exist, or you don't have a link to it anymore.
      </p>
      <Button asChild className="mt-6">
        <Link to="/hub">Back to hub</Link>
      </Button>
    </div>
  );
}
