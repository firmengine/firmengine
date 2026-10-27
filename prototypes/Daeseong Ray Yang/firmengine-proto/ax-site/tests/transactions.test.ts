import test from "node:test";
import assert from "node:assert/strict";
import type { CaseData, Fact, Json, Transaction } from "../lib/domain.ts";
import { createCase, normalizeMoney } from "../lib/domain.ts";
import { scanTransactions } from "../lib/transaction-review.ts";

function fixture(): CaseData {
  const data = createCase("합성 거래검증", "00000000-0000-4000-8000-000000000001", "2026-10-27");
  data.context.applicant = { name: "합성신청인" };
  data.documents = [{ id: "doc", name: "synthetic.pdf", sha256: "synthetic", status: "active", pages: [1] }];
  data.pages = [{ documentId: "doc", page: 1, role: "evidence", text: "Synthetic evidence only" }];
  return data;
}
function addFact(data: CaseData, subjectId: string, key: string, value: Json, numeric = false): Fact {
  const id = `fact-${data.facts.length}`;
  const fact: Fact = { id, logicalId: id, version: 1, subjectId, key, value, state: "verified", recognition: "accepted", refs: [{ documentId: "doc", page: 1, quote: "Synthetic evidence", sourceHash: "synthetic" }], validation: [], ...(numeric ? { numeric: normalizeMoney(String(value)) } : {}) };
  data.facts.push(fact); return fact;
}
function row(data: CaseData, id: string, amount: string, direction: "in" | "out" = "out", accountId = "account-A", date = "2026-10-01"): Transaction {
  const tx: Transaction = { id, date, accountId, direction, kind: "unknown", amount: normalizeMoney(amount), factIds: [] };
  for (const [key, value, numeric] of [["transaction.amount", amount, true], ["transaction.date", date, false], ["transaction.direction", direction, false], ["transaction.account_id", accountId, false]] as const) tx.factIds.push(addFact(data, id, key, value, numeric).id);
  data.transactions.push(tx); return tx;
}
function append(data: CaseData, tx: Transaction, key: string, value: Json, numeric = false) { tx.factIds.push(addFact(data, tx.id, key, value, numeric).id); }

test("전체 거래를 순회하며 50만원 경계는 업무정책으로만 표시한다", () => {
  const data = fixture(); row(data, "below", "499999"); row(data, "boundary", "500000"); row(data, "above", "500001");
  const result = scanTransactions(data);
  assert.equal(result.coverage.inspectedCount, 3);
  assert.equal(result.items.filter(x => x.id.startsWith("policy-outflow:")).length, 2);
  assert.equal(result.policy.legalThreshold, false);
  assert.equal(result.policy.automaticAdjudication, false);
  assert.equal(result.totals.outflowWon, "1500000");
});
test("빈 거래목록과 금액 누락은 0원이나 비해당으로 바뀌지 않는다", () => {
  const blank = scanTransactions(fixture()); assert.equal(blank.totals.inflowWon, null); assert.equal(blank.coverage.state, "unknown");
  const data = fixture(); row(data, "a", "500000"); const missing = row(data, "b", "100"); missing.amount = normalizeMoney(null);
  const result = scanTransactions(data); assert.equal(result.totals.outflowWon, null); assert.equal(result.totals.netFlowWon, null);
});
test("명시적 사용처 검토가 없으면 적요만으로 출금 항목을 해소하지 않는다", () => {
  const data = fixture(); const tx = row(data, "a", "500000"); append(data, tx, "transaction.memo", "카드대금");
  assert.equal(scanTransactions(data).items.find(x => x.id.startsWith("policy-outflow:"))?.status, "missing");
  append(data, tx, "transaction.use_of_funds", "검증된 계약대금 지급"); append(data, tx, "transaction.purpose_reviewed", true);
  assert.equal(scanTransactions(data).items.find(x => x.id.startsWith("policy-outflow:"))?.status, "pass");
});
test("본인 양계좌·금액·날짜·근거 일치 시 후보만 만들고 자동 상계하지 않는다", () => {
  const data = fixture(); const out = row(data, "out", "700000", "out", "own-A"), incoming = row(data, "in", "700000", "in", "own-B");
  append(data, out, "transaction.is_own_account", true); append(data, incoming, "transaction.is_own_account", true);
  const result = scanTransactions(data); assert.equal(result.transferCandidates.length, 1); assert.equal(result.transferCandidates[0].automaticConfirmation, false);
  assert.equal(result.totals.transfersExcluded, false); assert.equal(result.totals.outflowWon, "700000"); assert.equal(result.totals.inflowWon, "700000");
});
test("계좌 귀속이 없거나 금액·날짜·동일계좌 조건이 다르면 후보를 확정하지 않는다", () => {
  const data = fixture(); row(data, "out", "700000", "out", "A"); row(data, "in", "700000", "in", "B");
  assert.equal(scanTransactions(data).transferCandidates.length, 0);
  assert.ok(scanTransactions(data).items.some(x => x.id.startsWith("transfer-ownership:")));
  for (const variant of [{ amount: "700001", date: "2026-10-01", account: "B" }, { amount: "700000", date: "2026-10-02", account: "B" }, { amount: "700000", date: "2026-10-01", account: "A" }]) {
    const other = fixture(); const out = row(other, "out", "700000", "out", "A"), incoming = row(other, "in", variant.amount, "in", variant.account, variant.date);
    append(other, out, "transaction.is_own_account", true); append(other, incoming, "transaction.is_own_account", true);
    assert.equal(scanTransactions(other).transferCandidates.length, 0);
  }
});
test("복수의 대응 이체 후보는 상충 상태로 남는다", () => {
  const data = fixture(); for (const tx of [row(data, "out", "1000", "out", "A"), row(data, "in1", "1000", "in", "B"), row(data, "in2", "1000", "in", "C")]) append(data, tx, "transaction.is_own_account", true);
  const result = scanTransactions(data); assert.equal(result.transferCandidates.length, 2); assert.ok(result.transferCandidates.every(x => x.status === "conflict"));
});
test("전후 잔액이 존재하는 행의 연속식을 정확하게 검산한다", () => {
  const data = fixture(); const tx = row(data, "a", "200", "out"); append(data, tx, "transaction.balance_before", "1000", true); append(data, tx, "transaction.balance", "800", true);
  assert.equal(scanTransactions(data).items.find(x => x.id.startsWith("balance-row:"))?.status, "pass");
  const balance = data.facts.find(f => f.key === "transaction.balance")!; balance.numeric = normalizeMoney("799"); balance.value = "799";
  assert.equal(scanTransactions(data).items.find(x => x.id.startsWith("balance-row:"))?.status, "conflict");
});
test("같은 날 순서가 없는 잔액은 임의 정렬하여 오류로 확정하지 않는다", () => {
  const data = fixture(); for (const tx of [row(data, "a", "200"), row(data, "b", "300")]) append(data, tx, "transaction.balance", "800", true);
  const result = scanTransactions(data); assert.ok(result.items.some(x => x.id.startsWith("balance-order:") && x.status === "missing"));
  assert.ok(!result.items.some(x => x.id.startsWith("balance-chain:")));
});
test("적요의 대출·처분·현금·가상자산은 단서이며 자동 분류가 아니다", () => {
  const data = fixture(); const tx = row(data, "a", "500000"); append(data, tx, "transaction.memo", "대출 매각 현금 가상자산");
  const result = scanTransactions(data); assert.equal(result.items.filter(x => x.id.startsWith("clue-")).length, 4);
  assert.ok(result.items.filter(x => x.id.startsWith("clue-")).every(x => x.status === "missing")); assert.equal(data.transactions[0].kind, "unknown");
});
test("철회 원문·상충 금액·미확인 방향은 합계를 보류한다", () => {
  const data = fixture(); const tx = row(data, "a", "1000"); data.documents[0].status = "deleted";
  assert.equal(scanTransactions(data).totals.outflowWon, null);
  data.documents[0].status = "active"; append(data, tx, "transaction.amount", "2000", true);
  assert.ok(scanTransactions(data).items.some(x => x.id.startsWith("amount-conflict:")));
  tx.direction = "unknown"; assert.equal(scanTransactions(data).totals.netFlowWon, null);
});
test("다른 거래의 금액 사실과 부정확한 원화 정규화를 신뢰하지 않는다", () => {
  const data = fixture(); const a = row(data, "a", "1000"), b = row(data, "b", "1000"); b.factIds = [...a.factIds];
  assert.equal(scanTransactions(data).totals.inflowWon, null);
  a.amount = { ...normalizeMoney("1000"), amountWon: "999999" }; assert.equal(scanTransactions(data).totals.outflowWon, null);
});
test("중복 은행 거래번호와 거래 ID는 중복 합산을 차단한다", () => {
  const data = fixture(); const a = row(data, "a", "1000"), b = row(data, "b", "1000");
  append(data, a, "transaction.bank_reference", "same-bank-ref"); append(data, b, "transaction.bank_reference", "same-bank-ref");
  assert.equal(scanTransactions(data).totals.outflowWon, null);
  assert.ok(scanTransactions(data).items.some(x => x.id.startsWith("bank-reference:")));
  const duplicate = fixture(); const tx = row(duplicate, "same", "1000"); duplicate.transactions.push({ ...tx });
  assert.ok(scanTransactions(duplicate).items.some(x => x.id.startsWith("duplicate-id:"))); assert.equal(scanTransactions(duplicate).totals.outflowWon, null);
});
test("예금주 이름 일치만으로 본인계좌라고 확정하지 않는다", () => {
  const data = fixture(); const out = row(data, "out", "1000", "out", "A"), incoming = row(data, "in", "1000", "in", "B");
  for (const tx of [out, incoming]) append(data, tx, "transaction.account_owner", "합성신청인");
  assert.equal(scanTransactions(data).transferCandidates.length, 0);
});
test("함수는 사건과 사실 원장을 수정하지 않는다", () => {
  const data = fixture(); row(data, "a", "9007199254740993"); const before = JSON.stringify(data);
  assert.equal(scanTransactions(data).totals.outflowWon, "9007199254740993"); assert.equal(JSON.stringify(data), before);
});
