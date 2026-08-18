import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { fadeUp, useMotionSafe } from "@/components/oravio/motion";

export default function NotFoundPage() {
  const motionSafe = useMotionSafe();
  return (
    <motion.div
      initial={motionSafe ? "hidden" : "visible"}
      animate="visible"
      variants={fadeUp}
      className="mx-auto max-w-xl px-[clamp(18px,4vw,56px)] py-20 text-center"
    >
      <h1 className="text-2xl font-semibold text-[var(--app-text)]">Page not found</h1>
      <p className="mt-3 text-sm text-[var(--app-text-muted)]">
        That page doesn't exist, or you don't have a link to it anymore.
      </p>
      <Button asChild className="mt-6">
        <Link to="/hub">Back to hub</Link>
      </Button>
    </motion.div>
  );
}
