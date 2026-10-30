import { referenceMoney } from "./reference-parameters.ts";
import type { CaseData, Fact, Json, Transaction } from "./domain.ts";
import { groupTransactionEvidence, type TransactionGroup } from "./transaction-groups.ts";
import { currentFacts, factSourceLineageIssues, moneyValue, validSourceRef } from "./domain.ts";

export type TransactionCheckStatus = "pass" | "fail" | "missing" | "conflict" | "not_applicable";
export interface TransactionReviewItem {
  id: string;
  title: string;
  status: TransactionCheckStatus;
  transactionIds: string[];
  factIds: string[];
  reason: string;
  nextAction: string;
}
export interface TransferCandidate {
  id: string;
  outflowTransactionId: string;
  inflowTransactionId: string;
  fromAccountId: string;
  toAccountId: string;
  amountWon: string;
  date: string;
  factIds: string[];
  status: "missing" | "conflict";
  automaticConfirmation: false;
  candidateOnly: true;
  matchedConditions: { amount: true; date: true; distinctAccounts: true; sourceVerified: true; ownAccounts: true };
  reason: string;
}
interface Row {
  tx: Transaction;
  facts: Fact[];
  amount: bigint | null;
  date: string | null;
  ready: boolean;
  ownAccount: boolean | null;
  balance: bigint | null;
  openingBalance: bigint | null;
  sequence: number | null;
  time: string | null;
  bankReference: string | null;
  description: string;
}

function currentTransactionPolicy() {
 const thresholdWon = referenceMoney("param.policy.transaction.outflow_threshold_won");
 return {
  id: "POLICY-OUTFLOW-500K",
  title: `${BigInt(thresholdWon).toLocaleString("ko-KR")}원 이상 출금·이체 사용처 검토`,
  kind: "firm_review_policy",
  thresholdWon,
  comparison: "gte",
  currency: "KRW",
  legalThreshold: false,
  automaticAdjudication: false,
  note: "원본 업무 검토 정책입니다. 법정 한도·부인권 성립·불성실·개시 기각 기준이 아닙니다.",
  origin: { repository: "https://github.com/firmengine/firmengine", commit: "615f6d21e8a2bae978164142223ac9e86bc418f6", path: "prototypes/Daeseong Ray Yang/firmengine-proto/knowledge/bootstrap/correction_catalog.json" },
} as const;
}
const AMOUNT_KEYS = new Set(["transaction.amount", "transactions.amount", "transactions[].amount", "transaction_amount"]);

function scalar(fact: Fact): Json | null {
  if (fact.numeric) return moneyValue(fact.numeric)?.toString() ?? null;
  return fact.value;
}
function bool(value: Json | null): boolean | null {
  if (value === true || value === "yes" || value === "true") return true;
  if (value === false || value === "no" || value === "false") return false;
  return null;
}
function validDate(value: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const timestamp = Date.parse(value + "T00:00:00Z");
  return Number.isFinite(timestamp) && new Date(timestamp).toISOString().slice(0, 10) === value ? value : null;
}
function readyFact(data: CaseData, fact: Fact): boolean {
  return fact.state === "verified" && fact.recognition === "accepted" && fact.refs.length > 0 && fact.refs.every(ref => validSourceRef(data, ref));
}
function matching(facts: Fact[], keys: string[]): Fact[] { return facts.filter(f => keys.includes(f.key)); }
function oneValue(data: CaseData, facts: Fact[], keys: string[]): Json | null {
  const candidates = matching(facts, keys).filter(f => readyFact(data, f));
  const values = candidates.map(scalar).filter(v => v !== null && v !== "" && v !== "unknown");
  const unique = [...new Set(values.map(v => JSON.stringify(v)))];
  return unique.length === 1 ? values[0] : null;
}
function numericFact(data: CaseData, facts: Fact[], keys: string[]): bigint | null {
  const candidates = matching(facts, keys);
  if (!candidates.length || candidates.some(f => !readyFact(data, f) || !f.numeric || moneyValue(f.numeric) === null)) return null;
  const values = [...new Set(candidates.map(f => moneyValue(f.numeric)!.toString()))];
  return values.length === 1 ? BigInt(values[0]) : null;
}
function ownAccount(data: CaseData, facts: Fact[]): boolean | null {
  const explicit = bool(oneValue(data, facts, ["transaction.is_own_account", "transaction.account_is_own"]));
  if (explicit !== null) return explicit;
  const owner = oneValue(data, facts, ["transaction.account_owner", "transaction.account_owner_name"]);
  const name = data.context.applicant?.name;
  const identityConfirmed = bool(oneValue(data, facts, ["transaction.owner_identity_confirmed"])) === true;
  return identityConfirmed && typeof owner === "string" && name?.trim() && owner.trim() === name.trim() ? true : null;
}

/** Candidate groups derived only from transaction object fields. Missing account coverage is never inferred. */
export function groupTransactionCandidates(data: CaseData): TransactionGroup[] {
  return groupTransactionEvidence({ transactions: data.transactions.map(tx => ({
    id: tx.id, accountId: tx.accountId ?? null, counterpartyId: tx.counterparty ?? null,
    date: tx.date || null, amount: moneyValue(tx.amount)?.toString() ?? null,
    direction: tx.direction === "in" || tx.direction === "out" ? tx.direction : undefined,
    category: tx.kind,
  })), reviewThresholdWon: currentTransactionPolicy().thresholdWon });
}

/** Pure scan of every supplied row. Candidate matching never moves money or rewrites evidence. */
export function scanTransactions(data: CaseData) {
  const policy = currentTransactionPolicy();
  const items: TransactionReviewItem[] = [];
  const facts = currentFacts(data);
  const activeById = new Map(facts.map(f => [f.id, f]));
  const seenIds = new Map<string, number>();
  const add = (id: string, title: string, status: TransactionCheckStatus, txs: Transaction[], linked: Fact[], reason: string, nextAction: string) => {
    items.push({ id, title, status, transactionIds: txs.map(t => t.id), factIds: [...new Set(linked.map(f => f.id))], reason, nextAction });
  };
  for (const tx of data.transactions) seenIds.set(tx.id, (seenIds.get(tx.id) ?? 0) + 1);
  const rows: Row[] = data.transactions.map((tx, index) => {
    const linked = tx.factIds.flatMap(id => activeById.has(id) ? [activeById.get(id)!] : []);
    const related = linked.filter(f => f.subjectId === tx.id);
    const sourceIssues = factSourceLineageIssues(data, tx.factIds);
    if (related.length !== linked.length) sourceIssues.push("WRONG_TRANSACTION_SUBJECT");
    const amount = moneyValue(tx.amount);
    const date = validDate(tx.date);
    let ready = sourceIssues.length === 0 && amount !== null && amount >= 0n && date !== null && ["in", "out"].includes(tx.direction);
    if ((seenIds.get(tx.id) ?? 0) > 1) {
      ready = false;
      add(`duplicate-id:${tx.id}:${index}`, "거래 ID 중복", "conflict", [tx], related, "같은 거래 ID가 여러 행에 존재하여 합산을 보류합니다.", "행 식별자와 원문 거래번호를 대조하여 중복·수정 관계를 정리하세요.");
    }
    if (sourceIssues.length) add(`source:${tx.id}:${index}`, "거래 원문·검토 연결", sourceIssues.some(x => /DISPUTED/.test(x)) ? "conflict" : "missing", [tx], related, `출처·검토 상태 확인 필요: ${[...new Set(sourceIssues)].join(", ")}`, "삭제·철회·과거 버전·다른 거래의 사실을 제거하고 현재 원문과 연결하세요.");
    if (!date) add(`date:${tx.id}:${index}`, "거래일 확인", "missing", [tx], related, "유효한 YYYY-MM-DD 거래일이 없습니다.", "원문의 거래일을 확인하세요. 발급일·잔액기준일과 구별하세요.");
    if (!["in", "out"].includes(tx.direction)) add(`direction:${tx.id}:${index}`, "입출금 방향 확인", "missing", [tx], related, "입금·출금 방향이 확인되지 않았습니다.", "원문의 입금·출금 열과 거래 종류를 확인하세요.");
    if (amount === null || amount < 0n) add(`amount:${tx.id}:${index}`, "거래금액·단위 확인", amount !== null && amount < 0n ? "fail" : "missing", [tx], related, "0 이상 정수 원화 금액의 원문·단위 정규화가 필요합니다.", "금액 단위·통화·방향을 대조하세요. 빈칸은 0원으로 바꾸지 마세요.");
    const amountFacts = related.filter(f => AMOUNT_KEYS.has(f.key));
    const amountValues = amountFacts.filter(f => readyFact(data, f)).map(f => f.numeric ? moneyValue(f.numeric)?.toString() ?? null : null);
    const distinct = [...new Set(amountValues.filter(v => v !== null))];
    if (!amountFacts.length || amountValues.includes(null) || amountValues.length !== amountFacts.length) {
      ready = false;
      add(`amount-evidence:${tx.id}:${index}`, "금액 피처의 원문 연결", "missing", [tx], related, "거래금액에 직접 대응하는 검증·정규화된 사실이 필요합니다.", "transaction.amount 사실에 원문 위치·단위·인정 상태를 연결하세요.");
    } else if (distinct.length > 1 || amount !== null && distinct[0] !== amount.toString()) {
      ready = false;
      add(`amount-conflict:${tx.id}:${index}`, "거래금액 상충", "conflict", [tx], related, "거래 객체와 현재 금액 사실 또는 복수 사실의 값이 다릅니다.", "채택할 최신 원문을 확인하고 객체와 연결 사실을 함께 수정하세요.");
    }
    for (const [key, objectValue, label] of [["transaction.date", tx.date, "거래일"], ["transaction.direction", tx.direction, "방향"], ["transaction.account_id", tx.accountId, "계좌"]] as const) {
      const candidates = matching(related, [key]).filter(f => readyFact(data, f));
      const values = [...new Set(candidates.map(f => {
        const original=String(f.value),date=original.slice(0,10);
        return key==="transaction.date"&&validDate(date)&&/^\d{4}-\d{2}-\d{2}(?:$|[T\s])/.test(original)?date:original;
      }))];
      if (values.length > 1 || values.length === 1 && objectValue && values[0] !== objectValue) {
        ready = false;
        add(`field-conflict:${key}:${tx.id}:${index}`, `${label} 상충`, "conflict", [tx], candidates, "객체 값과 현재 원문 사실이 맞지 않습니다.", `${label}의 대상·열·원문을 대조하세요.`);
      }
    }
    const description = related.filter(f => ["transaction.memo", "transaction.description", "transaction.counterparty"].includes(f.key) && f.refs.some(ref => validSourceRef(data, ref))).map(f => String(f.value ?? "")).join(" ");
    const sequenceValue = oneValue(data, related, ["transaction.sequence", "transaction.statement_sequence"]);
    const timeValue = oneValue(data, related, ["transaction.time"]);
    const referenceValue = oneValue(data, related, ["transaction.bank_reference", "transaction.bank_transaction_id"]);
    const validTime = typeof timeValue === "string" && /^\d{2}:\d{2}(:\d{2})?$/.test(timeValue) && timeValue.split(":").every((part, i) => Number(part) >= 0 && Number(part) < (i === 0 ? 24 : 60)) ? timeValue : null;
    const row: Row = { tx, facts: related, amount, date, ready, ownAccount: ownAccount(data, related), balance: numericFact(data, related, ["transaction.balance", "transaction.balance_after"]), openingBalance: numericFact(data, related, ["transaction.balance_before", "transaction.opening_balance"]), sequence: /^\d+$/.test(String(sequenceValue)) && Number.isSafeInteger(Number(sequenceValue)) ? Number(sequenceValue) : null, time: validTime, bankReference: typeof referenceValue === "string" ? referenceValue : null, description };
    const closingFacts = matching(related, ["transaction.balance", "transaction.balance_after"]);
    if (closingFacts.length && row.balance === null) add(`balance-evidence:${tx.id}:${index}`, "거래 후 잔액의 단위·상충 확인", "missing", [tx], closingFacts, "잔액 값은 있으나 같은 기준의 검증된 정수 원화 값으로 확정되지 않았습니다.", "잔액 열·통화·복수 값과 원문을 대조한 후 잔액 검산을 실행하세요.");
    if (tx.direction === "out" && amount !== null && amount >= BigInt(policy.thresholdWon)) {
      const purpose = oneValue(data, related, ["transaction.use_of_funds", "transaction.purpose_evidence"]);
      const purposeReviewed = bool(oneValue(data, related, ["transaction.purpose_reviewed", "transaction.use_of_funds_reviewed"])) === true;
      add(`policy-outflow:${tx.id}:${index}`, policy.title, ready && purpose !== null && purposeReviewed ? "pass" : "missing", [tx], related, ready && purpose !== null && purposeReviewed ? "업무 정책상 사용처 근거와 검토가 기록되었습니다. 법적 성질의 판단과는 별개입니다." : "업무 정책 금액에 해당하는 출금 후보입니다. 적요만으로 사용처를 확정하지 않습니다.", "상대방·계약·영수증·상환대상과 실제 사용처를 연결하고 검토 결과를 기록하세요.");
    }
    const clues: { id: string; pattern: RegExp; title: string; action: string }[] = [
      { id: "loan", pattern: /대출|차입|카드론|현금서비스|loan/i, title: "대출·차입 관련 적요 단서", action: "대출계약·채권목록·대환과 자금 사용처를 대조하세요." },
      { id: "disposal", pattern: /매각|매매대금|해약환급|보증금.?반환|차량.?매도/, title: "처분·환급대금 관련 적요 단서", action: "처분계약과 기존 자산·대체현금·담보상환을 연결하세요." },
      { id: "cash", pattern: /현금|ATM|CD기|cash/i, title: "현금 인출·입금 관련 단서", action: "현금 보유·사용처와 이후 입금·자산취득을 확인하세요." },
      { id: "investment", pattern: /가상자산|가상화폐|비트코인|코인|거래소|증권|펀드|crypto|bitcoin/i, title: "투자·가상자산 관련 적요 단서", action: "거래소·증권 잔고와 보유·손실·외부이전 경로를 확인하세요." },
    ];
    for (const clue of clues) if (clue.pattern.test(description)) add(`clue-${clue.id}:${tx.id}:${index}`, clue.title, "missing", [tx], related, "문구 기반 조사 단서입니다. 거래 성질·불성실·은닉 또는 법적 효과를 확정하지 않습니다.", clue.action);
    return row;
  });

  // A repeated bank reference is stronger evidence of possible duplication than amount/date alone.
  const bankRefs = new Map<string, Row[]>();
  for (const row of rows) if (row.bankReference && row.tx.accountId) {
    const key = `${row.tx.accountId}|${row.bankReference}`;
    bankRefs.set(key, [...(bankRefs.get(key) ?? []), row]);
  }
  for (const group of bankRefs.values()) if (group.length > 1) {
    group.forEach(row => { row.ready = false; });
    add(`bank-reference:${group[0].tx.id}`, "동일 은행 거래번호의 중복 후보", "conflict", group.map(r => r.tx), group.flatMap(r => r.facts), "같은 계좌·은행 거래번호가 여러 행에 있어 합산을 보류합니다.", "원문 중복·수정·분할 행인지 확인하세요. 날짜·금액만 같은 거래는 임의 중복삭제하지 않습니다.");
  }

  const transferCandidates: TransferCandidate[] = [];
  const outflows = rows.filter(r => r.ready && r.tx.direction === "out" && r.amount !== null && r.amount > 0n);
  const inflowIndex = new Map<string, Row[]>();
  for (const row of rows) if (row.ready && row.tx.direction === "in" && row.amount !== null && row.amount > 0n) {
    const key = `${row.date}|${row.amount}`;
    inflowIndex.set(key, [...(inflowIndex.get(key) ?? []), row]);
  }
  for (const out of outflows) for (const incoming of inflowIndex.get(`${out.date}|${out.amount}`) ?? []) {
    if (!out.tx.accountId || !incoming.tx.accountId || out.tx.accountId === incoming.tx.accountId) continue;
    if (out.ownAccount !== true || incoming.ownAccount !== true) {
      add(`transfer-ownership:${out.tx.id}:${incoming.tx.id}`, "동액·동일일자 이체의 계좌 귀속", "missing", [out.tx, incoming.tx], [...out.facts, ...incoming.facts], "금액·일자는 맞지만 양쪽 계좌의 본인 소유가 확인되지 않았습니다.", "양쪽 계좌명의·전체 식별자와 상대계좌 내역을 확인한 후 후보를 검토하세요.");
      continue;
    }
    transferCandidates.push({ id: `transfer:${out.tx.id}:${incoming.tx.id}`, outflowTransactionId: out.tx.id, inflowTransactionId: incoming.tx.id, fromAccountId: out.tx.accountId, toAccountId: incoming.tx.accountId, amountWon: out.amount!.toString(), date: out.date!, factIds: [...new Set([...out.facts, ...incoming.facts].map(f => f.id))], status: "missing", automaticConfirmation: false, candidateOnly: true, matchedConditions: { amount: true, date: true, distinctAccounts: true, sourceVerified: true, ownAccounts: true }, reason: "본인 명의 양계좌·동일 금액·동일 거래일·원문 근거가 맞는 후보입니다. 실제 대응 이체 여부는 별도 확인합니다." });
  }
  for (const candidate of transferCandidates) {
    const ambiguous = transferCandidates.some(other => other.id !== candidate.id && (other.outflowTransactionId === candidate.outflowTransactionId || other.inflowTransactionId === candidate.inflowTransactionId));
    if (ambiguous) { candidate.status = "conflict"; candidate.reason = "동일 거래에 여러 대응 후보가 있습니다. 시간·상대계좌·은행 거래참조를 대조해야 합니다."; }
    const transactions = [candidate.outflowTransactionId, candidate.inflowTransactionId].flatMap(id => data.transactions.filter(t => t.id === id));
    add(candidate.id, "본인계좌 이체 후보", candidate.status, transactions, candidate.factIds.flatMap(id => activeById.has(id) ? [activeById.get(id)!] : []), candidate.reason, "대응 이체를 명시적으로 확인하기 전 소득·지출 합계에서 자동 제외하지 마세요.");
  }

  // Check recorded balances; a mismatch may mean missing rows, wrong ordering, or a reading error.
  const accounts = new Map<string, Row[]>();
  for (const row of rows) {
    if (row.tx.accountId) accounts.set(row.tx.accountId, [...(accounts.get(row.tx.accountId) ?? []), row]);
    if (row.ready && row.openingBalance !== null && row.balance !== null && row.amount !== null) {
      const expected = row.openingBalance + (row.tx.direction === "in" ? row.amount : -row.amount);
      add(`balance-row:${row.tx.id}`, "거래 전·후 잔액 검산", expected === row.balance ? "pass" : "conflict", [row.tx], row.facts, `기재된 전 잔액 ${row.openingBalance}원 + 순입출금 ${row.tx.direction === "in" ? row.amount : -row.amount}원 = ${expected}원; 후 잔액 ${row.balance}원.`, "차액이 있으면 입출금 열·누락행·잔액 시점을 확인하세요. 잔액 일치는 전체 거래 완전성의 증명이 아닙니다.");
    }
  }
  for (const group of accounts.values()) {
    const ordered = [...group].sort((a, b) => (a.date ?? "").localeCompare(b.date ?? "") || (a.sequence ?? Number.MAX_SAFE_INTEGER) - (b.sequence ?? Number.MAX_SAFE_INTEGER) || (a.time ?? "").localeCompare(b.time ?? ""));
    for (let i = 1; i < ordered.length; i++) {
      const prev = ordered[i - 1], next = ordered[i];
      if (!prev.ready || !next.ready || prev.balance === null || next.balance === null || next.amount === null) continue;
      const sameDay = prev.date === next.date;
      const sequenceKnown = prev.sequence !== null && next.sequence !== null && next.sequence === prev.sequence + 1;
      const timeKnown = prev.time !== null && next.time !== null && prev.time < next.time;
      if (sameDay && !sequenceKnown && !timeKnown) {
        add(`balance-order:${prev.tx.id}:${next.tx.id}`, "동일일자 거래 순서 확인", "missing", [prev.tx, next.tx], [...prev.facts, ...next.facts], "잔액은 있으나 동일 일자 거래의 순서가 확인되지 않았습니다.", "명세서 행 순번이나 거래시각을 확보한 후 연속식을 검산하세요.");
        continue;
      }
      const expected = prev.balance + (next.tx.direction === "in" ? next.amount : -next.amount);
      add(`balance-chain:${prev.tx.id}:${next.tx.id}`, "기재된 인접 거래 잔액 연속식", expected === next.balance ? "pass" : "conflict", [prev.tx, next.tx], [...prev.facts, ...next.facts], `이전 기재잔액 ${prev.balance}원 + 다음 순입출금 ${next.tx.direction === "in" ? next.amount : -next.amount}원 = ${expected}원; 다음 기재잔액 ${next.balance}원. 누락 거래·순서·수수료를 함께 확인해야 합니다.`, "원문 전후 행과 조회기간 전체를 대조하세요. 차액을 임의 조정 거래로 생성하지 마세요.");
    }
  }
  const coverageFacts = facts.filter(f => ["transactions.coverage_complete", "transaction.coverage_complete", "coverage.transactions_complete"].includes(f.key));
  const coverageValue = oneValue(data, coverageFacts, coverageFacts.map(f => f.key));
  const coverageState = bool(coverageValue) === true ? "complete" : bool(coverageValue) === false ? "incomplete" : "unknown";
  if (!rows.length) add("transactions-empty", "거래내역 조사범위 확인", "missing", [], [], "거래 행이 없습니다. 거래가 없다는 뜻으로 해석하지 않습니다.", "계좌목록·조회기간·거래내역과 제출 제외 사유를 확인하세요.");
  if (coverageState !== "complete") add("transactions-coverage", "계좌·조회기간의 완전성", "missing", [], coverageFacts, "제공된 행만 검사했습니다. 전체 계좌·기간·누락 페이지의 확인이 남아 있습니다.", "전체 계좌와 대상기간이 포함됐는지 원문 및 진술을 대조하고 조사범위를 기록하세요.");
  const allRowsUsable = rows.length > 0 && rows.every(r => r.ready);
  let inflow: bigint | null = null, outflow: bigint | null = null;
  if (allRowsUsable) {
    inflow = 0n; outflow = 0n;
    for (const row of rows) if (row.tx.direction === "in") inflow += row.amount!; else outflow += row.amount!;
  }
  const dates = rows.flatMap(r => r.date ? [r.date] : []).sort();
  return {
    policy: { ...policy },
    coverage: { state: coverageState, transactionCount: rows.length, inspectedCount: rows.length, usableAmountAndSourceCount: rows.filter(r => r.ready).length, unresolvedRowCount: rows.filter(r => !r.ready).length, accountIds: [...accounts.keys()], firstObservedDate: dates[0] ?? null, lastObservedDate: dates.at(-1) ?? null, completePeriodProven: coverageState === "complete", note: "행 검사 완료와 계좌·기간 전체 수집 완료는 별개입니다." },
    items,
    totals: { scope: "supplied_rows_only", inputComplete: allRowsUsable, inflowWon: inflow?.toString() ?? null, outflowWon: outflow?.toString() ?? null, netFlowWon: inflow !== null && outflow !== null ? (inflow - outflow).toString() : null, transfersExcluded: false, note: allRowsUsable ? "제공된 검증 가능 행의 입출금 합계입니다. 수입·비용·가용소득으로 분류한 금액이 아닙니다." : "누락·미확인·상충·철회가 있어 합계를 보류했습니다. 0원으로 대체하지 않았습니다." },
    transferCandidates,
    evidenceGroups: groupTransactionCandidates(data),
  };
}
