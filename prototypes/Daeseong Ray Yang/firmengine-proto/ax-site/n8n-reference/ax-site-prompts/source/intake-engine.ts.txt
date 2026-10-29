import {
  INTAKE_SCHEMA_VERSION, INTAKE_NOTE_MAX_CHARS, INTAKE_ACTIVE_MAX_CHARS,
  type ConsultationNote, type IntakeCatalog, type IntakeClaim, type IntakeCondition,
  type IntakeDocumentNeed, type IntakeQuestion, type IntakeQuote, type IntakeRequirement,
  type IntakeResult, type IntakeRule, type IntakeScope, type IntakeState,
} from "./intake-types.ts";

/** Bounds apply before model input and again before accepting structured output. */
export const INTAKE_LIMITS = {
  catalogChars: 1_500_000, notes: 100, noteChars: INTAKE_NOTE_MAX_CHARS, totalNoteChars: INTAKE_ACTIVE_MAX_CHARS,
  claims: 300, claimChars: 1_000_000, refsPerClaim: 12, quoteChars: 4_000,
} as const;
const SCOPES: IntakeScope[] = ["case", "income", "debt", "asset", "household", "expense", "event", "procedure"];
export const INTAKE_NEGATIVE_SUBJECT_LABELS: Readonly<Record<IntakeScope, string>> = {
  case: "신청인(사건 공통)", income: "신청인 소득 관련 비해당 진술", debt: "신청인 채무 관련 비해당 진술",
  asset: "신청인 재산 관련 비해당 진술", household: "신청인 가족·부양 관련 비해당 진술",
  expense: "신청인 지출 관련 비해당 진술", event: "신청인 사건이력 관련 비해당 진술", procedure: "신청인 절차 관련 비해당 진술",
};
const STATES: IntakeState[] = ["present", "absent", "unknown", "conflict", "legal_review"];
const TEMPORAL = ["current", "past", "uncertain"] as const;
const ID = /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,119}$/;
const own = (value: object, key: string) => Object.prototype.hasOwnProperty.call(value, key);
const sort = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0;
const unique = <T>(values: T[]) => [...new Set(values)];

function fail(code: string, detail: string): never { throw new Error(`${code}: ${detail}`); }
function record(value: unknown, where: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) fail("INTAKE_INVALID_OBJECT", where);
  return value as Record<string, unknown>;
}
function keys(value: Record<string, unknown>, expected: string[], where: string) {
  if (Object.keys(value).some(key => !expected.includes(key)) || expected.some(key => !own(value, key))) {
    fail("INTAKE_INVALID_FIELDS", where);
  }
}
function text(value: unknown, where: string, max = 2_000, allowEmpty = false): string {
  if (typeof value !== "string" || value.length > max || (!allowEmpty && !value.trim()) || /\u0000/.test(value)) fail("INTAKE_INVALID_TEXT", where);
  return value;
}
function id(value: unknown, where: string): string {
  const result = text(value, where, 120);
  if (!ID.test(result)) fail("INTAKE_INVALID_ID", where);
  return result;
}
function bool(value: unknown, where: string): boolean {
  if (typeof value !== "boolean") fail("INTAKE_INVALID_BOOLEAN", where);
  return value;
}
function integer(value: unknown, where: string, min = 1): number {
  if (!Number.isSafeInteger(value) || (value as number) < min) fail("INTAKE_INVALID_INTEGER", where);
  return value as number;
}
function list(value: unknown, where: string, max: number): unknown[] {
  if (!Array.isArray(value) || value.length > max) fail("INTAKE_INVALID_ARRAY", where);
  return value;
}
function strings(value: unknown, where: string, max = 100, length = 1_000): string[] {
  const result = list(value, where, max).map((item, index) => text(item, `${where}[${index}]`, length));
  if (unique(result).length !== result.length) fail("INTAKE_DUPLICATE_VALUE", where);
  return result;
}
function ids(value: unknown, where: string, max = 100): string[] {
  return strings(value, where, max, 120).map(item => id(item, where));
}
function enumValue<T extends string>(value: unknown, allowed: readonly T[], where: string): T {
  if (typeof value !== "string" || !allowed.includes(value as T)) fail("INTAKE_INVALID_ENUM", where);
  return value as T;
}
function date(value: unknown, where: string): string {
  const result = text(value, where, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(result) || !Number.isFinite(Date.parse(`${result}T00:00:00Z`)) || new Date(`${result}T00:00:00Z`).toISOString().slice(0, 10) !== result) fail("INTAKE_INVALID_DATE", where);
  return result;
}
function boundedJson(value: unknown, max: number, where: string) {
  let serialized: string | undefined;
  try { serialized = JSON.stringify(value); } catch { fail("INTAKE_INVALID_JSON", where); }
  if (!serialized || serialized.length > max) fail("INTAKE_INPUT_TOO_LARGE", where);
}
function uniqueIds<T extends { id: string }>(items: T[], where: string) {
  if (new Set(items.map(item => item.id)).size !== items.length) fail("INTAKE_DUPLICATE_ID", where);
}

/** Parse a bounded, declarative catalog. It never evaluates arbitrary expressions. */
export function validateIntakeCatalog(value: unknown): IntakeCatalog {
  boundedJson(value, INTAKE_LIMITS.catalogChars, "catalog");
  const raw = record(value, "catalog");
  keys(raw, ["schemaVersion", "version", "title", "features", "documents", "rules", "sources", "note"], "catalog");
  if (raw.schemaVersion !== INTAKE_SCHEMA_VERSION) fail("INTAKE_SCHEMA_MISMATCH", "catalog.schemaVersion");
  const features = list(raw.features, "features", 300).map((item, index) => {
    const row = record(item, `features[${index}]`);
    keys(row, ["id", "label", "scope", "question", "essential", "description"], `features[${index}]`);
    return { id: id(row.id, "feature.id"), label: text(row.label, "feature.label", 200), scope: enumValue(row.scope, SCOPES, "feature.scope"), question: text(row.question, "feature.question", 1_000), essential: bool(row.essential, "feature.essential"), description: text(row.description, "feature.description", 3_000) };
  });
  const sources = list(raw.sources, "sources", 150).map((item, index) => {
    const row = record(item, `sources[${index}]`);
    keys(row, ["id", "title", "url", "jurisdiction", "checkedAt", "locator", "note"], `sources[${index}]`);
    const url = text(row.url, "source.url", 3_000);
    let parsed: URL;
    try { parsed = new URL(url); } catch { fail("INTAKE_INVALID_URL", "source.url"); }
    if (!["https:", "http:"].includes(parsed.protocol) || parsed.username || parsed.password) fail("INTAKE_INVALID_URL", "source.url");
    return { id: id(row.id, "source.id"), title: text(row.title, "source.title", 500), url, jurisdiction: text(row.jurisdiction, "source.jurisdiction", 200), checkedAt: date(row.checkedAt, "source.checkedAt"), locator: text(row.locator, "source.locator", 1_000), note: text(row.note, "source.note", 4_000, true) };
  });
  const documents = list(raw.documents, "documents", 400).map((item, index) => {
    const row = record(item, `documents[${index}]`);
    keys(row, ["id", "name", "category", "issuer", "purpose", "fields", "workflowDocumentTypes", "sourceIds"], `documents[${index}]`);
    return { id: id(row.id, "document.id"), name: text(row.name, "document.name", 300), category: text(row.category, "document.category", 200), issuer: text(row.issuer, "document.issuer", 1_000), purpose: text(row.purpose, "document.purpose", 3_000), fields: strings(row.fields, "document.fields", 100), workflowDocumentTypes: ids(row.workflowDocumentTypes, "document.workflowDocumentTypes"), sourceIds: ids(row.sourceIds, "document.sourceIds") };
  });
  const condition = (item: unknown): IntakeCondition => {
    const row = record(item, "condition"); keys(row, ["featureId", "state"], "condition");
    return { featureId: id(row.featureId, "condition.featureId"), state: enumValue(row.state, ["present", "absent"], "condition.state") };
  };
  const need = (item: unknown): IntakeDocumentNeed => {
    const row = record(item, "documentNeed");
    keys(row, ["documentTypeId", "alternatives", "alternativePolicy", "period", "requirement", "reason"], "documentNeed");
    return { documentTypeId: id(row.documentTypeId, "need.documentTypeId"), alternatives: ids(row.alternatives, "need.alternatives"), alternativePolicy: enumValue(row.alternativePolicy, ["any_of", "review_required"], "need.alternativePolicy"), period: text(row.period, "need.period", 1_000), requirement: enumValue(row.requirement, ["required_when_applicable", "recommended", "court_ordered"], "need.requirement"), reason: text(row.reason, "need.reason", 3_000) };
  };
  const rules = list(raw.rules, "rules", 400).map((item, index): IntakeRule => {
    const row = record(item, `rules[${index}]`);
    keys(row, ["id", "title", "enabled", "scope", "all", "any", "documents", "questions", "workflowIds", "sourceIds", "jurisdictions", "effectiveFrom", "effectiveTo", "legalReviewRequired"], `rules[${index}]`);
    return { id: id(row.id, "rule.id"), title: text(row.title, "rule.title", 300), enabled: bool(row.enabled, "rule.enabled"), scope: enumValue(row.scope, SCOPES, "rule.scope"), all: list(row.all, "rule.all", 30).map(condition), any: list(row.any, "rule.any", 30).map(condition), documents: list(row.documents, "rule.documents", 40).map(need), questions: strings(row.questions, "rule.questions", 30), workflowIds: ids(row.workflowIds, "rule.workflowIds"), sourceIds: ids(row.sourceIds, "rule.sourceIds"), jurisdictions: ids(row.jurisdictions, "rule.jurisdictions", 100), effectiveFrom: row.effectiveFrom === null ? null : date(row.effectiveFrom, "rule.effectiveFrom"), effectiveTo: row.effectiveTo === null ? null : date(row.effectiveTo, "rule.effectiveTo"), legalReviewRequired: bool(row.legalReviewRequired, "rule.legalReviewRequired") };
  });
  uniqueIds(features, "features"); uniqueIds(documents, "documents"); uniqueIds(rules, "rules"); uniqueIds(sources, "sources");
  const featureMap = new Map(features.map(feature => [feature.id, feature]));
  const documentIds = new Set(documents.map(document => document.id)), sourceIds = new Set(sources.map(source => source.id));
  const sourceLinks = (links: string[], where: string) => { for (const link of links) if (!sourceIds.has(link)) fail("INTAKE_UNKNOWN_SOURCE", where); };
  for (const document of documents) sourceLinks(document.sourceIds, `document:${document.id}`);
  for (const rule of rules) {
    sourceLinks(rule.sourceIds, `rule:${rule.id}`);
    if (!rule.all.length && !rule.any.length && rule.scope !== "case") fail("INTAKE_UNSCOPED_RULE", rule.id);
    if (rule.effectiveFrom && rule.effectiveTo && rule.effectiveFrom > rule.effectiveTo) fail("INTAKE_INVALID_EFFECTIVE_PERIOD", rule.id);
    for (const conditions of [rule.all, rule.any]) {
      const identities = conditions.map(item => `${item.featureId}:${item.state}`);
      if (unique(identities).length !== identities.length) fail("INTAKE_DUPLICATE_CONDITION", rule.id);
      for (const item of conditions) {
        const feature = featureMap.get(item.featureId);
        if (!feature) fail("INTAKE_UNKNOWN_FEATURE", `${rule.id}:${item.featureId}`);
        if (feature.scope !== rule.scope && feature.scope !== "case") fail("INTAKE_CONDITION_SCOPE_MISMATCH", `${rule.id}:${feature.id}`);
      }
    }
    if (new Set(rule.all.map(item => item.featureId)).size !== rule.all.length) fail("INTAKE_CONTRADICTORY_RULE", rule.id);
    for (const item of rule.documents) {
      if (!documentIds.has(item.documentTypeId)) fail("INTAKE_UNKNOWN_DOCUMENT", rule.id);
      for (const alternative of item.alternatives) if (!documentIds.has(alternative) || alternative === item.documentTypeId) fail("INTAKE_UNKNOWN_ALTERNATIVE", rule.id);
    }
  }
  return { schemaVersion: INTAKE_SCHEMA_VERSION, version: integer(raw.version, "catalog.version"), title: text(raw.title, "catalog.title", 500), features, documents, rules, sources, note: text(raw.note, "catalog.note", 5_000, true) };
}

/** The runtime also filters superseded notes. Repeat that exclusion at the pure boundary. */
export function intakeSourceNotes(value: ConsultationNote[]): ConsultationNote[] {
  const notes = list(value, "notes", INTAKE_LIMITS.notes).map((item, index) => {
    const row = record(item, `notes[${index}]`);
    id(row.id, "note.id"); id(row.caseId, "note.caseId"); integer(row.sequence, "note.sequence");
    text(row.text, "note.text", INTAKE_LIMITS.noteChars);
    if (typeof row.textSha256 !== "string" || !/^[a-f0-9]{64}$/.test(row.textSha256)) fail("INTAKE_INVALID_SOURCE_HASH", "note.textSha256");
    if (row.supersedesId !== null) id(row.supersedesId, "note.supersedesId");
    return item as ConsultationNote;
  });
  if (notes.reduce((total, note) => total + note.text.length, 0) > INTAKE_LIMITS.totalNoteChars) fail("INTAKE_INPUT_TOO_LARGE", "consultation text");
  uniqueIds(notes, "notes");
  if (new Set(notes.map(note => note.caseId)).size > 1) fail("INTAKE_CASE_MISMATCH", "notes");
  const superseded = new Set(notes.flatMap(note => note.supersedesId ? [note.supersedesId] : []));
  for (const note of notes) if (note.supersedesId === note.id) fail("INTAKE_INVALID_SUPERSESSION", note.id);
  return notes.filter(note => !superseded.has(note.id)).sort((a, b) => a.sequence - b.sequence || sort(a.id, b.id));
}

function requireSubject(subjectId: string, scope: IntakeScope, state?: IntakeState) {
  if (scope === "case" ? subjectId !== "case" : !subjectId.startsWith(`${scope}:`) || subjectId.length <= scope.length + 1) fail("INTAKE_SUBJECT_SCOPE_MISMATCH", subjectId);
  if (state === "present" && subjectId === `${scope}:none`) fail("INTAKE_NEGATIVE_SUBJECT_PRESENT", subjectId);
}
function acceptsHistoricalOccurrence(feature: { id: string; scope: IntakeScope }): boolean {
  // A prior proceeding is relevant history. An old court order is not a current filing obligation.
  return feature.scope === "event" || feature.scope === "procedure" && ["procedure.previous", "procedure.private_adjustment"].includes(feature.id);
}
function combinedState(states: IntakeState[]): IntakeState {
  if (states.includes("conflict") || states.includes("present") && states.includes("absent")) return "conflict";
  if (states.includes("legal_review")) return "legal_review";
  if (states.includes("unknown") || !states.length) return "unknown";
  return states[0];
}
function uniqueRefs(refs: IntakeQuote[]): IntakeQuote[] {
  const seen = new Set<string>();
  return refs.filter(ref => { const key = JSON.stringify([ref.noteId, ref.start, ref.end, ref.quote]); if (seen.has(key)) return false; seen.add(key); return true; }).sort((a, b) => sort(a.noteId, b.noteId) || a.start - b.start || a.end - b.end);
}

/** Ground every model claim in an exact active-note quote; offsets are server-computed. */
export function validateIntakeClaims(raw: unknown, notes: ConsultationNote[], catalog: IntakeCatalog): IntakeClaim[] {
  const checkedCatalog = validateIntakeCatalog(catalog), activeNotes = intakeSourceNotes(notes);
  boundedJson(raw, INTAKE_LIMITS.claimChars, "claims");
  let rows: unknown;
  if (Array.isArray(raw)) rows = raw;
  else { const envelope = record(raw, "classifier result"); keys(envelope, ["claims"], "classifier result"); rows = envelope.claims; }
  const features = new Map(checkedCatalog.features.map(feature => [feature.id, feature])), noteMap = new Map(activeNotes.map(note => [note.id, note]));
  const parsed = list(rows, "claims", INTAKE_LIMITS.claims).map((item, index) => {
    const row = record(item, `claims[${index}]`);
    keys(row, ["featureId", "subjectId", "subjectLabel", "state", "temporal", "refs"], `claims[${index}]`);
    const featureId = id(row.featureId, "claim.featureId"), feature = features.get(featureId);
    if (!feature) fail("INTAKE_UNKNOWN_FEATURE", featureId);
    const rawSubjectId = id(row.subjectId, "claim.subjectId"), subjectLabel = text(row.subjectLabel, "claim.subjectLabel", 250).replace(/\s+/gu, " ").trim();
    const state = enumValue(row.state, STATES, "claim.state"), temporal = enumValue(row.temporal, TEMPORAL, "claim.temporal");
    // Compatibility repair for the former prompt's literal placeholder only. The
    // allowlisted feature supplies the scope; no positive or unresolved ID is repaired.
    const subjectId = rawSubjectId === "scope:none" && state === "absent" ? feature.scope === "case" ? "case" : `${feature.scope}:none` : rawSubjectId;
    requireSubject(subjectId, feature.scope, state);
    const refs = list(row.refs, "claim.refs", INTAKE_LIMITS.refsPerClaim).map(item => {
      const ref = record(item, "claim.ref"); keys(ref, ["noteId", "quote"], "claim.ref");
      const noteId = id(ref.noteId, "claim.ref.noteId"), note = noteMap.get(noteId), quote = text(ref.quote, "claim.ref.quote", INTAKE_LIMITS.quoteChars);
      if (!note) fail("INTAKE_UNKNOWN_OR_SUPERSEDED_NOTE", noteId);
      if (quote.trim().length < 2) fail("INTAKE_UNSUPPORTED_QUOTE", noteId);
      const start = note.text.indexOf(quote);
      if (start < 0) fail("INTAKE_UNSUPPORTED_QUOTE", noteId);
      if (note.text.indexOf(quote, start + 1) >= 0) fail("INTAKE_AMBIGUOUS_QUOTE", noteId);
      return { noteId, quote, start, end: start + quote.length };
    });
    if (!refs.length) fail("INTAKE_UNGROUNDED_CLAIM", featureId);
    return { featureId, subjectId, subjectLabel, state, temporal, refs };
  });
  const subjectGroups = new Map<string, typeof parsed>();
  for (const claim of parsed) subjectGroups.set(claim.subjectId, [...(subjectGroups.get(claim.subjectId) ?? []), claim]);
  for (const [subjectId, group] of subjectGroups) {
    const labelKeys = new Set(group.map(claim => claim.subjectLabel.replace(/\s/gu, "")));
    let canonicalLabel = group[0].subjectLabel;
    if (labelKeys.size > 1) {
      // A display-label variation on an entirely negative subject cannot create a positive
      // identity. Keep its exact source quotes and ID; never repair ambiguous positive IDs.
      if (!group.every(claim => claim.state === "absent")) fail("INTAKE_SUBJECT_LABEL_CONFLICT", subjectId);
      canonicalLabel = INTAKE_NEGATIVE_SUBJECT_LABELS[features.get(group[0].featureId)!.scope];
    }
    for (const claim of group) claim.subjectLabel = canonicalLabel;
  }
  const groups = new Map<string, IntakeClaim>(), groupStates = new Map<string, IntakeState[]>();
  for (const claim of parsed) {
    const key = JSON.stringify([claim.featureId, claim.subjectId, claim.temporal]), previous = groups.get(key);
    const states = [...(groupStates.get(key) ?? []), claim.state]; groupStates.set(key, states);
    if (previous) {
      previous.state = combinedState(states);
      previous.refs = uniqueRefs([...previous.refs, ...claim.refs]);
    } else groups.set(key, { ...claim, id: `claim:${claim.featureId}:${claim.subjectId}:${claim.temporal}`, basis: "client_report", refs: uniqueRefs(claim.refs) });
  }
  const result = [...groups.values()].sort((a, b) => sort(a.subjectId, b.subjectId) || sort(a.featureId, b.featureId) || sort(a.temporal, b.temporal));
  // A blanket denial and a positive member cannot coexist silently under different IDs.
  for (const denial of result.filter(claim => claim.subjectId.endsWith(":none") && claim.state === "absent")) {
    const historical = acceptsHistoricalOccurrence(features.get(denial.featureId)!);
    const positives = result.filter(claim => claim.featureId === denial.featureId && claim.subjectId !== denial.subjectId && claim.state === "present" && (claim.temporal === denial.temporal || historical && claim.temporal !== "uncertain" && denial.temporal !== "uncertain"));
    if (!positives.length) continue;
    const refs = uniqueRefs([denial, ...positives].flatMap(claim => claim.refs));
    denial.state = "conflict"; denial.refs = refs;
    for (const positive of positives) { positive.state = "conflict"; positive.refs = refs; }
  }
  return result;
}

interface Evidence { state: IntakeState; claims: IntakeClaim[]; reason: string; temporalPending: boolean }
interface ConditionResult { condition: IntakeCondition; evidence: Evidence; outcome: "true" | "false" | "unknown" | "conflict" | "legal_review" }
type GroupOutcome = ConditionResult["outcome"];
const severity: Record<IntakeRequirement["status"], number> = { requested: 0, qualification_needed: 1, legal_review: 2, conflict: 3 };
const obligationStrength: Record<IntakeDocumentNeed["requirement"], number> = { recommended: 0, court_ordered: 1, required_when_applicable: 2 };
function unresolved(outcomes: GroupOutcome[]): GroupOutcome {
  return outcomes.includes("conflict") ? "conflict" : outcomes.includes("legal_review") ? "legal_review" : "unknown";
}
function evaluateGroup(results: ConditionResult[], mode: "all" | "any"): GroupOutcome {
  if (!results.length) return "true";
  const outcomes = results.map(result => result.outcome);
  if (mode === "all") return outcomes.includes("false") ? "false" : outcomes.every(value => value === "true") ? "true" : unresolved(outcomes);
  return outcomes.includes("true") ? "true" : outcomes.every(value => value === "false") ? "false" : unresolved(outcomes);
}

/** Independent deterministic matching: no model-generated document IDs or legal acceptance. */
export function matchIntakeChecklist(input: { claims: IntakeClaim[]; catalog: IntakeCatalog; courtId: string; asOf: string }): IntakeResult {
  const catalog = validateIntakeCatalog(input.catalog), asOf = date(input.asOf, "asOf"), courtId = text(input.courtId, "courtId", 120, true);
  const features = new Map(catalog.features.map(feature => [feature.id, feature])), documents = new Map(catalog.documents.map(document => [document.id, document]));
  const claims = list(input.claims, "claims", INTAKE_LIMITS.claims).map(value => {
    const claim = record(value, "validated claim") as unknown as IntakeClaim, feature = features.get(claim.featureId);
    if (!feature) fail("INTAKE_UNKNOWN_FEATURE", String(claim.featureId));
    id(claim.subjectId, "claim.subjectId"); enumValue(claim.state, STATES, "claim.state"); enumValue(claim.temporal, TEMPORAL, "claim.temporal");
    requireSubject(claim.subjectId, feature.scope, claim.state);
    if (claim.basis !== "client_report" || !Array.isArray(claim.refs) || !claim.refs.length) fail("INTAKE_UNGROUNDED_CLAIM", claim.featureId);
    return { ...claim, refs: claim.refs.map(ref => ({ ...ref })) };
  });
  uniqueIds(claims, "claims");
  const byFeature = new Map<string, IntakeClaim[]>();
  for (const claim of claims) byFeature.set(claim.featureId, [...(byFeature.get(claim.featureId) ?? []), claim]);
  const lookup = (featureId: string, subjectId: string): Evidence => {
    const feature = features.get(featureId)!, target = feature.scope === "case" ? "case" : subjectId;
    const candidates = (byFeature.get(featureId) ?? []).filter(claim => claim.subjectId === target || claim.subjectId === `${feature.scope}:none`);
    const history = acceptsHistoricalOccurrence(feature);
    const current = candidates.filter(claim => claim.temporal === "current" || history && claim.temporal === "past");
    const uncertain = candidates.filter(claim => claim.temporal === "uncertain");
    const relevant = [...current, ...uncertain];
    if (relevant.length) {
      const states = relevant.map(claim => claim.temporal === "uncertain" && !["conflict", "legal_review"].includes(claim.state) ? "unknown" as const : claim.state);
      return { state: combinedState(states), claims: relevant, reason: uncertain.length ? "상담에서 현재 적용 시점이 확정되지 않았습니다." : "상담 원문에 명시된 해당 대상의 진술입니다.", temporalPending: uncertain.length > 0 };
    }
    if (candidates.length) return { state: "unknown", claims: candidates, reason: "과거 사실은 보존하되 현재 소득·소유·채무 상태로 간주하지 않습니다.", temporalPending: true };
    return { state: "unknown", claims: [], reason: "상담에서 이 조건을 확인하지 않았습니다. 미언급은 없음이 아닙니다.", temporalPending: false };
  };
  const requirements = new Map<string, IntakeRequirement>(), questions = new Map<string, IntakeQuestion>(), warnings = new Set<string>(), matchedRuleIds: string[] = [];
  const obligations = new Map<string, { requirement: IntakeDocumentNeed["requirement"]; active: boolean }[]>();
  const addQuestion = (featureId: string | null, subjectId: string, question: string, reason: string, ruleIds: string[]) => {
    const key = JSON.stringify([featureId, subjectId, question]), previous = questions.get(key);
    if (previous) { previous.ruleIds = unique([...previous.ruleIds, ...ruleIds]); previous.reason = unique([previous.reason, reason]).join(" "); }
    else questions.set(key, { id: `question:${encodeURIComponent(key)}`, featureId, subjectId, question, reason, ruleIds: unique(ruleIds) });
  };
  // Essential existence questions do not invent unknown claims or infer a negative from silence.
  for (const feature of catalog.features.filter(feature => feature.essential)) {
    const related = byFeature.get(feature.id) ?? [];
    const subjects = feature.scope === "case" ? ["case"] : unique(related.map(claim => claim.subjectId));
    if (!subjects.length) addQuestion(feature.id, `${feature.scope}:unspecified`, feature.question, "상담에 이 항목의 명시적 답변이 없습니다.", []);
    for (const subjectId of subjects) {
      const evidence = lookup(feature.id, subjectId);
      if (["present", "absent"].includes(evidence.state)) continue;
      addQuestion(feature.id, subjectId, feature.question, evidence.state === "conflict" ? "서로 모순되는 진술을 원문과 함께 확인해야 합니다." : evidence.state === "legal_review" ? "해당 여부에 담당자의 법률 검토가 필요합니다." : evidence.reason, []);
    }
  }
  for (const rule of catalog.rules) {
    if (!rule.enabled || rule.effectiveFrom && asOf < rule.effectiveFrom || rule.effectiveTo && asOf > rule.effectiveTo) continue;
    const courtUnknown = !courtId || ["unknown", "unconfirmed", "미확인"].includes(courtId);
    if (rule.jurisdictions.length && !courtUnknown && !rule.jurisdictions.includes(courtId)) continue;
    const jurisdictionPending = rule.jurisdictions.length > 0 && courtUnknown;
    const subjectIds = rule.scope === "case" ? ["case"] : unique(claims.filter(claim => features.get(claim.featureId)!.scope === rule.scope && !claim.subjectId.endsWith(":none")).map(claim => claim.subjectId));
    for (const subjectId of subjectIds) {
      const check = (condition: IntakeCondition): ConditionResult => {
        const evidence = lookup(condition.featureId, subjectId);
        return { condition, evidence, outcome: evidence.state === "present" || evidence.state === "absent" ? evidence.state === condition.state ? "true" : "false" : evidence.state };
      };
      const all = rule.all.map(check), any = rule.any.map(check), allOutcome = evaluateGroup(all, "all"), anyOutcome = evaluateGroup(any, "any");
      if (allOutcome === "false" || anyOutcome === "false") continue;
      // An OR satisfied by one known branch does not demand every alternative branch.
      const relevant = [...all, ...(anyOutcome === "true" ? any.filter(result => result.outcome === "true") : any)];
      const hasGroundedTrigger = !relevant.length || relevant.some(result => result.evidence.claims.length > 0);
      if (!hasGroundedTrigger) continue;
      const outcome: GroupOutcome = allOutcome === "true" && anyOutcome === "true" ? "true" : unresolved([allOutcome, anyOutcome]);
      const status: IntakeRequirement["status"] = outcome === "conflict" ? "conflict" : outcome === "legal_review" ? "legal_review" : outcome === "unknown" || jurisdictionPending ? "qualification_needed" : rule.legalReviewRequired ? "legal_review" : "requested";
      if (outcome === "true" && !jurisdictionPending) matchedRuleIds.push(rule.id);
      const sourceClaims = unique(relevant.flatMap(result => result.evidence.claims.map(claim => claim.id)));
      const subjectLabel = subjectId === "case" ? "신청인(사건 공통)" : claims.find(claim => claim.subjectId === subjectId)?.subjectLabel ?? subjectId;
      for (const result of relevant.filter(result => !["true", "false"].includes(result.outcome))) {
        const feature = features.get(result.condition.featureId)!;
        addQuestion(feature.id, feature.scope === "case" ? "case" : subjectId, feature.question, result.outcome === "conflict" ? "동일 대상의 상담 진술이 충돌하여 조건을 확정할 수 없습니다." : result.outcome === "legal_review" ? "상담만으로 법적 성질을 확정할 수 없습니다." : result.evidence.reason, [rule.id]);
      }
      if (jurisdictionPending) addQuestion(null, "case", "관할 법원을 확인해 주세요.", `${rule.title}: 관할이 확인되기 전에는 법원별 요구를 공통 필수서류로 적용하지 않습니다.`, [rule.id]);
      if (rule.legalReviewRequired) addQuestion(null, subjectId, `${rule.title}의 해당 여부와 요청 범위를 담당자가 검토해 주세요.`, "이 규칙에는 사건별 법률 검토가 필요합니다.", [rule.id]);
      for (const question of rule.questions) addQuestion(null, subjectId, question, rule.title, [rule.id]);
      for (const need of rule.documents) {
        const document = documents.get(need.documentTypeId)!;
        const key = JSON.stringify([need.documentTypeId, subjectId, need.period]);
        const previous = requirements.get(key);
        const activeCurrentOrder = outcome === "true" && !jurisdictionPending && relevant.some(result => result.condition.featureId === "procedure.court_order" && result.condition.state === "present" && result.outcome === "true" && result.evidence.claims.some(claim => claim.temporal === "current" && claim.state === "present"));
        const needStatus = need.requirement === "court_ordered" && !activeCurrentOrder && status === "requested" ? "legal_review" : status;
        if (need.requirement === "court_ordered" && !activeCurrentOrder) addQuestion(null, subjectId, "현재 사건 법원의 실제 요구사항과 제출기한을 확인해 주세요.", "현재 사건의 유효한 명령 원문이 확인되기 전에는 이 서류를 확정된 법원 제출의무로 취급하지 않습니다.", [rule.id]);
        const allObligations = [...(obligations.get(key) ?? []), { requirement: need.requirement, active: outcome === "true" && !jurisdictionPending && (need.requirement !== "court_ordered" || activeCurrentOrder) }];
        obligations.set(key, allObligations);
        const activeObligations = allObligations.filter(item => item.active);
        const strongestObligation = (activeObligations.length ? activeObligations : allObligations).reduce((strongest, item) => obligationStrength[item.requirement] > obligationStrength[strongest] ? item.requirement : strongest, "recommended" as IntakeDocumentNeed["requirement"]);
        const alternatives = need.alternatives.map(alternative => ({ id: alternative, name: documents.get(alternative)!.name }));
        const needSourceIds = unique([...rule.sourceIds, ...document.sourceIds, ...need.alternatives.flatMap(alternative => documents.get(alternative)!.sourceIds)]);
        const reasons = [need.reason, ...unique(relevant.filter(result => result.evidence.temporalPending).map(result => result.evidence.reason))];
        if (needStatus === "qualification_needed") reasons.push("해당 조건을 확인한 뒤 요청 범위를 확정합니다.");
        if (need.requirement === "court_ordered" && !activeCurrentOrder) reasons.push("현재 사건의 실제 법원 요구인지 원문 확인이 필요합니다.");
        if (previous) {
          const priorAlternatives = previous.alternatives.map(alternative => alternative.id).sort(sort), nextAlternatives = alternatives.map(alternative => alternative.id).sort(sort);
          const differentAlternativeSets = JSON.stringify(priorAlternatives) !== JSON.stringify(nextAlternatives);
          previous.status = severity[needStatus] > severity[previous.status] ? needStatus : previous.status;
          previous.requirement = strongestObligation;
          previous.reason = unique([...previous.reason, ...reasons]);
          previous.matchedRuleIds = unique([...previous.matchedRuleIds, rule.id]);
          previous.workflowIds = unique([...previous.workflowIds, ...rule.workflowIds]);
          previous.sourceClaimIds = unique([...previous.sourceClaimIds, ...sourceClaims]);
          previous.sourceIds = unique([...previous.sourceIds, ...needSourceIds]);
          previous.alternatives = [...new Map([...previous.alternatives, ...alternatives].map(alternative => [alternative.id, alternative])).values()];
          if (need.alternativePolicy === "review_required" || differentAlternativeSets) previous.alternativePolicy = "review_required";
          if (differentAlternativeSets) {
            const warning = `${document.name}: 연결된 규칙의 대체자료 범위가 달라 담당자 확인이 필요합니다.`;
            warnings.add(warning); previous.reason = unique([...previous.reason, warning]);
          }
        } else requirements.set(key, { id: `requirement:${encodeURIComponent(key)}`, documentTypeId: document.id, documentName: document.name, subjectId, subjectLabel, period: need.period, requirement: strongestObligation, status: needStatus, reason: reasons, matchedRuleIds: [rule.id], workflowIds: [...rule.workflowIds], sourceClaimIds: sourceClaims, sourceIds: needSourceIds, alternatives, alternativePolicy: need.alternativePolicy, fields: [...document.fields], issuer: document.issuer });
      }
    }
  }
  if (claims.some(claim => claim.state === "conflict")) warnings.add("상담 진술의 충돌을 보존했습니다. 명시적으로 정정된 상담 이력이 없으면 최신 진술만으로 덮어쓰지 않습니다.");
  if (claims.some(claim => claim.temporal === "past" && !acceptsHistoricalOccurrence(features.get(claim.featureId)!))) warnings.add("과거 활동·소유·명령은 현재 상태나 제출의무로 자동 적용하지 않았습니다. 현재 여부를 추가 확인해 주세요.");
  if (claims.some(claim => claim.temporal === "uncertain")) warnings.add("시점이 불명확한 진술은 현재 해당 여부를 확정하지 않았습니다.");
  const items = [...requirements.values()], questionItems = [...questions.values()];
  return { claims, requirements: items, questions: questionItems, warnings: [...warnings], matchedRuleIds: unique(matchedRuleIds), counts: { requested: items.filter(item => item.status === "requested").length, qualificationNeeded: items.filter(item => item.status === "qualification_needed").length, conflict: items.filter(item => item.status === "conflict").length, legalReview: items.filter(item => item.status === "legal_review").length, questions: questionItems.length } };
}
