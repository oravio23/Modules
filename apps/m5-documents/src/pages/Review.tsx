import { useParams } from "react-router-dom";
import { ReviewWorkspace } from "@/components/review/ReviewWorkspace";

export default function ReviewPage() {
  const { documentId } = useParams<{ documentId: string }>();

  if (!documentId) {
    return <p className="text-sm text-muted-foreground">No document selected.</p>;
  }

  return <ReviewWorkspace documentId={documentId} />;
}
