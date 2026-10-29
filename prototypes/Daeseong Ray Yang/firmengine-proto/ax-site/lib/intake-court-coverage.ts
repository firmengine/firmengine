import type { IntakeCatalog, IntakeDocumentNeed, IntakeRule, IntakeScope } from "./intake-types.ts";

/** 2026-10-30 court-verified additions for 12 documents not linked by existing rules.
 * Seoul/Busan Practice Rule 402 §2 attachments and §3 discretionary requests
 * are kept separate. These are advisory collection/authoring instructions,
 * not a finding of legal sufficiency or evidence acceptance.
 */
const court = ["SRC-INTAKE-SEOUL-402", "SRC-INTAKE-BUSAN-402"];
const office = ["SRC-INTAKE-OFFICE-POLICY"];
const sb = ["seoul", "busan"];
const period = {
  property: "신청 예정일 기준 본인 명의 지적전산 조회범위·기준일 확인; 행정정보 공동이용 여부 별도 확인",
  tax: "신청 예정일 기준 본인 명의 과세지역·연도·세목·미과세 표시 확인; 행정정보 공동이용 여부 별도 확인",
  pension: "신청 예정일 기준 국민연금 가입·납부이력 및 발급일·대상기간 확인",
  statement: "현재 신청을 위한 채무발생 경위·서명 확인; 담당자가 초안 작성",
};
function need(documentTypeId:string,reason:string,period:string,requirement:IntakeDocumentNeed["requirement"]="recommended"):IntakeDocumentNeed {
 return {documentTypeId,alternatives:[],alternativePolicy:"review_required",period,requirement,reason};
}
function rule(n:number,title:string,scope:IntakeScope,documents:IntakeDocumentNeed[],option:{
 all?:string[];any?:string[];jurisdictions?:string[];sourceIds?:string[];
 workflowIds?:string[];questions?:string[];legalReviewRequired?:boolean;
}={}):IntakeRule {
 return {id:`INTAKE-${n}`,title,scope,enabled:true,
  all:(option.all??[]).map(featureId=>({featureId,state:"present" as const})),
  any:(option.any??[]).map(featureId=>({featureId,state:"present" as const})),
  documents,questions:option.questions??[],workflowIds:option.workflowIds??["WF-01"],
  sourceIds:option.sourceIds??office,jurisdictions:option.jurisdictions??[],
  effectiveFrom:null,effectiveTo:null,legalReviewRequired:option.legalReviewRequired??false};
}
export const INTAKE_COVERAGE_RULES:IntakeRule[] = [
 rule(55,"채권자 누락 점검용 본인 신용정보 조회","case",[
  need("credit_information_report","신용이력·채권자변동 누락을 대조하는 권장자료입니다. 현 채무잔액증명을 대체하지 않습니다.","신청 직전 본인 명의 최신 조회·발급본")
 ],{sourceIds:["SRC-SHARED-CREDIT4U",...office],workflowIds:["WF-02"]}),
 rule(56,"서울·부산 본인 지적전산·지방세 제출자료","case",[
  need("property_ownership_search","서울·부산 실무준칙 제402호 제2조 제2호 다목의 채무자 본인 지적전산자료조회결과서입니다. 개별 등기부·일반 부동산 조회가 자동 대체하지 않습니다.",period.property,"required_when_applicable"),
  need("local_tax_assessment","서울·부산 실무준칙 제402호 제2조 제2호 다목의 채무자 본인 지방세세목별과세증명서입니다. 과세증명·체납증명·완납증명을 구분합니다.",period.tax,"required_when_applicable")
 ],{sourceIds:court,jurisdictions:sb,workflowIds:["WF-03"]}),
 rule(57,"서울·부산 국민연금산정용 가입내역","case",[
  need("pension_contribution_statement","서울·부산 실무준칙 제402호 제2조 제3호 다목의 가입내역확인서에 대응합니다. 수급액증명·퇴직금증명과 별도입니다.",period.pension,"required_when_applicable")
 ],{sourceIds:court,jurisdictions:sb,workflowIds:["WF-04"]}),
 rule(58,"서울·부산 진술서 작성·제출 준비","case",[
  need("applicant_statement","서울·부산 실무준칙 제402호 제2조의 진술서 제출 준비입니다. 의뢰인에게 발급 요구하는 증명서가 아니라 담당자 작성·신청인 검수 대상입니다.",period.statement,"required_when_applicable")
 ],{sourceIds:court,jurisdictions:sb,workflowIds:["WF-05"]}),
 rule(59,"기타 관할 재산 소유·과세 기초조회(권장)","case",[
  need("property_ownership_search","본인 명의 재산 누락 점검을 위한 권장 조회입니다. 해당 관할의 별도 지침과 공동이용 인정여부를 확인합니다.",period.property),
  need("local_tax_assessment","재산 보유·과세 확인용 권장 자료이며 체납 여부를 증명하는 서류와 다릅니다.",period.tax)
 ],{sourceIds:["SRC-SHARED-PROPERTY-SEARCH","SRC-SHARED-GOV-LOCAL-TAX",...office],workflowIds:["WF-03"]}),
 rule(60,"일반 소득이력 확인용 연금 가입내역","income",[
  need("pension_contribution_statement","고용·소득이력 추가 확인용 권장자료입니다. 국민연금 미가입은 소득 없음의 증명이 아닙니다.",period.pension)
 ],{any:["income.wage","income.business","income.freelance"],sourceIds:["SRC-SHARED-NPS-CONTRIBUTION",...office],workflowIds:["WF-04"]}),
 rule(61,"보유 예금의 계좌 거래흐름 확인","asset",[
  need("bank_statement","예금 잔액자료와 입출금내역은 다릅니다. 서울·부산 실무준칙 제402호 제3조의 직전 1년은 법원이 추가로 명할 수 있는 기간이며 전국 공통 제출의무가 아닙니다.","대상 본인 계좌·필요한 기간을 특정; 법원의 개별 명령이 있으면 명령문 적용")
 ],{all:["asset.deposit"],sourceIds:[...court,...office],workflowIds:["WF-03"],questions:["어느 계좌의 어떤 거래기간이 실제 필요한지 확인해 주세요."]}),
 rule(62,"재산 처분대금 거래흐름 추가 소명","event",[
  need("bank_statement","처분대금이 실제 계좌를 거친 경우 관련 거래내역으로 확인합니다. 현금거래였다면 거래내역을 지어내지 않고 다른 소명자료를 확인합니다.","처분일과 사용일 전후 해당 계좌 범위를 지정")
 ],{all:["event.asset_disposal"],sourceIds:office,workflowIds:["WF-03"],questions:["처분대금이 실제 은행계좌로 입출금되었는지 확인해 주세요."]}),
 rule(63,"은행계좌 외 현금·현금성자산 보유 확인","asset",[
  need("cash_holding_statement","계좌 밖에 실제 현재 보유한 현금과 출처만 확인합니다. 계좌 잔고나 과거 인출을 현재 현금 보유로 추정하지 않습니다.","현재 보유 기준일 및 해당 현금 취득 시점")
 ],{all:["asset.cash_on_hand"],workflowIds:["WF-03"]}),
 rule(64,"추가 생계비 청구액과 실지급액 대조","expense",[
  need("household_expense_ledger","의료·주거·교육 등 특별 지출의 청구액·본인 실지급액·분담·보전금을 구별합니다. 제출 자체로 법원의 추가생계비 인정을 뜻하지 않습니다.","지출 발생·청구·실지급 기간을 구별해 해당 기간 지정")
 ],{any:["expense.medical","expense.housing","expense.education"],workflowIds:["WF-04"]}),
 rule(65,"신청인 진술·채무증대경위 작성 업무","case",[
  need("applicant_statement","기 제출된 진술서는 수집할 수 있으나 신규 서류는 담당자가 초안을 작성하고 신청인에게 확인·서명받습니다.",period.statement)
 ],{workflowIds:["WF-05"]}),
 rule(66,"개시신청서 인적사항·관할 검수 업무","case",[
  need("application_form_input","신규 신청서는 담당자가 작성합니다. 인적사항과 관할 입력을 상담기록으로 확인하고 과거 접수본이 있을 때만 기존 서식을 요청합니다.","신청 예정일·주소·관할 판단시점 및 기존 접수일")
 ],{workflowIds:["WF-05"]}),
 rule(67,"변제계획 재원·처분·지급일정 검수 업무","case",[
  need("plan_funding_statement","내부 작성·검수 항목입니다. 소득자료와 처분대금 근거를 연결해 변제계획안에 반영하고 의뢰인에게 존재하지 않는 양식 발급을 요구하지 않습니다.","변제계획 대상기간·재원 발생시점·지급예정일")
 ],{workflowIds:["WF-05"]}),
 rule(68,"현재 사건 법원 개별 자료제출요구 기록","procedure",[
  need("case_specific_court_request","현재 사건에 실제로 송달된 법원의 개별 명령·질의·회신 원문을 확인하며 이전 사건 명령을 적용하지 않습니다.","현재 사건의 실제 송달일·제출기한·대상기간")
 ],{all:["procedure.court_order"],legalReviewRequired:true,workflowIds:["WF-06"]}),
 rule(69,"이직·휴직 등 소득 변동의 기간별 영향","income",[
  need("income_household_change_evidence","변동 전후 소득 차이와 지속 기간을 소명합니다. 이미 확보한 고용변동 자료로 충분하면 중복 제출을 검토합니다.","고용변동 발생·효력일 전후와 실제 수입변경 기간")
 ],{all:["income.employment_changed"],workflowIds:["WF-04"]}),
 rule(70,"폐업·이혼·상속으로 인한 가구·소득 변화","event",[
  need("income_household_change_evidence","해당 사건이 실제 가구구성·소득·지출에 미친 영향이 있는지 질문하고 필요한 기간의 증빙만 요청합니다.","실제 사건 발생·효력일 및 소득·가구 영향기간")
 ],{any:["event.business_closed","event.divorce","event.inheritance"],workflowIds:["WF-04"]}),
];

export function addIntakeCourtCoverage(seed:IntakeCatalog):IntakeCatalog {
 const result=structuredClone(seed);
 if(!result.features.some(x=>x.id==="asset.cash_on_hand")) result.features.push({
  id:"asset.cash_on_hand",label:"은행계좌 밖 현금·현금성자산 보유",scope:"asset",
  question:"현재 계좌 밖에 별도로 실제 보유한 현금·수표·현금성자산과 자금출처가 있습니까?",
  essential:false,description:"현재 실제 보유를 명시한 경우만 해당. 계좌잔고·과거 인출·타인 보유를 본인 현금으로 단정하지 않음."
 });
 const known=new Set(result.rules.map(rule=>rule.id));
 for(const added of INTAKE_COVERAGE_RULES) if(!known.has(added.id))result.rules.push(structuredClone(added));
 // A new version also distinguishes the seed from its immutable predecessors.
 if(result.version<3)result.version=3;
 result.note+=" 추가 서류 규칙: 서울·부산 제402호 제2조 첨부와 제3조의 추가 제출명령 가능자료를 구별합니다. 신규 작성서식은 담당자 작업이며 의뢰인 발급 요구로 보지 않습니다.";
 return result;
}
