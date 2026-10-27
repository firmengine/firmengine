import test from "node:test";
import assert from "node:assert/strict";
import { applyExtraction, createCase, normalizeMoney, reviewFact } from "../lib/domain.ts";
import { assessCase, calculateCase, monthlyIncome } from "../lib/assessment.ts";
import { buildFormBindings } from "../lib/form-mapping.ts";

function incomeFixture(rows: { id: string; employer?: string; payerIdentityId?: string; kind?: "wage" | "business"; amount: string; amountBasis: "monthly" | "period_total"; periodStart?: string; periodEnd?: string; periodMonths?: number; aggregationTreatment?: "series_observation" | "independent_source" | "component" | "duplicate" | "unknown"; aggregationReviewed?: boolean; aggregationReviewReason?: string }[], filingPeriod?: { start: string; end: string }): ReturnType<typeof createCase> {
  const data = createCase("합성 소득 관측", "synthetic-income-observations", "2026-10-27");
  data.documents = [{ id: "income-doc", name: "synthetic-income.pdf", sha256: "9".repeat(64), status: "active", pages: [1] }];
  const quotes = rows.map((row) => `Synthetic observation ${row.id}`);
  data.pages = [{ documentId: "income-doc", page: 1, role: "evidence", text: quotes.join(" | ") }];
  data.facts = rows.map((row, index) => ({ id: "fact-" + row.id, logicalId: "fact-" + row.id, version: 1, subjectId: row.id, key: "income.net", value: quotes[index], state: "verified" as const, recognition: "accepted" as const, refs: [{ documentId: "income-doc", page: 1, quote: quotes[index] }], validation: [] }));
  data.incomes = rows.map((row) => ({ id: row.id, kind: row.kind ?? "wage", label: row.id, employer: row.employer, payerIdentityId: row.payerIdentityId, net: normalizeMoney(row.amount), amountBasis: row.amountBasis, periodStart: row.periodStart, periodEnd: row.periodEnd, periodMonths: row.periodMonths, aggregationTreatment: row.aggregationTreatment, aggregationReviewed: row.aggregationReviewed, aggregationReviewReason: row.aggregationReviewReason, recurring: "yes" as const, recognition: "accepted" as const, factIds: ["fact-" + row.id] }));
  data.context.inventoryComplete.income = "yes";
  if (filingPeriod) data.context.filingPeriod = filingPeriod;
  return data;
}

function assetDateFixture(assetDate: string): ReturnType<typeof createCase> {
  const data = createCase("합성 평가일", "synthetic-asset-date", "2026-10-27");
  data.documents = [{ id: "asset-doc", name: "synthetic-asset.pdf", sha256: "8".repeat(64), status: "active", pages: [1] }];
  data.pages = [{ documentId: "asset-doc", page: 1, role: "evidence", text: "Synthetic asset valuation" }];
  data.facts = [{ id: "asset-fact", logicalId: "asset-fact", version: 1, subjectId: "asset", key: "asset.value", value: "Synthetic asset valuation", state: "verified", recognition: "accepted", refs: [{ documentId: "asset-doc", page: 1, quote: "Synthetic asset valuation" }], validation: [] }];
  data.assets = [{ id: "asset", kind: "deposit", label: "합성 예금", grossValue: normalizeMoney("1000000"), securedPayoff: normalizeMoney("0"), disposalCosts: normalizeMoney("0"), protectedValue: normalizeMoney("0"), ownershipBps: 10000, asOf: assetDate, valuationBasis: "합성 평가서", recognition: "accepted", factIds: ["asset-fact"] }];
  data.context.inventoryComplete.asset = "yes";
  return data;
}

test("재산 평가일의 누락·오류·사건 기준일 불일치를 별도 계산 이슈로 보존한다", () => {
  const rules = { id: "synthetic", status: "source_verified" as const, sources: [] };
  for (const date of ["2019-01-01", "2027-01-01"]) {
    const data = assetDateFixture(date);
    data.context.assetValuationBasisReviewed = true;data.context.presentValueReviewed = true;data.context.presentValueBasis = "Synthetic reviewed basis";data.context.approvedPresentValue = normalizeMoney("2000000");
    const result = calculateCase(data, rules);
    assert.equal(result.assetRows[0].liquidationWon, "1000000"); // Arithmetic is retained as a clearly review-blocked preview.
    assert.ok(result.issues.includes("ASSET_AS_OF_RECONCILIATION_REQUIRED:asset"));
    assert.equal(result.traces.find(trace => trace.id === "asset:asset")?.status, "provisional");
    assert.equal(result.traces.find(trace => trace.id === "liquidation_comparison")?.status, "provisional");
    assert.equal(result.liquidationComparison, "unknown");
    assert.equal(assessCase(data, rules).generationGate.canFinalize, false);
    assert.ok(assessCase(data, rules).findings.some(finding => finding.id === "calc_ASSET_AS_OF_RECONCILIATION_REQUIRED:asset"));
  }

  const missing = calculateCase(assetDateFixture(""), rules);
  assert.equal(missing.assetRows[0].liquidationWon, null);
  assert.ok(missing.issues.includes("ASSET_VALUATION_DATE_MISSING:asset"));

  const malformed = calculateCase(assetDateFixture("2026-02-30"), rules);
  assert.equal(malformed.assetRows[0].liquidationWon, null);
  assert.ok(malformed.issues.includes("ASSET_VALUATION_DATE_INVALID:asset"));

  const matching = calculateCase(assetDateFixture("2026-10-27"), rules);
  assert.equal(matching.assetRows[0].liquidationWon, "1000000");
  assert.ok(!matching.issues.some(issue => issue.includes("ASSET_AS_OF_RECONCILIATION") || issue.includes("ASSET_VALUATION_DATE_INVALID") || issue.includes("ASSET_VALUATION_DATE_MISSING")));
});

test("음수 소득원은 다른 소득을 자동 상계하지 않고 검토 대상으로 막는다", () => {
  const result = monthlyIncome({
    id: "synthetic-loss", kind: "business", label: "합성 사업 손실",
    net: normalizeMoney("-100000"), amountBasis: "monthly", recurring: "yes", factIds: [],
  });
  assert.equal(result.value, null);
  assert.ok(result.reasons.includes("INCOME_NET_NEGATIVE_REQUIRES_REVIEW"));
});

test("명시된 0원 월소득은 누락값으로 바뀌지 않는다", () => {
  const result = monthlyIncome({
    id: "synthetic-zero", kind: "other", label: "합성 0원 소득",
    net: normalizeMoney("0"), amountBasis: "monthly", recurring: "yes", factIds: [],
  });
  assert.equal(result.value, 0n);
  assert.deepEqual(result.reasons, []);
});

test("음수 제안 월변제액은 계산 가능한 가용소득으로 조용히 대체되지 않는다", () => {
  const data = createCase("합성 음수 월액", "synthetic-negative-payment", "2026-10-27");
  data.documents = [{ id: "pay-doc", name: "synthetic.pdf", sha256: "f".repeat(64), status: "active", pages: [1] }];
  data.pages = [{ documentId: "pay-doc", page: 1, role: "evidence", text: "Synthetic amount" }];
  data.facts = ["income-f", "living-f"].map((id) => ({ id, logicalId: id, version: 1, subjectId: id, key: id, value: "Synthetic amount", state: "verified" as const, recognition: "accepted" as const, refs: [{ documentId: "pay-doc", page: 1, quote: "Synthetic amount" }], validation: [] }));
  data.incomes = [{ id: "wage", kind: "wage", label: "합성 급여", net: normalizeMoney("1000"), amountBasis: "monthly", recurring: "yes", recognition: "accepted", factIds: ["income-f"] }];
  data.household = { recognizedMembers: 1, recognizedLivingCost: normalizeMoney("0"), livingCostIncludesAdditional: true, recognition: "accepted", factIds: ["living-f"] };
  Object.assign(data.context, { inventoryComplete: { income: "yes", debt: "yes", asset: "yes" }, monthlyTrusteeFee: normalizeMoney("0"), monthlyPriorityPayment: normalizeMoney("0"), monthlyEstatePayment: normalizeMoney("0"), approvedMonthlyPayment: normalizeMoney("-1"), planMonths: 36 });
  const result = calculateCase(data, { id: "synthetic", status: "source_verified", sources: [] });
  assert.equal(result.disposableIncomeWon, "1000");
  assert.equal(result.monthlyPaymentWon, null);
  assert.ok(result.issues.includes("APPROVED_PAYMENT_INVALID"));
});

test("같은 payer의 서로 다른 월별 급여명세서는 합산하지 않고 관측 월평균으로 낸다", () => {
  const data = incomeFixture([
    { id: "pay-jan", employer: "합성회사", payerIdentityId: "biz-123", amount: "1000", amountBasis: "monthly", periodStart: "2025-01-01", periodEnd: "2025-01-31" },
    { id: "pay-feb", employer: "합성회사", payerIdentityId: "biz-123", amount: "2000", amountBasis: "monthly", periodStart: "2025-02-01", periodEnd: "2025-02-28" },
    { id: "pay-mar", employer: "합성회사", payerIdentityId: "biz-123", amount: "3000", amountBasis: "monthly", periodStart: "2025-03-01", periodEnd: "2025-03-31" },
  ]);
  const result = calculateCase(data, { id: "synthetic", status: "source_verified", sources: [] });
  assert.equal(result.incomeRows.reduce((sum, row) => sum + BigInt(row.monthlyWon ?? "0"), 0n).toString(), "6000"); // Raw observations stay visible.
  assert.equal(result.monthlyIncomeWon, "2000");
  assert.equal(result.incomeGroups[0].observedMonths, 3);
  assert.ok(result.issues.includes("INCOME_REPRESENTATIVE_PERIOD_NOT_SELECTED"));
  assert.equal(result.traces.find((trace) => trace.id.startsWith("income_group:"))?.status, "provisional");
});

test("같은 사업자의 2023·2024 연간증명서를 기간가중 평균하고 2024 선택기간에는 그 해만 반영한다", () => {
  const sources = [
    { id: "tax-2023", kind: "business" as const, employer: "합성사업", payerIdentityId: "biz-456", amount: "120000", amountBasis: "period_total" as const, periodStart: "2023-01-01", periodEnd: "2023-12-31" },
    { id: "tax-2024", kind: "business" as const, employer: "합성사업", payerIdentityId: "biz-456", amount: "240000", amountBasis: "period_total" as const, periodStart: "2024-01-01", periodEnd: "2024-12-31" },
  ];
  const observed = calculateCase(incomeFixture(sources), { id: "synthetic", status: "source_verified", sources: [] });
  assert.equal(observed.monthlyIncomeWon, "15000");
  assert.deepEqual(sources.map((source) => monthlyIncome({ id: source.id, kind: source.kind, label: source.id, net: normalizeMoney(source.amount), amountBasis: source.amountBasis, periodStart: source.periodStart, periodEnd: source.periodEnd, factIds: [] }).value), [10000n, 20000n]);
  const selected = incomeFixture(sources, { start: "2024-01-01", end: "2024-12-31" });
  (selected.context as typeof selected.context & { incomePeriodReviewed?: boolean }).incomePeriodReviewed = true;
  const current = calculateCase(selected, { id: "synthetic", status: "source_verified", sources: [] });
  assert.equal(current.monthlyIncomeWon, "20000");
  assert.equal(current.incomeGroups[0].sourceIds.includes("tax-2023"), false);
});

test("같은 지급자·같은 기간의 상이한 관측은 보너스나 중복으로 추정하지 않는다", () => {
  const data = incomeFixture([
    { id: "salary", employer: "합성회사", payerIdentityId: "biz-789", amount: "1000", amountBasis: "monthly", periodStart: "2025-01-01", periodEnd: "2025-01-31" },
    { id: "bonus-or-copy", employer: "합성회사", payerIdentityId: "biz-789", amount: "500", amountBasis: "monthly", periodStart: "2025-01-01", periodEnd: "2025-01-31" },
  ]);
  const result = calculateCase(data, { id: "synthetic", status: "source_verified", sources: [] });
  assert.equal(result.monthlyIncomeWon, null);
  assert.ok(result.issues.some((issue) => issue.startsWith("INCOME_OVERLAPPING_OBSERVATIONS_REVIEW_REQUIRED")));
});

test("같은 기간의 사람이 검토한 구성소득은 한 기간 합계로 반영한다", () => {
  const data = incomeFixture([
    { id: "base", employer: "합성회사", payerIdentityId: "biz-777", amount: "1000", amountBasis: "monthly", periodStart: "2025-01-01", periodEnd: "2025-01-31", aggregationTreatment: "component", aggregationReviewed: true, aggregationReviewReason: "합성 급여명세서에서 기본급과 별도 구성 확인" },
    { id: "bonus", employer: "합성회사", payerIdentityId: "biz-777", amount: "500", amountBasis: "monthly", periodStart: "2025-01-01", periodEnd: "2025-01-31", aggregationTreatment: "component", aggregationReviewed: true, aggregationReviewReason: "합성 급여명세서에서 기본급과 별도 구성 확인" },
  ]);
  assert.equal(calculateCase(data, { id: "synthetic", status: "source_verified", sources: [] }).monthlyIncomeWon, "1500");
});

test("같은 지급자명만 있고 지급자 식별번호가 없으면 관측을 합산하지 않는다", () => {
  const data = incomeFixture([
    { id: "jan", employer: "동명 회사", amount: "1000", amountBasis: "monthly", periodStart: "2025-01-01", periodEnd: "2025-01-31" },
    { id: "feb", employer: "동명 회사", amount: "2000", amountBasis: "monthly", periodStart: "2025-02-01", periodEnd: "2025-02-28" },
  ]);
  const result = calculateCase(data, { id: "synthetic", status: "source_verified", sources: [] });
  assert.equal(result.monthlyIncomeWon, null);
  assert.ok(result.issues.includes("INCOME_PAYER_IDENTITY_REVIEW_REQUIRED:jan,feb"));
});

test("같은 관측 문서를 중복 연결한 복사 행은 한 번만 반영한다", () => {
  const data = incomeFixture([{ id: "pay", employer: "합성회사", payerIdentityId: "biz-321", amount: "1000", amountBasis: "monthly", periodStart: "2025-01-01", periodEnd: "2025-01-31" }]);
  data.incomes.push({ ...structuredClone(data.incomes[0]), id: "pay-copy" });
  const result = calculateCase(data, { id: "synthetic", status: "source_verified", sources: [] });
  assert.equal(result.monthlyIncomeWon, "1000");
  assert.deepEqual(result.excludedDuplicateIds, ["pay-copy"]);
});

test("연간 기간합계는 완전한 시작일·종료일에서 개월수를 유도한다", () => {
  const source = { id: "annual", kind: "business" as const, label: "연간", net: normalizeMoney("120000"), amountBasis: "period_total" as const, periodStart: "2024-01-01", periodEnd: "2024-12-31", factIds: [] };
  const result = monthlyIncome(source);
  assert.equal(result.value, 10000n);
  assert.equal(result.formula.includes("자동유도"), true);
});

test("연간합계의 잔여 원은 월액마다 버리지 않고 전체 관측을 합친 뒤 한 번 나눈다",()=>{
  const data=incomeFixture([
    {id:"odd-2023",kind:"business",payerIdentityId:"payer-rounding",amount:"11999",amountBasis:"period_total",periodStart:"2023-01-01",periodEnd:"2023-12-31"},
    {id:"odd-2024",kind:"business",payerIdentityId:"payer-rounding",amount:"12001",amountBasis:"period_total",periodStart:"2024-01-01",periodEnd:"2024-12-31"},
  ]);
  const result=calculateCase(data,{id:"synthetic",status:"source_verified",sources:[]});
  assert.equal(result.monthlyIncomeWon,"1000");
  assert.equal(buildFormBindings(data,result).scalars.monthly_business_income,"1,000");
});

test("같은 기간의 구성 소득 두 행은 누락된 다음 달 증빙을 대신하지 않는다",()=>{
  const data=incomeFixture([
    {id:"base-jan",payerIdentityId:"payer-components",amount:"1000",amountBasis:"monthly",periodStart:"2025-01-01",periodEnd:"2025-01-31",aggregationTreatment:"component",aggregationReviewed:true,aggregationReviewReason:"기본급 명세"},
    {id:"bonus-jan",payerIdentityId:"payer-components",amount:"500",amountBasis:"monthly",periodStart:"2025-01-01",periodEnd:"2025-01-31",aggregationTreatment:"component",aggregationReviewed:true,aggregationReviewReason:"별도 수당 명세"},
  ],{start:"2025-01-01",end:"2025-02-28"});
  data.context.incomePeriodReviewed=true;
  const result=calculateCase(data,{id:"synthetic",status:"source_verified",sources:[]});
  assert.equal(result.monthlyIncomeWon,"1500");
  assert.equal(result.incomeGroups[0].observedMonths,1);
  assert.ok(result.issues.includes("INCOME_PERIOD_COVERAGE_INCOMPLETE"));
});

test("명시 0원 채무와 미입력 이자는 구별된다", () => {
  const zero = normalizeMoney("0");
  const omitted = normalizeMoney(undefined);
  assert.equal(zero.amountWon, "0");
  assert.equal(omitted.amountWon, null);
  const data = createCase("합성 명시값 검증", "synthetic-zero-vs-missing", "2026-10-27");
  data.debts = [{ id: "zero-claim", creditor: "합성 채권자", principal: zero, interest: omitted, secured: "no", classification: "ordinary", factIds: [] }];
  data.context.inventoryComplete.debt = "yes";
  assert.equal(data.debts[0].principal?.amountWon, "0");
  assert.equal(data.debts[0].interest?.amountWon, null);
});

test("보증한도 원문과 신청인의 채무원금을 분리하고 중복 연결 채권은 한도합계 확정을 보류한다", () => {
  const data = createCase("합성 보증 중복 검증", "synthetic-guarantee", "2026-10-27");
  data.documents = [{ id: "g-doc", name: "synthetic-guarantee.pdf", sha256: "c".repeat(64), status: "active", pages: [1] }];
  data.pages = [{ documentId: "g-doc", page: 1, role: "evidence", text: "Synthetic claim" }];
  data.facts = ["principal-f", "guarantor-f"].map((id) => ({ id, logicalId: id, version: 1, subjectId: id, key: "debt.claim", value: "Synthetic claim", state: "verified" as const, recognition: "accepted" as const, refs: [{ documentId: "g-doc", page: 1, quote: "Synthetic claim" }], validation: [] }));
  data.context.inventoryComplete.debt = "yes";
  data.debts = [
    { id: "principal", contractId: "underlying-contract", creditor: "합성 원채권자", principal: normalizeMoney("1000"), interest: normalizeMoney("0"), secured: "no", classification: "ordinary", asOf: data.context.asOf, factIds: ["principal-f"] },
    { id: "guarantor", contractId: "guarantee-contract", creditor: "합성 보증채권자", principal: normalizeMoney("1000"), interest: normalizeMoney("0"), secured: "no", classification: "ordinary", asOf: data.context.asOf, factIds: ["guarantor-f"], guaranteeDetails: { liabilityRole: "guarantor", claimNature: "contingent", underlyingDebtId: "principal", sourceGuaranteeAmount: normalizeMoney("1000"), sourceGuaranteeLimit: normalizeMoney("1500"), recourseStatus: "unpaid", capTreatment: "include", capTreatmentReviewed: true, reviewReason: "합성 검토" } },
  ];
  const result = assessCase(data, { id: "synthetic", status: "source_verified", sources: [], debtCaps: { unsecuredWon: "100000", securedWon: "100000", comparison: "lte" } });
  assert.equal(result.calculation.debtPrincipalWon, "2000"); // Exposure rows remain visible.
  assert.equal(result.calculation.unsecuredDebtWon, null); // Cap bucket does not silently double count.
  assert.ok(result.calculation.issues.some((issue) => issue.startsWith("GUARANTEE_OVERLAP_REQUIRES_REVIEW")));
});

test("검증 확인은 해소 가능한 편집 경고만 새 버전에서 해결하고 과거 경고는 보존한다", () => {
  const data = createCase("합성 사실 검토", "synthetic-validation", "2026-10-27");
  data.documents = [{ id: "v-doc", name: "synthetic.pdf", sha256: "d".repeat(64), status: "active", pages: [1] }];
  data.pages = [{ documentId: "v-doc", page: 1, role: "evidence", text: "Synthetic verified value" }];
  data.facts = [{ id: "v-fact", logicalId: "v-fact", version: 1, subjectId: "income", key: "income.net", value: "100", numeric: normalizeMoney("100"), state: "reported", recognition: "unreviewed", refs: [{ documentId: "v-doc", page: 1, quote: "Synthetic verified value" }], validation: [{ code: "USER_EDIT", message: "edited", severity: "warning" }, { code: "UNCERTAIN_READING", message: "uncertain", severity: "warning" }, { code: "FIELD_CONFLICT", message: "conflict", severity: "error" }] }];
  const checked = reviewFact(data, "v-fact", { state: "verified", actor: "합성 검토자", reason: "원문과 대조" });
  const next = checked.facts.find((fact) => fact.id !== "v-fact")!;
  assert.equal(next.validation.some((v) => v.code === "USER_EDIT" && v.severity !== "info"), false);
  assert.equal(next.validation.some((v) => v.code === "UNCERTAIN_READING" && v.severity !== "info"), false);
  assert.equal(next.validation.some((v) => v.code === "FIELD_CONFLICT" && v.severity === "error"), true);
  assert.equal(data.facts[0].validation.some((v) => v.code === "USER_EDIT"), true);
});

test("AI 채무 추출은 보증 한도처리와 법률검토 승인을 올릴 수 없다", () => {
  const data = createCase("합성 AI 보증 승인 차단", "synthetic-ai-guarantee", "2026-10-27");
  data.documents = [{ id: "ai-doc", name: "synthetic.pdf", sha256: "e".repeat(64), status: "active", pages: [1] }];
  data.pages = [{ documentId: "ai-doc", page: 1, role: "evidence", text: "Synthetic guarantee" }];
  const result = applyExtraction(data, {
    facts: [{ id: "debt-fact", subjectId: "debt-ai", key: "debt.guarantee", value: "Synthetic guarantee", refs: [{ documentId: "ai-doc", page: 1, quote: "Synthetic guarantee" }] }],
    debts: [{ id: "debt-ai", creditor: "합성 채권자", principal: normalizeMoney("100"), interest: normalizeMoney("0"), secured: "no", classification: "ordinary", asOf: data.context.asOf, factIds: ["debt-fact"], guaranteeDetails: { liabilityRole: "guarantor", claimNature: "fixed", recourseStatus: "unpaid", capTreatment: "include", capTreatmentReviewed: true, reviewReason: "model approval" } }],
  });
  assert.equal(result.debts[0].guaranteeDetails?.capTreatment, "unknown");
  assert.equal(result.debts[0].guaranteeDetails?.capTreatmentReviewed, false);
  assert.equal(result.debts[0].guaranteeDetails?.reviewReason, undefined);
});
