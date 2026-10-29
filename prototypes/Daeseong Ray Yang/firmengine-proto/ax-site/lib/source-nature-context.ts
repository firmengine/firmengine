import { renderPromptPolicy } from "./reference-prompts.ts";
import { SOURCE_NATURES, type SourceNature } from "./classification-recovery.ts";

export const SOURCE_NATURE_QUOTE_MAX_CHARS = 240;

export interface SourceNatureRead {
  sourceNature?: unknown;
  sourceNatureQuote?: unknown;
}

export interface SourceNatureDiagnosticContext {
  version: "source-nature-diagnostic-v1";
  observations: SourceNatureObservation[];
}
export interface SourceNatureObservation {
  pass: "classification" | "recovery";
  sourceNature: SourceNature;
  sourceNatureQuote: string | null;
  sourceNatureQuoteTruncated: boolean;
}

/**
 * Preserve classifier source-nature claims as small diagnostic excerpts. This
 * is not an evidence quote: controls/spacing are normalized, the excerpt is
 * bounded, and consumers must continue to verify everything against the image.
 */
function safeExcerpt(value: unknown): { value: string | null; truncated: boolean } {
  if (typeof value !== "string") return { value: null, truncated: false };
  const boundedInput = value.slice(0, SOURCE_NATURE_QUOTE_MAX_CHARS * 4 + 1);
  const normalized = boundedInput
    .replace(/[\u0000-\u001f\u007f-\u009f]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const chars = Array.from(normalized);
  return {
    value: chars.length ? chars.slice(0, SOURCE_NATURE_QUOTE_MAX_CHARS).join("") : null,
    truncated: value.length > boundedInput.length || chars.length > SOURCE_NATURE_QUOTE_MAX_CHARS,
  };
}

function observation(pass: "classification" | "recovery", read: SourceNatureRead | null | undefined): SourceNatureObservation | null {
  if (!read) return null;
  const sourceNature = SOURCE_NATURES.includes(read.sourceNature as SourceNature)
    ? read.sourceNature as SourceNature
    : null;
  if (!sourceNature) return null;
  const excerpt = safeExcerpt(read.sourceNatureQuote);
  return {
    pass,
    sourceNature,
    sourceNatureQuote: excerpt.value,
    sourceNatureQuoteTruncated: excerpt.truncated,
  };
}

export function sourceNatureDiagnosticContext(
  classification?: SourceNatureRead | null,
  recovery?: SourceNatureRead | null,
): SourceNatureDiagnosticContext {
  return {
    version: "source-nature-diagnostic-v1",
    observations: [
      observation("classification", classification),
      observation("recovery", recovery),
    ].filter((value): value is SourceNatureObservation => value !== null),
  };
}

export const SOURCE_NATURE_HANDOFF_INSTRUCTIONS = renderPromptPolicy("prompt.source_nature_context.source_nature_handoff_instructions");
