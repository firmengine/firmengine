import { documentFieldContract, FIELD_CATALOG_RELEASE, FIELD_CATALOG_RELEASE_SHA256 } from "./document-agent-registry.ts";

export const FIELD_OBSERVATION_VERSION = "field-observation-2" as const;
export const SOURCE_STATES = ["present", "blank", "masked", "illegible", "not_seen", "conflicting", "explicit_none", "unknown"] as const;
export type SourceState = typeof SOURCE_STATES[number];
export type ApplicabilityClaim = "applicable" | "not_applicable" | "unknown";
export const VERIFICATION_STATES = ["unverified", "supported", "corrected", "wrong_field", "unreadable", "conflicting", "value_mismatch", "unclear", "missing_check"] as const;
export type VerificationState = typeof VERIFICATION_STATES[number];
export const SOURCE_BBOX_INSTRUCTIONS = "근거 위치의 범위: present/masked/explicit_none 값의 bbox는 quote에 직접 인용한 실제 문자·기호를 둘러싸는 최소 직사각형으로 잡는다. 표의 테두리, 셀 전체 너비, 행 전체 여백을 문자 근거 범위에 포함하지 않는다. quote가 표제와 값을 함께 인용하면 그 표제와 값의 실제 글자 영역을 모두 포함하는 최소 범위를 사용한다. 같은 값이 반복되어도 이 필드의 행·열에서 실제로 인용한 위치만 선택하고 떨어진 다른 필드를 큰 박스로 합치지 않는다. blank는 글자가 있는 것처럼 위치를 만들지 않고 실제 확인한 빈칸 영역을 사용하며, 그 빈칸을 식별하는 표제/행 문구를 quote로 보존한다. illegible은 판독불가인 원문 영역을 확인할 수 있을 때만 그 영역을 표시한다. bbox는 [left,top,right,bottom]의 좌표 끝점이며 좌상단이 원점이다. 기본 좌표계는 원본 전체 페이지를 0~1로 정규화한 것이다. 별도 영역 판독 요청에서만 현재 영역 이미지 내부의 0~1 좌표를 쓰며, 임의로 페이지 좌표와 섞지 않는다. 이미지에서 위치를 확인할 수 없으면 bbox=null로 둔다. bbox의 크기를 고정 비율로 줄이거나 기존 상자를 추정으로 이동하지 말고 실제 인용 글자와 다시 대조한다.";
export interface ObservationInput {
  key: string; label: string; value: string | null; unit: string | null; quote: string | null;
  bbox: number[] | null; confidence: "clear" | "uncertain" | "unreadable";
  canonicalFieldId?: string | null; sourceState?: SourceState;
  applicability?: ApplicabilityClaim; applicabilityQuote?: string | null;
  verificationState?: VerificationState;
}
export interface FieldObservation {
  version: typeof FIELD_OBSERVATION_VERSION;
  canonicalFieldId: string | null;
  familyId: string | null;
  catalogRelease: string;
  catalogSha256: string;
  binding: "explicit_id" | "exact_key" | "unbound";
  documentId: string; page: number; sourceSha256: string;
  recordIndex: number | null; fieldIndex: number | null;
  origin: "source_read" | "catalog_gap";
  supersededByHumanFactId?: string;
  label: string; rawValue: string | null; rawUnit: string | null; quote: string | null; bbox: number[] | null;
  sourceState: SourceState;
  extractionState: "value_read" | "source_empty" | "source_obscured" | "not_observed" | "conflict" | "uncertain";
  applicability: { sourceClaim: ApplicabilityClaim; quote: string | null; caseDecision: "unreviewed" };
  subjectRole: string | null; temporalRole: string | null;
  verificationState: VerificationState;
  issues: string[];
}
export interface PageFieldCoverage {
  version: typeof FIELD_OBSERVATION_VERSION;
  documentId: string; page: number; sourceSha256: string;
  familyId: string | null; catalogRelease: string; catalogSha256: string;
  completeReadClaim: boolean;
  observations: FieldObservation[];
}
const bboxValid = (v: number[] | null) => !!v && v.length === 4 && v.every(x => Number.isFinite(x) && x >= 0 && x <= 1) && v[0] < v[2] && v[1] < v[3];

/** Identity binding is exact and family-scoped. A label or value match never binds a field. */
export function observeField(type: string, field: ObservationInput, source: {documentId: string; page: number; sourceSha256: string}, recordIndex: number | null, fieldIndex: number | null): FieldObservation {
  const contract = documentFieldContract(type);
  const explicit = typeof field.canonicalFieldId === "string" && field.canonicalFieldId.length > 0;
  const candidates = (contract?.fields ?? []).filter(f => explicit ? f.global_field_id === field.canonicalFieldId : f.local_id === field.key || f.global_field_id === field.key);
  let definition = candidates.length === 1 ? candidates[0] : undefined;
  const issues: string[] = [];
  if (definition && explicit) {
    const local = definition.local_id, leaf = local.split(".").at(-1)!;
    const leafUnique = contract!.fields.filter(f => f.local_id.split(".").at(-1) === leaf).length === 1;
    const shortKey = field.key.split(".");
    const compatible = field.key === local || field.key === definition.global_field_id || leafUnique && (field.key === leaf || shortKey.length === 2 && ["person", "income", "debt", "asset", "transaction", "household", "business", "statement", "other", "bank_account", "lease", "insurance", "credit_report", "health_insurance_arrears"].includes(shortKey[0]) && shortKey[1] === leaf);
    if (!compatible) { definition = undefined; issues.push("canonical_id_key_conflict"); }
  }
  if (!definition) issues.push(explicit ? "canonical_id_outside_family" : "canonical_id_unbound");
  let state: SourceState = SOURCE_STATES.includes(field.sourceState as SourceState) ? field.sourceState! : field.value !== null ? "present" : field.confidence === "unreadable" ? "illegible" : "unknown";
  // Missing metadata is never evidence of a blank, zero, or inapplicability.
  if (state === "present" && (field.value === null || !field.value.trim())) { state = "unknown"; issues.push("present_without_value"); }
  if (["blank", "not_seen", "illegible"].includes(state) && field.value !== null) { state = "unknown"; issues.push("state_value_conflict"); }
  if (["blank", "masked", "explicit_none"].includes(state) && (!field.quote?.trim() || !bboxValid(field.bbox))) { state = "unknown"; issues.push("state_anchor_missing"); }
  if (state === "explicit_none" && field.value !== null && !field.value.trim()) { state = "unknown"; issues.push("explicit_none_without_source_token"); }
  let claim: ApplicabilityClaim = ["applicable", "not_applicable"].includes(field.applicability ?? "") ? field.applicability! : "unknown";
  const quote = field.applicabilityQuote?.trim() || null;
  // It is only a quoted source claim, never a reviewed case-level decision.
  // Require its evidence in this exact field citation, not a free-floating assertion.
  if (claim !== "unknown" && (!quote || !field.quote?.includes(quote) || !bboxValid(field.bbox))) { claim = "unknown"; issues.push("applicability_evidence_missing"); }
  if (claim === "not_applicable" && state === "present") { claim = "unknown"; issues.push("applicability_value_conflict"); }
  // A missing or empty slot does not establish that the field is inapplicable.
  // Require an explicit source-none token; case-level applicability remains a
  // separate, unreviewed decision even when the document makes that claim.
  if (claim === "not_applicable" && state !== "explicit_none") { claim = "unknown"; issues.push("not_applicable_without_explicit_none"); }
  const extractionState = recordIndex === null ? "not_observed" : state === "present" ? (field.confidence === "clear" ? "value_read" : "uncertain") : state === "blank" || state === "explicit_none" ? "source_empty" : state === "masked" || state === "illegible" ? "source_obscured" : state === "not_seen" ? "not_observed" : state === "conflicting" ? "conflict" : "uncertain";
  return { version: FIELD_OBSERVATION_VERSION, ...source, recordIndex, fieldIndex, origin: recordIndex === null ? "catalog_gap" : "source_read",
    canonicalFieldId: definition?.global_field_id ?? null, familyId: contract?.family_id ?? null,
    catalogRelease: FIELD_CATALOG_RELEASE, catalogSha256: FIELD_CATALOG_RELEASE_SHA256,
    binding: definition ? explicit ? "explicit_id" : "exact_key" : "unbound",
    label: field.label, rawValue: field.value, rawUnit: field.unit, quote: field.quote,
    bbox: bboxValid(field.bbox) ? [...field.bbox!] : null, sourceState: state, extractionState,
    applicability: { sourceClaim: claim, quote: claim === "unknown" ? null : quote, caseDecision: "unreviewed" },
    subjectRole: definition?.subject_role ?? null, temporalRole: definition?.temporal_role ?? null,
    verificationState: VERIFICATION_STATES.includes(field.verificationState as VerificationState) ? field.verificationState! : "unverified", issues };
}

export function pageFieldCoverage(read: {documentType: string; complete: boolean; records: {fields: ObservationInput[]}[]}, source: {documentId: string; page: number; sourceSha256: string}): PageFieldCoverage {
  const contract = documentFieldContract(read.documentType);
  const observations = read.records.flatMap((r, ri) => r.fields.map((f, fi) => observeField(read.documentType, f, source, ri, fi)));
  const observed = new Set(observations.map(o => o.canonicalFieldId));
  // These are catalog coverage gaps, not claims that a field actually exists in this source.
  for (const field of contract?.fields ?? []) if (!observed.has(field.global_field_id)) observations.push(observeField(read.documentType, {
    key: field.local_id, label: field.label, value: null, unit: null, quote: null, bbox: null,
    confidence: "uncertain", canonicalFieldId: field.global_field_id, sourceState: "unknown", applicability: "unknown", applicabilityQuote: null,
  }, source, null, null));
  return { version: FIELD_OBSERVATION_VERSION, ...source, familyId: contract?.family_id ?? null,
    catalogRelease: FIELD_CATALOG_RELEASE, catalogSha256: FIELD_CATALOG_RELEASE_SHA256,
    completeReadClaim: read.complete, observations };
}

export const FIELD_OBSERVATION_INSTRUCTIONS = `각 필드의 canonicalFieldId는 현재 family 계약의 global_field_id 중 정확히 대응하는 것만 쓰고 대응하지 않으면 null로 둔다. field.key는 기존 원문 의미 key를 유지하며 global ID로 대체하지 않는다. 계약의 datatype/canonical_unit은 원문 literal을 다른 값으로 고치거나 기본값을 채우라는 지시가 아니다. 명시된 필드의 값이 예상 형식과 달라도 보이는 literal을 보존하고 의미·형식 불일치는 별도 경고/검증 상태로 남긴다. 원문에 단위 항목이 따로 있으면 그 항목의 실제 문자열을 읽고, 다른 금액 칸의 단위로 대체하지 않는다. 금액 field.unit은 그 금액에 적용된다는 근거가 있는 인접 단위 또는 표 공통 머리글에서 읽을 수 있다. 같은 원문 수치·단위의 명시적 표기를 보존하는 정상적인 파싱은 허용하지만 계산·기본값·다른 칸의 값으로 빈칸을 채우지 않는다. 원문 상태 sourceState는 present(값 명시), blank(보이는 칸이 빈칸), masked(가림), illegible(판독불가), not_seen(현재 이미지에서 관찰 안 됨), conflicting(명시적 상충), explicit_none(원문에 없음 명시), unknown을 구별한다. blank/illegible/not_seen의 value는 null이다. masked 값은 보이는 마스킹 그대로 남긴다. explicit_none은 원문에 표시된 literal을 value에 담거나, 별도 값 없이 비해당 문구만 있는 경우 value=null로 두고 해당 문구를 quote와 bbox에 보존한다. 이를 0으로 바꾸지 않는다. blank는 해당 빈칸의 표제/행 quote와 bbox가 필요하다. ${SOURCE_BBOX_INSTRUCTIONS} applicability는 해당 주체·기간·항목에 대해 원문이 명시한 applicable/not_applicable/unknown 주장만 기록하고 그 구절을 applicabilityQuote 및 해당 field.quote에 함께 포함한다. not_applicable은 원문이 명시한 없음 토큰이나 비해당 문구를 quote와 bbox로 직접 확인할 수 있을 때 sourceState=explicit_none으로 기록한다. 빈칸, 누락, 서류 미제출, 값 0만으로 not_applicable이라 하지 않는다. 근거 없는 applicability는 unknown이다. 문서의 비해당 표시는 검토 전 원문 주장으로 저장되며 사건 전체의 법적 비대상 결정이나 사람 승인을 뜻하지 않는다. 계약 필드가 목록에 있다는 이유로 문서에 존재하는 칸을 만들지 않는다. 같은 필드가 여러 행이면 행마다 별도 occurrence로 보존한다.`;
