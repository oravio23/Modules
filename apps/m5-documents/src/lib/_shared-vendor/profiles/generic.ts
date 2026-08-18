// VENDORED — copied verbatim from supabase/functions/_shared by scripts/vendor-shared.mjs.
// Do not hand-edit: edit the source in supabase/functions/_shared and re-run
// `node scripts/vendor-shared.mjs` (also runs automatically on postinstall/build).

import type { DocumentProfileDefinition } from "./types.ts";

/**
 * The `generic` profile — the "any input" half of the app. No fixed field
 * set: it asks Claude to describe what the document actually is and pull out
 * whatever structured content it plausibly contains, using the exact same
 * evidence + anchoring + validation machinery as commercial_invoice.
 *
 * This is what makes "extract from ANY document" true rather than "extract
 * from any document, as long as it's one of the profiles we thought of."
 */
export const GENERIC_PROFILE: DocumentProfileDefinition = {
  id: "generic",
  version: "0.1",
  status: "PROPOSED",
  title: "Generic document",
  description:
    "No fixed field set. Produces a document-type guess, a short summary, and whatever key-values, tables, entities, dates, and amounts the document actually contains.",
  fields: [
    {
      path: "document_type_guess",
      label: "Document type (guess)",
      type: "string",
      required: true,
      critical: false,
      description: "A short, plain-language guess at what kind of document this is (e.g. 'delivery note', 'employment contract', 'lab report'). Not a classification into a fixed taxonomy.",
    },
    {
      path: "summary",
      label: "Summary",
      type: "string",
      required: true,
      critical: false,
      description: "A 1-3 sentence factual summary of the document's content. No speculation about intent or missing context.",
    },
  ],
  repeatingGroup: {
    groupPath: "key_values",
    fields: [
      {
        path: "key_values[{i}].label",
        label: "Key-value label",
        type: "string",
        required: false,
        critical: false,
        description: "The label/key as printed or clearly implied on the document (e.g. 'PO Number', 'Reference').",
      },
      {
        path: "key_values[{i}].value",
        label: "Key-value value",
        type: "string",
        required: false,
        critical: false,
        description: "The value associated with that label.",
      },
    ],
  },
  validatorIds: ["EVD-001", "CMP-001"],
  extractionPrompt: `You are extracting structured content from a document you have not seen a fixed schema for.

Read the transcript(s) provided and produce:
- document_type_guess: a short, plain-language guess at the document type.
- summary: 1-3 factual sentences.
- Zero or more key_values entries: any clearly labelled field/value pairs on the document (form fields, headers, metadata blocks). Do not invent labels that aren't there.
- Zero or more entities, dates, amounts, or tables you can identify, each as its own field with its own evidence.

For every field you emit, you MUST provide at least one evidence quote: a short, VERBATIM substring copied exactly from the transcript that supports the value. Do not paraphrase the quote. If you cannot find a supporting quote, do not emit the field — mark it status 'missing' instead, or omit it if it's part of an optional repeating group.

Never invent a value to fill a gap. If a field is illegible, ambiguous, or contradicted elsewhere in the document, set its status to 'uncertain' or 'conflicting' and explain why in 'notes' — do not silently pick one reading.`,
};
