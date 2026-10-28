import type { ArtifactKind, CaseData, Fact, Json, SourceRef } from "./domain.ts";
import { currentFacts, factHasValidStructuredRefs, factSourceLineageIssues, validSourceRef } from "./domain.ts";
import { assessCase, type Assessment } from "./assessment.ts";
import { CURRENT_RULESET, LEGAL_CATALOG } from "./legal-rules.ts";

export type WorkflowStatus = "pass" | "fail" | "missing" | "conflict" | "not_applicable";
type Scope = "case" | "income" | "debt" | "asset" | "transaction";
export interface WorkflowTarget { kind: ArtifactKind; section: string; field: string }
export interface WorkflowField {
  key: string; label: string; unit?: string; period?: string;
  aliases?: string[]; crossChecks: string[]; targets: WorkflowTarget[];
  validation?: "nonnegative_money" | "positive_integer" | "date" | "ownership_bps";
}
export interface WorkflowDocument {
  type: string; label: string; why: string; fields: WorkflowField[];
  alternatives?: string[]; requirement: "required_when_applicable" | "conditional" | "court_ordered";
}
export interface WorkflowRule {
  id: string; title: string; scope: Scope;
  activation: { feature: string; op: "eq" | "in" | "gt" | "exists"; value?: Json }[];
  activationMode?: "all" | "any";
  documents: WorkflowDocument[]; ruleIds: string[];
  missingAction: string; disposalConsiderations: string[]; legalReviewRequired: boolean;
}
type Subject = { id: string; scope: Scope; value: Record<string, unknown>; factIds: string[] };
interface Cell { status: WorkflowStatus; value: Json | null; reason: string; facts: Fact[] }
interface WorkflowIndex {
  facts: Fact[];
  byKey: Map<string, Fact[]>;
  ledgerOrder: Map<string, number>;
  objectIds: Set<string>;
  householdFactIds: Set<string>;
  subjectFactIds: Map<string, Set<string>>;
  sourceValid: Map<string, boolean>;
  sourceReady: Map<string, boolean>;
  cells: Map<string, Cell>;
}
function workflowIndex(data: CaseData): WorkflowIndex {
  const facts = currentFacts(data), byKey = new Map<string, Fact[]>();
  for (const fact of facts) { const values = byKey.get(fact.key) ?? []; values.push(fact); byKey.set(fact.key, values); }
  const objects = [...data.incomes, ...data.debts, ...data.assets, ...data.transactions];
  return { facts, byKey, ledgerOrder: new Map(facts.map((f,i)=>[f.id,i])), objectIds: new Set(objects.map(o => o.id)), householdFactIds: new Set(data.household.factIds), subjectFactIds: new Map(objects.map(o => [o.id, new Set(o.factIds)])), sourceValid: new Map(), sourceReady: new Map(), cells: new Map() };
}

const target = (kind: ArtifactKind, section: string, field: string): WorkflowTarget => ({ kind, section, field });
const incomeTarget = (field: string) => target("income_expense", "D5103 / 수입의 상황", field);
const assetTarget = (field: string) => target("assets", "D5101 / 재산목록", field);
const debtTarget = (field: string) => target("creditors", "D5106 / 채권자목록 및 부속명세", field);
const appTarget = (field: string) => target("application", "D5100·D5105 / 신청서·진술", field);
const planTarget = (field: string) => target("repayment_plan", "D5110·D5111 / 변제계획안", field);
function field(key: string, label: string, targets: WorkflowTarget[], options: Partial<WorkflowField> = {}): WorkflowField {
  return { key, label, targets, crossChecks: ["동일 대상·기준일의 원문과 대조", "서로 다른 문서의 중복 합산 방지"], ...options };
}
const money = (key: string, label: string, targets: WorkflowTarget[], options: Partial<WorkflowField> = {}) => field(key, label, targets, { unit: "KRW", validation: "nonnegative_money", ...options });
const date = (key: string, label: string, targets: WorkflowTarget[], options: Partial<WorkflowField> = {}) => field(key, label, targets, { unit: "YYYY-MM-DD", validation: "date", ...options });
const doc = (type: string, label: string, why: string, fields: WorkflowField[], alternatives: string[] = [], requirement: WorkflowDocument["requirement"] = "required_when_applicable"): WorkflowDocument => ({ type, label, why, fields, alternatives, requirement });
const eq = (feature: string, value: Json) => ({ feature, op: "eq" as const, value });
const flag = (feature: string) => [eq(feature, true)];
const kind = (scope: Scope, value: string) => [eq(`${scope}.kind`, value)];
const legal = (...numbers: number[]) => numbers.map(n => `KR-PR-${String(n).padStart(3, "0")}`);
const sourcePeriod = (): WorkflowField[] => [
  date("income.periodStart", "소득 산정 시작일", [incomeTarget("산정기간 시작")], { period: "실제 소득 귀속기간" }),
  date("income.periodEnd", "소득 산정 종료일", [incomeTarget("산정기간 종료")], { period: "실제 소득 귀속기간", crossChecks: ["시작일 이후인지 확인", "과세연도·급여월·입금일 구분"] }),
  field("income.amountBasis", "월액/기간합계 구분", [incomeTarget("월평균 환산 근거")]),
];
const wageDocs = (): WorkflowDocument[] => [
  doc("salary_withholding", "원천징수·급여명세", "급여 총액·공제·실수령과 귀속기간 확인", [
    field("income.employer", "사용자·직장", [incomeTarget("직장명")]),
    money("income.gross", "급여 총액", [incomeTarget("급여 총액")]),
    money("income.net", "실수령액", [incomeTarget("공제 후 수입")]), ...sourcePeriod(),
  ], ["salary_statement", "employer_income_certificate"]),
  doc("employment_certificate", "재직·고용관계 증빙", "계속적·정기적 수입 가능성 검토", [
    field("income.recurring", "수입의 계속 가능성", [incomeTarget("계속 수입 근거"), appTarget("직업·수입")]),
    field("income.contract", "고용형태·계약기간", [incomeTarget("고용관계")]),
  ], ["employment_contract"]),
  doc("salary_bank_statement", "급여 입금내역", "급여명세와 실제 지급액 대조", [
    money("income.salaryDeposits", "해당 기간 급여 입금액", [target("evidence_index", "급여 대조", "입금 근거")], { period: "급여 귀속기간과 대응", crossChecks: ["동일 사용자·급여월·실수령액 대조", "자기이체·대출입금 제외 검토"] }),
  ], ["bank_statement"], "conditional"),
];
const businessDocs = (): WorkflowDocument[] => [
  doc("business_registration", "사업자·영업현황", "사업체·업종·개폐업 및 계속성 확인", [
    field("income.businessName", "사업체명", [incomeTarget("사업체명")]),
    field("income.businessType", "업종", [incomeTarget("업종")]),
    field("income.recurring", "계속 영업 가능성", [incomeTarget("계속 수입 근거")]),
  ]),
  doc("business_income_report", "사업 수입·비용·순소득", "매출과 순소득을 분리하고 월평균 산출", [
    money("income.gross", "매출/총수입", [incomeTarget("영업 총수입")]),
    money("income.expenses", "필요 사업비용", [incomeTarget("영업 필요비용")]),
    field("income.net", "사업 순소득", [incomeTarget("영업 순수입")], { unit: "KRW", crossChecks: ["같은 기간 총수입−비용과 대조", "개인생계비와 이중 공제 여부"] }), ...sourcePeriod(),
  ], ["vat_certificate", "income_amount_certificate", "financial_statement", "sales_purchase_summary"]),
];
const debtDocs = (): WorkflowDocument[] => [doc("debt_certificate", "채권별 잔액·계약 증빙", "신청 기준 채권자·원금·이자·성립원인 확인", [
  field("debt.creditor", "현재 채권자", [debtTarget("성명·명칭")]),
  field("debt.contractId", "계약·채권 식별자", [debtTarget("채권 원인·식별")]),
  money("debt.principal", "채권 원금", [debtTarget("원금")]),
  money("debt.interest", "채권 이자", [debtTarget("이자")]),
  date("debt.asOf", "잔액 산정 기준일", [debtTarget("채권 산정기준일")], { crossChecks: ["신청일·사건 산정기준일 대조", "발급일과 잔액 기준일 구분"] }),
  field("debt.cause", "채권 발생원인", [debtTarget("발생원인")]),
], ["loan_contract", "creditor_reply", "judgment"])];
const assetDocs = (type: string, label: string): WorkflowDocument[] => [doc(type, label, "소유·기준일·시가·권리 제한과 청산가치 기초 확인", [
  field("asset.label", "재산 식별·내역", [assetTarget("재산의 종류·내역")]),
  money("asset.grossValue", "재산 평가액", [assetTarget("시가·평가액")]),
  field("asset.ownershipBps", "신청인 소유지분", [assetTarget("지분")], { unit: "basis_points", validation: "ownership_bps" }),
  date("asset.asOf", "평가 기준일", [assetTarget("평가 기준일")]),
  field("asset.valuationBasis", "평가 방법·근거", [assetTarget("시가산정자료")]),
], ["asset_ownership_evidence", "asset_valuation_evidence"])];
const eventDoc = (type: string, label: string, key: string, targetField: WorkflowTarget) => doc(type, label, "해당 사실과 금액·기간을 원문으로 확인", [field(key, label, [targetField])]);
function workflow(id: string, title: string, scope: Scope, activation: WorkflowRule["activation"], documents: WorkflowDocument[], ruleIds: string[], missingAction: string, disposalConsiderations: string[] = [], legalReviewRequired = true): WorkflowRule {
  return { id, title, scope, activation, documents, ruleIds, missingAction, disposalConsiderations, legalReviewRequired };
}

/** Situations compose additively; salaried + business + rental cases activate all relevant branches. */
export const WORKFLOW_RULES: WorkflowRule[] = [
  workflow("WF-01", "신청인·관할·절차 기준일", "case", flag("case.always"), [
    doc("resident_registration", "신분·주소·가족 자료", "신청인과 관할 및 부양관계의 기초 확인", [
      field("applicant.name", "신청인 성명", [appTarget("성명")]), field("applicant.address", "현재 주소", [appTarget("주소·관할")]),
      date("case.applicationDate", "신청일·예정일", [appTarget("신청일")]), field("case.courtId", "관할 법원", [appTarget("관할 법원")]),
    ], ["family_relation", "foreign_registration"]),
  ], legal(1,2,3,11,12), "신청일·관할·주민등록 및 실제 거주·근무 근거를 확인하세요."),
  workflow("WF-02", "급여 근로자", "income", kind("income", "wage"), wageDocs(), legal(4,14,15,19,20), "직장별 급여·재직·지급내역과 산정기간을 연결하세요."),
  workflow("WF-03", "사업 소득자", "income", kind("income", "business"), businessDocs(), legal(5,16,18,19,20), "사업체별 매출·비용·세무자료와 실제 영업기간을 보완하세요.", ["폐업·설비 처분 시 잔존재고·처분대금·계속 수입 감소를 함께 계산"]),
  workflow("WF-04", "근로·사업·부수입 겸업", "case", flag("case.multipleIncomeSources"), [
    doc("income_source_inventory", "소득원별 전체 목록", "각 직장·사업·임대·기타소득 누락·중복 확인", [field("case.incomeInventoryComplete", "전체 소득원 조사 완료", [incomeTarget("수입 합계의 조사범위")]), field("income.sources", "소득원과 기간 연결", [incomeTarget("소득원별 내역")])]),
  ], legal(4,5,17,20), "소득원별 고유 ID를 부여하고 각 소득원의 증빙·기간·비용을 따로 연결하세요."),
  workflow("WF-05", "임대 소득", "income", kind("income", "rent"), [doc("lease_contract", "임대차·임대료 입금", "임대료와 보증금 및 필요비용 분리", [money("income.gross", "임대료 수입", [incomeTarget("임대 수입")]), money("income.expenses", "임대 관련 필요비용", [incomeTarget("임대 필요비용")]), field("income.recurring", "임대 수입 지속성", [incomeTarget("계속성")]), ...sourcePeriod()])], legal(5,17,18,20), "임대물건·계약기간·월세수령·보증금 반환채무를 대조하세요.", ["매각 시 임대수입 중단과 임차보증금 반환·담보 상환 후 대금을 동시 검토"]),
  workflow("WF-06", "이자 소득", "income", kind("income", "interest"), [doc("interest_income_statement", "이자 지급·계좌 증빙", "지급기간·원천세·원금자산과 이자 구분", [money("income.gross", "이자 총액", [incomeTarget("기타 수입")]), money("income.net", "공제 후 이자", [incomeTarget("순수입")]), ...sourcePeriod()])], legal(17,19,20,27), "원금 잔액과 이자 지급을 분리하고 동일 기간 원천징수 내역을 연결하세요."),
  workflow("WF-07", "배당 소득", "income", kind("income", "dividend"), [doc("dividend_statement", "배당·증권계좌 증빙", "배당 귀속기간과 반복성 및 보유주식 대조", [money("income.gross", "배당 총액", [incomeTarget("배당 수입")]), field("income.recurring", "반복 가능성", [incomeTarget("수입 지속성")]), ...sourcePeriod()])], legal(17,19,20,27), "일회성 배당과 장래 반복 수입을 구분하여 검토하세요."),
  workflow("WF-08", "연금 수급", "income", kind("income", "pension"), [doc("pension_certificate", "연금 수급·지급증명", "연금 종류·수급기간·실지급·보호범위 확인", [field("income.pensionType", "연금 유형", [incomeTarget("연금 종류")]), money("income.net", "연금 실수령액", [incomeTarget("연금 수입")]), field("income.recurring", "수급 지속성", [incomeTarget("계속성")]), ...sourcePeriod()])], legal(4,17,31), "연금 종류와 지급내역 및 보호 법률의 적용 범위를 검토하세요."),
  workflow("WF-09", "복지급여·지원금", "income", kind("income", "benefit"), [doc("benefit_award", "급여·지원 결정 및 입금", "급여 성질·기간·사용제한·압류금지 확인", [field("income.benefitType", "급여 성질", [incomeTarget("기타 수입의 성질")]), money("income.net", "지원금 실수령", [incomeTarget("기타 수입")]), field("income.protectionGround", "보호·사용제한 근거", [assetTarget("보호재산 근거")]), ...sourcePeriod()])], legal(17,31), "지원금을 일률적 가용소득으로 처리하지 말고 결정문·근거 법령을 검토하세요."),
  workflow("WF-10", "이직·신규취업·휴직·복직", "income", flag("income.employmentChanged"), [...wageDocs(), eventDoc("employment_history", "직장·근무기간 변동", "income.employmentChanges", incomeTarget("변동 후 평균 산정기간"))], legal(4,15), "변동 전후 자료를 구분하고 현재 직장 이후의 실제 소득을 평균하세요."),
  workflow("WF-11", "일용·프리랜서·플랫폼 소득", "income", flag("income.variableWork"), [doc("platform_settlement", "계약·정산·입금 내역", "근무형태와 무관하게 실제 반복 수입 확인", [field("income.contract", "노무 제공·계약 관계", [incomeTarget("직업·계약")]), money("income.gross", "정산 전 수입", [incomeTarget("총수입")]), money("income.expenses", "수수료·필요비용", [incomeTarget("필요비용")]), field("income.recurring", "반복 가능성", [incomeTarget("계속성")]), ...sourcePeriod()])], legal(4,5,15,16,18), "플랫폼별 정산기간·수수료·실입금과 미정산 채권을 대조하세요."),
  workflow("WF-12", "계절성·변동 수입", "income", flag("income.seasonal"), [doc("seasonal_income_report", "기간별 수입·비용표", "월별 변동과 지급주기에 맞춘 계획 검토", [money("income.gross", "기간 총수입", [incomeTarget("총수입")]), field("income.seasonality", "수입 발생주기", [planTarget("변제주기")]), ...sourcePeriod()])], legal(15,16,48), "누락월과 무수입월을 구분하고 수개월 간격 변제는 법원 허가 필요성을 검토하세요."),
  workflow("WF-13", "휴업·폐업·사업 양도", "income", flag("income.closedOrSuspended"), [eventDoc("closure_certificate", "휴폐업일·사유", "income.closure", appTarget("소득변동 경위")), eventDoc("business_liquidation", "폐업정산·재고·보증금·매각대금", "income.liquidationDetails", assetTarget("폐업 잔여재산"))], legal(5,16,27,30), "폐업 사실과 처분 후 잔존재산 및 대체 소득원을 확보하세요.", ["사업자등록 폐업만으로 재산가액을 0원으로 만들 수 없음", "설비·재고·보증금의 처분대금과 대체현금 추적"]),
  workflow("WF-14", "급여 압류·전부명령", "income", flag("income.garnished"), [eventDoc("garnishment_order", "압류·추심·전부명령 및 확정", "income.garnishment", debtTarget("전부명령 등 내역")), eventDoc("employer_withholding", "회사 공제·보관·송금 내역", "income.garnishedAmounts", incomeTarget("실제 지급과 보관금"))], legal(10,19,38,48), "명령 대상·송달·확정·회사 보관액과 실제 가용 현금을 검토하세요."),
  workflow("WF-15", "채권별 잔액과 목록", "debt", flag("debt.exists"), debtDocs(), legal(6,7,10,13), "원금·이자·기준일과 현재 채권자를 모두 확인하세요."),
  workflow("WF-16", "조세·사회보험 체납", "debt", [{ feature: "debt.classification", op: "in", value: ["tax", "social_insurance"] }], [...debtDocs(), doc("tax_arrears", "체납·고지·납기 증명", "세목·기간·납기와 우선·재단·비면책을 독립 검토", [field("debt.taxType", "세목·보험 종류", [debtTarget("조세채권 성질")]), date("debt.dueDate", "납부기한", [debtTarget("납기")]), field("debt.taxPeriod", "귀속 과세기간", [debtTarget("귀속기간")]), field("debt.priority", "우선권 성질", [planTarget("우선채권 변제")])])], legal(19,33,36,37), "체납 원장과 납기를 확보하고 세금·사회보험을 일괄 재단채권으로 분류하지 마세요."),
  workflow("WF-17", "재단·일반 우선권 채권", "debt", [{ feature: "debt.priority", op: "in", value: ["estate", "priority"] }], [...debtDocs(), eventDoc("priority_basis", "재단·우선권 근거와 해당 조문", "debt.priorityBasis", planTarget("전액 변제 및 지급시기"))], legal(33,34,35,36), "우선순위·재단채권 여부와 계획 전액 변제 재원을 검토하세요."),
  workflow("WF-18", "직원 임금·퇴직금·보관금", "debt", flag("debt.employeeClaim"), [...debtDocs(), eventDoc("employee_wage_claim", "고용관계·미지급 임금·퇴직금", "debt.employeeClaimDetails", debtTarget("피용자 채권"))], legal(34,36,37), "사용자로서의 채무와 신청인 본인의 급여소득을 분리하세요."),
  workflow("WF-19", "담보부 채권·별제권", "debt", [eq("debt.secured", true)], [...debtDocs(), doc("security_register", "담보설정·목적물 평가", "권리순위·회수가능액·부족액 검토", [field("debt.collateralId", "담보 목적물", [debtTarget("별제권 목적물")]), field("debt.securityRank", "담보권 순위", [debtTarget("권리순위")]), money("debt.expectedSeparateRecovery", "예상 별제권 변제액", [debtTarget("별제권 예상변제액")]), money("debt.deficiency", "예상 부족액", [debtTarget("담보부족 예상액")])])], legal(6,32,36,43), "담보권 종류·순위와 목적물 시가를 확인하고 부족액의 분류를 검토하세요.", ["매각대금에서 담보상환·비용을 공제한 대체현금과 채무부족액을 동시에 반영"]),
  workflow("WF-20", "보증·연대채무·구상", "debt", flag("debt.guarantee"), [...debtDocs(), eventDoc("guarantee_contract", "보증·주채무·구상 관계", "debt.guaranteeDetails", debtTarget("보증·구상 채권"))], legal(10,37), "주채무·보증 범위·청구와 실제 대위변제 여부를 대조하세요."),
  workflow("WF-21", "채권양도·대위변제", "debt", flag("debt.transferred"), [eventDoc("assignment_notice", "양도·대위변제 통지와 금액", "debt.assignment", debtTarget("현재 채권자·승계 내역")), ...debtDocs()], legal(10,38), "구·신 채권자를 동일 채무에 연결하고 중복합산을 막으세요."),
  workflow("WF-22", "가족·지인·개인채권자", "debt", flag("debt.privateCreditor"), [...debtDocs(), eventDoc("private_loan_transfer", "차용 경위·실제 교부·상환", "debt.privateLoanEvidence", debtTarget("사인 채권 발생·잔액"))], legal(10,39,40), "차용증만 아니라 실제 자금교부·잔액과 특수관계를 확인하세요."),
  workflow("WF-23", "최근 대출·카드대출", "debt", flag("debt.recentBorrowing"), [...debtDocs(), doc("loan_use_of_funds", "차입일·사용처·대환 흐름", "최근 차입의 실질 용도와 기존채무 상환 연결", [date("debt.incurredAt", "차입일", [appTarget("채무증대 경위")]), field("debt.useOfFunds", "사용처·대환채무", [appTarget("채무사용처 진술")])])], legal(39,42), "최근 비율만으로 기각 결론을 내리지 말고 사용처·대환 관계를 소명하세요."),
  workflow("WF-24", "소송·다툼 있는 채권", "debt", [eq("debt.classification", "disputed")], [...debtDocs(), doc("litigation_record", "판결·소송·이의 자료", "주장액·인정액·쟁점·확정 여부 분리", [money("debt.claimedAmount", "채권자 주장액", [debtTarget("다툼 있는 채권액")]), money("debt.undisputedAmount", "다툼 없는 금액", [debtTarget("다툼 없는 금액")]), field("debt.disputeReason", "쟁점·진행상태", [debtTarget("다툼의 원인·경과")])])], legal(38), "최종 확정 여부와 이의기간을 확인할 때까지 다툼 금액을 유지하세요."),
  workflow("WF-25", "벌금·불법행위·부양 채무", "debt", [{ feature: "debt.classification", op: "in", value: ["non_dischargeable"] }], [...debtDocs(), eventDoc("claim_legal_basis", "발생원인·확정판결·부양의무", "debt.nonDischargeGround", debtTarget("면책 제외 사유"))], legal(37), "비면책 사유와 금액·확정 여부를 채권별로 검토하세요."),
  workflow("WF-26", "차량·이륜차", "asset", kind("asset", "vehicle"), [...assetDocs("vehicle_registration", "차량등록·시가자료"), moneyDocument("vehicle_lien", "차량 담보잔액", "asset.securedPayoff", "담보 상환액")], legal(27,31,32,43), "차량 식별·소유지분·시가·할부/담보 잔액을 대조하세요.", ["매각 후 대체현금과 잔여 할부채무 계산", "영업용 차량이면 처분에 따른 소득 감소도 검토"]),
  workflow("WF-27", "임차보증금·전월세", "asset", kind("asset", "lease_deposit"), [...assetDocs("lease_contract", "주거 계약·보증금"), eventDoc("deposit_rights", "보증금 반환권·양도·질권·보호 근거", "asset.depositRights", assetTarget("보증금 권리·보호"))], legal(23,27,31,32), "보증금 실제 지급·미반환·담보와 지역별 보호기준을 검토하세요.", ["이사·반환 시 종전 보증금과 새 보증금/현금의 연결 유지"]),
  workflow("WF-28", "부동산 소유", "asset", kind("asset", "real_estate"), [...assetDocs("real_estate_register", "등기·시가·지분"), moneyDocument("mortgage_balance", "담보권별 상환예정액", "asset.securedPayoff", "담보부담")], legal(27,30,31,32,43), "공동지분·후순위 권리·임차인 보증금·시가를 함께 대조하세요.", ["매각가격·세금/비용·담보정산·잔여현금과 임대소득 변화 검토"]),
  workflow("WF-29", "배우자 명의·가족 명의 재산", "case", flag("case.spouseAssets"), [eventDoc("spouse_asset_evidence", "배우자 소유·취득자금·명의 관계", "spouse.assets", assetTarget("배우자 재산 별도 검토")), eventDoc("spouse_transfer_evidence", "신청인 자금·배우자 이전 경위", "spouse.transfers", assetTarget("실질 귀속·부인 대상 검토"))], legal(28,30), "배우자 자산을 일률적으로 절반 합산하지 말고 명의·실질 귀속을 조사하세요.", ["가족 이전과 명의신탁 의심은 원인·대가·자금원 검토"]),
  workflow("WF-30", "사업 재고·설비·비품", "asset", kind("asset", "business"), [...assetDocs("business_asset_inventory", "사업자산 목록·평가"), eventDoc("business_asset_use", "영업 필요성과 처분 가능성", "asset.businessUse", assetTarget("사업자산 용도"))], legal(18,27,30,43), "재고수량·실현가치·리스/소유 구분과 영업 필요성을 확인하세요.", ["처분대금과 대체현금 추적", "장부가와 실현가능가치 구분", "매각 시 장래 영업수입 변동 반영"]),
  workflow("WF-31", "보험·보험계약 대출", "asset", kind("asset", "insurance"), [...assetDocs("insurance_surrender_statement", "보험계약·해약환급금"), moneyDocument("insurance_loan_statement", "보험계약 대출잔액", "asset.securedPayoff", "보험대출 상계·부담"), eventDoc("insurance_protection", "보험금·보호 범위 근거", "asset.protectionGround", assetTarget("보호액 근거"))], legal(27,31), "계약자·수익자·해약환급금·계약대출을 구분하세요.", ["해약 시 실제 수령액과 계약대출 처리 및 보장 상실 검토"]),
  workflow("WF-32", "퇴직금·퇴직연금·공제회", "asset", kind("asset", "retirement"), [...assetDocs("retirement_estimate", "퇴직급여 예상·잔액"), eventDoc("retirement_type", "급여제도·지급청구·보호 근거", "asset.retirementType", assetTarget("퇴직급여 성질·보호"))], legal(27,31), "퇴직금과 퇴직연금 제도 및 압류금지 범위를 구분하여 검토하세요.", ["실제 퇴직·중간정산 시 수령액·소득중단·보호범위 변화를 검토"]),
  workflow("WF-33", "가상자산", "asset", [eq("asset.subtype", "crypto")], [...assetDocs("crypto_balance", "거래소·지갑 잔고·시가"), eventDoc("crypto_transactions", "입출고·매매·손실 흐름", "asset.investmentHistory", assetTarget("가상자산 보유·처분") )], legal(27,29,30), "거래소·개인지갑의 현재 보유와 실현손실·외부이전을 대조하세요.", ["보유자산과 투자손실은 별개", "처분대금이 현금/다른 자산으로 이동한 경로 추적"]),
  workflow("WF-34", "상장·비상장 주식·펀드", "asset", [{ feature: "asset.subtype", op: "in", value: ["stock", "fund", "equity"] }], [...assetDocs("securities_balance", "증권 잔고·평가자료"), eventDoc("securities_transactions", "매매·출자·처분 흐름", "asset.investmentHistory", assetTarget("주식·출자금 내역"))], legal(27,29,30), "보유수량·기준일 가격·비상장 평가근거와 손실 내역을 분리하세요.", ["매각 후 현금·채무상환·다른 투자 전환을 연결"]),
  workflow("WF-35", "현금·예금·적금·외화", "asset", [{ feature: "asset.kind", op: "in", value: ["cash", "deposit"] }], assetDocs("bank_balance_certificate", "계좌별 잔고·잔액증명"), legal(27,31), "계좌 전체 조사와 같은 기준일 잔액·압류·담보·통화를 확인하세요.", ["계좌이체는 자산 소멸이 아님", "환전 시 환율 기준과 원화 평가 검토"]),
  workflow("WF-36", "대여금·매출채권·공탁·환급", "asset", kind("asset", "receivable"), [...assetDocs("receivable_statement", "채권·환급·공탁 근거"), eventDoc("receivable_collectability", "회수가능성·분쟁·기한", "asset.collectability", assetTarget("채권 회수가능가치"))], legal(27,31,38), "명목채권액과 현실적인 회수가능가액 및 미정산 기간을 검토하세요.", ["회수 시 기존 채권을 줄이고 수령현금을 연결하여 중복합산 방지"]),
  workflow("WF-37", "개인택시·운송 면허·영업권", "asset", [eq("asset.subtype", "taxi_license")], [...assetDocs("taxi_license", "개인택시 면허·차량·영업권"), eventDoc("taxi_transfer_valuation", "양도가능성·거래평가·제한", "asset.transferability", assetTarget("영업권 평가 근거")), eventDoc("taxi_operating_income", "운송매출·운영비·영업 지속", "asset.relatedIncome", incomeTarget("운송업 소득 연결"))], legal(5,18,27,30,31), "면허·차량·영업권의 중복 평가와 양도 요건을 개별 검토하세요.", ["면허·차량 처분은 영업소득 감소와 연동", "양도 제한·필요비용·대체소득 확인"]),
  workflow("WF-38", "부양가족·배우자·성년자녀", "case", flag("case.dependents"), [doc("dependent_evidence", "가족관계·실제부양·소득", "가구원과 실제 피부양자를 구분", [field("household.recognizedMembers", "검토 인정 가구원 수", [target("income_expense", "지출·생계비", "가구원 수")], { validation: "positive_integer" }), field("household.dependentDetails", "대상별 관계·연령·소득·실제부양", [target("income_expense", "부양가족", "대상별 인정 근거")])], ["family_relation", "dependent_income_certificate"])], legal(21,22), "각 부양가족의 소득·연령·돌봄·실제 생활비 부담과 중복 부양을 확인하세요."),
  workflow("WF-39", "추가 주거·의료·교육비", "case", flag("case.additionalLiving"), [doc("additional_living_evidence", "추가 지출 사유·계약·영수증", "필요한 반복 지출과 기본생계비 포함분 구분", [money("household.additionalLivingCost", "검토 추가 생계비", [target("income_expense", "지출·생계비", "추가 생계비")]), field("household.additionalLivingBasis", "비용별 필요성·기간·근거", [target("income_expense", "지출·생계비", "추가사유")])])], legal(21,23,24,25,26), "금액 표만 적용하지 말고 실제 반복지출·가구·지역·기본 포함분을 검토하세요."),
  workflow("WF-40", "재산 처분·증여·고액 출금", "case", flag("case.disposals"), [doc("disposal_records", "처분계약·대금·사용처", "처분재산과 대체재산·현금·채무감소 연결", [field("disposals.assets", "처분재산·일자·상대방", [assetTarget("처분 내역")]), money("disposals.proceeds", "처분대금", [assetTarget("처분대금·대체현금")]), field("disposals.useOfFunds", "대금 사용처·잔존재산", [assetTarget("사용처·대체재산")])])], legal(27,30,32,43), "처분원장과 입출금, 채무상환, 대체재산을 연결하세요.", ["자산 삭제만으로 청산가치 축소 금지", "동일 대금·대체자산 중복합산 금지", "양도 관련 비용과 부족 채무 별도 추적"]),
  workflow("WF-41", "편파변제·가족 이전", "case", flag("case.preferencePayments"), [eventDoc("selective_payment_records", "선택적 상환·가족 이전 및 대가", "transactions.preferenceDetails", appTarget("자금거래 경위"))], legal(30,39,40), "거래일·수익자·채무상태·대가·회복 가능성을 검토하세요.", ["회복금·재산반환과 수정계획 영향 검토", "위법·부인 대상 여부를 금액 기준만으로 단정하지 않음"]),
  workflow("WF-42", "이혼·상속·재산분할", "case", flag("case.familyAssetEvent"), [eventDoc("family_property_event", "상속·이혼·분할·포기 관련 문서", "family.propertyEvent", assetTarget("가족관계 재산변동")), eventDoc("family_property_flow", "귀속·분할·처분·대금 흐름", "family.propertyFlow", assetTarget("권리·대체재산"))], legal(27,28,30,31), "법률상 귀속·시점·분할 대가와 현재 재산을 검토하세요.", ["포기·분할·이전의 효력과 부인 가능성은 개별 법리 검토"]),
  workflow("WF-43", "전세사기·보증금 미반환", "case", flag("case.rentalFraud"), [eventDoc("rental_fraud_decision", "공식 피해자 결정·피해와 지급불능 관련성", "rentalFraud.officialDecision", appTarget("신청 경위·단축 검토")), eventDoc("unreturned_deposit", "반환채권·보증기관·소송·회수가능성", "rentalFraud.depositRecovery", assetTarget("미반환 보증금 평가"))], legal(27,31,38,42), "공식 결정과 보증금 회수·대위변제 관계를 확인하고 단축 여부를 검토하세요."),
  workflow("WF-44", "과거 절차·면책·채무조정", "case", flag("case.priorProceedings"), [eventDoc("prior_case_records", "과거 신청·기각·폐지·면책 결정", "priorProceedings.records", appTarget("이전 신청·면책 이력")), eventDoc("prior_creditor_list", "과거 채권자목록·수정 경위", "priorProceedings.creditorComparison", debtTarget("과거 목록 대조"))], legal(8,9,10), "신청이력 10년과 면책이력 5년을 구분하여 결정일·확정일·변경 사정을 확인하세요."),
  workflow("WF-45", "보정·추가자료 제출", "case", flag("case.correctionOrders"), [doc("court_correction_order", "보정권고·명령·기한", "요구사항별 답변·증빙·미해결 사유 추적", [field("court.orders", "보정 항목·기한·송달", [target("evidence_index", "보정 대응", "명령 항목")]), field("court.responses", "항목별 답변·근거·해소 여부", [target("evidence_index", "보정 대응", "답변·증빙")])])], legal(11,47,49), "답변 제출과 쟁점 해소를 분리하여 미해결 항목·연장 여부를 기록하세요."),
  workflow("WF-46", "변제계획·청산가치·특수채권", "case", flag("case.always"), [doc("repayment_plan_inputs", "계획의 검토 입력과 산식", "가용소득·기간·우선변제·평가기준·월 납부 정합성 확인", [field("case.planMonths", "제안 변제개월", [planTarget("변제기간")], { validation: "positive_integer" }), money("case.approvedMonthlyPayment", "검토 월 변제액", [planTarget("월 변제액")]), money("case.approvedPresentValue", "검토 총변제 현재가치", [planTarget("현재가치·청산가치 비교")]), field("case.presentValueBasis", "현가 산식·평가기준일", [planTarget("평가 근거")]), field("case.courtObjection", "채권자·회생위원 이의 여부", [planTarget("이의 조건")])])], legal(36,40,41,42,43,44,45,46,47,48), "인정 수입·생계비·재산·채권분류와 계산 근거를 갖춘 후 계획을 확정하세요."),
];

function moneyDocument(type: string, label: string, key: string, destination: string): WorkflowDocument {
  return doc(type, label, "기준일별 권리·잔액 대조", [money(key, label, [assetTarget(destination)])], [], "conditional");
}

/** Aliases preserve original extraction vocabulary without converting incompatible units. */
const ALIASES: Record<string, string[]> = {
  "applicant.name": ["client_name", "person.name"], "applicant.address": ["address", "person.address", "jurisdiction.residence"],
  "case.applicationDate": ["application_date", "case.application_date"], "case.courtId": ["court_name", "jurisdiction.court"],
  "income.employer": ["income_source.employer", "income.employer", "employer_name"],
  "income.gross": ["income.monthly_gross", "income.business_revenue", "annual_revenue", "monthly_revenue"],
  "income.expenses": ["income.necessary_cost", "annual_expenses", "monthly_expense"],
  "income.net": ["income.monthly_net", "annual_business_income", "monthly_income"],
  "income.recurring": ["income.recurring"],
  "income.periodStart": ["income.period_start"], "income.periodEnd": ["income.period_end"],
  "income.period": ["income.period"], "income.kind": ["income_source.kind", "income.type"],
  "income.businessName": ["business_name"], "income.businessType": ["business_type"],
  "debt.creditor": ["creditor.name", "creditor_name"], "debt.contractId": ["creditor_contract_id"],
  "debt.principal": ["debt.principal", "creditor_principal"], "debt.interest": ["debt.interest", "creditor_interest"],
  "debt.asOf": ["debt_as_of", "debts[].as_of"], "debt.cause": ["creditor_cause"],
  "debt.dueDate": ["creditor_due_date", "tax_arrears.due_date"], "debt.taxType": ["tax_arrears.tax_type", "tax_type"],
  "debt.taxPeriod": ["tax_arrears.period"], "debt.priority": ["tax_arrears.priority_status"],
  "debt.nonDischargeGround": ["tax_arrears.non_discharge_ground"], "debt.incurredAt": ["creditor_loan_date"],
  "debt.collateralId": ["creditor_collateral"], "debt.expectedSeparateRecovery": ["creditor_secured_recovery"],
  "debt.deficiency": ["creditor_shortfall"], "debt.claimedAmount": ["creditor_disputed_amount"],
  "debt.undisputedAmount": ["creditor_undisputed_amount"], "debt.disputeReason": ["creditor_dispute_reason"],
  "asset.label": ["asset_description", "assets[].description"], "asset.grossValue": ["asset_value", "assets[].gross_value"],
  "asset.asOf": ["assets[].valuation_as_of"], "asset.valuationBasis": ["assets[].valuation_method"],
  "asset.securedPayoff": ["assets[].secured_claim_amount"], "asset.protectionGround": ["assets[].protection_ground"],
  "asset.retirementType": ["retirement_type"], "asset.investmentHistory": ["assets[].transaction_history"],
  "household.recognizedMembers": ["household_size", "living.household_size"],
  "household.additionalLivingCost": ["living.additional_cost"],
  "court.orders": ["court.orders[]"], "court.responses": ["issue.answered", "issue.resolved"],
  "case.priorProceedings": ["prior_proceedings"], "case.planMonths": ["repayment_months", "plan.months"],
  "case.approvedMonthlyPayment": ["plan.monthly_payment"], "case.approvedPresentValue": ["plan.present_value"],
};

function jsonValue(value: unknown): Json | null {
  if (value === undefined || value === null || value === "" || value === "unknown") return null;
  if (typeof value === "object" && "normalizationStatus" in value && "amountWon" in value) {
    const numeric = value as { normalizationStatus: string; amountWon: string | null };
    return numeric.normalizationStatus === "exact" ? numeric.amountWon : null;
  }
  return value as Json;
}
function boolValue(value: Json | null): Json | null {
  return value === "yes" ? true : value === "no" ? false : value;
}
function sourceFacts(data: CaseData, subject: Subject, key: string, index: WorkflowIndex, extra: string[] = []): Fact[] {
  const snakeKey = key.replace(/[A-Z]/g, letter => "_" + letter.toLowerCase());
  const aliases = new Set([key, snakeKey, ...(ALIASES[key] ?? []), ...extra]);
  const candidates = [...aliases].flatMap(alias => index.byKey.get(alias) ?? []);
  const linked = index.subjectFactIds.get(subject.id) ?? new Set(subject.factIds);
  // Keep the ledger order: callers use it to preserve source and conflict order.
  const selected = candidates.filter(f => subject.scope === "case"
    ? [data.context.id, "case", "applicant", "household"].includes(f.subjectId) || index.householdFactIds.has(f.id) || !index.objectIds.has(f.subjectId)
    : f.subjectId === subject.id && linked.has(f.id));
  return selected.sort((a,b)=>(index.ledgerOrder.get(a.id)??0)-(index.ledgerOrder.get(b.id)??0));
}
function objectValue(data: CaseData, subject: Subject, key: string): unknown {
  const [namespace, ...rest] = key.split(".");
  if (namespace === subject.scope) return rest.reduce<unknown>((v, k) => v && typeof v === "object" ? (v as Record<string, unknown>)[k] : undefined, subject.value);
  if (subject.scope === "case" && namespace === "case") return (data.context as unknown as Record<string, unknown>)[rest.join(".")];
  if (subject.scope === "case" && namespace === "applicant") return (data.context.applicant as unknown as Record<string, unknown> | undefined)?.[rest.join(".")];
  if (subject.scope === "case" && namespace === "household") return (data.household as unknown as Record<string, unknown>)[rest.join(".")];
  return undefined;
}
function computeCell(data: CaseData, subject: Subject, key: string, index: WorkflowIndex, aliases: string[] = [], activation = false): Cell {
  const facts = sourceFacts(data, subject, key, index, aliases);
  const valid = facts.filter(f => {
    if (!index.sourceValid.has(f.id)) index.sourceValid.set(f.id, f.state !== "retracted" && f.recognition !== "rejected" && (f.structuredRefs !== undefined ? factHasValidStructuredRefs(data,f) : f.refs.length > 0 && f.refs.every(ref => validSourceRef(data, ref))));
    return index.sourceValid.get(f.id);
  });
  const values = valid.map(f => jsonValue(f.numeric ?? f.value)).filter(v => v !== null);
  const distinct = [...new Set(values.map(v => JSON.stringify(boolValue(v))))];
  const periods = new Set(valid.map(f => `${f.periodStart ?? ""}|${f.periodEnd ?? ""}|${f.asOf ?? ""}`));
  if (periods.size > 1 && distinct.length > 1) return { status: "missing", value: null, reason: "서로 다른 기간·기준일의 값입니다. 같은 기간의 집계·대조 근거를 연결하세요.", facts };
  if (facts.some(f => f.state === "disputed") || distinct.length > 1) return { status: "conflict", value: null, reason: "같은 대상·피처의 현재 사실이 충돌합니다.", facts };
  const direct = jsonValue(objectValue(data, subject, key));
  if (distinct.length && direct !== null && JSON.stringify(boolValue(direct)) !== distinct[0]) return { status: "conflict", value: null, reason: "객체 입력과 연결된 현재 사실이 다릅니다.", facts };
  if (valid.length && values.length) {
    const ready = valid.every(f => {
      if (!index.sourceReady.has(f.id)) index.sourceReady.set(f.id, factSourceLineageIssues(data, [f.id]).length === 0);
      return index.sourceReady.get(f.id);
    });
    return { status: ready ? "pass" : "missing", value: values[0], reason: ready ? "검증·인정된 원문 근거가 연결되었습니다." : "값을 추출했으나 원문 대조·인정 검토가 남았습니다.", facts: valid };
  }
  // Object categories activate the appropriate evidence branch, but do not prove its fields.
  if (activation && direct !== null && subject.scope !== "case") {
    const objectRecognized = subject.value.recognition === "accepted" || subject.value.legalReview === "accepted";
    const objectReady = objectRecognized && subject.factIds.length > 0 && factSourceLineageIssues(data, subject.factIds).length === 0;
    return { status: objectReady ? "pass" : "missing", value: direct, reason: objectReady ? "검증된 객체 분류" : "객체의 분류·근거 검토 필요", facts: index.facts.filter(f => (index.subjectFactIds.get(subject.id) ?? new Set(subject.factIds)).has(f.id)) };
  }
  return { status: "missing", value: direct, reason: direct === null ? "값과 원문 근거가 없습니다." : "객체 값의 해당 피처 원문 연결이 없습니다.", facts };
}
function cell(data: CaseData, subject: Subject, key: string, index: WorkflowIndex, aliases: string[] = [], activation = false): Cell {
  const identity = JSON.stringify([subject.scope, subject.id, key, aliases, activation]);
  let cached = index.cells.get(identity);
  if (!cached) { cached = computeCell(data, subject, key, index, aliases, activation); index.cells.set(identity, cached); }
  // Field-specific validations modify the returned status, never a shared cache.
  return { ...cached };
}
function specialCell(data: CaseData, subject: Subject, key: string): Cell | undefined {
  const known = (value: Json, reason: string): Cell => ({ status: "pass", value, reason, facts: [] });
  if (key === "case.always") return known(true, "공통 신청 점검");
  if (key === "debt.exists" && subject.scope === "debt") return known(true, "채무 객체에 대응하는 증빙 점검");
  if (key === "case.multipleIncomeSources") {
    if (data.incomes.length >= 2) return known(true, "복수 소득원 후보가 존재합니다.");
    if (data.context.inventoryComplete.income === "yes") return known(false, "검토한 소득원 목록에 복수 소득원이 없습니다.");
    return { status: "missing", value: null, reason: "전체 소득원 조사범위 미확인", facts: [] };
  }
  if (key === "case.incomeInventoryComplete") {
    const value = data.context.inventoryComplete.income;
    return value === "yes" ? known(true, "사건의 소득원 목록 완전성 검토") : { status: "missing", value: null, reason: "소득원 목록 완전성 검토 필요", facts: [] };
  }
  return undefined;
}
function compare(value: Json | null, op: WorkflowRule["activation"][number]["op"], expected?: Json): boolean | null {
  value = boolValue(value);
  if (value === null) return null;
  if (op === "exists") return true;
  if (op === "eq") {
    if (typeof expected === "boolean" && typeof value !== "boolean") return null;
    return JSON.stringify(value) === JSON.stringify(expected);
  }
  if (op === "in") return Array.isArray(expected) ? expected.some(x => JSON.stringify(x) === JSON.stringify(value)) : null;
  if (op === "gt" && /^-?\d+$/.test(String(value)) && /^-?\d+$/.test(String(expected))) return BigInt(String(value)) > BigInt(String(expected));
  return null;
}
const priority: WorkflowStatus[] = ["conflict", "fail", "missing", "pass", "not_applicable"];
function aggregate(statuses: WorkflowStatus[]): WorkflowStatus { return priority.find(s => statuses.includes(s)) ?? "missing"; }
function fieldResult(data: CaseData, subject: Subject, spec: WorkflowField, index: WorkflowIndex) {
  const result = specialCell(data, subject, spec.key) ?? cell(data, subject, spec.key, index, spec.aliases);
  if (spec.unit === "KRW" && result.status === "pass" && result.facts.some(f => !f.numeric || f.numeric.normalizationStatus !== "exact")) {
    result.status = "missing"; result.reason = "원문 금액의 단위·통화·정수 원화 정규화를 확인해야 합니다.";
  }
  if (result.status === "pass" && result.value !== null) {
    const value = String(result.value);
    if (spec.validation === "nonnegative_money" && (!/^\d+$/.test(value))) { result.status = "fail"; result.reason = "금액은 0 이상 정수 원화여야 합니다. 원문 단위를 확인하세요."; }
    if (spec.validation === "positive_integer" && (!/^\d+$/.test(value) || BigInt(value) <= 0n)) { result.status = "fail"; result.reason = "양의 정수인지 확인하세요."; }
    if (spec.validation === "ownership_bps" && (!/^\d+$/.test(value) || BigInt(value) > 10000n)) { result.status = "fail"; result.reason = "소유지분은 0~10000 basis points입니다. 원문 비율 단위를 확인하세요."; }
    if (spec.validation === "date" && (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(Date.parse(value)))) { result.status = "fail"; result.reason = "유효한 ISO 날짜가 필요합니다."; }
  }
  return { ...spec, status: result.status, value: result.value, reason: result.reason, factIds: result.facts.map(f => f.id), refs: result.facts.flatMap(f => f.refs), structuredRefs: result.facts.flatMap(f => f.structuredRefs ?? []) };
}
function subjects(data: CaseData, scope: Scope): Subject[] {
  if (scope === "case") return [{ id: data.context.id, scope, value: data.context as unknown as Record<string, unknown>, factIds: [] }];
  const objects = scope === "income" ? data.incomes : scope === "debt" ? data.debts : scope === "asset" ? data.assets : data.transactions;
  return objects.map(x => ({ id: x.id, scope, value: x as unknown as Record<string, unknown>, factIds: x.factIds }));
}
function noObjectsStatus(data: CaseData, scope: Scope): WorkflowStatus {
  return (scope === "income" || scope === "debt" || scope === "asset") && data.context.inventoryComplete[scope] === "yes" ? "not_applicable" : "missing";
}

function crossCheckResults(data: CaseData, subject: Subject, fields: ReturnType<typeof fieldResult>[]) {
  const results: { id: string; status: WorkflowStatus; message: string }[] = [];
  const byKey = new Map(fields.map(f => [f.key, f]));
  const start = byKey.get("income.periodStart"), end = byKey.get("income.periodEnd");
  if (start || end) results.push({ id: "income_period_order", status: start?.status === "pass" && end?.status === "pass" ? String(start.value) <= String(end.value) ? "pass" : "fail" : "missing", message: "소득 산정 시작일과 종료일의 순서·범위를 확인합니다." });
  const gross = byKey.get("income.gross"), expenses = byKey.get("income.expenses"), net = byKey.get("income.net");
  if (subject.value.kind === "business" && gross && expenses && net) {
    const ready = [gross, expenses, net].every(f => f.status === "pass" && /^-?\d+$/.test(String(f.value)));
    results.push({ id: "business_income_equation", status: ready ? BigInt(String(gross.value)) - BigInt(String(expenses.value)) === BigInt(String(net.value)) ? "pass" : "conflict" : "missing", message: "같은 기간의 매출−필요비용=순소득을 대조합니다. 기간·총액 기준도 확인해야 합니다." });
  }
  const asOf = byKey.get("debt.asOf");
  if (asOf) results.push({ id: "debt_as_of", status: asOf.status === "pass" ? asOf.value === data.context.asOf && asOf.value === data.context.applicationDate ? "pass" : "conflict" : "missing", message: "잔액 기준일·신청일·사건 산정일을 맞춰야 채무한도 비교에 사용할 수 있습니다." });
  return results;
}

/** Evidence gaps are deterministic; discretionary legal outcomes remain explicit review work. */
export function evaluateWorkflow(data: CaseData, existingAssessment?: Assessment) {
  const assessment = existingAssessment ?? assessCase(data, CURRENT_RULESET);
  const index = workflowIndex(data);
  const legalMap = new Map(LEGAL_CATALOG.map(r => [r.id, r]));
  const findingMap: Record<string, string[]> = { "KR-PR-006": ["cap_담보"], "KR-PR-007": ["cap_무담보"], "KR-PR-041": ["plan_term"], "KR-PR-043": ["liquidation"] };
  const items = WORKFLOW_RULES.flatMap(rule => {
    const scoped = subjects(data, rule.scope);
    const allSubjects = scoped.length ? scoped : [{ id: `${data.context.id}:${rule.scope}:unconfirmed`, scope: rule.scope, value: {}, factIds: [] } as Subject];
    return allSubjects.map(subject => {
      const activationChecks = rule.activation.map(condition => {
        const result = specialCell(data, subject, condition.feature) ?? cell(data, subject, condition.feature, index, [], true);
        const matches = compare(result.value, condition.op, condition.value);
        return { ...condition, status: result.status, actualValue: result.value, matches, reason: result.reason, factIds: result.facts.map(f => f.id) };
      });
      let applicability: WorkflowStatus;
      if (!scoped.length) applicability = noObjectsStatus(data, rule.scope);
      else if (activationChecks.some(x => x.status === "conflict")) applicability = "conflict";
      else {
        const provenFalse = activationChecks.filter(x => x.status === "pass" && x.matches === false).length;
        const provenTrue = activationChecks.filter(x => x.status === "pass" && x.matches === true).length;
        if (rule.activationMode === "any") applicability = provenTrue ? "pass" : provenFalse === activationChecks.length ? "not_applicable" : "missing";
        else applicability = provenFalse ? "not_applicable" : provenTrue === activationChecks.length ? "pass" : "missing";
      }
      const documents = rule.documents.map(spec => {
        const fields = spec.fields.map(f => fieldResult(data, subject, f, index));
        const refs = fields.flatMap(f => f.refs);
        const documentIds = [...new Set(refs.map(ref => ref.documentId))];
        const checks = crossCheckResults(data, subject, fields);
        const sourceRecordIds = [...new Set(fields.flatMap(f => f.structuredRefs.map(ref => ref.sourceRecordId)))];
        return { ...spec, status: applicability === "not_applicable" ? "not_applicable" as WorkflowStatus : aggregate([...fields.map(f => f.status), ...checks.map(c => c.status)]), documentIds, ...(sourceRecordIds.length ? { sourceRecordIds, sourceBasis: "assumed_extracted_synthetic" as const } : {}), fields, crossCheckResults: checks };
      });
      const legalChecks = rule.ruleIds.map(ruleId => {
        const definition = legalMap.get(ruleId);
        const matches = assessment.findings.filter(f => (findingMap[ruleId] ?? []).includes(f.id));
        let status: WorkflowStatus = applicability === "not_applicable" ? "not_applicable" : "missing";
        if (applicability !== "not_applicable" && matches.length) status = aggregate(matches.map(f => f.outcome === "pass" ? "pass" : f.outcome === "fail" ? "fail" : "missing"));
        if (definition?.authority_scope === "서울회생법원" && data.context.courtId !== "seoul") status = "missing";
        if (!data.context.ruleApplicationReviewed || data.context.ruleReleaseId !== CURRENT_RULESET.id || data.context.applicationDate < (CURRENT_RULESET.effectiveFrom ?? "")) status = applicability === "not_applicable" ? "not_applicable" : "missing";
        return { ruleId, title: definition?.title ?? "규칙 연결 확인", article: definition?.article ?? "", sourceUrl: definition?.source_url ?? "", status, reason: matches.length ? matches.map(f => f.detail).join(" ") : "원문·시행일·관할과 이 사건 적용의 별도 법률 검토가 필요합니다.", implementationScope: definition?.implementation_scope ?? "unresolved" };
      });
      const dataStatus = applicability === "not_applicable" ? "not_applicable" : aggregate([applicability, ...documents.map(d => d.status)]);
      const status = applicability === "not_applicable" ? "not_applicable" : aggregate([dataStatus, ...legalChecks.map(c => c.status)]);
      return { id: `${rule.id}:${subject.id}`, ruleId: rule.id, title: rule.title, subjectId: subject.id, applicability, status, dataStatus, activationChecks, documents, legalChecks, ruleIds: rule.ruleIds, missingAction: rule.missingAction, disposalConsiderations: rule.disposalConsiderations, legalReviewRequired: applicability !== "not_applicable" && rule.legalReviewRequired && legalChecks.some(c => c.status !== "pass") };
    });
  });
  const summary = { total: items.length, pass: 0, fail: 0, missing: 0, conflict: 0, not_applicable: 0, legalReviewRequired: 0 };
  for (const item of items) { summary[item.status] += 1; if (item.legalReviewRequired) summary.legalReviewRequired += 1; }
  return { version: "2026-10-27.1", evaluatedAt: data.context.asOf, scope: "상황별 증빙·원문·제출항목 연결과 구현된 사전요건 점검. 법원의 개시·인가·면책 결론이 아닙니다.", summary, items };
}

/** Preserved public prototype dictionaries; used as vocabulary, not current legal constants. */
export const LEGACY_WORKFLOW_ORIGIN = {
  "commit": "615f6d21e8a2bae978164142223ac9e86bc418f6",
  "repository": "https://github.com/firmengine/firmengine",
  "version": "seoul-document-purpose-v2",
  "documentTypeCount": 48,
  "featureCount": 84,
  "requirementCount": 18,
  "preservation": "Original labels/features/requirements only; no filed forms, evaluation answers or sample financial data. Legacy keys do not bypass evidence or legal review."
};
export const LEGACY_DOCUMENT_TYPES = {
  "resident_registration": "주민등록 등본·초본",
  "withholding_certificate": "근로소득 원천징수영수증",
  "employer_signed_salary_statement": "급여명세서",
  "employer_signed_income_certificate": "고용주 소득확인서",
  "salary_bank_statement_for_required_period": "급여입금 거래내역",
  "business_registration": "사업자등록증·사업자등록증명",
  "business_contract": "사업·용역 계약서",
  "platform_settlement": "플랫폼 정산자료",
  "business_tax_return": "종합소득세·부가세 신고서 또는 소득금액증명",
  "business_expense_ledger": "사업 필요경비 장부",
  "monthly_business_report": "월별 사업매출·경비 보고서",
  "business_bank_statement": "사업용 계좌 거래내역",
  "family_relationship_certificate": "가족관계 증명서",
  "household_support_evidence": "실제 부양관계 증빙",
  "debt_certificate": "부채증명서·채무확인서",
  "loan_contract": "대출·차용 계약서",
  "debt_balance_statement": "대출 잔액증명·상환내역",
  "judgment": "채권 관련 판결문",
  "current_debt_evidence": "현재 채무액 증빙",
  "vehicle_register": "자동차등록원부",
  "vehicle_market_evidence": "차량 시세·평가 자료",
  "secured_balance_evidence": "담보대출 잔액 증빙",
  "real_estate_register": "부동산 등기사항증명서",
  "property_market_evidence": "부동산 시세·감정 자료",
  "insurance_policy": "보험증권·계약내역",
  "insurance_surrender_certificate": "보험 해약환급금 증명",
  "insurance_loan_statement": "보험계약 대출내역",
  "bank_balance_certificate": "예금 잔액증명",
  "bank_statement": "일반 계좌 거래내역",
  "lease_contract": "임대차계약서",
  "lease_payment_evidence": "임차보증금·임차료 납부증빙",
  "asset_ownership_evidence": "그 밖의 자산 소유 증빙",
  "asset_valuation_evidence": "그 밖의 자산 가치 증빙",
  "pension_certificate": "연금·퇴직금 증명",
  "client_narrative": "의뢰인 진술·상담자료",
  "administrative": "위임·법무행정 자료",
  "filed_form": "기작성·기제출 법원 서류",
  "unknown": "판독 불가 또는 분류표에 없는 자료",
  "rental_contract": "rental contract",
  "rent_receipt_statement": "rent receipt statement",
  "interest_income_statement": "interest income statement",
  "dividend_income_statement": "dividend income statement",
  "pension_entitlement_certificate": "pension entitlement certificate",
  "pension_payment_statement": "pension payment statement",
  "benefit_decision": "benefit decision",
  "benefit_payment_statement": "benefit payment statement",
  "income_source_contract": "income source contract",
  "income_payment_statement": "income payment statement"
};
export const LEGACY_FEATURE_CATALOG = [
  {
    "key": "case.application_date",
    "type": "date",
    "label": "신청일·예정일",
    "group": "사건·인적사항",
    "note": "상담 추출 후 공적 문서·법원문서로 대조",
    "legal_source_ids": [
      "K01",
      "K02",
      "K03",
      "K06"
    ],
    "requires_evidence_ref": true,
    "unknown_policy": "NULL_NOT_ZERO"
  },
  {
    "key": "case.commencement_date",
    "type": "date?",
    "label": "개시일",
    "group": "사건·인적사항",
    "note": "상담 추출 후 공적 문서·법원문서로 대조",
    "legal_source_ids": [
      "K01",
      "K02",
      "K03",
      "K06"
    ],
    "requires_evidence_ref": true,
    "unknown_policy": "NULL_NOT_ZERO"
  },
  {
    "key": "case.confirmation_date",
    "type": "date?",
    "label": "인가일",
    "group": "사건·인적사항",
    "note": "상담 추출 후 공적 문서·법원문서로 대조",
    "legal_source_ids": [
      "K01",
      "K02",
      "K03",
      "K06"
    ],
    "requires_evidence_ref": true,
    "unknown_policy": "NULL_NOT_ZERO"
  },
  {
    "key": "case.discharge_final_date",
    "type": "date?",
    "label": "면책확정일",
    "group": "사건·인적사항",
    "note": "상담 추출 후 공적 문서·법원문서로 대조",
    "legal_source_ids": [
      "K01",
      "K02",
      "K03",
      "K06"
    ],
    "requires_evidence_ref": true,
    "unknown_policy": "NULL_NOT_ZERO"
  },
  {
    "key": "case.procedural_stage",
    "type": "enum",
    "label": "법적 절차단계",
    "group": "사건·인적사항",
    "note": "상담 추출 후 공적 문서·법원문서로 대조",
    "legal_source_ids": [
      "K01",
      "K02",
      "K03",
      "K06"
    ],
    "requires_evidence_ref": true,
    "unknown_policy": "NULL_NOT_ZERO"
  },
  {
    "key": "person.birth_date",
    "type": "date",
    "label": "연령근거",
    "group": "사건·인적사항",
    "note": "상담 추출 후 공적 문서·법원문서로 대조",
    "legal_source_ids": [
      "K01",
      "K02",
      "K03",
      "K06"
    ],
    "requires_evidence_ref": true,
    "unknown_policy": "NULL_NOT_ZERO"
  },
  {
    "key": "person.natural_person",
    "type": "boolean",
    "label": "개인 여부",
    "group": "사건·인적사항",
    "note": "상담 추출 후 공적 문서·법원문서로 대조",
    "legal_source_ids": [
      "K01",
      "K02",
      "K03",
      "K06"
    ],
    "requires_evidence_ref": true,
    "unknown_policy": "NULL_NOT_ZERO"
  },
  {
    "key": "jurisdiction.residence",
    "type": "text",
    "label": "실제주소",
    "group": "사건·인적사항",
    "note": "상담 추출 후 공적 문서·법원문서로 대조",
    "legal_source_ids": [
      "K01",
      "K02",
      "K03",
      "K06"
    ],
    "requires_evidence_ref": true,
    "unknown_policy": "NULL_NOT_ZERO"
  },
  {
    "key": "jurisdiction.workplace",
    "type": "text?",
    "label": "계속근무지",
    "group": "사건·인적사항",
    "note": "상담 추출 후 공적 문서·법원문서로 대조",
    "legal_source_ids": [
      "K01",
      "K02",
      "K03",
      "K06"
    ],
    "requires_evidence_ref": true,
    "unknown_policy": "NULL_NOT_ZERO"
  },
  {
    "key": "jurisdiction.main_business",
    "type": "text?",
    "label": "주된사업장",
    "group": "사건·인적사항",
    "note": "상담 추출 후 공적 문서·법원문서로 대조",
    "legal_source_ids": [
      "K01",
      "K02",
      "K03",
      "K06"
    ],
    "requires_evidence_ref": true,
    "unknown_policy": "NULL_NOT_ZERO"
  },
  {
    "key": "history.proceedings[]",
    "type": "object[]",
    "label": "10년 내 과거사건·결과",
    "group": "사건·인적사항",
    "note": "상담 추출 후 공적 문서·법원문서로 대조",
    "legal_source_ids": [
      "K01",
      "K02",
      "K03",
      "K06"
    ],
    "requires_evidence_ref": true,
    "unknown_policy": "NULL_NOT_ZERO"
  },
  {
    "key": "history.discharge_dates[]",
    "type": "date[]",
    "label": "과거 면책 날짜",
    "group": "사건·인적사항",
    "note": "상담 추출 후 공적 문서·법원문서로 대조",
    "legal_source_ids": [
      "K01",
      "K02",
      "K03",
      "K06"
    ],
    "requires_evidence_ref": true,
    "unknown_policy": "NULL_NOT_ZERO"
  },
  {
    "key": "solvency.payment_difficulty[]",
    "type": "object[]",
    "label": "지급곤란 사실",
    "group": "지급곤란·소득",
    "note": "수입의 추출과 반복·확실성의 법률판단을 분리",
    "legal_source_ids": [
      "K01",
      "K19"
    ],
    "requires_evidence_ref": true,
    "unknown_policy": "NULL_NOT_ZERO"
  },
  {
    "key": "income.sources[]",
    "type": "object[]",
    "label": "급여·사업·연금",
    "group": "지급곤란·소득",
    "note": "수입의 추출과 반복·확실성의 법률판단을 분리",
    "legal_source_ids": [
      "K01",
      "K19"
    ],
    "requires_evidence_ref": true,
    "unknown_policy": "NULL_NOT_ZERO"
  },
  {
    "key": "income.recurring_evidence[]",
    "type": "reference[]",
    "label": "반복수입 증거",
    "group": "지급곤란·소득",
    "note": "수입의 추출과 반복·확실성의 법률판단을 분리",
    "legal_source_ids": [
      "K01",
      "K19"
    ],
    "requires_evidence_ref": true,
    "unknown_policy": "NULL_NOT_ZERO"
  },
  {
    "key": "income.job_changed_at",
    "type": "date?",
    "label": "이직일",
    "group": "지급곤란·소득",
    "note": "수입의 추출과 반복·확실성의 법률판단을 분리",
    "legal_source_ids": [
      "K01",
      "K19"
    ],
    "requires_evidence_ref": true,
    "unknown_policy": "NULL_NOT_ZERO"
  },
  {
    "key": "income.period",
    "type": "date_range",
    "label": "평균 산정기간",
    "group": "지급곤란·소득",
    "note": "수입의 추출과 반복·확실성의 법률판단을 분리",
    "legal_source_ids": [
      "K01",
      "K19"
    ],
    "requires_evidence_ref": true,
    "unknown_policy": "NULL_NOT_ZERO"
  },
  {
    "key": "income.monthly_gross",
    "type": "money?",
    "label": "세전수입",
    "group": "지급곤란·소득",
    "note": "수입의 추출과 반복·확실성의 법률판단을 분리",
    "legal_source_ids": [
      "K01",
      "K19"
    ],
    "requires_evidence_ref": true,
    "unknown_policy": "NULL_NOT_ZERO"
  },
  {
    "key": "income.monthly_net",
    "type": "money?",
    "label": "실수령수입",
    "group": "지급곤란·소득",
    "note": "수입의 추출과 반복·확실성의 법률판단을 분리",
    "legal_source_ids": [
      "K01",
      "K19"
    ],
    "requires_evidence_ref": true,
    "unknown_policy": "NULL_NOT_ZERO"
  },
  {
    "key": "income.tax_social_insurance",
    "type": "money?",
    "label": "법정공제",
    "group": "지급곤란·소득",
    "note": "수입의 추출과 반복·확실성의 법률판단을 분리",
    "legal_source_ids": [
      "K01",
      "K19"
    ],
    "requires_evidence_ref": true,
    "unknown_policy": "NULL_NOT_ZERO"
  },
  {
    "key": "income.business_revenue",
    "type": "money?",
    "label": "사업매출",
    "group": "지급곤란·소득",
    "note": "수입의 추출과 반복·확실성의 법률판단을 분리",
    "legal_source_ids": [
      "K01",
      "K19"
    ],
    "requires_evidence_ref": true,
    "unknown_policy": "NULL_NOT_ZERO"
  },
  {
    "key": "income.necessary_cost",
    "type": "money?",
    "label": "사업필요비",
    "group": "지급곤란·소득",
    "note": "수입의 추출과 반복·확실성의 법률판단을 분리",
    "legal_source_ids": [
      "K01",
      "K19"
    ],
    "requires_evidence_ref": true,
    "unknown_policy": "NULL_NOT_ZERO"
  },
  {
    "key": "income.seasonality",
    "type": "enum",
    "label": "계절성",
    "group": "지급곤란·소득",
    "note": "수입의 추출과 반복·확실성의 법률판단을 분리",
    "legal_source_ids": [
      "K01",
      "K19"
    ],
    "requires_evidence_ref": true,
    "unknown_policy": "NULL_NOT_ZERO"
  },
  {
    "key": "income.expected_change",
    "type": "object?",
    "label": "증빙 가능한 장래변동",
    "group": "지급곤란·소득",
    "note": "수입의 추출과 반복·확실성의 법률판단을 분리",
    "legal_source_ids": [
      "K01",
      "K19"
    ],
    "requires_evidence_ref": true,
    "unknown_policy": "NULL_NOT_ZERO"
  },
  {
    "key": "household.members[]",
    "type": "object[]",
    "label": "관계·나이·동거",
    "group": "가구·생계비",
    "note": "실제 가구구성과 인정 부양·생계비를 별도로 관리",
    "legal_source_ids": [
      "K19",
      "K20",
      "K21"
    ],
    "requires_evidence_ref": true,
    "unknown_policy": "NULL_NOT_ZERO"
  },
  {
    "key": "dependents.support_evidence[]",
    "type": "reference[]",
    "label": "실제부양",
    "group": "가구·생계비",
    "note": "실제 가구구성과 인정 부양·생계비를 별도로 관리",
    "legal_source_ids": [
      "K19",
      "K20",
      "K21"
    ],
    "requires_evidence_ref": true,
    "unknown_policy": "NULL_NOT_ZERO"
  },
  {
    "key": "spouse.income_amount",
    "type": "money?",
    "label": "지난1년 소득금액",
    "group": "가구·생계비",
    "note": "실제 가구구성과 인정 부양·생계비를 별도로 관리",
    "legal_source_ids": [
      "K19",
      "K20",
      "K21"
    ],
    "requires_evidence_ref": true,
    "unknown_policy": "NULL_NOT_ZERO"
  },
  {
    "key": "spouse.total_wage",
    "type": "money?",
    "label": "지난1년 총급여",
    "group": "가구·생계비",
    "note": "실제 가구구성과 인정 부양·생계비를 별도로 관리",
    "legal_source_ids": [
      "K19",
      "K20",
      "K21"
    ],
    "requires_evidence_ref": true,
    "unknown_policy": "NULL_NOT_ZERO"
  },
  {
    "key": "dependents.care_need",
    "type": "object?",
    "label": "돌봄·장애",
    "group": "가구·생계비",
    "note": "실제 가구구성과 인정 부양·생계비를 별도로 관리",
    "legal_source_ids": [
      "K19",
      "K20",
      "K21"
    ],
    "requires_evidence_ref": true,
    "unknown_policy": "NULL_NOT_ZERO"
  },
  {
    "key": "household.recognized_count",
    "type": "integer?",
    "label": "검토된 가구원수",
    "group": "가구·생계비",
    "note": "실제 가구구성과 인정 부양·생계비를 별도로 관리",
    "legal_source_ids": [
      "K19",
      "K20",
      "K21"
    ],
    "requires_evidence_ref": true,
    "unknown_policy": "NULL_NOT_ZERO"
  },
  {
    "key": "living.base_allowance",
    "type": "money?",
    "label": "기본생계 산술",
    "group": "가구·생계비",
    "note": "실제 가구구성과 인정 부양·생계비를 별도로 관리",
    "legal_source_ids": [
      "K19",
      "K20",
      "K21"
    ],
    "requires_evidence_ref": true,
    "unknown_policy": "NULL_NOT_ZERO"
  },
  {
    "key": "living.housing_actual",
    "type": "money?",
    "label": "지속주거비",
    "group": "가구·생계비",
    "note": "실제 가구구성과 인정 부양·생계비를 별도로 관리",
    "legal_source_ids": [
      "K19",
      "K20",
      "K21"
    ],
    "requires_evidence_ref": true,
    "unknown_policy": "NULL_NOT_ZERO"
  },
  {
    "key": "living.housing_location",
    "type": "text",
    "label": "실거주지역",
    "group": "가구·생계비",
    "note": "실제 가구구성과 인정 부양·생계비를 별도로 관리",
    "legal_source_ids": [
      "K19",
      "K20",
      "K21"
    ],
    "requires_evidence_ref": true,
    "unknown_policy": "NULL_NOT_ZERO"
  },
  {
    "key": "living.education_actual",
    "type": "money?",
    "label": "자녀별교육비",
    "group": "가구·생계비",
    "note": "실제 가구구성과 인정 부양·생계비를 별도로 관리",
    "legal_source_ids": [
      "K19",
      "K20",
      "K21"
    ],
    "requires_evidence_ref": true,
    "unknown_policy": "NULL_NOT_ZERO"
  },
  {
    "key": "living.medical_net",
    "type": "money?",
    "label": "보전조정의료비",
    "group": "가구·생계비",
    "note": "실제 가구구성과 인정 부양·생계비를 별도로 관리",
    "legal_source_ids": [
      "K19",
      "K20",
      "K21"
    ],
    "requires_evidence_ref": true,
    "unknown_policy": "NULL_NOT_ZERO"
  },
  {
    "key": "living.extra_allowed",
    "type": "money?",
    "label": "인정추가생계",
    "group": "가구·생계비",
    "note": "실제 가구구성과 인정 부양·생계비를 별도로 관리",
    "legal_source_ids": [
      "K19",
      "K20",
      "K21"
    ],
    "requires_evidence_ref": true,
    "unknown_policy": "NULL_NOT_ZERO"
  },
  {
    "key": "living.other_expense_issue",
    "type": "object?",
    "label": "고소득 기타생계 쟁점",
    "group": "가구·생계비",
    "note": "실제 가구구성과 인정 부양·생계비를 별도로 관리",
    "legal_source_ids": [
      "K19",
      "K20",
      "K21"
    ],
    "requires_evidence_ref": true,
    "unknown_policy": "NULL_NOT_ZERO"
  },
  {
    "key": "debts[].origin_contract_id",
    "type": "text",
    "label": "원채권 동일성",
    "group": "채무",
    "note": "원계약·채권자·금액·성질을 채무 객체마다 반복 저장",
    "legal_source_ids": [
      "K01",
      "K06",
      "K08",
      "K10"
    ],
    "requires_evidence_ref": true,
    "unknown_policy": "NULL_NOT_ZERO"
  },
  {
    "key": "debts[].current_creditor_id",
    "type": "text",
    "label": "현채권자",
    "group": "채무",
    "note": "원계약·채권자·금액·성질을 채무 객체마다 반복 저장",
    "legal_source_ids": [
      "K01",
      "K06",
      "K08",
      "K10"
    ],
    "requires_evidence_ref": true,
    "unknown_policy": "NULL_NOT_ZERO"
  },
  {
    "key": "debts[].cause",
    "type": "enum+text",
    "label": "발생원인",
    "group": "채무",
    "note": "원계약·채권자·금액·성질을 채무 객체마다 반복 저장",
    "legal_source_ids": [
      "K01",
      "K06",
      "K08",
      "K10"
    ],
    "requires_evidence_ref": true,
    "unknown_policy": "NULL_NOT_ZERO"
  },
  {
    "key": "debts[].incurred_at",
    "type": "date?",
    "label": "발생일",
    "group": "채무",
    "note": "원계약·채권자·금액·성질을 채무 객체마다 반복 저장",
    "legal_source_ids": [
      "K01",
      "K06",
      "K08",
      "K10"
    ],
    "requires_evidence_ref": true,
    "unknown_policy": "NULL_NOT_ZERO"
  },
  {
    "key": "debts[].principal",
    "type": "money?",
    "label": "원금잔액",
    "group": "채무",
    "note": "원계약·채권자·금액·성질을 채무 객체마다 반복 저장",
    "legal_source_ids": [
      "K01",
      "K06",
      "K08",
      "K10"
    ],
    "requires_evidence_ref": true,
    "unknown_policy": "NULL_NOT_ZERO"
  },
  {
    "key": "debts[].interest",
    "type": "money?",
    "label": "이자잔액",
    "group": "채무",
    "note": "원계약·채권자·금액·성질을 채무 객체마다 반복 저장",
    "legal_source_ids": [
      "K01",
      "K06",
      "K08",
      "K10"
    ],
    "requires_evidence_ref": true,
    "unknown_policy": "NULL_NOT_ZERO"
  },
  {
    "key": "debts[].amount_as_of",
    "type": "date?",
    "label": "잔액기준일",
    "group": "채무",
    "note": "원계약·채권자·금액·성질을 채무 객체마다 반복 저장",
    "legal_source_ids": [
      "K01",
      "K06",
      "K08",
      "K10"
    ],
    "requires_evidence_ref": true,
    "unknown_policy": "NULL_NOT_ZERO"
  },
  {
    "key": "debts[].due_date",
    "type": "date?",
    "label": "납부기한",
    "group": "채무",
    "note": "원계약·채권자·금액·성질을 채무 객체마다 반복 저장",
    "legal_source_ids": [
      "K01",
      "K06",
      "K08",
      "K10"
    ],
    "requires_evidence_ref": true,
    "unknown_policy": "NULL_NOT_ZERO"
  },
  {
    "key": "debts[].security_status",
    "type": "enum",
    "label": "담보법적성격",
    "group": "채무",
    "note": "원계약·채권자·금액·성질을 채무 객체마다 반복 저장",
    "legal_source_ids": [
      "K01",
      "K06",
      "K08",
      "K10"
    ],
    "requires_evidence_ref": true,
    "unknown_policy": "NULL_NOT_ZERO"
  },
  {
    "key": "debts[].collateral_ids",
    "type": "text[]",
    "label": "담보자산",
    "group": "채무",
    "note": "원계약·채권자·금액·성질을 채무 객체마다 반복 저장",
    "legal_source_ids": [
      "K01",
      "K06",
      "K08",
      "K10"
    ],
    "requires_evidence_ref": true,
    "unknown_policy": "NULL_NOT_ZERO"
  },
  {
    "key": "debts[].priority_status",
    "type": "enum",
    "label": "우선권",
    "group": "채무",
    "note": "원계약·채권자·금액·성질을 채무 객체마다 반복 저장",
    "legal_source_ids": [
      "K01",
      "K06",
      "K08",
      "K10"
    ],
    "requires_evidence_ref": true,
    "unknown_policy": "NULL_NOT_ZERO"
  },
  {
    "key": "debts[].estate_claim_status",
    "type": "enum",
    "label": "재단채권",
    "group": "채무",
    "note": "원계약·채권자·금액·성질을 채무 객체마다 반복 저장",
    "legal_source_ids": [
      "K01",
      "K06",
      "K08",
      "K10"
    ],
    "requires_evidence_ref": true,
    "unknown_policy": "NULL_NOT_ZERO"
  },
  {
    "key": "debts[].non_discharge_ground",
    "type": "enum[]",
    "label": "비면책근거",
    "group": "채무",
    "note": "원계약·채권자·금액·성질을 채무 객체마다 반복 저장",
    "legal_source_ids": [
      "K01",
      "K06",
      "K08",
      "K10"
    ],
    "requires_evidence_ref": true,
    "unknown_policy": "NULL_NOT_ZERO"
  },
  {
    "key": "debts[].dispute",
    "type": "enum",
    "label": "다툼",
    "group": "채무",
    "note": "원계약·채권자·금액·성질을 채무 객체마다 반복 저장",
    "legal_source_ids": [
      "K01",
      "K06",
      "K08",
      "K10"
    ],
    "requires_evidence_ref": true,
    "unknown_policy": "NULL_NOT_ZERO"
  },
  {
    "key": "debts[].guarantee_subrogation",
    "type": "object?",
    "label": "보증·대위",
    "group": "채무",
    "note": "원계약·채권자·금액·성질을 채무 객체마다 반복 저장",
    "legal_source_ids": [
      "K01",
      "K06",
      "K08",
      "K10"
    ],
    "requires_evidence_ref": true,
    "unknown_policy": "NULL_NOT_ZERO"
  },
  {
    "key": "debts[].listed_snapshots",
    "type": "text[]",
    "label": "제출목록이력",
    "group": "채무",
    "note": "원계약·채권자·금액·성질을 채무 객체마다 반복 저장",
    "legal_source_ids": [
      "K01",
      "K06",
      "K08",
      "K10"
    ],
    "requires_evidence_ref": true,
    "unknown_policy": "NULL_NOT_ZERO"
  },
  {
    "key": "assets[].type",
    "type": "enum",
    "label": "재산·청구권종류",
    "group": "재산",
    "note": "재산 존재·귀속·평가·보호·면제결정을 별도로 관리",
    "legal_source_ids": [
      "K09",
      "K14",
      "K15",
      "K20",
      "K27"
    ],
    "requires_evidence_ref": true,
    "unknown_policy": "NULL_NOT_ZERO"
  },
  {
    "key": "assets[].legal_owner",
    "type": "text?",
    "label": "명의자",
    "group": "재산",
    "note": "재산 존재·귀속·평가·보호·면제결정을 별도로 관리",
    "legal_source_ids": [
      "K09",
      "K14",
      "K15",
      "K20",
      "K27"
    ],
    "requires_evidence_ref": true,
    "unknown_policy": "NULL_NOT_ZERO"
  },
  {
    "key": "assets[].beneficial_owner_issue",
    "type": "object?",
    "label": "실질귀속",
    "group": "재산",
    "note": "재산 존재·귀속·평가·보호·면제결정을 별도로 관리",
    "legal_source_ids": [
      "K09",
      "K14",
      "K15",
      "K20",
      "K27"
    ],
    "requires_evidence_ref": true,
    "unknown_policy": "NULL_NOT_ZERO"
  },
  {
    "key": "assets[].ownership_share",
    "type": "decimal?",
    "label": "지분",
    "group": "재산",
    "note": "재산 존재·귀속·평가·보호·면제결정을 별도로 관리",
    "legal_source_ids": [
      "K09",
      "K14",
      "K15",
      "K20",
      "K27"
    ],
    "requires_evidence_ref": true,
    "unknown_policy": "NULL_NOT_ZERO"
  },
  {
    "key": "assets[].gross_value",
    "type": "money?",
    "label": "평가액",
    "group": "재산",
    "note": "재산 존재·귀속·평가·보호·면제결정을 별도로 관리",
    "legal_source_ids": [
      "K09",
      "K14",
      "K15",
      "K20",
      "K27"
    ],
    "requires_evidence_ref": true,
    "unknown_policy": "NULL_NOT_ZERO"
  },
  {
    "key": "assets[].valuation_as_of",
    "type": "date?",
    "label": "기준일",
    "group": "재산",
    "note": "재산 존재·귀속·평가·보호·면제결정을 별도로 관리",
    "legal_source_ids": [
      "K09",
      "K14",
      "K15",
      "K20",
      "K27"
    ],
    "requires_evidence_ref": true,
    "unknown_policy": "NULL_NOT_ZERO"
  },
  {
    "key": "assets[].valuation_method",
    "type": "text",
    "label": "시가·회수가능성근거",
    "group": "재산",
    "note": "재산 존재·귀속·평가·보호·면제결정을 별도로 관리",
    "legal_source_ids": [
      "K09",
      "K14",
      "K15",
      "K20",
      "K27"
    ],
    "requires_evidence_ref": true,
    "unknown_policy": "NULL_NOT_ZERO"
  },
  {
    "key": "assets[].secured_balance",
    "type": "money?",
    "label": "실제담보잔액",
    "group": "재산",
    "note": "재산 존재·귀속·평가·보호·면제결정을 별도로 관리",
    "legal_source_ids": [
      "K09",
      "K14",
      "K15",
      "K20",
      "K27"
    ],
    "requires_evidence_ref": true,
    "unknown_policy": "NULL_NOT_ZERO"
  },
  {
    "key": "assets[].protection_basis",
    "type": "reference[]",
    "label": "압류금지근거",
    "group": "재산",
    "note": "재산 존재·귀속·평가·보호·면제결정을 별도로 관리",
    "legal_source_ids": [
      "K09",
      "K14",
      "K15",
      "K20",
      "K27"
    ],
    "requires_evidence_ref": true,
    "unknown_policy": "NULL_NOT_ZERO"
  },
  {
    "key": "assets[].exemption_application",
    "type": "object?",
    "label": "면제신청·기한",
    "group": "재산",
    "note": "재산 존재·귀속·평가·보호·면제결정을 별도로 관리",
    "legal_source_ids": [
      "K09",
      "K14",
      "K15",
      "K20",
      "K27"
    ],
    "requires_evidence_ref": true,
    "unknown_policy": "NULL_NOT_ZERO"
  },
  {
    "key": "assets[].exemption_decision",
    "type": "object?",
    "label": "인정결정·금액",
    "group": "재산",
    "note": "재산 존재·귀속·평가·보호·면제결정을 별도로 관리",
    "legal_source_ids": [
      "K09",
      "K14",
      "K15",
      "K20",
      "K27"
    ],
    "requires_evidence_ref": true,
    "unknown_policy": "NULL_NOT_ZERO"
  },
  {
    "key": "assets[].liquidation_contribution",
    "type": "money?",
    "label": "청산가치반영",
    "group": "재산",
    "note": "재산 존재·귀속·평가·보호·면제결정을 별도로 관리",
    "legal_source_ids": [
      "K09",
      "K14",
      "K15",
      "K20",
      "K27"
    ],
    "requires_evidence_ref": true,
    "unknown_policy": "NULL_NOT_ZERO"
  },
  {
    "key": "assets[].disposal_history[]",
    "type": "object[]",
    "label": "처분·대금",
    "group": "재산",
    "note": "재산 존재·귀속·평가·보호·면제결정을 별도로 관리",
    "legal_source_ids": [
      "K09",
      "K14",
      "K15",
      "K20",
      "K27"
    ],
    "requires_evidence_ref": true,
    "unknown_policy": "NULL_NOT_ZERO"
  },
  {
    "key": "assets[].successor_asset_ids",
    "type": "text[]",
    "label": "대체재산",
    "group": "재산",
    "note": "재산 존재·귀속·평가·보호·면제결정을 별도로 관리",
    "legal_source_ids": [
      "K09",
      "K14",
      "K15",
      "K20",
      "K27"
    ],
    "requires_evidence_ref": true,
    "unknown_policy": "NULL_NOT_ZERO"
  },
  {
    "key": "coverage.debt_inventory",
    "type": "enum",
    "label": "채무조사완전성",
    "group": "검증·절차·계획",
    "note": "법적 적용조건과 계산 결과를 별도로 관리",
    "legal_source_ids": [
      "K03",
      "K04",
      "K05",
      "K07",
      "K11",
      "K12"
    ],
    "requires_evidence_ref": true,
    "unknown_policy": "NULL_NOT_ZERO"
  },
  {
    "key": "coverage.asset_inventory",
    "type": "enum",
    "label": "재산조사완전성",
    "group": "검증·절차·계획",
    "note": "법적 적용조건과 계산 결과를 별도로 관리",
    "legal_source_ids": [
      "K03",
      "K04",
      "K05",
      "K07",
      "K11",
      "K12"
    ],
    "requires_evidence_ref": true,
    "unknown_policy": "NULL_NOT_ZERO"
  },
  {
    "key": "coverage.account_periods[]",
    "type": "object[]",
    "label": "계좌조회범위",
    "group": "검증·절차·계획",
    "note": "법적 적용조건과 계산 결과를 별도로 관리",
    "legal_source_ids": [
      "K03",
      "K04",
      "K05",
      "K07",
      "K11",
      "K12"
    ],
    "requires_evidence_ref": true,
    "unknown_policy": "NULL_NOT_ZERO"
  },
  {
    "key": "flows.unexplained_items[]",
    "type": "object[]",
    "label": "미설명흐름",
    "group": "검증·절차·계획",
    "note": "법적 적용조건과 계산 결과를 별도로 관리",
    "legal_source_ids": [
      "K03",
      "K04",
      "K05",
      "K07",
      "K11",
      "K12"
    ],
    "requires_evidence_ref": true,
    "unknown_policy": "NULL_NOT_ZERO"
  },
  {
    "key": "court.objection_status",
    "type": "enum",
    "label": "채권자·회생위원이의",
    "group": "검증·절차·계획",
    "note": "법적 적용조건과 계산 결과를 별도로 관리",
    "legal_source_ids": [
      "K03",
      "K04",
      "K05",
      "K07",
      "K11",
      "K12"
    ],
    "requires_evidence_ref": true,
    "unknown_policy": "NULL_NOT_ZERO"
  },
  {
    "key": "court.orders[]",
    "type": "object[]",
    "label": "요구·기한",
    "group": "검증·절차·계획",
    "note": "법적 적용조건과 계산 결과를 별도로 관리",
    "legal_source_ids": [
      "K03",
      "K04",
      "K05",
      "K07",
      "K11",
      "K12"
    ],
    "requires_evidence_ref": true,
    "unknown_policy": "NULL_NOT_ZERO"
  },
  {
    "key": "court.service_date",
    "type": "date?",
    "label": "송달일",
    "group": "검증·절차·계획",
    "note": "법적 적용조건과 계산 결과를 별도로 관리",
    "legal_source_ids": [
      "K03",
      "K04",
      "K05",
      "K07",
      "K11",
      "K12"
    ],
    "requires_evidence_ref": true,
    "unknown_policy": "NULL_NOT_ZERO"
  },
  {
    "key": "plan.disposable_income",
    "type": "money?",
    "label": "가용소득",
    "group": "검증·절차·계획",
    "note": "법적 적용조건과 계산 결과를 별도로 관리",
    "legal_source_ids": [
      "K03",
      "K04",
      "K05",
      "K07",
      "K11",
      "K12"
    ],
    "requires_evidence_ref": true,
    "unknown_policy": "NULL_NOT_ZERO"
  },
  {
    "key": "plan.term_months",
    "type": "integer?",
    "label": "변제기간",
    "group": "검증·절차·계획",
    "note": "법적 적용조건과 계산 결과를 별도로 관리",
    "legal_source_ids": [
      "K03",
      "K04",
      "K05",
      "K07",
      "K11",
      "K12"
    ],
    "requires_evidence_ref": true,
    "unknown_policy": "NULL_NOT_ZERO"
  },
  {
    "key": "plan.start_date",
    "type": "date?",
    "label": "기산일",
    "group": "검증·절차·계획",
    "note": "법적 적용조건과 계산 결과를 별도로 관리",
    "legal_source_ids": [
      "K03",
      "K04",
      "K05",
      "K07",
      "K11",
      "K12"
    ],
    "requires_evidence_ref": true,
    "unknown_policy": "NULL_NOT_ZERO"
  },
  {
    "key": "plan.term_exception_basis",
    "type": "reference[]",
    "label": "기간특례근거",
    "group": "검증·절차·계획",
    "note": "법적 적용조건과 계산 결과를 별도로 관리",
    "legal_source_ids": [
      "K03",
      "K04",
      "K05",
      "K07",
      "K11",
      "K12"
    ],
    "requires_evidence_ref": true,
    "unknown_policy": "NULL_NOT_ZERO"
  },
  {
    "key": "plan.payments[]",
    "type": "object[]",
    "label": "회차·금액·재원",
    "group": "검증·절차·계획",
    "note": "법적 적용조건과 계산 결과를 별도로 관리",
    "legal_source_ids": [
      "K03",
      "K04",
      "K05",
      "K07",
      "K11",
      "K12"
    ],
    "requires_evidence_ref": true,
    "unknown_policy": "NULL_NOT_ZERO"
  },
  {
    "key": "plan.total_present_value",
    "type": "money?",
    "label": "평가변제총액",
    "group": "검증·절차·계획",
    "note": "법적 적용조건과 계산 결과를 별도로 관리",
    "legal_source_ids": [
      "K03",
      "K04",
      "K05",
      "K07",
      "K11",
      "K12"
    ],
    "requires_evidence_ref": true,
    "unknown_policy": "NULL_NOT_ZERO"
  },
  {
    "key": "plan.liquidation_floor",
    "type": "money?",
    "label": "청산가치",
    "group": "검증·절차·계획",
    "note": "법적 적용조건과 계산 결과를 별도로 관리",
    "legal_source_ids": [
      "K03",
      "K04",
      "K05",
      "K07",
      "K11",
      "K12"
    ],
    "requires_evidence_ref": true,
    "unknown_policy": "NULL_NOT_ZERO"
  },
  {
    "key": "plan.priority_full_payment",
    "type": "enum",
    "label": "전액변제",
    "group": "검증·절차·계획",
    "note": "법적 적용조건과 계산 결과를 별도로 관리",
    "legal_source_ids": [
      "K03",
      "K04",
      "K05",
      "K07",
      "K11",
      "K12"
    ],
    "requires_evidence_ref": true,
    "unknown_policy": "NULL_NOT_ZERO"
  },
  {
    "key": "plan.funding_evidence[]",
    "type": "reference[]",
    "label": "추가재원",
    "group": "검증·절차·계획",
    "note": "법적 적용조건과 계산 결과를 별도로 관리",
    "legal_source_ids": [
      "K03",
      "K04",
      "K05",
      "K07",
      "K11",
      "K12"
    ],
    "requires_evidence_ref": true,
    "unknown_policy": "NULL_NOT_ZERO"
  },
  {
    "key": "plan.performability",
    "type": "enum",
    "label": "수행가능성",
    "group": "검증·절차·계획",
    "note": "법적 적용조건과 계산 결과를 별도로 관리",
    "legal_source_ids": [
      "K03",
      "K04",
      "K05",
      "K07",
      "K11",
      "K12"
    ],
    "requires_evidence_ref": true,
    "unknown_policy": "NULL_NOT_ZERO"
  }
];
export const LEGACY_DOCUMENT_REQUIREMENTS = [
  {
    "id": "identity",
    "label": "신청인·주소 확인",
    "scope": "case",
    "income_types": [
      "business",
      "wage",
      "mixed",
      "unknown"
    ],
    "purpose_features": [
      "jurisdiction.residence",
      "person.natural_person"
    ],
    "period_policy": "application_context",
    "alternatives": [
      {
        "all_of": [
          "resident_registration"
        ]
      }
    ],
    "legal_basis": [
      "K18",
      "K19",
      "K29"
    ],
    "document_basis": "COMMON_ATTACHMENT"
  },
  {
    "id": "salary_income",
    "label": "급여소득·반복수입 확인",
    "scope": "case",
    "income_types": [
      "wage",
      "mixed"
    ],
    "purpose_features": [
      "income.monthly_net",
      "income.recurring_evidence[]"
    ],
    "period_policy": "income_evidence_period",
    "alternatives": [
      {
        "condition": "primary_available",
        "all_of": [
          "withholding_certificate"
        ]
      },
      {
        "condition": "primary_unavoidably_unavailable",
        "any_of": [
          [
            "employer_signed_salary_statement"
          ],
          [
            "employer_signed_income_certificate"
          ],
          [
            "salary_bank_statement_for_required_period"
          ]
        ]
      }
    ],
    "legal_basis": [
      "K19",
      "K20"
    ],
    "document_basis": "CONDITIONAL_ATTACHMENT"
  },
  {
    "id": "business_registration",
    "label": "영업소득 유형·사업장 확인",
    "scope": "case",
    "income_types": [
      "business",
      "mixed"
    ],
    "purpose_features": [
      "income.sources[]",
      "jurisdiction.main_business"
    ],
    "period_policy": "application_context",
    "alternatives": [
      {
        "any_of": [
          [
            "business_registration"
          ],
          [
            "business_contract",
            "platform_settlement"
          ]
        ]
      }
    ],
    "legal_basis": [
      "K19",
      "K20"
    ],
    "document_basis": "CONDITIONAL_ATTACHMENT"
  },
  {
    "id": "business_income",
    "label": "사업매출·필요경비 및 산정기간 확인",
    "scope": "case",
    "income_types": [
      "business",
      "mixed"
    ],
    "purpose_features": [
      "income.business_revenue",
      "income.necessary_cost",
      "income.period",
      "income.recurring_evidence[]"
    ],
    "period_policy": "income_evidence_period",
    "alternatives": [
      {
        "any_of": [
          [
            "business_tax_return",
            "business_expense_ledger"
          ],
          [
            "monthly_business_report",
            "business_bank_statement"
          ],
          [
            "platform_settlement",
            "business_expense_ledger"
          ]
        ]
      }
    ],
    "legal_basis": [
      "K19",
      "K20",
      "K27"
    ],
    "document_basis": "CONDITIONAL_ATTACHMENT"
  },
  {
    "id": "household",
    "label": "가족구성·실제부양 확인",
    "scope": "case",
    "income_types": [
      "business",
      "wage",
      "mixed",
      "unknown"
    ],
    "purpose_features": [
      "household.members[]",
      "dependents.support_evidence[]",
      "household.recognized_count"
    ],
    "period_policy": "application_context",
    "alternatives": [
      {
        "all_of": [
          "family_relationship_certificate",
          "household_support_evidence"
        ]
      }
    ],
    "legal_basis": [
      "K19",
      "K20",
      "K21"
    ],
    "document_basis": "CONDITIONAL_ATTACHMENT"
  },
  {
    "id": "debt_statement",
    "label": "원계약·현채권자·원금·이자·성질 확인",
    "scope": "debt",
    "purpose_features": [
      "debts[].origin_contract_id",
      "debts[].current_creditor_id",
      "debts[].principal",
      "debts[].interest",
      "debts[].amount_as_of",
      "debts[].security_status",
      "debts[].priority_status",
      "debts[].estate_claim_status",
      "debts[].dispute"
    ],
    "period_policy": "balance_as_of",
    "alternatives": [
      {
        "any_of": [
          [
            "debt_certificate"
          ],
          [
            "loan_contract",
            "debt_balance_statement"
          ],
          [
            "judgment",
            "current_debt_evidence"
          ]
        ]
      }
    ],
    "legal_basis": [
      "K18",
      "K19",
      "K20"
    ],
    "document_basis": "CONDITIONAL_ATTACHMENT"
  },
  {
    "id": "vehicle_valuation",
    "label": "차량 소유·지분·시가·담보 확인",
    "scope": "vehicle",
    "purpose_features": [
      "assets[].legal_owner",
      "assets[].ownership_share",
      "assets[].gross_value",
      "assets[].valuation_as_of",
      "assets[].valuation_method",
      "assets[].secured_balance"
    ],
    "period_policy": "valuation_as_of",
    "alternatives": [
      {
        "all_of": [
          "vehicle_register",
          "vehicle_market_evidence",
          "secured_balance_evidence"
        ]
      }
    ],
    "legal_basis": [
      "K09",
      "K20",
      "K27"
    ],
    "document_basis": "CONDITIONAL_ATTACHMENT"
  },
  {
    "id": "property_valuation",
    "label": "부동산 소유·시가·담보·임차권 확인",
    "scope": "real_estate",
    "purpose_features": [
      "assets[].legal_owner",
      "assets[].ownership_share",
      "assets[].gross_value",
      "assets[].valuation_as_of",
      "assets[].valuation_method",
      "assets[].secured_balance"
    ],
    "period_policy": "valuation_as_of",
    "alternatives": [
      {
        "all_of": [
          "real_estate_register",
          "property_market_evidence",
          "secured_balance_evidence"
        ]
      }
    ],
    "legal_basis": [
      "K09",
      "K20",
      "K27"
    ],
    "document_basis": "CONDITIONAL_ATTACHMENT"
  },
  {
    "id": "insurance_value",
    "label": "보험 계약자·현재 해약환급가치 확인",
    "scope": "insurance",
    "purpose_features": [
      "assets[].legal_owner",
      "assets[].gross_value",
      "assets[].valuation_as_of",
      "assets[].secured_balance"
    ],
    "period_policy": "valuation_as_of",
    "alternatives": [
      {
        "all_of": [
          "insurance_policy",
          "insurance_surrender_certificate",
          "insurance_loan_statement"
        ]
      }
    ],
    "legal_basis": [
      "K09",
      "K20",
      "K27"
    ],
    "document_basis": "CONDITIONAL_ATTACHMENT"
  },
  {
    "id": "bank_balance",
    "label": "계좌 소유·기준일 잔고·조회범위 확인",
    "scope": "bank_account",
    "purpose_features": [
      "assets[].legal_owner",
      "assets[].gross_value",
      "assets[].valuation_as_of",
      "coverage.account_periods[]"
    ],
    "period_policy": "balance_as_of",
    "alternatives": [
      {
        "all_of": [
          "bank_balance_certificate",
          "bank_statement"
        ]
      }
    ],
    "legal_basis": [
      "K09",
      "K20"
    ],
    "document_basis": "CONDITIONAL_ATTACHMENT"
  },
  {
    "id": "lease_value",
    "label": "임차보증금 반환권·담보 및 주거비 확인",
    "scope": "lease",
    "purpose_features": [
      "assets[].legal_owner",
      "assets[].gross_value",
      "assets[].secured_balance",
      "assets[].valuation_method"
    ],
    "period_policy": "application_context",
    "alternatives": [
      {
        "all_of": [
          "lease_contract",
          "lease_payment_evidence",
          "secured_balance_evidence"
        ]
      }
    ],
    "legal_basis": [
      "K09",
      "K14",
      "K20",
      "K24"
    ],
    "document_basis": "CONDITIONAL_ATTACHMENT"
  },
  {
    "id": "asset_inventory",
    "label": "기타 재산의 존재·귀속·가액 확인",
    "scope": "asset",
    "purpose_features": [
      "assets[].type",
      "assets[].legal_owner",
      "assets[].gross_value",
      "assets[].valuation_method"
    ],
    "period_policy": "valuation_as_of",
    "alternatives": [
      {
        "all_of": [
          "asset_ownership_evidence",
          "asset_valuation_evidence"
        ]
      }
    ],
    "legal_basis": [
      "K09",
      "K20",
      "K27"
    ],
    "document_basis": "INTERNAL_VERIFICATION"
  },
  {
    "id": "passive_income_rent",
    "label": "임대수입 발생원인·기간·순액·반복성 확인",
    "scope": "income_source",
    "source_kinds": [
      "rent"
    ],
    "purpose_features": [
      "income_source.kind",
      "income_source.net",
      "income_source.period",
      "income_source.recurring_evidence"
    ],
    "period_policy": "income_evidence_period",
    "alternatives": [
      {
        "any_of": [
          [
            "rental_contract",
            "rent_receipt_statement"
          ]
        ]
      }
    ],
    "legal_basis": [
      "K01",
      "K19"
    ],
    "document_basis": "INTERNAL_VERIFICATION",
    "note": "소득으로 산정할 수 있는 권리인지, 보호 법률·반복성·기간·중복 여부는 검토한다. 급여를 자동으로 가용소득으로 인정하지 않는다."
  },
  {
    "id": "passive_income_interest",
    "label": "이자수입 발생원인·기간·순액·반복성 확인",
    "scope": "income_source",
    "source_kinds": [
      "interest"
    ],
    "purpose_features": [
      "income_source.kind",
      "income_source.net",
      "income_source.period",
      "income_source.recurring_evidence"
    ],
    "period_policy": "income_evidence_period",
    "alternatives": [
      {
        "any_of": [
          [
            "interest_income_statement"
          ]
        ]
      }
    ],
    "legal_basis": [
      "K01",
      "K19"
    ],
    "document_basis": "INTERNAL_VERIFICATION",
    "note": "소득으로 산정할 수 있는 권리인지, 보호 법률·반복성·기간·중복 여부는 검토한다. 급여를 자동으로 가용소득으로 인정하지 않는다."
  },
  {
    "id": "passive_income_dividend",
    "label": "배당수입 발생원인·기간·순액·반복성 확인",
    "scope": "income_source",
    "source_kinds": [
      "dividend"
    ],
    "purpose_features": [
      "income_source.kind",
      "income_source.net",
      "income_source.period",
      "income_source.recurring_evidence"
    ],
    "period_policy": "income_evidence_period",
    "alternatives": [
      {
        "any_of": [
          [
            "dividend_income_statement"
          ]
        ]
      }
    ],
    "legal_basis": [
      "K01",
      "K19"
    ],
    "document_basis": "INTERNAL_VERIFICATION",
    "note": "소득으로 산정할 수 있는 권리인지, 보호 법률·반복성·기간·중복 여부는 검토한다. 급여를 자동으로 가용소득으로 인정하지 않는다."
  },
  {
    "id": "passive_income_pension",
    "label": "연금수입 발생원인·기간·순액·반복성 확인",
    "scope": "income_source",
    "source_kinds": [
      "pension"
    ],
    "purpose_features": [
      "income_source.kind",
      "income_source.net",
      "income_source.period",
      "income_source.recurring_evidence"
    ],
    "period_policy": "income_evidence_period",
    "alternatives": [
      {
        "any_of": [
          [
            "pension_entitlement_certificate",
            "pension_payment_statement"
          ]
        ]
      }
    ],
    "legal_basis": [
      "K01",
      "K19"
    ],
    "document_basis": "INTERNAL_VERIFICATION",
    "note": "소득으로 산정할 수 있는 권리인지, 보호 법률·반복성·기간·중복 여부는 검토한다. 급여를 자동으로 가용소득으로 인정하지 않는다."
  },
  {
    "id": "passive_income_benefit",
    "label": "복지·사회보장 급여 발생원인·기간·순액·반복성 확인",
    "scope": "income_source",
    "source_kinds": [
      "benefit",
      "benefits"
    ],
    "purpose_features": [
      "income_source.kind",
      "income_source.net",
      "income_source.period",
      "income_source.recurring_evidence"
    ],
    "period_policy": "income_evidence_period",
    "alternatives": [
      {
        "any_of": [
          [
            "benefit_decision",
            "benefit_payment_statement"
          ]
        ]
      }
    ],
    "legal_basis": [
      "K01",
      "K19"
    ],
    "document_basis": "INTERNAL_VERIFICATION",
    "note": "소득으로 산정할 수 있는 권리인지, 보호 법률·반복성·기간·중복 여부는 검토한다. 급여를 자동으로 가용소득으로 인정하지 않는다."
  },
  {
    "id": "passive_income_other",
    "label": "기타 반복수입 발생원인·기간·순액·반복성 확인",
    "scope": "income_source",
    "source_kinds": [
      "other"
    ],
    "purpose_features": [
      "income_source.kind",
      "income_source.net",
      "income_source.period",
      "income_source.recurring_evidence"
    ],
    "period_policy": "income_evidence_period",
    "alternatives": [
      {
        "any_of": [
          [
            "income_source_contract",
            "income_payment_statement"
          ]
        ]
      }
    ],
    "legal_basis": [
      "K01",
      "K19"
    ],
    "document_basis": "INTERNAL_VERIFICATION",
    "note": "소득으로 산정할 수 있는 권리인지, 보호 법률·반복성·기간·중복 여부는 검토한다. 급여를 자동으로 가용소득으로 인정하지 않는다."
  }
];
