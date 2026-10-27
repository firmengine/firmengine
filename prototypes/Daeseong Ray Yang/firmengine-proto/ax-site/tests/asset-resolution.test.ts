import test from "node:test";
import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";
import { createCase, DRAFT_RULESET, normalizeMoney, type Asset, type CaseData, type Fact } from "../lib/domain.ts";
import { resolveAssetRows } from "../lib/asset-resolution.ts";
import { calculateCase } from "../lib/assessment.ts";

const hash = "b".repeat(64);
function fixture() {
  const data = createCase("Synthetic asset resolution", "synthetic-assets", "2026-10-27");
  data.documents = [{ id: "doc", name: "synthetic.pdf", sha256: hash, status: "active", pages: [1, 2, 3] }];
  data.pages = [1, 2, 3].map(page => ({ documentId: "doc", page, role: "evidence" as const, text: "", imageUrl: `/synthetic/${page}` }));
  data.context.inventoryComplete = { income: "yes", debt: "yes", asset: "yes" };
  return data;
}
function addAsset(data: CaseData, opts: { id: string; page: number; kind?: Asset["kind"]; label?: string; policy?: string; issuer?: string; account?: string; bank?: string; owner?: string; ownerName?: string; vin?: string; registration?: string; ownerStatus?: string; value?: string | null; asOf?: string; protectedValue?: string; payoff?: string; payoffScope?: Asset["securedPayoffScope"]; costs?: string; basis?: string; ownershipBps?: number | null }) {
  const fields: [string,string][] = [];
  if (opts.policy) { fields.push(["asset.policy_number", opts.policy], ["asset.issuer_identity_id", opts.issuer ?? "issuer-001"], ["asset.owner_identity_id", opts.owner ?? "owner-001"]); }
  if (opts.account) { fields.push(["asset.account_number", opts.account], ["asset.bank_identity_id", opts.bank ?? "bank-001"], ["asset.owner_identity_id", opts.owner ?? "owner-001"]); }
  if (opts.vin) { fields.push(["asset.vin", opts.vin]); if (opts.owner) fields.push(["asset.owner_identity_id", opts.owner]); }
  if (opts.registration) { fields.push(["asset.vehicle_registration_number", opts.registration], ["asset.owner_identity_id", opts.owner ?? "owner-001"]); }
  if (opts.ownerStatus) fields.push(["vehicle.owner_status", opts.ownerStatus]);
  if (opts.ownerName) fields.push(["vehicle.current_owner_name", opts.ownerName]);
  if(opts.payoffScope)fields.push(["asset.secured_payoff_scope",opts.payoffScope]);
  const factIds = fields.map(([key,value],i) => {
    const id = `${opts.id}-f${i}`, quote = `synthetic source ${key} ${value}`;
    const fact: Fact = { id, logicalId: `${opts.id}:${key}`, version: 1, subjectId: opts.id, key, value, rawValue: value, state: "extracted", recognition: "unreviewed", refs: [{ documentId: "doc", page: opts.page, quote, sourceHash: hash }], validation: [] };
    data.facts.push(fact); return id;
  });
  const money = (value: string | undefined) => value === undefined ? null : normalizeMoney(value, "KRW");
  const asset: Asset = { id: opts.id, kind: opts.kind ?? (opts.policy ? "insurance" : "vehicle"), label: opts.label ?? "Synthetic asset", ...(opts.value !== null && opts.value !== undefined ? { grossValue: money(opts.value) } : {}), ...(opts.payoff !== undefined ? { securedPayoff: money(opts.payoff) } : {}), ...(opts.payoffScope ? {securedPayoffScope:opts.payoffScope}:{}), ...(opts.costs !== undefined ? { disposalCosts: money(opts.costs) } : {}), ...(opts.protectedValue !== undefined ? { protectedValue: money(opts.protectedValue) } : {}), ...(opts.ownershipBps !== undefined ? { ownershipBps: opts.ownershipBps } : {}), ...(opts.asOf ? { asOf: opts.asOf } : {}), ...(opts.basis ? { valuationBasis: opts.basis } : {}), recognition: "unreviewed", factIds };
  data.assets.push(asset); return asset;
}
const completeInsurance = (id: string, page: number, extra: Partial<Parameters<typeof addAsset>[1]> = {}) => ({ id, page, policy: "POLICY-001", issuer: "INSURER-001", owner: "OWNER-001", kind: "insurance" as const, label: "Synthetic policy", value: "4000000", asOf: "2026-10-01", protectedValue: "500000", payoff: "0", costs: "0", basis: "surrender value certificate", ownershipBps: 10000, ...extra });

test("issuer and owner scoped complete policy ID deduplicates an identical observation only", () => {
  const data = fixture(); addAsset(data, completeInsurance("policy-a", 1)); addAsset(data, completeInsurance("policy-b", 2));
  const result = resolveAssetRows(data);
  assert.deepEqual(result.rows.map(row => row.id), ["policy-a"]); assert.deepEqual(result.duplicates, ["policy-b"]);
  assert.equal(result.rows[0].recognition, "unreviewed"); assert.ok(result.rows[0].factIds.length > 0);
});

test("different valuation date or legal deduction keeps both rows and blocks their aggregate", () => {
  for (const extra of [{ asOf: "2025-12-01" }, { protectedValue: "900000" }, { ownershipBps: 5000 }]) {
    const data = fixture(); addAsset(data, completeInsurance("policy-a", 1)); addAsset(data, completeInsurance("policy-b", 2, extra));
    const resolution = resolveAssetRows(data), calculation = calculateCase(data, DRAFT_RULESET);
    assert.equal(resolution.rows.length, 2); assert.equal(resolution.duplicates.length, 0); assert.equal(resolution.conflictIds.length, 2);
    assert.ok(calculation.assetRows.every(row => row.liquidationWon === null));
    assert.ok(calculation.issues.some(issue => issue.startsWith("ASSET_SAME_ID_DIFFERENT_OBSERVATION_REVIEW_REQUIRED")));
  }
});

test("secured payoff scope differences are separate asset observations and cannot deduplicate",()=>{
  const data=fixture();
  const a=addAsset(data,{...completeInsurance("scope-a",1),payoff:"1000000",payoffScope:"applicant_interest"});
  const b=addAsset(data,{...completeInsurance("scope-b",2),payoff:"1000000",payoffScope:"entire_collateral"});
  const resolved=resolveAssetRows(data);
  assert.equal(resolved.rows.length,2);assert.equal(resolved.duplicates.length,0);
  assert.ok(resolved.conflictIds.includes(a.id)&&resolved.conflictIds.includes(b.id));
});

test("same-name and same-value assets without strong IDs remain separate and become a review candidate", () => {
  const data = fixture();
  addAsset(data, { id: "cash-a", page: 1, kind: "cash", label: "same-name deposit", value: "1000000", asOf: "2026-10-01", payoff: "0", costs: "0", protectedValue: "0", ownershipBps: 10000, basis: "statement" });
  addAsset(data, { id: "cash-b", page: 2, kind: "cash", label: "same-name deposit", value: "1000000", asOf: "2026-10-01", payoff: "0", costs: "0", protectedValue: "0", ownershipBps: 10000, basis: "statement" });
  const result = resolveAssetRows(data);
  assert.equal(result.rows.length, 2); assert.deepEqual(result.duplicates, []); assert.equal(result.conflictIds.length, 2);
  assert.ok(result.issues.some(issue => issue.startsWith("ASSET_WEAK_LABEL_OR_VALUE_MATCH_IS_NOT_IDENTITY")));
  assert.ok(calculateCase(data, DRAFT_RULESET).assetRows.every(row => row.liquidationWon === null));
});

test("masked policy ID does not deduplicate; owner scope conflict keeps rows and blocks totals", () => {
  const masked = fixture(); addAsset(masked, completeInsurance("masked-a", 1, { policy: "POL-****-001" })); addAsset(masked, completeInsurance("masked-b", 2, { policy: "POL-XXXX-001" }));
  assert.equal(resolveAssetRows(masked).rows.length, 2);
  const ownerMismatch = fixture(); addAsset(ownerMismatch, completeInsurance("owner-a", 1)); addAsset(ownerMismatch, completeInsurance("owner-b", 2, { owner: "OWNER-002" }));
  const result = resolveAssetRows(ownerMismatch);
  assert.equal(result.rows.length, 2); assert.equal(result.duplicates.length, 0); assert.equal(result.conflictIds.length, 2);
  assert.ok(result.issues.some(issue => issue.startsWith("ASSET_OWNER_OR_IDENTITY_SCOPE_CONFLICT")));
});

test("embedded repeated X tokens are masked and unknown vehicle ownership scope never merges", () => {
  const masked = fixture();
  addAsset(masked, completeInsurance("x-mask-a", 1, { policy: "ABXX1234" })); addAsset(masked, completeInsurance("x-mask-b", 2, { policy: "ABXX1234" }));
  assert.equal(resolveAssetRows(masked).rows.length, 2);
  const unknownOwners = fixture();
  addAsset(unknownOwners, { id: "vin-owner-a", page: 1, kind: "vehicle", vin: "KMHAB001TU000001", ownerName: "Owner Alpha", value: "10000000", asOf: "2026-01-01", payoff: "0", costs: "0", protectedValue: "0", ownershipBps: 10000, basis: "valuation" });
  addAsset(unknownOwners, { id: "vin-owner-b", page: 1, kind: "vehicle", vin: "KMHAB001TU000001", ownerName: "Owner Beta", value: "10000000", asOf: "2026-01-01", payoff: "0", costs: "0", protectedValue: "0", ownershipBps: 10000, basis: "valuation" });
  const result = resolveAssetRows(unknownOwners);
  assert.equal(result.rows.length, 2); assert.deepEqual(result.duplicates, []); assert.equal(result.conflictIds.length, 2);
});

test("complete VIN and owner-scoped vehicle registration connect strong observations", () => {
  const vin = fixture(); addAsset(vin, { id: "v1", page: 1, kind: "vehicle", vin: "KMHAB001TU000001", owner: "OWNER-001", label: "different label", value: "10000000", asOf: "2026-01-01", payoff: "0", costs: "0", protectedValue: "0", ownershipBps: 10000, basis: "valuation" }); addAsset(vin, { id: "v2", page: 2, kind: "vehicle", vin: "kmhab001tu000001", owner: "OWNER-001", label: "another label", value: "10000000", asOf: "2026-01-01", payoff: "0", costs: "0", protectedValue: "0", ownershipBps: 10000, basis: "valuation" });
  assert.equal(resolveAssetRows(vin).rows.length, 1);
  const registration = fixture(); addAsset(registration, { id: "r1", page: 1, kind: "vehicle", registration: "12가3456", owner: "OWNER-001", label: "Synthetic vehicle" }); addAsset(registration, { id: "r2", page: 2, kind: "vehicle", registration: "12-가-3456", owner: "OWNER-001", label: "Synthetic vehicle" });
  assert.equal(resolveAssetRows(registration).rows.length, 1);
});

test("bank account identity requires complete account, institution, and owner evidence", () => {
  const data = fixture();
  const common = { kind: "deposit" as const, label: "Synthetic bank account", value: "2000000", asOf: "2026-10-01", payoff: "0", costs: "0", protectedValue: "0", ownershipBps: 10000, basis: "bank statement" };
  addAsset(data, { id: "bank-a", page: 1, account: "123-456-7890", bank: "BANK-001", owner: "OWNER-001", ...common });
  addAsset(data, { id: "bank-b", page: 2, account: "1234567890", bank: "BANK-001", owner: "OWNER-001", ...common });
  const result = resolveAssetRows(data);
  assert.deepEqual(result.rows.map(row => row.id), ["bank-a"]); assert.deepEqual(result.duplicates, ["bank-b"]);

  const masked = fixture();
  addAsset(masked, { id: "mask-a", page: 1, account: "1234-****-90", bank: "BANK-001", owner: "OWNER-001", ...common });
  addAsset(masked, { id: "mask-b", page: 2, account: "1234-XXXX-90", bank: "BANK-001", owner: "OWNER-001", ...common });
  assert.equal(resolveAssetRows(masked).rows.length, 2);
});

test("information-only rows can support one valued asset but do not create approvals", () => {
  const data = fixture();
  const valued = addAsset(data, { id: "valued", page: 1, kind: "vehicle", vin: "KMHAB001TU000001", owner: "OWNER-001", value: "10000000", asOf: "2026-01-01", payoff: "0", costs: "0", protectedValue: "0", ownershipBps: 10000, basis: "valuation" });
  const info = addAsset(data, { id: "info", page: 2, kind: "vehicle", vin: "KMHAB001TU000001", owner: "OWNER-001", asOf: "2024-01-01", basis: "registration information", ownershipBps: 10000 });
  const result = resolveAssetRows(data);
  assert.deepEqual(result.rows.map(row => row.id), ["valued"]); assert.deepEqual(result.duplicates, ["info"]);
  assert.equal(result.rows[0].recognition, "unreviewed"); assert.ok(result.rows[0].factIds.includes(info.factIds[0]));
  assert.equal(data.assets.length, 2); assert.equal(data.assets[0].factIds.length, valued.factIds.length);
});

test("historical ownership record is blocked and never changes recognition", () => {
  const data = fixture(); addAsset(data, { id: "old-owner", page: 1, kind: "vehicle", vin: "KMHAB001TU000001", owner: "OWNER-OLD", ownerStatus: "previous owner", value: "10000000", asOf: "2023-01-01", payoff: "0", costs: "0", protectedValue: "0", ownershipBps: 10000, basis: "historical record" });
  const result = resolveAssetRows(data);
  assert.equal(result.rows.length, 1); assert.deepEqual(result.conflictIds, ["old-owner"]); assert.ok(result.issues.some(issue => issue.startsWith("ASSET_HISTORICAL_OWNERSHIP_NOT_CURRENT")));
  assert.equal(data.assets[0].recognition, "unreviewed");
});

test("rejected or invalid ownership-status evidence cannot silently establish current ownership", () => {
  const data = fixture(); addAsset(data, { id: "status-untrusted", page: 1, kind: "vehicle", vin: "KMHAB001TU000001", owner: "OWNER-001", ownerStatus: "previous owner", value: "10000000", asOf: "2023-01-01", payoff: "0", costs: "0", protectedValue: "0", ownershipBps: 10000, basis: "registry" });
  const status = data.facts.find(fact => fact.key === "vehicle.owner_status")!; status.recognition = "rejected";
  const result = resolveAssetRows(data);
  assert.equal(result.rows.length, 1); assert.deepEqual(result.conflictIds, ["status-untrusted"]);
  assert.ok(result.issues.some(issue => issue.startsWith("ASSET_OWNERSHIP_STATUS_AMBIGUOUS")));
});

test("asset resolver lookup work grows with rows using map buckets", (t) => {
  const data = fixture(), count = 8000;
  data.assets = Array.from({ length: count }, (_, i) => ({ id: `asset-${i}`, kind: "other" as const, label: `synthetic-${i}`, factIds: [] }));
  const started = performance.now(), result = resolveAssetRows(data), elapsedMs = performance.now() - started;
  assert.equal(result.rows.length, count); assert.equal(result.metrics.rowsVisited, count); assert.ok(result.metrics.mapLookups <= count * 2);
  t.diagnostic(`synthetic asset resolution: ${count} rows, ${result.metrics.mapLookups} map lookups, ${elapsedMs.toFixed(1)} ms`);
});
