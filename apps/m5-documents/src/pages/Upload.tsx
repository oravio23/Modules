import { UploadDropzone } from "@/components/upload/UploadDropzone";

export default function UploadPage() {
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <div className="space-y-1 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Upload a document</h1>
        <p className="text-sm text-muted-foreground">
          Any file type — native or scanned PDF, a photo, a spreadsheet, an email export, or a zip of
          mixed documents. English, Arabic, or mixed.
        </p>
      </div>
      <UploadDropzone />
    </div>
  );
}
