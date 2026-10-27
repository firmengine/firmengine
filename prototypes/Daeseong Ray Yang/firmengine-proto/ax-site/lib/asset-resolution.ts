import { currentFacts, validSourceRef, type Asset, type CaseData, type Fact } from "./domain.ts";

export interface AssetResolution {
  rows: Asset[];
  duplicates: string[];
  conflictIds: string[];
  issues: string[];
  metrics: { rowsVisited: number; mapLookups: number; strongGroups: number };
}
interface Identity { key: string | null; candidateKey: string | null; ownerId: string | null; historical: boolean; incompleteScope: boolean; }

function idValue(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const text = raw.normalize("NFKC").trim().toLocaleUpperCase("en-US");
  if (!text || /[*＊×•●○◦…_?？]/u.test(text) || /X{2,}/u.test(text) || /MASK|REDACT|UNKNOWN|미상|마스킹/iu.test(text)) return null;
  const value = text.replace(/[\s().\-‐‑‒–—/]/gu, "");
  return value.length >= 4 && /[\p{L}\p{N}]/u.test(value) ? value : null;
}
function canonicalKey(value: string) { return value.replace(/([a-z0-9])([A-Z])/g, "$1_$2").toLowerCase(); }
function factsFor(asset: Asset, active: Map<string, Fact>): Fact[] { return [...new Set(asset.factIds)].map(id => active.get(id)).filter((fact): fact is Fact => !!fact); }
function sourceBackedValue(data: CaseData, facts: Fact[], keys: string[]): string | null {
  const candidates = facts.filter(fact => keys.includes(canonicalKey(fact.key)));
  if (!candidates.length || candidates.some(fact => fact.state === "disputed" || fact.recognition === "rejected" || fact.validation.some(v => v.severity === "error" || v.code === "UNCERTAIN_READING") || fact.value === null || !fact.refs.length || fact.refs.some(ref => !ref.sourceHash || !validSourceRef(data, ref)))) return null;
  const values = candidates.map(fact => idValue(fact.value));
  if (values.some(value => !value) || new Set(values).size !== 1) return null;
  const value = values[0]!;
  if (candidates.some(fact => fact.refs.every(ref => !ref.quote.normalize("NFKC").replace(/[\s().\-‐‑‒–—/]/gu, "").toLocaleUpperCase("en-US").includes(value)))) return null;
  return value;
}
function historicalOwnership(data: CaseData, facts: Fact[]): boolean {
  const keys = new Set(["asset.owner_status", "vehicle.owner_status", "asset.ownership_status", "vehicle.current_owner_status", "asset.current_ownership"]);
  return facts.some(fact => keys.has(canonicalKey(fact.key)) && fact.state !== "disputed" && fact.recognition !== "rejected" && !fact.validation.some(v => v.severity === "error" || v.code === "UNCERTAIN_READING") && fact.refs.length > 0 && fact.refs.every(ref => !!ref.sourceHash && validSourceRef(data, ref)) && /(?:former|previous|historical|past|transferred|disposed|cancelled|이전\s*소유|과거|말소|양도|처분)/iu.test(String(fact.value ?? "")));
}
function ownershipStatusAmbiguous(data: CaseData, facts: Fact[]): boolean {
  const keys = new Set(["asset.owner_status", "vehicle.owner_status", "asset.ownership_status", "vehicle.current_owner_status", "asset.current_ownership"]);
  return facts.some(fact => keys.has(canonicalKey(fact.key)) && (fact.state === "disputed" || fact.recognition === "rejected" || fact.validation.some(v => v.severity === "error" || v.code === "UNCERTAIN_READING") || !fact.refs.length || fact.refs.some(ref => !ref.sourceHash || !validSourceRef(data, ref))));
}
const OWNER_KEYS = new Set(["asset.owner_name", "asset.current_owner", "asset.current_owner_name", "vehicle.owner_name", "vehicle.current_owner", "vehicle.current_owner_name", "insurance.policy_holder_name", "bank_account.account_holder_name"]);
function ownerObservation(facts: Fact[]): { value: string | null; ambiguous: boolean } {
  const ownerFacts = facts.filter(fact => OWNER_KEYS.has(canonicalKey(fact.key)) || ["asset.owner_identity_id", "asset.owner_id", "asset.policy_holder_identity_id", "asset.account_holder_identity_id", "bank_account.account_holder_id"].includes(canonicalKey(fact.key)));
  if (!ownerFacts.length) return { value: null, ambiguous: false };
  if (ownerFacts.some(fact => fact.state === "disputed" || fact.recognition === "rejected" || fact.validation.some(v => v.severity === "error" || v.code === "UNCERTAIN_READING") || !fact.refs.length || fact.refs.some(ref => !ref.sourceHash || !ref.quote?.trim()))) return { value: null, ambiguous: true };
  const values = ownerFacts.map(fact => `${canonicalKey(fact.key)}=${String(fact.value ?? "").normalize("NFKC").trim().toLocaleUpperCase("en-US")}`).sort();
  return { value: JSON.stringify(values), ambiguous: false };
}
function identityFor(data: CaseData, asset: Asset, facts: Fact[]): Identity {
  const ownerId = sourceBackedValue(data, facts, ["asset.owner_identity_id", "asset.owner_id", "asset.policy_holder_identity_id", "asset.account_holder_identity_id", "bank_account.account_holder_id"]);
  if (asset.kind === "insurance") {
    const issuer = sourceBackedValue(data, facts, ["asset.issuer_identity_id", "asset.insurer_identity_id", "asset.insurer_id", "insurance.issuer_identity_id"]);
    const policy = sourceBackedValue(data, facts, ["asset.policy_id", "asset.policy_number", "asset.insurance_policy_number", "insurance.policy_number"]);
    const base = issuer && policy ? JSON.stringify(["insurance", issuer, policy]) : null;
    return { key: base && ownerId ? JSON.stringify([base, ownerId]) : null, candidateKey: base, ownerId, historical: false, incompleteScope: !!base && !ownerId };
  }
  if (asset.kind === "vehicle") {
    const vin = sourceBackedValue(data, facts, ["asset.vin", "asset.chassis_number", "vehicle.vin", "vehicle.chassis_number"]);
    if (vin) return { key: ownerId ? JSON.stringify(["vehicle-vin", vin, ownerId]) : null, candidateKey: JSON.stringify(["vehicle-vin", vin]), ownerId, historical: historicalOwnership(data, facts), incompleteScope: !ownerId };
    const reg = sourceBackedValue(data, facts, ["asset.vehicle_registration_number", "asset.vehicle_number", "asset.plate_number", "vehicle.vehicle_number", "vehicle.registration_number"]);
    const base = reg ? JSON.stringify(["vehicle-registration", reg]) : null;
    return { key: base && ownerId ? JSON.stringify([base, ownerId]) : null, candidateKey: base, ownerId, historical: historicalOwnership(data, facts), incompleteScope: !!base && !ownerId };
  }
  if (asset.kind === "cash" || asset.kind === "deposit") {
    const issuer = sourceBackedValue(data, facts, ["asset.bank_identity_id", "asset.bank_id", "bank_account.bank_identity_id", "bank_account.bank_id"]);
    const account = sourceBackedValue(data, facts, ["asset.account_id", "asset.account_number", "bank_account.account_number"]);
    const base = issuer && account ? JSON.stringify(["bank-account", issuer, account]) : null;
    return { key: base && ownerId ? JSON.stringify([base, ownerId]) : null, candidateKey: base, ownerId, historical: false, incompleteScope: !!base && !ownerId };
  }
  return { key: null, candidateKey: null, ownerId, historical: false, incompleteScope: false };
}
function amount(value: Asset["grossValue"]) { return value == null ? null : [value.rawValue, value.unit, value.amountWon, value.normalizationStatus]; }
function observationKey(asset: Asset, ownerId: string | null, ownerSource: string | null) {
  return JSON.stringify([asset.kind, asset.asOf ?? null, asset.valuationBasis ?? null, asset.ownershipBps ?? null, amount(asset.grossValue), amount(asset.securedPayoff), amount(asset.disposalCosts), amount(asset.protectedValue), ownerId, ownerSource, asset.recognition ?? null]);
}
function informationalOnly(asset: Asset) {
  return asset.grossValue == null && asset.securedPayoff == null && asset.disposalCosts == null && asset.protectedValue == null;
}

/** Group by source-backed identity; only exact observations are deduplicated or linked as detail support. */
export function resolveAssetRows(data: CaseData): AssetResolution {
  const active = new Map(currentFacts(data).map(fact => [fact.id, fact]));
  const rows: Asset[] = [], duplicates: string[] = [], conflictIds = new Set<string>(), issues: string[] = [];
  const exactBuckets = new Map<string, Asset>(), identityBuckets = new Map<string, Asset[]>(), candidates = new Map<string, { row: Asset; identity: Identity }[]>(), weakCandidates = new Map<string, Asset[]>();
  const duplicateFacts = new Map<string, string[]>(), linkedSupportIds = new Set<string>();
  let mapLookups = 0;
  for (const asset of data.assets) {
    const row: Asset = { ...asset, factIds: [...asset.factIds] };
    const facts = factsFor(asset, active), identity = identityFor(data, asset, facts), owner = ownerObservation(facts), statusAmbiguous = ownershipStatusAmbiguous(data, facts);
    if (!identity.key && !identity.candidateKey) {
      const weakKey = JSON.stringify([asset.kind, asset.label.normalize("NFKC").trim().toLocaleLowerCase("ko-KR"), asset.asOf ?? null, asset.valuationBasis ?? null, asset.ownershipBps ?? null, amount(asset.grossValue), amount(asset.securedPayoff), amount(asset.disposalCosts), amount(asset.protectedValue)]);
      mapLookups++; const weakBucket = weakCandidates.get(weakKey) ?? []; weakBucket.push(row); weakCandidates.set(weakKey, weakBucket);
    }
    if (identity.historical) { conflictIds.add(row.id); issues.push(`ASSET_HISTORICAL_OWNERSHIP_NOT_CURRENT:${row.id}`); rows.push(row); continue; }
    if (statusAmbiguous) { conflictIds.add(row.id); issues.push(`ASSET_OWNERSHIP_STATUS_AMBIGUOUS:${row.id}`); rows.push(row); continue; }
    if (owner.ambiguous) { conflictIds.add(row.id); issues.push(`ASSET_OWNER_EVIDENCE_AMBIGUOUS:${row.id}`); rows.push(row); continue; }
    if (identity.candidateKey) { mapLookups++; const bucket = candidates.get(identity.candidateKey) ?? []; bucket.push({ row, identity }); candidates.set(identity.candidateKey, bucket); }
    if (!identity.key) { if (identity.incompleteScope) issues.push(`ASSET_IDENTITY_SCOPE_INCOMPLETE:${row.id}`); rows.push(row); continue; }
    const exact = JSON.stringify([identity.key, observationKey(row, identity.ownerId, owner.value)]);
    mapLookups++; const duplicate = exactBuckets.get(exact);
    if (duplicate) { const merged = duplicateFacts.get(duplicate.id) ?? [...duplicate.factIds]; merged.push(...row.factIds); duplicateFacts.set(duplicate.id, merged); duplicates.push(row.id); continue; }
    exactBuckets.set(exact, row); mapLookups++;
    const group = identityBuckets.get(identity.key) ?? []; group.push(row); identityBuckets.set(identity.key, group); mapLookups++;
    rows.push(row);
  }
  for (const group of identityBuckets.values()) {
    if (group.length < 2) continue;
    const supports = group.filter(informationalOnly), observations = group.filter(asset => !informationalOnly(asset));
    if (supports.length && observations.length === 1) {
      const primary = observations[0], merged = duplicateFacts.get(primary.id) ?? [...primary.factIds];
      merged.push(...supports.flatMap(asset => duplicateFacts.get(asset.id) ?? asset.factIds)); duplicateFacts.set(primary.id, merged);
      for (const asset of supports) linkedSupportIds.add(asset.id);
      duplicates.push(...supports.map(asset => asset.id));
      issues.push(`ASSET_INFORMATION_ROW_LINKED_NOT_PROMOTED:${supports.map(asset => asset.id).join(",")}`);
      continue;
    }
    if (observations.length > 1) {
      for (const asset of observations) conflictIds.add(asset.id);
      issues.push(`ASSET_SAME_ID_DIFFERENT_OBSERVATION_REVIEW_REQUIRED:${observations.map(asset => asset.id).join(",")}`);
    }
  }
  for (const group of candidates.values()) {
    if (group.length < 2) continue;
    const owners = new Set(group.map(item => item.identity.ownerId));
    if (owners.size > 1 || group.some(item => item.identity.incompleteScope)) {
      for (const item of group) conflictIds.add(item.row.id);
      issues.push(`ASSET_OWNER_OR_IDENTITY_SCOPE_CONFLICT:${group.map(item => item.row.id).join(",")}`);
    }
  }
  for (const group of weakCandidates.values()) if (group.length > 1) {
    for (const asset of group) conflictIds.add(asset.id);
    issues.push(`ASSET_WEAK_LABEL_OR_VALUE_MATCH_IS_NOT_IDENTITY:${group.map(asset => asset.id).join(",")}`);
  }
  for (const asset of rows) {
    const merged = duplicateFacts.get(asset.id);
    if (merged) asset.factIds = [...new Set(merged)];
  }
  const retainedRows = linkedSupportIds.size ? rows.filter(asset => !linkedSupportIds.has(asset.id)) : rows;
  return { rows: retainedRows, duplicates, conflictIds: [...conflictIds], issues: [...new Set(issues)], metrics: { rowsVisited: data.assets.length, mapLookups, strongGroups: identityBuckets.size } };
}
