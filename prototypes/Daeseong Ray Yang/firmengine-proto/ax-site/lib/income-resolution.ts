import { currentFacts, factHasValidStructuredRefs, structuredSourceRowKeys, validSourceRef, type CaseData, type IncomeSource } from "./domain.ts";

export interface IncomeResolution {
  rows: IncomeSource[];
  duplicates: string[];
  issues: string[];
  metrics: { rowsVisited: number; mapLookups: number };
}

const moneyFingerprint = (value: IncomeSource["net"]) => value == null ? null : [value.rawValue, value.unit, value.amountWon, value.normalizationStatus];
function exactIdentity(raw: string | undefined): string | null {
  if (!raw) return null;
  const text = raw.normalize("NFKC").trim().toLocaleUpperCase("en-US");
  if (!text || /[*＊×•●○◦…_?？]/u.test(text) || /X{2,}/u.test(text) || /MASK|REDACT|UNKNOWN|미상|마스킹/iu.test(text)) return null;
  const value = text.replace(/[\s().\-‐‑‒–—/]/gu, "");
  return value.length >= 4 && /[\p{L}\p{N}]/u.test(value) ? value : null;
}
function sourceIdentity(data: CaseData, source: IncomeSource, active: Map<string, ReturnType<typeof currentFacts>[number]>): string | null {
  const id = exactIdentity(source.payerIdentityId);
  if (!id) return null;
  const facts = source.factIds.map(fid => active.get(fid)).filter((fact): fact is NonNullable<typeof fact> => !!fact);
  const candidates = facts.filter(fact => fact.key.replace(/([a-z0-9])([A-Z])/g, "$1_$2").toLowerCase() === "income.payer_identity_id");
  if (!candidates.length || candidates.some(fact => fact.state === "disputed" || fact.recognition === "rejected" || fact.validation.some(v => v.severity === "error" || v.code === "UNCERTAIN_READING") || String(fact.value).normalize("NFKC").trim() !== source.payerIdentityId?.normalize("NFKC").trim() || !(fact.structuredRefs !== undefined ? factHasValidStructuredRefs(data,fact) : fact.refs.length > 0 && fact.refs.every(ref => !!ref.sourceHash && validSourceRef(data, ref))))) return null;
  if (candidates.some(fact => fact.structuredRefs === undefined && fact.refs.every(ref => !ref.quote.normalize("NFKC").replace(/[\s().\-‐‑‒–—/]/gu, "").toLocaleUpperCase("en-US").includes(id)))) return null;
  return id;
}

function observationCore(source: IncomeSource) {
  return JSON.stringify([source.kind, exactIdentity(source.payerIdentityId), source.label, source.employer ?? null, source.periodStart ?? null, source.periodEnd ?? null, source.periodMonths ?? null, source.amountBasis ?? null, moneyFingerprint(source.gross), moneyFingerprint(source.expenses), moneyFingerprint(source.net), source.recurring ?? null]);
}
function sourceObservationSignature(data: CaseData, source: IncomeSource, active: Map<string, ReturnType<typeof currentFacts>[number]>): string | null {
  const facts = source.factIds.map(id => active.get(id));
  if (!facts.length || facts.some(fact => !fact || !(fact.structuredRefs !== undefined ? factHasValidStructuredRefs(data,fact) : fact.refs.length > 0 && fact.refs.every(ref => !!ref.sourceHash && validSourceRef(data, ref))))) return null;
  if (facts.every(fact => fact?.structuredRefs !== undefined)) {
    const rowKeys = facts.flatMap(fact => structuredSourceRowKeys(data, fact!));
    const distinctRows = [...new Set(rowKeys)];
    if (distinctRows.length !== 1) return null;
    return JSON.stringify(facts.map(fact => [fact!.key, fact!.value, fact!.numeric?.rawValue ?? null, fact!.numeric?.unit ?? null, distinctRows[0]]).sort((a,b) => JSON.stringify(a).localeCompare(JSON.stringify(b))));
  }
  if (facts.some(fact => fact?.structuredRefs !== undefined)) return null;
  const canonicalKey = (key: string) => key.replace(/([a-z0-9])([A-Z])/g, "$1_$2").toLowerCase();
  const occurrenceFields = facts.filter(fact => ["income.net", "income.gross", "income.period_start", "income.period_end"].includes(canonicalKey(fact!.key)));
  // Cross-fact dedup needs row-level provenance: same page/quote/value can occur in two rows.
  // Require complete, non-page-wide boxes on the amount and period fields, then bind every
  // referenced fact to its exact box. Stable fact-version IDs remain a separate safe key.
  const required = new Set(["income.net", "income.period_start", "income.period_end"]);
  if ([...required].some(key => !occurrenceFields.some(fact => canonicalKey(fact!.key) === key && fact!.refs.some(ref => ref.bbox && ref.bbox.length === 4 && ref.bbox.every(Number.isFinite) && ref.bbox[0] >= 0 && ref.bbox[1] >= 0 && ref.bbox[2] <= 1 && ref.bbox[3] <= 1 && ref.bbox[2] - ref.bbox[0] <= 0.95 && ref.bbox[3] - ref.bbox[1] <= 0.20)))) return null;
  const fields = facts.flatMap(fact => fact!.refs.map(ref => [fact!.key, fact!.value, fact!.numeric?.rawValue ?? null, fact!.numeric?.unit ?? null, ref.sourceHash ?? null, ref.documentId, ref.page, ref.quote.normalize("NFKC").trim(), ref.bbox ?? null])).sort((a,b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
  return JSON.stringify(fields);
}

/**
 * Remove only repeated representations of the same source fact versions, or the same
 * complete-payer, same-period, same-basis observation from the exact same source refs.
 * Similar names/amounts and masked IDs never authorize a merge.
 */
export function resolveIncomeRows(data: CaseData, sources: IncomeSource[] = data.incomes): IncomeResolution {
  const activeFacts = currentFacts(data), active = new Map(activeFacts.map(fact => [fact.id, fact]));
  const exactBuckets = new Map<string, IncomeSource>(), strongBuckets = new Map<string, IncomeSource>();
  const potentialBuckets = new Map<string, string[]>(), weakCandidates = new Map<string, string[]>();
  const rows: IncomeSource[] = [], duplicates: string[] = [], issues: string[] = [];
  let mapLookups = 0;
  for (const source of sources) {
    const row: IncomeSource = { ...source, factIds: [...source.factIds] };
    const factIds = [...new Set(row.factIds)].sort();
    const exactFacts = factIds.length > 0 && factIds.every(id => active.has(id));
    const core = observationCore(row), identity = sourceIdentity(data, row, active);
    const exactKey = exactFacts ? JSON.stringify([factIds, core]) : null;
    const sourceSignature = sourceObservationSignature(data, row, active);
    const strongKey = identity && sourceSignature ? JSON.stringify([identity, row.kind, row.periodStart ?? null, row.periodEnd ?? null, row.periodMonths ?? null, row.amountBasis ?? null, core, sourceSignature]) : null;
    let existing: IncomeSource | undefined;
    if (exactKey) { mapLookups++; existing = exactBuckets.get(exactKey); }
    if (!existing && strongKey) { mapLookups++; existing = strongBuckets.get(strongKey); }
    if (existing) {
      existing.factIds = [...new Set([...existing.factIds, ...source.factIds])];
      duplicates.push(source.id);
      continue;
    }
    rows.push(row);
    if (exactKey) { mapLookups++; exactBuckets.set(exactKey, row); }
    if (strongKey) { mapLookups++; strongBuckets.set(strongKey, row); }
    if (identity) {
      const key = JSON.stringify([identity, row.kind, row.periodStart ?? null, row.periodEnd ?? null, row.periodMonths ?? null, row.amountBasis ?? null]);
      mapLookups++; const bucket = potentialBuckets.get(key) ?? []; bucket.push(row.id); potentialBuckets.set(key, bucket);
    } else if (row.employer || row.label) {
      const name = (row.employer || row.label).normalize("NFKC").trim().toLocaleLowerCase("ko-KR");
      const key = JSON.stringify([name, row.kind, row.periodStart ?? null, row.periodEnd ?? null, row.periodMonths ?? null, row.amountBasis ?? null, moneyFingerprint(row.net)]);
      mapLookups++; const bucket = weakCandidates.get(key) ?? []; bucket.push(row.id); weakCandidates.set(key, bucket);
    }
  }
  for (const ids of potentialBuckets.values()) if (ids.length > 1) issues.push(`INCOME_SAME_PAYER_PERIOD_OBSERVATIONS_REVIEW_REQUIRED:${ids.join(",")}`);
  for (const ids of weakCandidates.values()) if (ids.length > 1) issues.push(`INCOME_NAME_MATCH_IS_NOT_IDENTITY:${ids.join(",")}`);
  return { rows, duplicates, issues: [...new Set(issues)], metrics: { rowsVisited: sources.length, mapLookups } };
}
