import { Link, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MODULES } from "@/lib/entitlements/modules";
import { fadeUp, useMotionSafe } from "@/components/oravio/motion";

export default function NoAccessPage() {
  const { moduleId } = useParams();
  const module = MODULES.find((m) => m.id === moduleId);
  const motionSafe = useMotionSafe();

  return (
    <motion.div
      initial={motionSafe ? "hidden" : "visible"}
      animate="visible"
      variants={fadeUp}
      className="mx-auto max-w-xl px-[clamp(18px,4vw,56px)] py-20 text-center"
    >
      <motion.div
        className="mx-auto mb-6 flex h-12 w-12 items-center justify-center rounded-full border border-[var(--app-line)] bg-[var(--app-surface)]"
        animate={motionSafe ? { scale: [1, 1.08, 1] } : undefined}
        transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
      >
        <Lock className="h-5 w-5 text-[var(--app-text-muted)]" />
      </motion.div>
      <h1 className="text-2xl font-semibold text-[var(--app-text)]">
        {module ? module.name : "This module"} isn't in your package
      </h1>
      {module && (
        <p className="mt-3 text-sm text-[var(--app-text-muted)]">{module.tagline}</p>
      )}
      <p className="mt-2 text-sm text-[var(--app-text-muted)]">
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
    </motion.div>
  );
}
