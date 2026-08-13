import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { DocumentProfile } from "@/lib/profiles/types";
import { loadBuiltInProfiles } from "@/lib/profiles/registry";

export default function ProfilesPage() {
  const [profiles, setProfiles] = useState<DocumentProfile[]>([]);

  useEffect(() => {
    loadBuiltInProfiles().then(setProfiles);
  }, []);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Document profiles</h1>
        <p className="text-sm text-muted-foreground">
          A profile is data, not code: a field schema, an extraction prompt, and a validator set.
          Adding a new document type (Bill of Lading, Packing List, …) is a new row here, not a
          pipeline change.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {profiles.map((profile) => (
          <Card key={profile.id}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">{profile.title}</CardTitle>
                <Badge variant={profile.status === "PROPOSED" ? "warning" : "secondary"}>
                  {profile.status} · v{profile.version}
                </Badge>
              </div>
              <CardDescription>{profile.description}</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-1.5 text-xs text-muted-foreground">
              <span className="font-medium text-foreground">{profile.fields.length}</span> fields ·{" "}
              <span className="font-medium text-foreground">{profile.validatorIds.length}</span> validators
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
