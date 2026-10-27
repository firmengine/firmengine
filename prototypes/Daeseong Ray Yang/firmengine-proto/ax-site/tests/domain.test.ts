import test from "node:test";
import assert from "node:assert/strict";
import { AI_MODEL, applyExtraction, archiveExport, createCase, currentFacts, extractionCacheKey, manifestFingerprint, manifestIssues, moneyValue, normalizeMoney, REQUIRED_ARTIFACT_KINDS, retractDocument, reviewExport, reviewFact } from "../lib/domain.ts";
import type { ArtifactKind, CaseData, Fact, RuleSet } from "../lib/domain.ts";
import { allocateProRata, assessCase, calculateCase, calculateDisposal } from "../lib/assessment.ts";
import { buildCourtPackage, newExportManifest, printableHtml } from "../lib/exports.ts";

const rules: RuleSet = { id: "synthetic-reviewed-rules", status: "source_verified", effectiveFrom: "2026-01-01", effectiveTo: "2026-12-31", courtIds: ["seoul"], sources: [{ id: "synthetic", title: "Synthetic test rule", url: "https://example.invalid/synthetic" }], debtCaps: { unsecuredWon: "1000000000", securedWon: "1500000000", comparison: "lte" }, term: { ordinaryMonths: 36, exceptionalMaxMonths: 60 } };
function fixture(): CaseData {
  const data = createCase("합성 회귀검증", "synthetic-case", "2026-10-27");
  data.documents = [{ id: "doc", name: "synthetic.pdf", sha256: "a".repeat(64), status: "active", pages: [1, 2, 3, 4] }];
  data.pages = [1, 2, 3, 4].map((page) => ({ documentId: "doc", page, role: "evidence", text: "Synthetic evidence only" }));
  const fact = (id: string, subject: string, key: string): string => {
    data.facts.push({ id, logicalId: id, version: 1, subjectId: subject, key, value: "Synthetic evidence", state: "verified", recognition: "accepted", refs: [{ documentId: "doc", page: 1, quote: "Synthetic evidence" }], validation: [] });
    return id;
  };
  data.incomes = [
    { id: "wage", kind: "wage", label: "근로소득", net: normalizeMoney("3000000"), amountBasis: "monthly", recurring: "yes", recognition: "accepted", factIds: [fact("f-wage", "wage", "income.wage")] },
    { id: "business", kind: "business", label: "사업소득", gross: normalizeMoney("60000000"), expenses: normalizeMoney("36000000"), amountBasis: "period_total", periodMonths: 12, periodStart: "2025-01-01", periodEnd: "2025-12-31", recurring: "yes", recognition: "accepted", factIds: [fact("f-business", "business", "income.business")] },
    { id: "rent", kind: "rent", label: "임대소득", net: normalizeMoney("500000"), amountBasis: "monthly", recurring: "yes", recognition: "accepted", factIds: [fact("f-rent", "rent", "income.rent")] },
  ];
  data.debts = [{ id: "loan", contractId: "contract-001", creditor: "합성채권자", principal: normalizeMoney("100000000"), interest: normalizeMoney("1000000"), secured: "no", classification: "ordinary", priority: "ordinary", legalReview: "accepted", asOf: "2026-10-27", factIds: [fact("f-loan", "loan", "debt.contract-001")] }];
  data.assets = [{ id: "deposit", kind: "deposit", label: "합성 예금", grossValue: normalizeMoney("1000000"), securedPayoff: normalizeMoney("0"), disposalCosts: normalizeMoney("0"), protectedValue: normalizeMoney("0"), ownershipBps: 10000, asOf: "2026-10-27", valuationBasis: "Synthetic statement", recognition: "accepted", factIds: [fact("f-asset", "deposit", "asset.deposit")] }];
  data.household = { reportedMembers: 1, recognizedMembers: 1, recognizedLivingCost: normalizeMoney("1500000"), livingCostIncludesAdditional: true, recognition: "accepted", factIds: [fact("f-household", "person", "living.recognized")] };
  Object.assign(data.context, { ruleReleaseId: rules.id, ruleApplicationReviewed: true, inventoryComplete: { income: "yes", debt: "yes", asset: "yes" }, monthlyTrusteeFee: normalizeMoney("0"), monthlyPriorityPayment: normalizeMoney("0"), monthlyEstatePayment: normalizeMoney("0"), planMonths: 36, approvedPresentValue: normalizeMoney("120000000"), presentValueBasis: "Synthetic reviewed discount basis", presentValueReviewed: true, assetValuationBasisReviewed: true, allocationBasis: "principal_then_interest_pro_rata", allocationBasisReviewed: true, eligibility: { naturalPerson: "yes", insolventOrRisk: "yes", priorProceedingsReviewed: "yes" }, applicant: { name: "합성사용자", address: "합성주소", statement: "실제 사건이 아닌 회귀검증 자료" } });
  return data;
}

test("원문 단위 정규화는 원화 정수로 정확히 계산하고 미확인을 0으로 바꾸지 않는다", () => {
  assert.equal(normalizeMoney("1.25", "만원").amountWon, "12500");
  assert.equal(normalizeMoney("9,007,199,254,740,993").amountWon, "9007199254740993");
  assert.equal(normalizeMoney(undefined).amountWon, null);
  assert.equal(normalizeMoney("0").amountWon, "0");
  assert.equal(normalizeMoney("0.5").normalizationStatus, "review_required");
  assert.equal(normalizeMoney(1.5).normalizationStatus, "invalid");
  assert.equal(normalizeMoney("100", "USD", "USD").amountWon, null);
  assert.equal(moneyValue({ ...normalizeMoney("10"), amountWon: "999" }), null);
});

test("근로·사업·임대 소득의 서로 다른 기간과 경비를 통합한다", () => {
  const result = calculateCase(fixture(), rules);
  assert.equal(result.monthlyIncomeWon, "5500000");
  assert.equal(result.incomeRows.find((r) => r.id === "business")?.monthlyWon, "2000000");
  assert.equal(result.disposableIncomeWon, "4000000");
  assert.equal(result.liquidationValueWon, "1000000");
  assert.equal(result.planTotalWon, "144000000");
});

test("사업소득 분모와 완전한 월범위가 모두 없으면 월평균과 합계를 보류한다", () => {
  const data = fixture(); delete data.incomes[1].periodMonths; delete data.incomes[1].periodStart; delete data.incomes[1].periodEnd;
  const result = calculateCase(data, rules);
  assert.equal(result.incomeRows.find((r) => r.id === "business")?.monthlyWon, null);
  assert.equal(result.monthlyIncomeWon, null);
  assert.ok(result.issues.some((x) => x.startsWith("INCOME_PERIOD_DENOMINATOR_MISSING")));
});

test("연간 금액을 월액이라고 선언하면서 12개월 분모를 혼용하면 차단한다", () => {
  const data = fixture(); data.incomes[1].amountBasis = "monthly";
  assert.equal(calculateCase(data, rules).monthlyIncomeWon, null);
});

test("원금과 이자 열을 유지하고 미확인 이자를 0으로 대체하지 않는다", () => {
  const data = fixture();
  const result = calculateCase(data, rules);
  assert.equal(result.debtPrincipalWon, "100000000");
  assert.equal(result.debtInterestWon, "1000000");
  assert.equal(result.totalDebtWon, "101000000");
  data.debts[0].interest = undefined;
  const missing = calculateCase(data, rules);
  assert.equal(missing.debtPrincipalWon, "100000000");
  assert.equal(missing.debtInterestWon, null);
  assert.equal(missing.totalDebtWon, null);
});

test("동일 계약 완전중복은 한 번만 합산하고 값 충돌이면 집계를 보류한다", () => {
  const data = fixture(); data.debts.push({ ...structuredClone(data.debts[0]), id: "duplicate" });
  const result = calculateCase(data, rules);
  assert.equal(result.totalDebtWon, "101000000");
  assert.deepEqual(result.excludedDuplicateIds, ["duplicate"]);
  data.debts[1].principal = normalizeMoney("200000000");
  const conflict = calculateCase(data, rules);
  assert.equal(conflict.totalDebtWon, null);
  assert.ok(conflict.issues.includes("DEBT_CONTRACT_CONFLICT:contract-001"));
});

test("채권자 이름이 같아도 서로 다른 계약은 합치지 않는다", () => {
  const data = fixture(); data.debts.push({ ...structuredClone(data.debts[0]), id: "second-loan", contractId: "contract-002" });
  assert.equal(calculateCase(data, rules).totalDebtWon, "202000000");
});

test("구버전 사실을 참조하는 객체의 금액을 재사용하지 않는다", () => {
  const data = fixture(); const old = data.facts.find((f) => f.id === "f-loan")!;
  data.facts.push({ ...old, id: "f-loan-v2", version: 2, supersedes: old.id, value: "Changed evidence" });
  const result = calculateCase(data, rules);
  assert.equal(result.totalDebtWon, null);
  assert.ok(result.issues.some((i) => i.includes("STALE_OR_RETRACTED_FACT")));
  assert.equal(currentFacts(data).filter((f) => f.logicalId === old.logicalId).length, 1);
});

test("원문 확인과 법적 인정 상태 변경은 새 사실버전으로 보존한다", () => {
  const data = fixture(); data.facts[0].state = "extracted"; data.facts[0].recognition = "unreviewed";
  const reviewed = reviewFact(data, "f-wage", { state: "verified", actor: "합성검수자", reason: "원문 금액 대조" });
  const latest = currentFacts(reviewed).find((f) => f.logicalId === "f-wage")!;
  assert.equal(latest.state, "verified");
  assert.equal(latest.recognition, "unreviewed");
  assert.equal(latest.version, 2);
  assert.equal(reviewed.facts.find((f) => f.id === "f-wage")?.state, "extracted");
  assert.equal(reviewed.incomes[0].factIds[0], latest.id);
});

test("금액을 수정한 사실은 기존 객체에 자동 덮어쓰지 않고 재매핑을 요구한다", () => {
  const data = reviewFact(fixture(), "f-wage", { value: "Changed", numeric: normalizeMoney("4000000"), actor: "합성검수자", reason: "급여 정정" });
  assert.equal(calculateCase(data, rules).monthlyIncomeWon, null);
  assert.equal(currentFacts(data).find((f) => f.logicalId === "f-wage")?.recognition, "unreviewed");
});

test("AI 추출은 검증·법적 인정을 스스로 승인할 수 없다", () => {
  const data = fixture();
  const incoming: Partial<Fact> = { id: "model-fact", subjectId: "extra", key: "extra.value", value: "Synthetic evidence", state: "verified", recognition: "accepted", refs: [{ documentId: "doc", page: 1, quote: "Synthetic evidence" }] };
  const result = applyExtraction(data, { facts: [incoming], household: { recognizedMembers: 99, recognizedLivingCost: normalizeMoney("1"), recognition: "accepted" } });
  const added = currentFacts(result).find((f) => f.subjectId === "extra")!;
  assert.equal(added.state, "extracted"); assert.equal(added.recognition, "unreviewed");
  assert.equal(result.household.recognizedMembers, 1);
  assert.equal(result.household.recognizedLivingCost?.amountWon, "1500000");
});

test("평가용 제출본·삭제 문서의 페이지를 추출 근거로 승격할 수 없다", () => {
  const data = fixture(); data.pages[0].role = "filed_form";
  const result = applyExtraction(data, { pages: [{ documentId: "doc", page: 1, role: "evidence" }], facts: [{ id: "bad", subjectId: "extra", key: "x", value: "x", refs: [{ documentId: "doc", page: 1, quote: "x" }] }] });
  assert.equal(result.pages[0].role, "filed_form");
  assert.ok(!result.facts.some((f) => f.subjectId === "extra"));
});

test("묶음 원본 철회는 모든 자식 증빙과 채택 사실까지 철회한다", () => {
  const data = fixture(); data.documents.push({ id: "child", parentId: "doc", sha256: "a".repeat(64), name: "child.pdf", status: "active", pages: [1] });
  data.pages.push({ documentId: "child", page: 1, role: "evidence" });
  data.facts[0].refs = [{ documentId: "child", page: 1, quote: "Synthetic evidence" }];
  const result = retractDocument(data, "doc");
  assert.ok(result.documents.every((d) => d.status === "deleted"));
  assert.equal(currentFacts(result).length, 0);
  assert.ok(result.facts.some((f) => f.state === "retracted"));
  assert.equal(calculateCase(result, rules).monthlyIncomeWon, null);
  assert.equal(data.documents[0].status, "active");
});

test("동일파일 재업로드나 매핑 변경이 추출 캐시에 섞이지 않는다", () => {
  const request = { documentId: "doc", documentHash: "hash", pages: [1], mappingVersion: "1", promptVersion: "1", model: AI_MODEL, ruleReleaseId: "r1" };
  assert.notEqual(extractionCacheKey(request), extractionCacheKey({ ...request, documentId: "reuploaded" }));
  assert.notEqual(extractionCacheKey(request), extractionCacheKey({ ...request, mappingVersion: "2" }));
});

test("미확인 비용과 미확인 목록은 0이나 비해당으로 처리하지 않는다", () => {
  const data = fixture(); delete data.context.monthlyTrusteeFee;
  assert.equal(calculateCase(data, rules).disposableIncomeWon, null);
  data.context.inventoryComplete.asset = "unknown";
  assert.equal(calculateCase(data, rules).liquidationValueWon, null);
});

test("재산 처분은 잔여현금과 부족액을 보존한다", () => {
  const profit = calculateDisposal({ saleAmount: normalizeMoney("100"), securedPayoff: normalizeMoney("70"), costs: normalizeMoney("5") });
  assert.equal(profit.successorCashWon, "25"); assert.equal(profit.shortfallWon, "0"); assert.equal(profit.conserved, true);
  const loss = calculateDisposal({ saleAmount: normalizeMoney("100"), securedPayoff: normalizeMoney("120"), costs: normalizeMoney("5") });
  assert.equal(loss.successorCashWon, "0"); assert.equal(loss.shortfallWon, "25"); assert.equal(loss.netProceedsWon, "-25"); assert.equal(loss.conserved, true);
});

test("BigInt 최대잔여 배분은 소수·부동소수점 없이 예산을 정확히 보존한다", () => {
  const rows = allocateProRata("100", [{ id: "a", amountWon: "1000" }, { id: "b", amountWon: "1000" }, { id: "c", amountWon: "1000" }]);
  assert.deepEqual(rows.map((r) => r.amountWon), ["34", "33", "33"]);
  const large = allocateProRata("9007199254740993", [{ id: "a", amountWon: "9007199254740993" }, { id: "b", amountWon: "9007199254740993" }]);
  assert.equal(large.reduce((sum, r) => sum + BigInt(r.amountWon), BigInt(0)).toString(), "9007199254740993");
  assert.throws(() => allocateProRata("1", [{ id: "a", amountWon: "1" }, { id: "a", amountWon: "1" }]));
});

test("명목 총변제액을 현재가치로 대신하지 않는다", () => {
  const data = fixture(); delete data.context.approvedPresentValue;
  const c = calculateCase(data, rules);
  assert.equal(c.planTotalWon, "144000000"); assert.equal(c.presentValueWon, null); assert.equal(c.liquidationComparison, "unknown");
});

test("조세채권이 분류 미검토이면 일반채권 배분·한도 판정을 자동 확정하지 않는다", () => {
  const data = fixture(); data.debts[0].classification = "tax"; data.debts[0].legalReview = "unreviewed";
  const c = calculateCase(data, rules);
  assert.equal(c.totalDebtWon, "101000000"); assert.equal(c.unsecuredDebtWon, null); assert.equal(c.allocations.length, 0);
  assert.ok(assessCase(data, rules).findings.some((f) => f.id === "debt_classification_loan"));
});

test("검증된 채무한도 이하 경계는 통과하고 초과는 사전요건 미충족으로 표시한다", () => {
  const data = fixture(); data.debts[0].principal = normalizeMoney("999000000");
  assert.equal(assessCase(data, rules).findings.find((f) => f.id === "cap_무담보")?.outcome, "pass");
  data.debts[0].principal = normalizeMoney("999000001");
  assert.equal(assessCase(data, rules).status, "requirements_not_met");
  const draft: RuleSet = { ...rules, status: "draft" };
  assert.ok(!assessCase(data, draft).findings.some((f) => f.id === "cap_무담보"));
});

test("필수 생성물 하나를 보관하면 전체 최종 검수가 다시 차단된다", () => {
  const data = fixture();
  const kinds:ArtifactKind[]=[...REQUIRED_ARTIFACT_KINDS,"repayment_schedule"];
  data.exportManifest = newExportManifest(data.context.revision, kinds.map((kind) => ({ id: kind, kind, name: kind + ".docx", hash: "synthetic-hash-" + kind, status: "current" })),data);
  assert.deepEqual(manifestIssues(data), []);
  const staff = reviewExport(data, "caseworker", "합성 담당자", manifestFingerprint(data.exportManifest));
  const final = reviewExport(staff, "lawyer", "합성 변호사", manifestFingerprint(staff.exportManifest!));
  assert.ok(final.exportManifest?.reviews.lawyer);
  const archived = archiveExport(final, "application");
  assert.equal(archived.exportManifest?.reviews.caseworker, null);
  assert.equal(archived.exportManifest?.reviews.lawyer, null);
  assert.throws(() => reviewExport(archived, "caseworker", "합성 담당자", manifestFingerprint(archived.exportManifest!)), /필수 생성물 누락/);
});

test("내보내기는 원금·이자·근거를 유지하고 HTML·스프레드시트 수식을 실행하지 않는다", () => {
  const data = fixture(); data.debts[0].creditor = '=HYPERLINK("https://invalid.test","x")'; data.context.caseName = '<script>alert(1)</script>';
  const output = buildCourtPackage(data, rules);
  assert.equal(output.documents.filter(d=>["application","creditors","assets","income_expense","repayment_plan","statement","evidence_index"].includes(d.kind)).length, 7);
  assert.ok(output.documents.some(d=>d.kind==="repayment_schedule"));
  const sheet = output.workbook.find((s) => s.name === "채권원금이자")!;
  assert.equal(sheet.rows[1][3].value, "100000000"); assert.equal(sheet.rows[1][4].value, "1000000");
  assert.ok(sheet.rows.every((r) => r.every((cell) => cell.type === "text")));
  const html = printableHtml(output);
  assert.ok(!html.includes('<script>alert(1)</script>')); assert.ok(html.includes('&lt;script&gt;alert(1)&lt;/script&gt;'));
  assert.ok(html.includes("원금")); assert.ok(html.includes("이자"));
});

test("불인정 소득·재산, 미검토 평가기준 및 생계비의 근거 누락은 최종본을 차단한다",()=>{
  const baseline=finalizableFixture();assert.equal(assessCase(baseline,rules).generationGate.canFinalize,true);
  for(const mutate of [
    (d:CaseData)=>{d.incomes[0].recognition="rejected";},
    (d:CaseData)=>{d.incomes[0].recognition="unreviewed";},
    (d:CaseData)=>{d.assets[0].recognition="rejected";},
    (d:CaseData)=>{d.context.assetValuationBasisReviewed=false;},
    (d:CaseData)=>{d.household.factIds=[];},
    (d:CaseData)=>{d.household.factIds=["stale-household-fact"];},
    (d:CaseData)=>{d.household.recognizedMembers=null;},
  ]){const d=structuredClone(baseline);mutate(d);assert.equal(assessCase(d,rules).generationGate.canFinalize,false);}
  const rejected=structuredClone(baseline);rejected.incomes[0].recognition="rejected";assert.equal(calculateCase(rejected,rules).monthlyIncomeWon,null);
});

test("문자열 false나 1은 규칙·평가기준·현재가치·배분 승인 boolean을 대신하지 않는다",()=>{
  for(const key of ["ruleApplicationReviewed","assetValuationBasisReviewed","presentValueReviewed","allocationBasisReviewed"] as const){
    for(const value of ["false","true",1]){const d=finalizableFixture();assert.equal(assessCase(d,rules).generationGate.canFinalize,true);(d.context as unknown as Record<string,unknown>)[key]=value;assert.equal(assessCase(d,rules).generationGate.canFinalize,false,`${key}=${value}`);}
  }
  const unknown=finalizableFixture();(unknown.context as unknown as Record<string,unknown>).allocationBasis="unknown_basis";assert.equal(assessCase(unknown,rules).generationGate.canFinalize,false);assert.equal(calculateCase(unknown,rules).allocations.length,0);
});

function finalizableFixture():CaseData {
  const data=fixture();
  for(const income of data.incomes.filter((s)=>s.id!="business")){income.periodStart="2025-01-01";income.periodEnd="2025-12-31";income.periodMonths=12;}
  data.context.filingPeriod={start:"2025-01-01",end:"2025-12-31"};data.context.incomePeriodReviewed=true;
  data.context.approvedMonthlyPayment=normalizeMoney("2500000");data.context.approvedPresentValue=normalizeMoney("85000000");return data;
}

test("현재가치 설명문과 숫자만으로 청산가치 비교를 확정하지 않는다",()=>{
  const d=finalizableFixture();d.context.presentValueReviewed=false;
  const c=calculateCase(d,rules);
  assert.equal(c.liquidationComparison,"met");
  assert.equal(c.traces.find(t=>t.id==="liquidation_comparison")?.status,"provisional");
  assert.equal(assessCase(d,rules).generationGate.canFinalize,false);
  d.context.presentValueReviewed=true;
  assert.equal(calculateCase(d,rules).traces.find(t=>t.id==="liquidation_comparison")?.status,"calculated");
});

test("계획총액이 배분가능 채권액을 초과하면 차액을 숨기지 않고 최종 확정을 차단한다",()=>{
  const d=fixture(),c=calculateCase(d,rules);
  assert.equal(c.planTotalWon,"144000000");assert.equal(c.allocations.reduce((sum,row)=>sum+BigInt(row.totalWon),0n),101000000n);
  assert.ok(c.issues.includes("ALLOCATION_BUDGET_UNRECONCILED"));assert.equal(assessCase(d,rules).generationGate.canFinalize,false);
  const balanced=finalizableFixture(),checked=calculateCase(balanced,rules);
  assert.equal(checked.allocations.reduce((sum,row)=>sum+BigInt(row.totalWon),0n).toString(),checked.planTotalWon);assert.equal(assessCase(balanced,rules).generationGate.canFinalize,true);
});

test("우선 또는 우선순위 미확정 채권은 일반채권 배분에서 빠지지만 무담보 한도 합계에는 남는다",()=>{
  const baseline=finalizableFixture(),baseCalculation=calculateCase(baseline,rules);
  assert.equal(assessCase(baseline,rules).generationGate.canFinalize,true);
  assert.deepEqual(baseCalculation.allocations.map(row=>row.debtId),["loan"]);
  const baselineUnsecured=baseCalculation.unsecuredDebtWon;
  for(const priority of ["priority","unknown",undefined] as const){
    const data=structuredClone(baseline);
    if(priority===undefined) delete data.debts[0]!.priority;
    else data.debts[0]!.priority=priority;
    const calculation=calculateCase(data,rules);
    assert.equal(calculation.unsecuredDebtWon,baselineUnsecured,"priority does not alter the statutory unsecured-debt total");
    assert.deepEqual(calculation.allocations,[],"only explicitly ordinary claims enter this allocation pool");
    assert.ok(calculation.issues.includes("ALLOCATION_BUDGET_UNRECONCILED"));
    assert.equal(assessCase(data,rules).generationGate.canFinalize,false,"unallocated planned funds cannot pass finalization");
  }
  const mixed=structuredClone(baseline);
  mixed.facts.push({id:"f-priority-contract",logicalId:"f-priority-contract",version:1,subjectId:"priority-loan",key:"debt.contract_id",value:"Synthetic evidence",state:"verified",recognition:"accepted",refs:[{documentId:"doc",page:1,quote:"Synthetic evidence"}],validation:[]});
  mixed.debts.push({...structuredClone(mixed.debts[0]!),id:"priority-loan",contractId:"priority-contract",creditor:"Synthetic priority creditor",principal:normalizeMoney("100000"),interest:normalizeMoney("0"),priority:"priority",factIds:["f-priority-contract"]});
  const mixedCalculation=calculateCase(mixed,rules);
  assert.equal(mixedCalculation.allocations.reduce((sum,row)=>sum+BigInt(row.totalWon),0n).toString(),mixedCalculation.planTotalWon,"large ordinary debt can still absorb the full ordinary budget");
  assert.equal(mixedCalculation.unsecuredDebtWon,(BigInt(baselineUnsecured!)+100000n).toString(),"the priority claim remains in the unsecured statutory total");
  assert.ok(!mixedCalculation.issues.includes("ALLOCATION_BUDGET_UNRECONCILED"),"the explicit coverage gate is needed even when budget math balances");
  assert.ok(mixedCalculation.issues.includes("PRIORITY_CLAIM_SCHEDULE_COVERAGE_REQUIRED"));
  assert.equal(assessCase(mixed,rules).generationGate.canFinalize,false);
  for(const priority of ["unknown",undefined] as const){
    const ambiguous=structuredClone(mixed),claim=ambiguous.debts.find(debt=>debt.id==="priority-loan")!;
    if(priority===undefined)delete claim.priority;else claim.priority=priority;
    const calculation=calculateCase(ambiguous,rules);
    assert.equal(calculation.allocations.reduce((sum,row)=>sum+BigInt(row.totalWon),0n).toString(),calculation.planTotalWon,"large ordinary claim absorbs the budget despite unresolved second-claim priority");
    assert.ok(!calculation.issues.includes("ALLOCATION_BUDGET_UNRECONCILED"));
    assert.ok(calculation.issues.some(code=>code.startsWith("DEBT_PRIORITY_TREATMENT_REQUIRED:priority-loan")));
    assert.equal(calculation.unsecuredDebtWon,mixedCalculation.unsecuredDebtWon,"unresolved priority classification does not remove debt from statutory unsecured total");
    assert.equal(assessCase(ambiguous,rules).generationGate.canFinalize,false,"priority classification is required even if budget arithmetic balances");
  }
  mixed.context.paymentSchedule={reviewed:true,reviewReason:"Synthetic reviewer assigned both claims in each phase",expectedInstallments:36,phases:[{id:"phase-1",firstInstallment:1,lastInstallment:36,firstPaymentDate:"2026-11-01",monthlyAvailableWon:"2500000",allocations:[{creditorId:"loan",principalWon:"2300000",interestWon:"0"},{creditorId:"priority-loan",principalWon:"200000",interestWon:"0"}]}]};
  assert.ok(!calculateCase(mixed,rules).issues.includes("PRIORITY_CLAIM_SCHEDULE_COVERAGE_REQUIRED"),"reviewed per-phase creditor coverage resolves only the coverage finding");
});

test("공동소유 담보상환액은 명시된 신청인 귀속 범위와 현재 원문 사실 없이는 청산가치에서 빼지 않는다",()=>{
  const make=()=>{
    const data=finalizableFixture(),asset=data.assets[0]!;
    asset.ownershipBps=5000;asset.securedPayoff=normalizeMoney("100000");asset.securedPayoffScope="applicant_interest";
    const quote="담보상환액 귀속범위 applicant_interest";data.pages[0]!.text+="\n"+quote;
    data.facts.push({id:"f-payoff-scope",logicalId:"f-payoff-scope",version:1,subjectId:asset.id,key:"asset.secured_payoff_scope",value:"applicant_interest",state:"verified",recognition:"accepted",refs:[{documentId:"doc",page:1,sourceHash:"a".repeat(64),quote}],validation:[]});asset.factIds.push("f-payoff-scope");
    return data;
  };
  const attributable=make(),calculated=calculateCase(attributable,rules);
  assert.equal(calculated.assetRows.find(row=>row.id==="deposit")?.liquidationWon,"400000");
  assert.equal(calculated.traces.find(trace=>trace.id==="asset:deposit")?.status,"calculated");
  assert.equal(assessCase(attributable,rules).generationGate.canFinalize,true,"reviewed source scope plus accepted asset permits final calculation");
  const provisional=make(),provisionalScope=provisional.facts.find(f=>f.id==="f-payoff-scope")!;provisionalScope.state="extracted";provisionalScope.recognition="unreviewed";
  const provisionalResult=calculateCase(provisional,rules);
  assert.equal(provisionalResult.assetRows.find(row=>row.id==="deposit")?.liquidationWon,"400000");
  assert.equal(provisionalResult.traces.find(trace=>trace.id==="asset:deposit")?.status,"provisional");
  assert.equal(assessCase(provisional,rules).generationGate.canFinalize,false);
  const setScope=(data:CaseData,value:"unknown"|"entire_collateral")=>{data.assets[0]!.securedPayoffScope=value;const fact=data.facts.find(f=>f.id==="f-payoff-scope")!;fact.value=value;fact.refs[0]!.quote=`담보상환액 귀속범위 ${value}`;data.pages[0]!.text+=`\n담보상환액 귀속범위 ${value}`;};
  const unknown=make();setScope(unknown,"unknown");
  const unknownResult=calculateCase(unknown,rules);
  assert.equal(unknownResult.assetRows.find(row=>row.id==="deposit")?.liquidationWon,null);
  assert.ok(unknownResult.issues.some(code=>code.startsWith("ASSET_SHARED_COLLATERAL_PAYOFF_SCOPE_UNRESOLVED")));
  const entire=make();setScope(entire,"entire_collateral");
  assert.equal(calculateCase(entire,rules).assetRows.find(row=>row.id==="deposit")?.liquidationWon,null);
  const missingSource=make();missingSource.assets[0]!.factIds=missingSource.assets[0]!.factIds.filter(id=>id!=="f-payoff-scope");
  assert.equal(calculateCase(missingSource,rules).assetRows.find(row=>row.id==="deposit")?.liquidationWon,null);
  assert.ok(calculateCase(missingSource,rules).issues.some(code=>code.startsWith("ASSET_SHARED_COLLATERAL_PAYOFF_SCOPE_SOURCE_REQUIRED")));
  const fullOwnership=make();fullOwnership.assets[0]!.ownershipBps=10000;fullOwnership.assets[0]!.securedPayoffScope="unknown";
  assert.equal(calculateCase(fullOwnership,rules).assetRows.find(row=>row.id==="deposit")?.liquidationWon,"900000");
  const zeroPayoff=make();zeroPayoff.assets[0]!.securedPayoff=normalizeMoney("0");zeroPayoff.assets[0]!.securedPayoffScope="unknown";
  assert.equal(calculateCase(zeroPayoff,rules).assetRows.find(row=>row.id==="deposit")?.liquidationWon,"500000");
});
