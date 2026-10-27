import { currentFacts, moneyValue, validSourceRef, type CaseData, type CaseReadIndex, type Debt, type Fact } from "./domain.ts";

/** A complete source identifier; masked suffixes and display names never identify a contract. */
function identity(value: unknown, requireDigit = false): string | null {
  if (typeof value !== "string") return null;
  const raw = value.normalize("NFKC").trim().toUpperCase();
  if (!raw || /[*×•●○◦…_?]/u.test(raw) || /X{2,}/.test(raw) || /MASK|REDACT|UNKNOWN|미상|마스킹/.test(raw)) return null;
  const result = raw.replace(/[\s().\-‐‑‒–—/]/gu, "");
  return result.length >= 4 && (!requireDigit || /\d/.test(result)) ? result : null;
}

function sourceIdentity(data: CaseData, debt: Debt, facts: Fact[], keys: string[], requireDigit = false,index?:CaseReadIndex): string | null {
  const candidates = facts.filter(f => debt.factIds.includes(f.id) && keys.includes(f.key.replace(/([a-z0-9])([A-Z])/g,"$1_$2").toLowerCase()));
  if (!candidates.length || candidates.some(f => f.state === "disputed" || f.recognition === "rejected" || f.validation.some(v => v.severity === "error" || v.code === "UNCERTAIN_READING") || !f.refs.length || f.refs.some(r => !validSourceRef(data, r,index)))) return null;
  const values = candidates.map(f => identity(f.value, requireDigit));
  if (values.some(v => v === null) || new Set(values).size !== 1) return null;
  const value = values[0]!;
  return candidates.every(f => f.refs.some(r => r.quote.normalize("NFKC").toUpperCase().replace(/[\s().\-‐‑‒–—/]/gu, "").includes(value))) ? value : null;
}

function completeContractKey(data: CaseData, debt: Debt, facts: Fact[],index?:CaseReadIndex): string | null {
  const issuer = sourceIdentity(data, debt, facts, ["debt.creditor_identity_id", "debt.creditor_registration_number", "debt.issuer_identity_id"], true,index);
  const contract = sourceIdentity(data, debt, facts, ["debt.contract_id", "debt.account_number"],false,index);
  if (!issuer || !contract || contract !== identity(debt.contractId)) return null;
  return JSON.stringify([issuer, contract]);
}

/**
 * Deduplicate only the same referenced observation, or a complete issuer-scoped
 * contract. Keep ambiguous rows and prevent their aggregate from becoming final.
 */
export function resolveDebtRows(data: CaseData,index?:CaseReadIndex): { rows: Debt[]; sourceGroups: Debt[][]; duplicates: string[]; issues: string[] } {
  const facts = currentFacts(data,index), active = new Set(facts.map(f => f.id));
  const groups = new Map<string, Debt[]>(), strong = new Map<string, string | null>();
  for (const debt of data.debts) {
    const scoped = completeContractKey(data, debt, facts,index); strong.set(debt.id, scoped);
    const ids = [...new Set(debt.factIds)].sort();
    // A shared quote on the same page is not necessarily the same row. Use exact fact versions.
    const observation = ids.length && ids.every(id => active.has(id)) ? JSON.stringify([debt.contractId ?? null, ids]) : null;
    const key = scoped ? "contract:" + scoped : observation ? "observation:" + observation : "id:" + debt.id;
    groups.set(key, [...(groups.get(key) ?? []), debt]);
  }
  const rows: Debt[] = [], sourceGroups: Debt[][] = [], duplicates: string[] = [], issues: string[] = [];
  const amount = (value: Debt["principal"]) => moneyValue(value)?.toString() ?? null;
  const fingerprint = (d: Debt) => JSON.stringify([d.contractId, d.creditor, amount(d.principal), amount(d.interest), d.asOf, d.dueDate, d.secured, d.classification, d.priority, d.legalReview, d.excludedByReview, d.exclusionReason, d.guaranteeDetails]);
  for (const group of groups.values()) {
    const first = group[0];
    if (group.some(d => fingerprint(d) !== fingerprint(first))) {
      issues.push("DEBT_CONTRACT_CONFLICT:" + (first.contractId ?? first.id)); rows.push(...group); sourceGroups.push(...group.map(debt=>[debt]));
    } else {
      rows.push({ ...first, factIds: [...new Set(group.flatMap(d => d.factIds))] });
      sourceGroups.push(group);
      duplicates.push(...group.slice(1).map(d => d.id));
    }
  }
  const byContract = new Map<string, Debt[]>(), byName = new Map<string, Debt[]>();
  for (const row of rows) {
    const contract = row.contractId?.normalize("NFKC").trim().toUpperCase();
    if (contract) byContract.set(contract, [...(byContract.get(contract) ?? []), row]);
    const name = row.creditor.normalize("NFKC").replace(/\s+/g, "").toLowerCase();
    if (name) byName.set(name, [...(byName.get(name) ?? []), row]);
  }
  for (const group of byContract.values()) if (group.length > 1 && group.some(d => !strong.get(d.id))) issues.push("DEBT_IDENTITY_AMBIGUOUS:" + group.map(d => d.id).join(","));
  for (const group of byName.values()) if (group.length > 1 && group.some(d => !identity(d.contractId))) issues.push("DEBT_IDENTITY_AMBIGUOUS:" + group.map(d => d.id).join(","));
  return { rows, sourceGroups, duplicates, issues: [...new Set(issues)] };
}
