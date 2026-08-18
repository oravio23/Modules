import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useNavigate } from "react-router-dom";
import { useUser } from "@/lib/auth/AuthProvider";
import { signOut } from "@/lib/auth/signOut";
import { fadeUp, useMotionSafe } from "@/components/oravio/motion";

export default function AccountPage() {
  const user = useUser();
  const navigate = useNavigate();
  const motionSafe = useMotionSafe();

  async function handleSignOut() {
    await signOut();
    navigate("/", { replace: true });
  }

  return (
    <div className="mx-auto max-w-2xl px-[clamp(18px,4vw,56px)] py-12">
      <h1 className="text-2xl font-semibold text-[var(--app-text)]">Account</h1>
      <motion.div
        initial={motionSafe ? "hidden" : "visible"}
        animate="visible"
        variants={fadeUp}
      >
        <Card className="mt-6 border-[var(--app-line)] bg-[var(--app-surface)] text-[var(--app-text)]">
          <CardHeader>
            <CardTitle className="text-[var(--app-text)]">Signed in as</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-[var(--app-text-muted)]">{user?.email}</p>
            <Button variant="outline" onClick={handleSignOut}>
              Sign out
            </Button>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
