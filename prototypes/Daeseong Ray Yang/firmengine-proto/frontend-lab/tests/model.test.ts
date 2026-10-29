import test from "node:test";
import assert from "node:assert/strict";
import { calculateDemo, createInitialState, createScenarioCase, deriveReadiness, labReducer, requirementsFor } from "../src/model.ts";
import { createFinancialDemo, deriveFinancialDemo } from "../src/model.ts";

type State = ReturnType<typeof createInitialState>;
type Scenario = Parameters<typeof createScenarioCase>[0];
type Action = Parameters<typeof labReducer>[1];
type CaseAction<T> = T extends { caseId: string } ? Omit<T, "caseId"> : never;
const active = (state: State) => state.cases.find(item => item.id === state.activeCaseId)!;
const act = (state: State, action: CaseAction<Action>) => labReducer(state, { ...action, caseId: state.activeCaseId } as Action);
function fixture(scenario: Scenario = "normal"): State {
  const item = createScenarioCase(scenario, "model-test-case");
  return { ...createInitialState(), role: "staff", activeCaseId: item.id, cases: [item] };
}
function confirmAvailable(state: State): State {
  for (const document of active(state).documents.filter(item => item.status !== "withdrawn")) {
    state = act(state, { type: "CONFIRM_DOCUMENT", documentId: document.id });
  }
  for (const field of active(state).fields.filter(item => item.status === "candidate")) {
    state = act(state, { type: "CONFIRM_FIELD", key: field.key, reason: "합성 원문과 출처 대조" });
  }
  return state;
}
function draft(): State {
  const state = confirmAvailable(fixture());
  assert.equal(deriveReadiness(active(state)).canGenerate, true);
  return act(state, { type: "GENERATE_DRAFT" });
}
function snapshot(state: State) {
  const result = active(state).generated.find(item => !item.invalidated && item.revision === active(state).revision);
  assert.ok(result);
  return result;
}
function assertDeepFrozen(value: unknown): void {
  if (!value || typeof value !== "object") return;
  assert.equal(Object.isFrozen(value), true);
  for (const child of Object.values(value)) assertDeepFrozen(child);
}

test("initial cases expose distinct missing and conflicting evidence before any approval", () => {
  const initial = createInitialState();
  assert.equal(initial.role, "staff");
  assert.equal(initial.cases.length, 3);
  assert.equal(active(initial).scenario, "conflict");
  assert.equal(deriveReadiness(createScenarioCase("normal")).canGenerate, false);
  const missing = createScenarioCase("missing");
  assert.equal(missing.fields.find(field => field.key === "income")!.value, null);
  assert.ok(deriveReadiness(missing).missingDocuments.length > 0);
  assert.equal(calculateDemo(missing), null);
  const conflict = createScenarioCase("conflict").fields.find(field => field.key === "debt")!;
  assert.equal(conflict.status, "conflict");
  assert.ok(conflict.alternatives && conflict.alternatives.length > 1);
});

test("clients can submit material but cannot approve or overwrite canonical evidence", () => {
  let state = labReducer(fixture(), { type: "SET_ROLE", role: "client" });
  const caseId = active(state).id, before = structuredClone(active(state));
  const documentId = before.documents[0].id;
  for (const action of [
    { type: "CONFIRM_DOCUMENT", documentId },
    { type: "CONFIRM_FIELD", key: "income", reason: "직접 승인 시도" },
    { type: "EDIT_FIELD", key: "income", value: 999, reason: "직접 변경 시도" },
    { type: "WITHDRAW_FIELD", key: "income", reason: "직접 철회 시도" },
    { type: "WITHDRAW_DOCUMENT", documentId },
    { type: "GENERATE_DRAFT" },
  ] as const) state = labReducer(state, { ...action, caseId });
  assert.deepEqual(active(state), before);
  state = act(state, { type: "UPDATE_CONSULTATION", text: "추가 합성 상담 자료" });
  assert.equal(active(state).consultation, "추가 합성 상담 자료");
  state = act(state, { type: "ADD_DOCUMENT", name: "합성 추가 소득.pdf", kind: "income", pages: 2 });
  assert.equal(active(state).documents.length, before.documents.length + 1);
  assert.equal(active(state).documents.find(document => document.name === "합성 추가 소득.pdf")!.status, "uploaded");
  state = act(state, { type: "RUN_DEMO_EXTRACTION" });
  assert.ok(active(state).fields.every(field => field.status !== "confirmed"));
});

test("a draft requires both source documents and candidate fields to be confirmed", () => {
  let state = fixture();
  assert.equal(calculateDemo(active(state)), null);
  state = act(state, { type: "GENERATE_DRAFT" });
  assert.equal(active(state).generated.length, 0);
  for (const document of active(state).documents) state = act(state, { type: "CONFIRM_DOCUMENT", documentId: document.id });
  assert.equal(deriveReadiness(active(state)).canGenerate, false);
  state = confirmAvailable(state);
  assert.equal(deriveReadiness(active(state)).canGenerate, true);
  const revision = active(state).revision;
  state = act(state, { type: "GENERATE_DRAFT" });
  assert.equal(snapshot(state).revision, revision);
  assert.equal(active(state).revision, revision);
});

test("conflicting debt needs an explained selection before confirmation", () => {
  let state = confirmAvailable(fixture("conflict"));
  state = act(state, { type: "CONFIRM_FIELD", key: "debt", reason: "불일치 값 그대로 확인" });
  assert.equal(active(state).fields.find(field => field.key === "debt")!.status, "conflict");
  assert.equal(deriveReadiness(active(state)).canGenerate, false);
  state = act(state, { type: "EDIT_FIELD", key: "debt", value: 48000000, reason: "" });
  assert.equal(active(state).fields.find(field => field.key === "debt")!.status, "conflict");
  state = act(state, { type: "EDIT_FIELD", key: "debt", value: 48000000, reason: "합성 잔액증명서의 기준일 잔액 채택" });
  assert.equal(active(state).fields.find(field => field.key === "debt")!.status, "candidate");
  state = act(state, { type: "CONFIRM_FIELD", key: "debt", reason: "선택한 잔액과 원문 대조" });
  assert.equal(deriveReadiness(active(state)).canGenerate, true);
});

test("only the lawyer can complete review after a current staff review", () => {
  let state = draft();
  const snapshotId = snapshot(state).id;
  state = labReducer(state, { type: "SET_ROLE", role: "lawyer" });
  state = act(state, { type: "REVIEW_LAWYER", snapshotId });
  assert.equal(snapshot(state).lawyerReviewed, false);
  state = labReducer(state, { type: "SET_ROLE", role: "client" });
  state = act(state, { type: "REVIEW_STAFF", snapshotId });
  assert.equal(snapshot(state).staffReviewed, false);
  state = labReducer(state, { type: "SET_ROLE", role: "staff" });
  state = act(state, { type: "REVIEW_STAFF", snapshotId });
  assert.equal(snapshot(state).staffReviewed, true);
  state = act(state, { type: "REVIEW_LAWYER", snapshotId });
  assert.equal(snapshot(state).lawyerReviewed, false);
  state = labReducer(state, { type: "SET_ROLE", role: "lawyer" });
  state = act(state, { type: "REVIEW_LAWYER", snapshotId });
  assert.equal(deriveReadiness(active(state)).stage, "lawyer_reviewed");
});

test("evidence changes invalidate approvals without changing a generated payload", () => {
  let state = draft();
  const snapshotId = snapshot(state).id;
  state = act(state, { type: "REVIEW_STAFF", snapshotId });
  state = labReducer(state, { type: "SET_ROLE", role: "lawyer" });
  state = act(state, { type: "REVIEW_LAWYER", snapshotId });
  const original = snapshot(state), payload = JSON.stringify(original.payload), revision = active(state).revision;
  assertDeepFrozen(original.payload);
  assert.throws(() => Object.defineProperty(original.payload, "injected", { value: true }), TypeError);
  state = labReducer(state, { type: "SET_ROLE", role: "staff" });
  state = act(state, { type: "EDIT_FIELD", key: "income", value: 3100000, reason: "정정 소득자료 반영" });
  const old = active(state).generated.find(item => item.id === snapshotId)!;
  assert.equal(active(state).revision, revision + 1);
  assert.equal(old.invalidated, true);
  assert.equal(old.staffReviewed, false);
  assert.equal(old.lawyerReviewed, false);
  assert.equal(JSON.stringify(old.payload), payload);
  state = act(state, { type: "REVIEW_STAFF", snapshotId });
  assert.equal(active(state).generated.find(item => item.id === snapshotId)!.staffReviewed, false);
});

test("an explicit confirmed zero differs from a missing value and withdrawn source", () => {
  let state = confirmAvailable(fixture());
  state = act(state, { type: "EDIT_FIELD", key: "income", value: null, reason: "확인할 금액 미입력" });
  assert.equal(calculateDemo(active(state)), null);
  assert.equal(deriveReadiness(active(state)).canGenerate, false);
  state = act(state, { type: "EDIT_FIELD", key: "income", value: 0, reason: "합성 원문에 명시된 0원" });
  state = act(state, { type: "CONFIRM_FIELD", key: "income", reason: "0원 원문 대조" });
  assert.equal(calculateDemo(active(state))!.monthlyPayment, 0);
  const source = active(state).fields.find(field => field.key === "income")!.source!;
  state = act(state, { type: "WITHDRAW_DOCUMENT", documentId: source.documentId });
  assert.equal(deriveReadiness(active(state)).canGenerate, false);
});

test("document requirements follow income type and positive assets", () => {
  let state = fixture();
  state = act(state, { type: "SET_INCOME_TYPE", incomeType: "salary" });
  state = act(state, { type: "EDIT_FIELD", key: "assets", value: 0, reason: "합성 무재산 입력" });
  assert.deepEqual(requirementsFor(active(state)).filter(item => item.required).map(item => item.kind).sort(), ["debt", "identity", "income"]);
  state = act(state, { type: "SET_INCOME_TYPE", incomeType: "business" });
  state = act(state, { type: "EDIT_FIELD", key: "assets", value: 1000000, reason: "합성 자산 확인" });
  assert.deepEqual(requirementsFor(active(state)).filter(item => item.required).map(item => item.kind).sort(), ["asset", "business", "debt", "identity", "income"]);
});

test("demo arithmetic is deterministic, bounded by debt, and leaves its input untouched", () => {
  let state = confirmAvailable(fixture());
  for (const [key, value] of [["income", 2700000], ["expenses", 400000], ["livingCost", 1400000], ["debt", 72000000], ["assets", 0]] as const) {
    state = act(state, { type: "EDIT_FIELD", key, value, reason: "고정 합성 계산 입력" });
    state = act(state, { type: "CONFIRM_FIELD", key, reason: "고정 합성 원문 대조" });
  }
  state = act(state, { type: "SET_MONTHS", months: 36 });
  const item = active(state), before = JSON.stringify(item), calculation = calculateDemo(item)!;
  assert.equal(calculation.disposableIncome, 900000);
  assert.equal(calculation.monthlyPayment, 900000);
  assert.equal(calculation.totalRepayment, 32400000);
  assert.equal(calculation.remainingDebt, 39600000);
  assert.deepEqual(calculateDemo(item), calculation);
  assert.equal(JSON.stringify(item), before);
  state = act(state, { type: "EDIT_FIELD", key: "debt", value: 1000000, reason: "채무 상한 계산 예시" });
  state = act(state, { type: "CONFIRM_FIELD", key: "debt", reason: "합성 잔액 대조" });
  assert.equal(calculateDemo(active(state))!.monthlyPayment, 27778);
  assert.equal(calculateDemo(active(state))!.totalRepayment, 1000000);
});

test("demo recovery supplies missing business and two-page income documents without replacing confirmed fields", () => {
  let state = confirmAvailable(fixture("missing"));
  const confirmed = active(state).fields.filter(field => field.status === "confirmed");
  state = labReducer(state, { type: "SET_ROLE", role: "client" });
  state = act(state, { type: "RUN_DEMO_EXTRACTION" });
  assert.equal(active(state).documents.find(document => document.kind === "income")!.pages, 2);
  assert.equal(active(state).documents.find(document => document.kind === "business")!.status, "uploaded");
  assert.ok(requirementsFor(active(state)).filter(item => item.required).every(item => item.status !== "missing"));
  assert.deepEqual(active(state).fields.filter(field => field.status === "confirmed"), confirmed);
  assert.equal(active(state).fields.find(field => field.key === "expenses")!.status, "candidate");
  const count = active(state).documents.length;
  state = act(state, { type: "RUN_DEMO_EXTRACTION" });
  assert.equal(active(state).documents.length, count);
  state = labReducer(state, { type: "SET_ROLE", role: "staff" });
  state = confirmAvailable(state);
  assert.equal(deriveReadiness(active(state)).canGenerate, true);
});

test("unknown assets require evidence and clients can choose an income type", () => {
  let state = labReducer(fixture(), { type: "SET_ROLE", role: "client" });
  state = act(state, { type: "SET_INCOME_TYPE", incomeType: "business" });
  assert.equal(active(state).incomeType, "business");
  assert.equal(requirementsFor(active(state)).find(item => item.kind === "business")!.required, true);
  state = labReducer(state, { type: "SET_ROLE", role: "staff" });
  state = act(state, { type: "EDIT_FIELD", key: "assets", value: null, reason: "재산 유무 미확인" });
  assert.equal(requirementsFor(active(state)).find(item => item.kind === "asset")!.required, true);
  assert.equal(requirementsFor({ ...active(state), fields: active(state).fields.filter(field => field.key !== "assets") }).find(item => item.kind === "asset")!.required, true);
  state = act(state, { type: "EDIT_FIELD", key: "assets", value: 0, reason: "명시적인 무재산 예시" });
  assert.equal(requirementsFor(active(state)).find(item => item.kind === "asset")!.required, false);
});

test("document upload deduplicates active trimmed names while allowing replacement of a withdrawn file", () => {
  let state = fixture();
  const original = active(state).documents[0], revision = active(state).revision, count = active(state).documents.length;
  state = act(state, { type: "ADD_DOCUMENT", name: `  ${original.name}  `, kind: "income", pages: 2 });
  assert.equal(active(state).documents.length, count);
  assert.equal(active(state).revision, revision);
  state = act(state, { type: "WITHDRAW_DOCUMENT", documentId: original.id });
  state = act(state, { type: "ADD_DOCUMENT", name: original.name, kind: original.kind, pages: original.pages });
  assert.equal(active(state).documents.length, count + 1);
  assert.equal(active(state).documents.filter(document => document.name === original.name && document.status !== "withdrawn").length, 1);
});

test("external changes require a staff or lawyer reason and invalidate prior approvals", () => {
  for (const role of ["staff", "lawyer"] as const) {
    let state = draft();
    const snapshotId = snapshot(state).id, revision = active(state).revision;
    state = act(state, { type: "REVIEW_STAFF", snapshotId });
    state = labReducer(state, { type: "SET_ROLE", role: "lawyer" });
    state = act(state, { type: "REVIEW_LAWYER", snapshotId });
    const payload = JSON.stringify(snapshot(state).payload);
    state = labReducer(state, { type: "SET_ROLE", role: "client" });
    state = act(state, { type: "EXTERNAL_CHANGE", reason: "권한 없는 변경" });
    assert.equal(active(state).revision, revision);
    assert.equal(snapshot(state).lawyerReviewed, true);
    state = labReducer(state, { type: "SET_ROLE", role });
    state = act(state, { type: "EXTERNAL_CHANGE", reason: " " });
    assert.equal(active(state).revision, revision);
    state = act(state, { type: "EXTERNAL_CHANGE", reason: "외부 원장 수정 확인" });
    assert.equal(active(state).revision, revision + 1);
    const old = active(state).generated.find(item => item.id === snapshotId)!;
    assert.equal(old.invalidated, true);
    assert.equal(old.staffReviewed, false);
    assert.equal(old.lawyerReviewed, false);
    assert.equal(JSON.stringify(old.payload), payload);
  }
});

test("draft narrative edits create immutable versions and require current snapshots and fresh reviews", () => {
  let state = draft();
  const original = snapshot(state), revision = active(state).revision, originalJson = JSON.stringify(original.payload);
  state = act(state, { type: "REVIEW_STAFF", snapshotId: original.id });
  state = labReducer(state, { type: "SET_ROLE", role: "lawyer" });
  state = act(state, { type: "REVIEW_LAWYER", snapshotId: original.id });
  state = act(state, { type: "EDIT_DRAFT_TEXT", snapshotId: original.id, text: "수정한 합성 진술", reason: "문구 검토" });
  const edited = snapshot(state);
  assert.notEqual(edited.id, original.id);
  assert.equal(edited.revision, revision);
  assert.equal(edited.payload.narrative, "수정한 합성 진술");
  assert.deepEqual(edited.payload.fields, original.payload.fields);
  assert.deepEqual(edited.payload.documents, original.payload.documents);
  assert.deepEqual(edited.payload.calculation, original.payload.calculation);
  assertDeepFrozen(edited.payload);
  assert.equal(JSON.stringify(original.payload), originalJson);
  assert.equal(edited.staffReviewed, false);
  assert.equal(edited.lawyerReviewed, false);
  assert.equal(active(state).generated.find(item => item.id === original.id)!.invalidated, true);
  const count = active(state).generated.length;
  state = act(state, { type: "EDIT_DRAFT_TEXT", snapshotId: original.id, text: "과거본 변경", reason: "과거본" });
  state = act(state, { type: "EDIT_DRAFT_TEXT", snapshotId: edited.id, text: " ", reason: "빈 문구" });
  state = act(state, { type: "EDIT_DRAFT_TEXT", snapshotId: edited.id, text: "문구", reason: " " });
  state = labReducer(state, { type: "SET_ROLE", role: "client" });
  state = act(state, { type: "EDIT_DRAFT_TEXT", snapshotId: edited.id, text: "문구", reason: "권한 없음" });
  assert.equal(active(state).generated.length, count);
  state = labReducer(state, { type: "SET_ROLE", role: "staff" });
  state = act(state, { type: "EXTERNAL_CHANGE", reason: "원장 변경" });
  state = act(state, { type: "EDIT_DRAFT_TEXT", snapshotId: edited.id, text: "새 문구", reason: "오래된 원장" });
  assert.equal(active(state).generated.length, count);
});

test("source selection validates staff permission, active page bounds and provenance without changing values", () => {
  let state = fixture("conflict");
  const debt = active(state).fields.find(field => field.key === "debt")!, alternative = debt.alternatives![1].source;
  const selection = { type: "SELECT_FIELD_SOURCE", key: "debt", ...alternative, reason: "다른 원문 근거 선택" } as const;
  for (const role of ["client", "lawyer"] as const) {
    const denied = act(labReducer(state, { type: "SET_ROLE", role }), selection);
    assert.deepEqual(active(denied).fields, active(state).fields);
  }
  for (const override of [{ page: 0 }, { page: 2 }, { documentId: "missing-doc" }, { excerpt: " " }, { reason: " " }]) {
    const denied = act(state, { ...selection, ...override });
    assert.equal(active(denied).revision, active(state).revision);
    assert.deepEqual(active(denied).fields, active(state).fields);
  }
  state = act(state, selection);
  const selected = active(state).fields.find(field => field.key === "debt")!;
  assert.equal(selected.value, debt.value);
  assert.deepEqual(selected.alternatives, debt.alternatives);
  assert.deepEqual(selected.source, alternative);
  assert.equal(selected.status, "candidate");
  state = act(state, { type: "EDIT_FIELD", key: "debt", value: null, reason: "값 미확인" });
  state = act(state, selection);
  assert.equal(active(state).fields.find(field => field.key === "debt")!.status, "missing");
  state = act(state, { type: "WITHDRAW_DOCUMENT", documentId: alternative.documentId });
  const revision = active(state).revision;
  state = act(state, selection);
  assert.equal(active(state).revision, revision);
});

function reviewedFinancial() {
  const data = createFinancialDemo(createScenarioCase("normal"));
  for (const row of [...data.incomes, ...data.debts, ...data.assets]) row.confirmed = true;
  return data;
}

test("financial workbench keeps unknown amounts distinct from reviewed zero", () => {
  const data = reviewedFinancial();
  data.incomes[0].gross = null;
  const unknown = deriveFinancialDemo(data);
  assert.equal(unknown.ready, false);
  assert.equal(unknown.incomeGross, null);
  data.incomes[0].gross = 0;
  const zero = deriveFinancialDemo(data);
  assert.equal(zero.ready, true);
  assert.equal(zero.incomeGross, 0);
  assert.equal(zero.ordinaryBudget, 0);
  assert.equal(zero.shortfall, 72_000_000);
  data.assets = [];
  assert.equal(deriveFinancialDemo(data).ready, false, "an empty asset list is not a declaration of zero assets");
});

test("financial workbench rejects overlapping income periods, duplicates and impossible dates", () => {
  const data = reviewedFinancial();
  data.incomes.push({ ...data.incomes[0], id: "income-overlap", from: "2026-06-01", to: "2026-12-31" });
  assert.equal(deriveFinancialDemo(data).ready, false);
  assert.match(deriveFinancialDemo(data).duplicates.join(" "), /겹침/);
  data.incomes.pop();
  data.debts.push({ ...data.debts[0], id: "debt-duplicate" });
  assert.match(deriveFinancialDemo(data).duplicates.join(" "), /채권 계약/);
  data.debts.pop();
  data.assets[0].asOf = "2026-02-30";
  assert.equal(deriveFinancialDemo(data).ready, false);
});

test("financial budget preserves fees, priority payment, rounding remainder and debt shortfall", () => {
  const data = reviewedFinancial();
  data.incomes[0].gross = 100;
  data.incomes[0].expenses = 0;
  data.livingCost = 0;
  data.fees = 10;
  data.priorityPayment = 20;
  data.debts = [1, 2, 3].map(n => ({ ...data.debts[0], id: `debt-${n}`, label: `합성 계약 ${n}`, principal: 1000, interest: 0 }));
  const before = JSON.stringify(data), result = deriveFinancialDemo(data);
  assert.equal(result.ready, true);
  assert.equal(result.ordinaryBudget, 70);
  assert.equal(result.repaymentPool, 2520);
  assert.equal(result.shortfall, 480);
  assert.equal(result.allocations.reduce((sum, row) => sum + row.amount, 0) + result.unallocated!, 2520);
  data.debts[0].principal = 1001;
  const rounded = deriveFinancialDemo(data);
  assert.equal(rounded.allocations.reduce((sum, row) => sum + row.amount, 0) + rounded.unallocated!, rounded.repaymentPool);
  assert.ok(rounded.unallocated! > 0);
  data.debts[0].principal = 1000;
  assert.equal(JSON.stringify(data), before, "derivation leaves financial input unchanged");
});

test("financial asset disposal separates cash proceeds from retained assets", () => {
  const data = reviewedFinancial();
  data.assets[0] = { ...data.assets[0], marketValue: 10_000, securedBalance: 1000, costs: 1000, exemption: 2000, ownershipBps: 5000 };
  assert.equal(deriveFinancialDemo(data).remainingAssets, 3000);
  data.assets[0].disposal = true;
  data.assets[0].salePrice = 8000;
  const disposed = deriveFinancialDemo(data);
  assert.equal(disposed.disposalProceeds, 3000);
  assert.equal(disposed.remainingAssets, 0);
  assert.equal(disposed.assetValue, 3000, "sold property is not counted again as retained property");
});

test("secured and tax example rows remain visible and are excluded from ordinary allocations", () => {
  const data = reviewedFinancial();
  data.debts.push({ ...data.debts[0], id: "secured", label: "합성 담보계약", principal: 1000, secured: true });
  data.debts.push({ ...data.debts[0], id: "tax", label: "합성 조세", principal: 2000, priority: "tax" });
  const result = deriveFinancialDemo(data);
  assert.equal(result.ready, true);
  assert.equal(result.debtTotal, 72_003_000);
  assert.equal(result.ordinaryDebt, 72_000_000);
  assert.equal(result.allocations.length, 1);
  assert.equal(result.warnings.length, 2);
});

test("explicit staff bulk review confirms only intact synthetic candidates in one revision", () => {
  const initial = fixture(), revision = active(initial).revision;
  for (const role of ["client", "lawyer"] as const) {
    const denied = act(labReducer(initial, { type: "SET_ROLE", role }), { type: "BULK_CONFIRM_SAFE", reason: "대조" });
    assert.deepEqual(active(denied), active(initial));
  }
  assert.equal(active(act(initial, { type: "BULK_CONFIRM_SAFE", reason: " " })).revision, revision);
  const reviewed = act(initial, { type: "BULK_CONFIRM_SAFE", reason: "정상 합성 후보와 원문을 명시적으로 대조했습니다." });
  assert.equal(active(reviewed).revision, revision + 1);
  assert.equal(deriveReadiness(active(reviewed)).canGenerate, true);
  assert.ok(active(initial).fields.every(field => field.status === "candidate"), "prior input state is untouched");
  const conflict = act(fixture("conflict"), { type: "BULK_CONFIRM_SAFE", reason: "정상 후보만 대조" });
  assert.equal(active(conflict).fields.find(field => field.key === "debt")!.status, "conflict");
  assert.equal(deriveReadiness(active(conflict)).canGenerate, false);
});

test("bulk review cannot approve renamed user files or edited values that disagree with fixture excerpts", () => {
  let state = fixture();
  state = act(state, { type: "EDIT_FIELD", key: "debt", value: 999, reason: "별도 금액 후보" });
  state = act(state, { type: "ADD_DOCUMENT", name: "[합성] 사용자 등록.pdf", kind: "income", pages: 2 });
  const uploaded = active(state).documents.at(-1)!;
  state = act(state, { type: "SELECT_FIELD_SOURCE", key: "income", documentId: uploaded.id, page: 1, excerpt: "[합성 고정 예시] 월 수입 4,500,000원", reason: "사용자 자료 선택" });
  state = act(state, { type: "BULK_CONFIRM_SAFE", reason: "정상 합성 후보만 대조" });
  assert.equal(active(state).documents.find(document => document.id === uploaded.id)!.status, "uploaded");
  assert.equal(active(state).fields.find(field => field.key === "income")!.status, "candidate");
  assert.equal(active(state).fields.find(field => field.key === "debt")!.status, "candidate");
  assert.equal(deriveReadiness(active(state)).canGenerate, false);
});

test("one document can satisfy multiple linked requirements without duplicating facts", () => {
  let state = confirmAvailable(fixture());
  const before = structuredClone(active(state).fields), documentId = active(state).documents.find(document => document.kind === "income")!.id;
  for (const kind of ["identity", "income"] as const) state = act(state, { type: "LINK_REQUIREMENT", kind, documentId, subject: "신청인", period: "2026-01~09", reason: "동일 자료의 별도 확인 범위" });
  assert.equal(active(state).requirementLinks!.length, 2);
  assert.deepEqual(active(state).fields, before);
  assert.ok(requirementsFor(active(state)).filter(item => ["identity", "income"].includes(item.kind)).every(item => item.status === "confirmed"));
  const revision = active(state).revision;
  state = act(state, { type: "LINK_REQUIREMENT", kind: "income", documentId, subject: "신청인", period: "2026-01~09", reason: "중복 시도" });
  assert.equal(active(state).revision, revision);
  state = act(state, { type: "GENERATE_DRAFT" });
  assert.equal(snapshot(state).payload.requirementLinks!.length, 2);
  assertDeepFrozen(snapshot(state).payload.requirementLinks);
  state = act(state, { type: "UNLINK_REQUIREMENT", linkId: active(state).requirementLinks![0].id, reason: "연결 정정" });
  assert.equal(active(state).generated.at(-1)!.invalidated, true);
});

test("linked alternatives satisfy their own subject and period rather than hiding another missing subject", () => {
  let state = confirmAvailable(fixture());
  const confirmedId = active(state).documents.find(document => document.kind === "income")!.id;
  state = act(state, { type: "ADD_DOCUMENT", name: "다른 사업장 자료.pdf", kind: "income", pages: 2 });
  const pendingId = active(state).documents.at(-1)!.id;
  for (const [documentId, subject] of [[confirmedId, "직장 A"], [pendingId, "사업장 B"]]) state = act(state, { type: "LINK_REQUIREMENT", kind: "income", documentId, subject, period: "2026-01~09", reason: "대상별 자료 확인" });
  assert.equal(requirementsFor(active(state)).find(item => item.kind === "income")!.status, "uploaded");
  state = act(state, { type: "LINK_REQUIREMENT", kind: "income", documentId: confirmedId, subject: "사업장 B", period: "2026-01~09", reason: "같은 범위 대체자료 확인" });
  assert.equal(requirementsFor(active(state)).find(item => item.kind === "income")!.status, "confirmed");
  state = act(state, { type: "WITHDRAW_DOCUMENT", documentId: confirmedId });
  assert.equal(requirementsFor(active(state)).find(item => item.kind === "income")!.status, "missing");
});

test("conditional exemptions require staff reasons and cannot bypass mandatory or unknown-asset requirements", () => {
  let state = fixture("missing");
  for (const kind of ["identity", "income", "debt"] as const) {
    const denied = act(state, { type: "SET_REQUIREMENT_EXEMPT", kind, reason: "우회 시도" });
    assert.equal(requirementsFor(active(denied)).find(item => item.kind === kind)!.required, true);
  }
  const client = act(labReducer(state, { type: "SET_ROLE", role: "client" }), { type: "SET_REQUIREMENT_EXEMPT", kind: "business", reason: "직접 면제" });
  assert.equal(requirementsFor(active(client)).find(item => item.kind === "business")!.required, true);
  state = act(state, { type: "SET_REQUIREMENT_EXEMPT", kind: "business", reason: "대체 확인 범위를 담당자가 기록" });
  assert.equal(requirementsFor(active(state)).find(item => item.kind === "business")!.required, false);
  state = act(state, { type: "CLEAR_REQUIREMENT_EXEMPT", kind: "business", reason: "사업자료 다시 요청" });
  assert.equal(requirementsFor(active(state)).find(item => item.kind === "business")!.required, true);
  state = act(state, { type: "EDIT_FIELD", key: "assets", value: null, reason: "재산 조사 미완료" });
  state = act(state, { type: "SET_REQUIREMENT_EXEMPT", kind: "asset", reason: "미확인을 없음으로 처리 시도" });
  assert.equal(requirementsFor(active(state)).find(item => item.kind === "asset")!.required, true);
  assert.equal(active(state).requirementExemptions!.some(item => item.kind === "asset"), false);
});
