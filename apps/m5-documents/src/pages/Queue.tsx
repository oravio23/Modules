import { DocumentQueue } from "@/components/queue/DocumentQueue";

export default function QueuePage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Queue</h1>
        <p className="text-sm text-muted-foreground">
          Every uploaded document and its pipeline stage. Nothing is exported until a human reviews it.
        </p>
      </div>
      <DocumentQueue />
    </div>
  );
}
