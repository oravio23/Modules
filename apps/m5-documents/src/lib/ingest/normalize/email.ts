import type { FileLike, NormalizedPart, NormalizeResult } from "../types.ts";
import { suggestDirection } from "@/lib/arabic";

export type RecurseFn = (file: FileLike, depth: number) => Promise<NormalizeResult>;

/** EML (RFC 5322) — headers + body as one part, attachments recursed through the same ingest pipeline. */
export async function normalizeEml(file: FileLike, depth: number, recurse: RecurseFn): Promise<NormalizeResult> {
  const { default: PostalMime } = await import("postal-mime");
  const email = await PostalMime.parse(file.bytes);

  const headerLines = [
    email.from ? `From: ${email.from.name ? `${email.from.name} <${email.from.address}>` : email.from.address}` : null,
    email.to?.length ? `To: ${email.to.map((t) => t.address).join(", ")}` : null,
    email.subject ? `Subject: ${email.subject}` : null,
    email.date ? `Date: ${email.date}` : null,
  ].filter(Boolean);
  const body = email.text ?? "(no plain-text body — HTML-only message)";
  const text = [...headerLines, "", body].join("\n");

  const parts: NormalizedPart[] = [
    { kind: "text", label: `${file.filename} — message`, text, direction: suggestDirection(text) },
  ];
  const warnings: string[] = [];

  if (depth >= 4) {
    if (email.attachments.length > 0) warnings.push(`${file.filename}: attachments skipped — max recursion depth reached`);
    return { parts, warnings };
  }

  for (const attachment of email.attachments) {
    const bytes = new Uint8Array(
      typeof attachment.content === "string"
        ? new TextEncoder().encode(attachment.content)
        : (attachment.content as ArrayBuffer),
    );
    try {
      const sub = await recurse(
        { filename: attachment.filename ?? "attachment", bytes, declaredMime: attachment.mimeType },
        depth + 1,
      );
      for (const p of sub.parts) {
        parts.push({ ...p, label: `${file.filename} — attachment: ${attachment.filename ?? "unnamed"} — ${p.label}` });
      }
      warnings.push(...sub.warnings);
    } catch (err) {
      warnings.push(`${file.filename}: attachment "${attachment.filename}" could not be processed — ${(err as Error).message}`);
    }
  }

  return { parts, warnings };
}
