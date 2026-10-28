import { WORKFLOW_RULES } from "./workflow-rules.ts";
import { LEGAL_CATALOG, RISK_CATALOG, CURRENT_RULESET } from "./legal-rules.ts";
import legalExceptions from "./legal-exceptions.json" with {type:"json"};
import sourceContracts from "./document-agent-field-contracts.json" with { type: "json" };
import type { ArtifactKind } from "./domain.ts";

/** Executable boundaries, not a second implementation of the arithmetic. */
export const EXECUTION_CONTRACT_VERSION = "case-execution/1.0.0";
export interface CalculationSpec {
  id: string; title: string; executor: string; inputs: string[]; dependsOn: string[]; resultPaths: string[];
  outputs: string[]; documents: ArtifactKind[]; formBindings: string[];
  formula: string; rounding: string; decisionBoundary: string;
}
function spec(id:string,title:string,executor:string,inputs:string[],dependsOn:string[],outputs:string[],documents:ArtifactKind[],formBindings:string[],formula:string,rounding="정수 원화; 불명값은 null",decisionBoundary="입력의 사실 검증·법적 인정 상태를 유지하며 산술 결과만 반환") : CalculationSpec {
  const root=executor==="calculateCase"||executor==="assessCase"?"/result/assessment/calculation/":executor==="expandPaymentSchedule"?"/result/schedule/":executor==="buildLegalProposals"?"/result/proposals/":executor==="scanTransactions"?"/result/transactionReview/":executor==="calculateDisposal"?"/result/":"/result/";
  const resultPaths=id==="living_cost_proposal"?["/result/proposals/livingCost"]:id==="objection_minimum"?["/result/proposals/objectionMinimum"]:id==="seoul_short_term"?["/result/proposals/termCandidate"]:id==="form_projection"?["/result/formBindings"]:id==="installment_distribution"?["/result/documentPayloads"]:outputs.map(key=>root+key);
  return {id,title,executor,inputs,dependsOn,outputs,resultPaths,documents,formBindings,formula,rounding,decisionBoundary};
}
export const CALCULATION_SPECS: readonly CalculationSpec[] = [
  spec("income_average","소득원별 월평균","calculateCase",["income.kind","income.gross","income.expenses","income.net","income.amountBasis","income.periodStart","income.periodEnd","income.periodMonths"],[],["incomeRows"],["income_expense"],["rows.month"],"순소득 또는 (총수입−같은 기간 필요비용)을 명시된 월액/기간 기준으로 월평균 환산","1원 미만 내림; 기간 충돌·음수 소득은 검토"),
  spec("income_aggregation","소득원 동일성·기간 통합","calculateCase",["income.payerIdentityId","income.aggregationTreatment","income.recurring","context.filingPeriod","context.inventoryComplete.income"],["income_average"],["incomeGroups","monthlyIncomeWon"],["income_expense","repayment_plan"],["scalars.monthly_income"],"동일 지급자·소득유형·기간의 중복을 해소한 관측 평균; 독립 소득원 합산"),
  spec("debt_total","채권별 원금·이자 및 합계","calculateCase",["debt.creditor","debt.contractId","debt.principal","debt.interest","debt.asOf","context.inventoryComplete.debt"],[],["debtRows","debtPrincipalWon","debtInterestWon","totalDebtWon"],["creditors"],["scalars.total_principal","scalars.total_interest","rows.creditor"],"동일 채권·원문 행의 원금+이자; 별도 비용·양도·중복채권은 자동 합산하지 않음"),
  spec("debt_cap","담보·무담보 한도 비교","assessCase",["debt.secured","debt.classification","debt.guaranteeDetails","context.applicationDate","context.asOf","context.ruleReleaseId"],["debt_total"],["securedDebtWon","unsecuredDebtWon"],["application","creditors"],["scalars.secured_debt_total","scalars.unsecured_debt_total"],"신청 기준일의 분류된 채권 합계를 해당 판본의 각 한도와 비교",undefined,"보증·분쟁·특별채권의 분류가 미정이면 한도 판단 보류"),
  spec("asset_liquidation","재산별 청산가치","calculateCase",["asset.grossValue","asset.ownershipBps","asset.securedPayoff","asset.securedPayoffScope","asset.disposalCosts","asset.protectedValue","asset.asOf","asset.valuationBasis","context.inventoryComplete.asset"],[],["assetRows","liquidationValueWon"],["assets","repayment_plan"],["scalars.liquidation_value","rows.asset"],"max(0, 평가액×지분−신청인 지분에 귀속하는 담보상환액−처분비용−인정 면제액)","지분가액 1원 미만 올림; 법정 반올림 규칙이라는 의미 아님","면제·배우자 귀속·담보 범위는 별도 판단 입력"),
  spec("available_income","생계비 차감 후 가용소득","calculateCase",["household.recognizedLivingCost","household.additionalLivingCost","household.livingCostIncludesAdditional"],["income_aggregation"],["recognizedLivingCostWon","disposableIncomeWon"],["income_expense","repayment_plan"],["scalars.recognized_living_cost","scalars.monthly_disposable_income"],"세금·사회보험·사업비용 차감을 마친 순소득−인정 생계비; 같은 공제 재차 차감 금지"),
  spec("ordinary_budget","일반채권 월 변제예산","calculateCase",["context.monthlyTrusteeFee","context.monthlyPriorityPayment","context.monthlyEstatePayment","context.approvedMonthlyPayment"],["available_income"],["ordinaryRepaymentBudgetWon","monthlyPaymentWon"],["repayment_plan","repayment_schedule"],["scalars.ordinary_repayment_budget","scalars.monthly_payment"],"가용소득−회생위원 보수−별도 우선채권 변제−재단채권 변제; 명시된 월 변제액과 비교"),
  spec("nominal_plan","명목 총변제액","calculateCase",["context.planMonths"],["ordinary_budget"],["planTotalWon"],["repayment_plan","repayment_schedule"],["scalars.total_repayment","scalars.repayment_months"],"월 변제액×개월수; 단계별 일정이 있으면 별도 일정 대조",undefined,"명목 합계를 현재가치로 사용하지 않음"),
  spec("allocation","채권자별 변제액 배분","calculateCase",["debt.priority","debt.classification","context.allocationBasis","context.allocationBasisReviewed"],["debt_total","nominal_plan"],["allocations"],["creditors","repayment_plan","repayment_schedule"],["rows.creditor"],"명시적 배분방식에 따라 원금 비례 배분 후 잔액으로 이자 배분; 합계 보존","최대 나머지법·동률 ID 순서; 채권액 초과 배분 금지"),
  spec("liquidation_comparison","청산가치 보장 비교","assessCase",["context.approvedPresentValue","context.presentValueBasis","context.presentValueReviewed","context.assetValuationBasisReviewed"],["asset_liquidation","nominal_plan"],["presentValueWon","liquidationComparison"],["assets","repayment_plan"],["scalars.present_value","scalars.present_value_basis"],"동일 평가 기준의 계획 현재가치와 청산가치 비교",undefined,"할인율·법적 평가방법은 추정하지 않음"),
  spec("disposal_conservation","처분대금·잔존현금·부족액","calculateDisposal",["saleAmount","securedPayoff","costs"],[],["saleWon","payoffWon","costsWon","netProceedsWon","successorCashWon","shortfallWon","conserved","status"],["assets","statement"],[],"매각대금−담보상환−비용; 순유입과 부족액을 분리",undefined,"처분의 허가·부인 가능성 판단과 분리; 외부 원문을 재산행으로 자동 덮어쓰지 않음"),
  spec("payment_schedule","회차별·채권자별 일정","expandPaymentSchedule",["context.paymentSchedule.phases","context.paymentSchedule.expectedInstallments"],["allocation"],["status","rows","totals","phaseTotals","issues"],["repayment_schedule"],[],"단계별 월 배분×회차; 중복·공백·초과배분·총액 대조","명시된 최초 지급일·회차·배분만 사용; 지급일이나 누락 회차를 추정하지 않음"),
  spec("living_cost_proposal","생계비 산술 후보","buildLegalProposals",["context.applicationDate","context.courtId","household.recognizedMembers","household.additionalLivingCost"],[],["livingCost"],["income_expense"],[],"지원 연도·관할의 중위소득×60% 정확분수", "정확분수 유지; 법원의 인정 금액으로 자동 변환하지 않음","실제 부양·추가비용·적용 관할 판단 필요"),
  spec("objection_minimum","이의 사건 최소변제 비교","buildLegalProposals",["context.planApprovalDate","context.ruleReleaseId","context.courtObjection","claims.presentValue","plan.repaymentPresentValue","context.approvedPresentValue","context.presentValueReviewed"],[],["objectionMinimum"],["repayment_plan"],[],"인가일 채권총액 PV<5천만원:5%; 그 외:3%+1백만원; 최대3천만원; 계획 PV와 비교","정확분수 비교; 원 단위 최소 정수는 올림","이의가 있는 해당 판본에만 적용; 채권 PV와 계획 PV는 별개"),
  spec("seoul_short_term","서울 단축기간 후보","buildLegalProposals",["context.courtId","context.applicationDate","context.planMonths","vulnerable.wageHistory","debts.total","debts.privateCreditors","debts.lastYearDebt","applicant.age","legal.seoul424.statutory_severe_disability","household.minorChildren","household.singleParent","rentalFraud.officialDecision"],[],["termCandidate"],["repayment_plan","statement"],[],"제424호 요건별 후보성 확인",undefined,"자동 24개월·자동 승인 아님; 사람의 사건 적용 판단 필요"),
  spec("transaction_review","입출금·이체·처분 대조","scanTransactions",["transaction.date","transaction.accountId","transaction.counterparty","transaction.amount","transaction.direction","transaction.kind","transaction.relatedObjectId"],[],["items","transferCandidates","coverage","totals","policy"],["bank_accounts","assets","statement"],[],"동일 기간·계좌·거래 연결 대조 및 합계",undefined,"모든 입금을 소득으로, 모든 출금을 비용으로 분류하지 않음"),
  spec("form_projection","서식별 소계·가용액 기재","buildFormBindings",["asset.kind","income.kind","context.monthlyTrusteeFee","context.planMonths"],["income_aggregation","debt_total","asset_liquidation","available_income","ordinary_budget"],["formBindings"],["application","creditors","assets","income_expense","repayment_plan"],["scalars.form_pre_fee_disposable","scalars.form_available_after_trustee","scalars.form_total_available_after_trustee","scalars.monthly_business_income"],"공통 계산값을 서식 항목에 기재; 재산 유형별 소계·수입 유형별 소계 및 서식의 비용 차감 항목 분리",undefined,"build_document_payload 호출로 생성; 문서 초안 기재값은 법적 인정 상태와 별개"),
  spec("installment_distribution","검토용 회차별 배분표","proposedInstallmentAnnex",["context.planMonths","context.paymentSchedule"],["allocation"],["documentPayloads"],["repayment_schedule"],[],"동일 사건 계산 배분액을 회차별 분배하고 원금·이자·회차별 합계 보존 대조","정수 몫·나머지를 회차에 배분; 지급일 추정 안 함","build_document_payload에 포함; 검토용 제안과 확정 지급일정을 구분"),
];

const income = ["income_average","income_aggregation","available_income","ordinary_budget","nominal_plan"];
const debts = ["debt_total","debt_cap","allocation"];
const assets = ["asset_liquidation","liquidation_comparison"];
/** Every current workflow has an explicit route; no catch-all silently clears an unimplemented rule. */
export const WORKFLOW_CALCULATIONS: Readonly<Record<string, readonly string[]>> = {
  "WF-01":[],"WF-02":income,"WF-03":income,"WF-04":income,"WF-05":income,"WF-06":income,"WF-07":income,"WF-08":income,"WF-09":income,
  "WF-10":income,"WF-11":income,"WF-12":income,"WF-13":income,"WF-14":[...income,"transaction_review"],
  "WF-15":debts,"WF-16":[...debts,"ordinary_budget","payment_schedule"],"WF-17":[...debts,"ordinary_budget","payment_schedule"],"WF-18":[...debts,"ordinary_budget","payment_schedule"],
  "WF-19":[...debts,...assets],"WF-20":debts,"WF-21":debts,"WF-22":debts,"WF-23":[...debts,"transaction_review"],"WF-24":debts,"WF-25":[...debts,"payment_schedule"],
  "WF-26":assets,"WF-27":assets,"WF-28":assets,"WF-29":assets,"WF-30":assets,"WF-31":assets,"WF-32":assets,"WF-33":assets,"WF-34":assets,"WF-35":[...assets,"transaction_review"],"WF-36":assets,"WF-37":assets,
  "WF-38":["living_cost_proposal","available_income","ordinary_budget"],"WF-39":["living_cost_proposal","available_income","ordinary_budget"],
  "WF-40":[...assets,"disposal_conservation","transaction_review"],"WF-41":[...debts,"transaction_review"],"WF-42":assets,"WF-43":[...debts,...assets],"WF-44":[],"WF-45":[],
  "WF-46":["income_aggregation","debt_total","debt_cap","asset_liquidation","available_income","ordinary_budget","nominal_plan","allocation","liquidation_comparison","payment_schedule","objection_minimum","seoul_short_term","form_projection","installment_distribution"],
};

export function executionCatalog() {
  const workflows=WORKFLOW_RULES.map(rule=>({...rule,calculationIds:WORKFLOW_CALCULATIONS[rule.id]??[],node:"case_planner"}));
  return {
    version:EXECUTION_CONTRACT_VERSION,ruleReleaseId:CURRENT_RULESET.id,
    calculations:CALCULATION_SPECS,workflows,
    legalRules:LEGAL_CATALOG.map(rule=>({...rule,node:"legal_review",workflowIds:WORKFLOW_RULES.filter(w=>w.ruleIds.includes(rule.id)).map(w=>w.id),automaticCourtDecision:false})),
    risks:RISK_CATALOG.map(risk=>({...risk,node:"legal_review",automaticCourtDecision:false})),
    sourceFamilies:Object.values(sourceContracts.families),
    exceptions:legalExceptions.scenarios.map(scenario=>({...scenario,node:"legal_review",automaticCourtDecision:false})),
    scope:"현재 저장소의 규칙·산식·문서·추출 명세. 모든 현실 사건이나 모든 법원 재량을 구현했다는 뜻이 아님.",
  };
}
