import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useNavigate } from "react-router-dom";
import { useUser } from "@/lib/auth/AuthProvider";
import { signOut } from "@/lib/auth/signOut";

export default function AccountPage() {
  const user = useUser();
  const navigate = useNavigate();

  async function handleSignOut() {
    await signOut();
    navigate("/", { replace: true });
  }

  return (
    <div className="mx-auto max-w-2xl px-[clamp(18px,4vw,56px)] py-12">
      <h1 className="text-2xl font-semibold text-[var(--navy)]">Account</h1>
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Signed in as</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-[var(--ink)]">{user?.email}</p>
          <Button variant="outline" onClick={handleSignOut}>
            Sign out
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
