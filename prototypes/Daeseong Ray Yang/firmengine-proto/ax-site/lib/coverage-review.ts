import { documentFieldContract } from "./document-agent-registry.ts";
import { isValidSourceBBox } from "./source-verification-identity.ts";

export const MAX_MISSING_FIELD_CUES = 32;
export const MISSING_FIELD_REVIEW_INSTRUCTIONS = "missingFields는 현재 페이지 이미지에서 실제로 보이는 필드·행·셀 중 read에 빠진 occurrence만 recovery cue로 기록한다. 현재 document family 계약에 정확히 있는 canonicalFieldId를 사용하고, 원문에 직접 대응하는 quote와 그 위치의 bbox를 함께 제시한다. sourceState는 보이는 값이 있으면 present, 빈칸이면 blank, 마스킹이면 masked, 읽을 수 없으면 illegible, 원문이 명시적으로 없다고 하면 explicit_none이다. 카탈로그에 필드가 있다는 이유, 빈칸·0·누락·다른 페이지·문서 전체 건수만으로 값을 만들거나 missingFields를 추가하지 않는다. 이 목록은 재추출 위치 후보이며 사실·값·비적용 결정·검증 증명이 아니다. 기존 read에 같은 canonicalFieldId와 겹치는 bbox occurrence가 있으면 중복 cue로 반환하지 않는다. 동일 필드가 여러 행에 실제로 보이면 각 행의 독립 bbox로 각각 기록한다.";

export type MissingFieldSourceState = "present" | "blank" | "masked" | "illegible" | "explicit_none";
export interface MissingFieldCue {
  canonicalFieldId: string | null;
  sourceState: MissingFieldSourceState;
  quote: string | null;
  bbox: number[] | null;
}
export interface MissingFieldRead {
  documentType: string;
  records: Array<{ fields: Array<{ canonicalFieldId?: string | null; bbox?: number[] | null }> }>;
}
export interface MissingFieldReviewResult {
  cues: MissingFieldCue[];
  diagnostics: string[];
}
const SOURCE_STATES: readonly MissingFieldSourceState[] = ["present", "blank", "masked", "illegible", "explicit_none"];
const overlaps = (left: number[], right: number[]) => left[0] < right[2] && right[0] < left[2] && left[1] < right[3] && right[1] < left[3];

/** Keep only exact, source-anchored family fields that are missing from this read. */
export function validateMissingFieldCues(read: MissingFieldRead, raw: unknown): MissingFieldReviewResult {
  const cues: MissingFieldCue[] = [], diagnostics: string[] = [];
  const contract = documentFieldContract(read.documentType);
  const allowed = new Set((contract?.fields ?? []).map(field => field.global_field_id));
  if (!contract) diagnostics.push("missing_fields_unknown_family");
  if (!Array.isArray(raw)) return { cues, diagnostics: [...diagnostics, "missing_fields_not_array"] };
  for (const candidate of raw) {
    if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) { diagnostics.push("missing_field_invalid_shape"); continue; }
    const cue = candidate as Record<string, unknown>;
    if (typeof cue.canonicalFieldId !== "string" || !cue.canonicalFieldId.trim() || !allowed.has(cue.canonicalFieldId)) { diagnostics.push("missing_field_id_unbound"); continue; }
    if (typeof cue.sourceState !== "string" || !SOURCE_STATES.includes(cue.sourceState as MissingFieldSourceState)) { diagnostics.push("missing_field_source_state_invalid"); continue; }
    if (typeof cue.quote !== "string" || !cue.quote.trim()) { diagnostics.push("missing_field_quote_missing"); continue; }
    if (!isValidSourceBBox(cue.bbox)) { diagnostics.push("missing_field_bbox_invalid"); continue; }
    const bbox = [...cue.bbox];
    const seenInRead = read.records.some(record => record.fields.some(field => field.canonicalFieldId === cue.canonicalFieldId && isValidSourceBBox(field.bbox) && overlaps(field.bbox, bbox)));
    if (seenInRead) { diagnostics.push("missing_field_occurrence_already_read"); continue; }
    const duplicate = cues.some(prior => prior.canonicalFieldId === cue.canonicalFieldId && isValidSourceBBox(prior.bbox) && overlaps(prior.bbox, bbox));
    if (duplicate) { diagnostics.push("missing_field_duplicate_region"); continue; }
    if (cues.length >= MAX_MISSING_FIELD_CUES) { diagnostics.push("missing_field_limit_reached"); continue; }
    cues.push({ canonicalFieldId: cue.canonicalFieldId, sourceState: cue.sourceState as MissingFieldSourceState, quote: cue.quote, bbox });
  }
  return { cues, diagnostics: [...new Set(diagnostics)] };
}

/** One initial source-omission recovery only; stored-read reverification is never a new extraction retry. */
export function shouldRetryMissingSource(input: { omittedRows: boolean; validMissingFieldCount: number; omissionRetried: boolean; isReverification: boolean }): boolean {
  return !input.isReverification && !input.omissionRetried && (input.omittedRows || Number.isSafeInteger(input.validMissingFieldCount) && input.validMissingFieldCount > 0);
}
