import { INTAKE_SCHEMA_VERSION } from "./intake-types.ts";
import type { IntakeCatalog, IntakeDocumentNeed, IntakeDocumentType, IntakeFeature, IntakeRule, IntakeScope, IntakeSource } from "./intake-types.ts";

/**
 * Saved master-data seed for consultation triage, not a finding of fact or a court filing approval.
 * Generic rows are collection recommendations. Court-specific mandatory rows retain their jurisdiction.
 * A document's existence, a client's statement, and a reviewed source observation are separate states.
 */
const checkedAt = "2026-10-29";
const currentPeriod = "신청 예정일·잔액 기준일을 확인하여 최신 자료 준비; 발급일과 내용 기준일을 별도 확인";
const incomePeriod = "실제 근무·영업 시작일과 소득 귀속기간 확인; 제출할 월수·과세연도는 관할법원 기준으로 확정";
const transactionPeriod = "관련 거래일 전후와 현재 잔액을 연결; 조회 시작·종료일은 사실관계와 관할 요구사항에 따라 확정";

const sources: IntakeSource[] = [
  { id: "SRC-INTAKE-SC-GUIDE", title: "개인회생사건 처리지침(재민 2004-4), 2026.7.1 시행", url: "https://www.law.go.kr/LSW/admRulInfoP.do?admRulSeq=2200000108651&chrClsCd=010201", jurisdiction: "대한민국", checkedAt, locator: "제4조 제1항~제7항; 대법원재판예규 제1958호", note: "관공서 작성 첨부자료의 발급시점, 부채자료 확보 곤란 시 자료송부청구 대체, 법원별 목록·추가요구·중복자료 면제 근거. 모든 문서에 같은 조회기간을 부여하는 규정은 아님." },
  { id: "SRC-INTAKE-SEOUL-402", title: "서울회생법원 실무준칙 제402호", url: "https://slb.scourt.go.kr/rel/information/qna/practice_rule.pdf", jurisdiction: "seoul", checkedAt, locator: "제402호 제2조·제3조, 공개 PDF 228~231쪽; 2026.9.23 개정 부칙 포함 판본", note: "제2조 첨부자료와 제3조 법원이 추가로 명할 수 있는 자료를 구분. 급여 대체자료의 최근 6개월과 사업 수입상황보고서의 직전 1년은 해당 문맥에만 적용. 타 법원의 필수목록으로 일반화하지 않음." },
  { id: "SRC-INTAKE-BUSAN-402", title: "부산회생법원 실무준칙 제402호", url: "https://bsb.scourt.go.kr/bsb/info/info_01/practice_rule_bsb.pdf", jurisdiction: "busan", checkedAt, locator: "제402호 제2조·제3조, 공개 PDF 210~213쪽; 2026.8.28 개정 부칙 포함 판본", note: "부산 관할의 첨부·추가자료 범주. 별도 2026.7.1 자료제출목록의 게시 사실은 확인했으나 HWP 세부 항목을 이 seed의 검증 근거로 사용하지 않음." },
  { id: "SRC-INTAKE-SEOUL-MANUAL", title: "서울회생법원 회생위원 직무편람 제5판", url: "https://slb.scourt.go.kr/rel/information/qna/member_manual.pdf", jurisdiction: "seoul", checkedAt, locator: "2024.12 발간; 채권자목록·재산목록·수입 및 지출 조사 부분", note: "개인차용·담보·예금·보험·사업비·추가생계비 등 사실확인 자료를 참고. 금액기준과 법률적 판단을 이 상담목록에서 자동 적용하지 않으며 현행 관할 기준의 대체 자료로 보지 않음." },
  { id: "SRC-INTAKE-ADMIN-INFO", title: "개인회생 행정정보 공동이용 안내", url: "https://changwon.scourt.go.kr/dcboard/new/DcNewsViewAction.work?cbub_code=000420&gubun=41&pageIndex=2&scode_kname=&searchWord=&seqnum=20468", jurisdiction: "changwon", checkedAt, locator: "2026.7.2 공지; 법 제589조 제2항~제4항 및 공동이용 대상 13종", note: "동의 의향·동의서 제출과 실제 행정정보 확인·전산등재를 구분. 상담내용만으로 자료가 제출·검증되었다고 표시하지 않음." },
  { id: "SRC-INTAKE-GOV-VEHICLE", title: "정부24 자동차 등록원부등본(초본) 발급·열람", url: "https://m.gov.kr/mw/AA020InfoCappView.do?CappBizCD=15000000334&HighCtgCD=A03007&Mcode=10020&tp_seq=02", jurisdiction: "대한민국", checkedAt, locator: "발급서류 자동차등록원부 갑·을 및 제공내용", note: "차량별 소유자·저당 등 확인용 발급 안내. 자동차등록증과 등록원부를 동일 문서로 취급하지 않음." },
  { id: "SRC-INTAKE-GOV-BUSINESS", title: "정부24 사업자등록증명 발급", url: "https://www.gov.kr/mw/AA020InfoCappView.do?CappBizCD=12100000016&HighCtgCD=A09002", jurisdiction: "대한민국", checkedAt, locator: "사업자등록증명 발급서류·제공내용", note: "등록한 사업내용의 증명. 상담에서 실질 영업이 있다는 사실만으로 사업자등록 존재를 추정하지 않음." },
  { id: "SRC-INTAKE-GOV-INCOME", title: "정부24 소득금액증명 발급", url: "https://m.gov.kr/mw/AA020InfoCappView.do?CappBizCD=12100000021", jurisdiction: "대한민국", checkedAt, locator: "종합소득·연말정산소득·일용근로소득에 대한 과세 소득 증명", note: "과세된 소득의 증명이며 최근 실제 입금액이나 장래 수입의 단독 증명이 아님. 미신고·신규취업을 소득 0원으로 처리하지 않음." },
  { id: "SRC-INTAKE-GOV-VAT", title: "정부24 부가가치세과세표준증명 발급", url: "https://www.gov.kr/mw/AA020InfoCappView.do?CappBizCD=12100000331", jurisdiction: "대한민국", checkedAt, locator: "부가가치세 신고내역에 대한 증명", note: "과세사업의 신고매출 자료. 순이익 증명으로 사용하지 않고 면세사업자에게 무조건 요구하지 않음." },
  { id: "SRC-INTAKE-GOV-TAX-FACT", title: "정부24 사실증명 발급·체납내역 유형 안내", url: "https://www.gov.kr/mw/AA020InfoCappView.do?CappBizCD=12100000352&HighCtgCD=", jurisdiction: "대한민국", checkedAt, locator: "사실증명 13종 중 체납내역; 발급창구 안내", note: "국세 체납내역 사실증명은 홈택스·세무서 경로를 안내. 정부24 자체 제공은 신고사실없음·사업자등록사실여부에 한정된다고 안내됨." },
  { id: "SRC-INTAKE-OFFICE-POLICY", title: "FirmEngine 상담단계 서류수집 기준 초안", url: "https://firmengine-ax-review.starry-tiger-1837.chatgpt.site", jurisdiction: "사무실 공통 사전확인", checkedAt, locator: "상담별 필요서류 기준정보 v1", note: "공식 자료를 참고해 구성한 초기 수집 후보. recommended는 전국 법원 공통 의무가 아님. 관할·대상·기간·대체서류를 담당자가 확인하며 의뢰인 진술을 사실 인정으로 승격하지 않음." },
];
const courtSources = ["SRC-INTAKE-SEOUL-402", "SRC-INTAKE-BUSAN-402"];
const officeSources = ["SRC-INTAKE-OFFICE-POLICY"];
const manualSources = ["SRC-INTAKE-SEOUL-MANUAL", ...officeSources];

function feature(id: string, label: string, scope: IntakeScope, question: string, description: string, essential = false): IntakeFeature {
  return { id, label, scope, question, description, essential };
}
const features: IntakeFeature[] = [
  feature("case.multiple_income", "복수 소득원·겸업", "case", "급여·사업·임대·연금 등 모든 소득원과 각각의 기간을 알려주세요.", "소득원 두 개 이상을 직접 진술한 경우. 다른 사람의 소득과 합치거나 입금건수만으로 판단하지 않음."),
  feature("income.wage", "급여 근로소득", "income", "현재 근무하는 직장, 입사일, 급여 지급주기와 공제내역은 무엇인가요?", "현재 사용자별 급여소득. 과거 직장은 temporal=past로 보존.", true),
  feature("income.business", "개인사업·실질 영업소득", "income", "직접 운영하는 사업, 영업 시작일과 매출·비용이 있나요?", "실제 사업 운영을 의미하며 사업자등록 보유와 별도. 배우자의 사업을 본인 사업으로 합치지 않음.", true),
  feature("income.business_registered", "본인 명의 사업자등록", "income", "이 사업에 본인 명의 사업자등록이 있나요? 등록명의·번호·개업일은 무엇인가요?", "동일 사업 소득원에 대해 등록 유무가 명시된 경우만 present/absent."),
  feature("income.vat_taxable", "부가가치세 과세사업", "income", "이 사업은 부가가치세 과세사업인가요? 일반·간이과세 여부와 신고기간을 알려주세요.", "동일 사업의 과세유형이 확인될 때만 표시. 사업자등록 존재만으로 추정하지 않음."),
  feature("income.vat_exempt", "부가가치세 면세사업", "income", "이 사업은 면세사업인가요? 사업장현황신고나 면세수입금액 자료가 있나요?", "면세와 영세율은 구분. 과세사업과 겸영 시 사업별 구분을 추가 질문."),
  feature("income.freelance", "프리랜서·일용·플랫폼 수입", "income", "계약·정산하는 업체나 플랫폼별 지급주기와 실제 수입·수수료를 알려주세요.", "반복 노무·서비스 수입. 명칭만으로 근로·사업의 법률적 지위를 확정하지 않음."),
  feature("income.rent", "임대 수입", "income", "빌려준 물건별 임차인·계약기간·보증금·임대료가 어떻게 되나요?", "신청인이 받는 임대료. 신청인이 내는 월세와 구분."),
  feature("income.interest", "이자 수입", "income", "어느 계좌·대여금에서 어느 기간의 이자를 받고 있나요?", "원금 회수·계좌 간 이체를 이자수입으로 분류하지 않음."),
  feature("income.dividend", "배당 수입", "income", "배당 지급회사·계좌·지급일과 반복 지급 여부를 알려주세요.", "배당 수입과 주식매도대금은 구분."),
  feature("income.pension", "연금 수급", "income", "수급 중인 연금의 종류·지급기관·지급기간은 무엇인가요?", "지급받는 연금수입과 아직 수령하지 않는 퇴직연금자산을 구분."),
  feature("income.employment_changed", "이직·신규취업·휴직 등 변동", "income", "언제 직장·근무상태·급여가 바뀌었고 전후 소득은 어떻게 다른가요?", "현재 소득원을 설명하는 고용변동. 과거사건 자체는 event로 별도 보존 가능."),
  feature("debt.financial", "금융기관 대출", "debt", "대출한 금융기관별 계약과 현재 원금·이자 잔액을 알려주세요.", "채권자·계약별 분리. 기관명이 같아도 계약을 임의 병합하지 않음.", true),
  feature("debt.card", "신용카드·카드대출 채무", "debt", "카드사별 카드대금·현금서비스·카드론 잔액과 사용기간은 어떻게 되나요?", "카드 이용금액과 대출잔액을 중복 합산하지 않음."),
  feature("debt.private", "가족·지인·개인 차용", "debt", "누구에게 언제 얼마를 빌렸고 차용증·입출금·변제내역이 있나요?", "신청인이 빌린 돈. 신청인이 남에게 빌려준 돈은 asset.receivable."),
  feature("debt.secured", "담보부 채무", "debt", "담보 물건·소유자·담보권자와 현재 대출잔액은 무엇인가요?", "담보의 존재·소유자를 진술한 경우. 자동차할부라는 명칭만으로 저당 설정을 확정하지 않음."),
  feature("debt.guarantee", "보증·연대·구상 관계", "debt", "주채무자·보증인·채권자는 누구이고 대위변제나 청구가 있었나요?", "신청인이 보증한 경우와 신청인의 빚에 타인이 보증한 경우를 subjectLabel과 인용으로 구분."),
  feature("debt.assigned", "채권양도·대위변제", "debt", "원래 채권자와 현재 청구자는 누구이며 양도·대위변제 통지를 받았나요?", "동일 원채무의 승계 여부 확인. 원채권자와 승계채권자를 별개 빚으로 자동 합산하지 않음."),
  feature("debt.tax", "국세·지방세 체납", "debt", "국세인지 지방세인지, 세목·귀속기간·납기·체납액을 알려주세요.", "완납증명 대신 실제 체납내역 확인. 체납을 자동으로 특정 법적 채권등급에 넣지 않음."),
  feature("debt.social_insurance", "사회보험료·징수금 미납", "debt", "어느 기관의 보험료 또는 기타징수금인지, 귀속기간·납기는 언제인가요?", "건강보험료와 기타징수금 등 성질 구분이 필요."),
  feature("debt.disputed", "다툼·소송·집행 중 채무", "debt", "다투는 금액·사유와 진행 중인 소송·지급명령·압류의 사건번호가 있나요?", "청구금액이 확정채무라는 뜻이 아님. 송달·확정 여부를 추가 확인."),
  feature("debt.recent", "최근 발생·증가한 채무", "debt", "최근 새로 빌리거나 늘어난 채무의 날짜·금액·사용처는 무엇인가요?", "최근의 의미·기간을 임의 고정하지 않고 상담에서 특정된 거래일을 질문."),
  feature("asset.vehicle_owned", "본인 소유 차량·이륜차", "asset", "본인 명의 차량별 등록번호·차종·연식·지분과 담보 여부를 알려주세요.", "타인 차량을 운전하는 사실·렌트·리스와 소유를 구분.", true),
  feature("asset.vehicle_leased", "리스·렌트 차량 이용", "asset", "차량 소유자는 누구이며 리스·렌트 계약의 보증금·월납입·종료조건은 무엇인가요?", "사용 사실만으로 차량 전체를 신청인 소유재산으로 만들지 않음."),
  feature("asset.vehicle_financed", "차량 관련 할부·담보부담", "asset", "이 차량의 할부금·대출·저당 설정과 현재 미상환잔액이 있나요?", "동일 차량별 부담. 채무기록과 이중으로 새 채무를 만들지 않음."),
  feature("asset.real_estate", "본인 부동산 소유·지분", "asset", "본인 소유 토지·건물·주택의 주소·지분·담보·임차관계를 알려주세요.", "임차 거주와 소유를 구분하며 공동소유는 본인 지분 확인.", true),
  feature("asset.lease_deposit", "전세·월세·사업장 임차보증금", "asset", "본인이 지급한 보증금별 계약자·소재지·금액·반환가능액은 무엇인가요?", "신청인이 돌려받을 보증금. 신청인이 임대인으로 받은 보증금은 별도 반환채무 확인."),
  feature("asset.insurance", "보험 계약·해약환급금", "asset", "가입 보험의 계약자·피보험자·수익자와 해약환급금·약관대출이 있나요?", "단순 피보험자라는 이유만으로 환급금이 본인 재산이라고 추정하지 않음."),
  feature("asset.insurance_loan", "보험계약 대출·약관대출", "asset", "이 보험계약에 실제 약관대출이나 환급금 공제액이 있나요?", "동일 보험계약의 대출·공제 존재가 명시된 경우에만 해당. 보험 가입만으로 대출을 추정하지 않음."),
  feature("asset.deposit", "예금·적금·외화·현금", "asset", "본인 계좌별 현재 잔액과 예적금·외화·보유현금이 있나요?", "예금잔액과 입금액은 다른 값. 가족 명의 계좌는 명의·실질소유 추가 확인."),
  feature("asset.securities", "주식·펀드·출자지분", "asset", "보유 증권·펀드·비상장지분의 계좌·수량·기준일과 처분내역이 있나요?", "과거 투자 손실과 현재 보유잔액을 구분."),
  feature("asset.crypto", "가상자산·거래소·지갑", "asset", "거래소·개인지갑별 보유수량·기준일·입출고 내역이 있나요?", "기왕 손실만으로 잔고가 없다고 추정하지 않으며 지갑 간 이체 중복 방지."),
  feature("asset.business", "사업 재고·설비·권리금", "asset", "보유 재고·설비·비품·권리금의 소유자·가치·처분가능성은 무엇인가요?", "장부가·시가·실제 회수가능가치를 구분하고 리스 물건은 소유로 확정하지 않음."),
  feature("asset.retirement", "퇴직금·퇴직연금·공제금", "asset", "퇴직급여 제도·적립기관·예상액과 현재 인출 가능 여부를 알려주세요.", "퇴직금·퇴직연금·일반 예금을 혼동하지 않고 보호범위는 별도 검토."),
  feature("asset.receivable", "대여금·매출채권·반환채권", "asset", "받을 돈의 상대방·원인·기한·잔액과 회수 가능성을 알려주세요.", "빌린 돈이 아니라 신청인이 받을 돈. 회수불능은 자료 없이 확정하지 않음."),
  feature("household.dependents", "부양 주장 가족", "household", "누구를 실제 부양하고 있으며 나이·소득·동거·지원액은 어떻게 되나요?", "동거·가족관계만으로 법적 부양인정을 확정하지 않음.", true),
  feature("household.spouse_assets", "배우자·가족 명의 재산 확인 필요", "household", "배우자 또는 가족 재산과 신청인의 자금·명의·처분 관계가 있나요?", "배우자가 있다는 사실만으로 모든 가족재산 자료를 요구하거나 본인 청산가치에 합산하지 않음."),
  feature("household.free_residence", "무상거주", "household", "누구 소유·명의의 주거지에서 어떤 조건으로 무상 거주하나요?", "보증금·임료 지급 진술과 모순되면 conflict로 보존."),
  feature("expense.medical", "계속적 의료·돌봄 지출", "expense", "누구를 위한 어떤 의료·돌봄비가 얼마씩, 언제까지 필요한가요?", "소득공제자료의 총액과 실제 반복지출·보험보전액을 구분."),
  feature("expense.housing", "추가 주거비 주장", "expense", "주거비의 항목·부담자·실제 지급액과 필요기간을 알려주세요.", "임대차보증금과 월세 지출을 구분. 추가 생계비 인정은 담당자 검토."),
  feature("expense.education", "교육·특수교육 지출", "expense", "누구를 위한 교육비인지, 항목·기간·실제 지급자료가 있나요?", "교육비 전액이 추가 인정되는 것으로 자동 판단하지 않음."),
  feature("event.business_closed", "휴업·폐업·사업양도 이력", "event", "어느 사업을 언제 휴업·폐업·양도했고 보증금·재고·설비대금은 어떻게 처리했나요?", "과거 사건도 해당. 현재 영업 여부와 독립이며 폐업만으로 재산 0원 처리 금지."),
  feature("event.asset_disposal", "재산 매각·증여·고액인출 이력", "event", "어떤 재산을 언제 누구에게 얼마에 처분했고 대금은 어디로 갔나요?", "과거 거래도 해당. 행위의 적법성·부인가능성을 상담만으로 확정하지 않음."),
  feature("event.preferential_payment", "특정 채권자·가족에 지급 이력", "event", "누구에게 언제 얼마를 지급했고 지급원인·당시 채무상태는 무엇인가요?", "특정인에게 지급했다는 사실과 법률상 편파변제 판단을 구분."),
  feature("event.inheritance", "상속·상속포기·분할 이력", "event", "상속 개시일과 상속재산·채무·분할·포기·한정승인 관련 절차가 있나요?", "과거 사건도 해당하며 법적 귀속과 기간 판단은 별도 검토."),
  feature("event.divorce", "이혼·재산분할·양육비 이력", "event", "이혼·분할 합의 또는 판결의 날짜와 재산·양육비 지급내역을 알려주세요.", "과거 사건도 해당. 혼인관계와 재산변동을 별도로 확인."),
  feature("procedure.previous", "과거 회생·파산 신청", "procedure", "과거 회생·파산·개인회생의 사건번호·신청일·종국·면책 여부가 있나요?", "과거 사건도 해당. 신청이력과 면책이력을 구분.", true),
  feature("procedure.private_adjustment", "신복위·캠코 등 채무조정", "procedure", "사적 채무조정 신청·합의·변제 내역과 관련 보고서가 있나요?", "과거·현재 조정절차 모두 별도로 보존. 기존 자료의 중복 요구를 검토."),
  feature("procedure.court_order", "현재 보정·추가자료 명령", "procedure", "법원에서 받은 명령·권고의 사건번호·송달일·기한·요구항목은 무엇인가요?", "현재 사건의 주문을 문서로 확인. 이전 사건 명령은 현재의 제출의무로 자동 전환하지 않음."),
];

function document(id: string, name: string, category: string, issuer: string, purpose: string, fields: string[], workflowDocumentTypes: string[], sourceIds = courtSources): IntakeDocumentType {
  return { id, name, category, issuer, purpose, fields, workflowDocumentTypes, sourceIds };
}
const documents: IntakeDocumentType[] = [
  document("resident_registration", "주민등록등본·필요한 주소이력 자료", "기본", "정부24·주민센터", "본인과 주소·관할 기초 확인. 초본의 주소이력 범위는 필요성 확인 후 지정.", ["성명", "현재 주소", "발급일", "필요한 주소변동기간"], ["resident_registration"]),
  document("family_relation", "가족관계증명서", "기본", "전자가족관계등록시스템·주민센터", "가족관계와 부양 주장 대상 확인. 상세 여부·제3자 식별정보 범위는 필요한 항목으로 확인.", ["본인", "가족관계", "부양 주장 대상", "발급일"], ["resident_registration", "dependent_evidence"], officeSources),
  document("income_source_inventory", "직장·사업·기타 소득원별 목록", "소득", "의뢰인 진술·각 지급처 자료", "소득원별 지급자와 기간을 구분하여 누락·중복 수집 방지.", ["소득원", "지급자", "시작·종료일", "총수입·비용·실수령 구분"], ["income_source_inventory"], officeSources),
  document("employment_certificate", "재직증명서", "소득", "사용자·직장", "현재 근로관계와 근무기간 확인.", ["사용자", "근로자", "입사일", "고용형태", "근무상태"], ["employment_certificate"]),
  document("employment_contract", "근로계약서·사용자 근무확인서", "소득", "사용자·의뢰인 보관", "재직증명 확보가 어려울 때 근로관계의 대체 소명 후보.", ["계약 당사자", "계약기간", "급여 조건", "사용자 서명·날인"], ["employment_certificate"]),
  document("salary_withholding", "근로소득원천징수영수증", "소득", "사용자·홈택스", "소득 귀속연도별 급여와 공제 확인.", ["사용자", "귀속연도", "급여 총액", "세액·공제", "근무기간"], ["salary_withholding"]),
  document("salary_statement", "급여명세서·사용자 소득증명", "소득", "사용자", "월별 급여·공제·실수령 확인; 대체자료의 서명·날인 요건 검토.", ["급여월", "총급여", "공제항목", "실수령", "사용자 확인"], ["salary_withholding"]),
  document("salary_bank_statement", "급여 입금 계좌 거래내역", "소득", "급여 수령 은행", "급여자료와 실제 입금 대조. 이체·대출금을 수입에 중복 포함하지 않음.", ["계좌명의", "입금일", "입금자", "급여월 대응", "입금액"], ["salary_bank_statement"]),
  document("employment_history", "고용변동·자격득실·종전 급여자료", "소득", "사용자·국민건강보험공단·국민연금공단", "이직·휴직 전후의 소득기간과 현재 상태 확인.", ["변동일", "직장별 근무기간", "급여변동", "보험자격·가입기간"], ["employment_history"], manualSources),
  document("business_status_evidence", "실제 영업·사업 운영 확인자료", "소득", "의뢰인·거래처·임대인", "사업자등록 유무와 별개로 어떤 영업을 누가 하는지 확인.", ["사업체·업종", "운영자", "명의자", "개업일", "영업장", "계속성"], ["business_registration"], [...courtSources, ...officeSources]),
  document("business_registration", "사업자등록증·사업자등록증명", "소득", "홈택스·세무서·정부24", "등록된 사업의 명의·업종·개업 상태 확인.", ["사업자번호", "명의", "상호", "업종", "개업일", "과세유형"], ["business_registration"], [...courtSources, "SRC-INTAKE-GOV-BUSINESS"]),
  document("business_contract", "사업장·가맹·도급·거래 계약자료", "소득", "의뢰인·임대인·거래처", "실제 영업 및 명의관계의 대체·보완 자료. 등록증과 동등한 효력을 자동 인정하지 않음.", ["당사자", "사업장", "계약기간", "영업내용", "대금 조건"], ["business_registration", "platform_settlement"], officeSources),
  document("business_income_report", "사업 월별 매출·비용·순소득 자료", "소득", "의뢰인·장부·세무대리인", "총매출과 필요비를 나누어 월별 순수입 확인. 법원 제출 보고서 작성은 별도 노드에서 수행.", ["사업체", "귀속월", "총매출", "필요비용", "실질소득", "자료 근거"], ["business_income_report"]),
  document("financial_statement", "손익계산서·재무제표", "소득", "장부·세무대리인·홈택스", "동일 기간 사업 손익·자산의 보완 확인.", ["사업체", "회계기간", "매출", "비용", "손익", "작성 근거"], ["business_income_report"]),
  document("income_amount_certificate", "소득금액증명", "소득", "홈택스·세무서·정부24", "과세 소득 확인. 현재 실제 수입이나 매출과 동일시하지 않음.", ["납세자", "귀속연도", "소득 종류", "수입금액", "소득금액"], ["business_income_report"], [...courtSources, "SRC-INTAKE-GOV-INCOME"]),
  document("vat_certificate", "부가가치세과세표준증명·신고내역", "소득", "홈택스·세무서", "과세사업의 신고매출 확인. 매출을 순소득으로 사용하지 않음.", ["사업자", "과세기간", "신고매출", "과세유형"], ["business_income_report"], [...courtSources, "SRC-INTAKE-GOV-VAT"]),
  document("vat_exempt_certificate", "면세사업자 수입금액증명·사업장현황신고", "소득", "홈택스·세무서", "면세사업의 수입현황 확인. 과세표준증명 일률 요구를 피함.", ["사업자", "귀속연도", "면세업종", "수입금액"], ["business_income_report"], manualSources),
  document("sales_purchase_summary", "매출·매입·카드·현금영수증 집계자료", "소득", "홈택스·카드단말기사·거래처·장부", "해당 업종에서 실제 발생한 매출과 매입 확인.", ["사업체", "기간", "거래처", "매출", "매입", "카드·현금 중복"], ["business_income_report"]),
  document("operating_expenses", "사업 필요비·임료·공과금 지급증빙", "소득", "거래처·은행·임대인·공급기관", "매출에서 차감할 실제 사업비 확인. 생계비 이중공제 검토.", ["사업체", "기간", "지출항목", "지급상대", "금액", "개인비용 구분"], ["business_income_report"]),
  document("platform_settlement", "프리랜서·플랫폼 계약·정산자료", "소득", "계약업체·플랫폼·의뢰인", "업체별 정산·수수료·실지급과 계속성 확인.", ["계약업체", "계약기간", "정산기간", "총정산액", "수수료", "실입금"], ["platform_settlement"], officeSources),
  document("income_bank_statement", "소득 수령 계좌 거래내역", "소득", "해당 금융기관", "사업·정산·임대 등 원천별 실제 지급과 자료 대조.", ["계좌명의", "거래일", "지급자", "금액", "원천자료 대응"], ["salary_bank_statement", "platform_settlement"], officeSources),
  document("rental_income_contract", "임대인 측 임대차계약·임대료 내역", "소득", "의뢰인·임차인·은행", "받는 임대료와 반환할 보증금 구분.", ["임대물건", "임대인·임차인", "계약기간", "보증금", "임대료", "실제 입금"], ["lease_contract"], officeSources),
  document("interest_income_statement", "이자 지급명세·계좌내역", "소득", "금융기관·차용인", "원금과 이자, 세전·세후 금액 분리.", ["지급자", "귀속기간", "이자총액", "원천세", "실수령", "원금 자산"], ["interest_income_statement"], officeSources),
  document("dividend_statement", "배당 지급명세·증권계좌내역", "소득", "증권사·배당 지급회사", "배당기간·세액·실수령 확인.", ["지급회사", "귀속기간", "지급일", "배당액", "원천세", "실수령"], ["dividend_statement"], officeSources),
  document("pension_certificate", "연금 수급·지급증명", "소득", "국민연금·공무원연금 등 지급기관", "연금 종류·지급기간·실수령 확인.", ["수급자", "연금 종류", "지급기간", "실지급액"], ["pension_certificate"], ["SRC-INTAKE-ADMIN-INFO", ...officeSources]),
  document("debt_certificate", "채권자별 부채증명·채무잔액 확인자료", "채무", "현재 채권자·금융기관", "원금·이자·발생원인·기준일·현재 채권자를 분리 확인.", ["현재 채권자", "계약번호", "발생일", "원금", "이자", "잔액 기준일", "이율"], ["debt_certificate"], ["SRC-INTAKE-SC-GUIDE"]),
  document("creditor_request_copy", "자료송부청구서 사본·발송 및 회신자료", "채무", "의뢰인·담당자·채권자", "부채자료 입수 노력에도 발급 곤란한 경우 대체 소명 검토. 청구만으로 잔액을 확정하지 않음.", ["채권자", "청구일", "발급 곤란 사유", "요청항목", "발송·회신 여부"], ["debt_certificate"], ["SRC-INTAKE-SC-GUIDE"]),
  document("loan_contract", "차용·대출계약서 및 상환내역", "채무", "채권자·의뢰인·은행", "채무 성립원인과 실제 상환을 확인하는 보완자료.", ["당사자", "차용일", "대출액", "이율", "기한", "상환내역"], ["debt_certificate", "private_loan_transfer"], manualSources),
  document("card_statement", "카드 이용·대출·결제 명세", "채무", "해당 카드사", "카드대금·카드론·현금서비스의 계약과 실제 사용처 구분.", ["카드사", "상품·계약", "이용일", "이용금액", "결제·대출잔액", "사용처"], ["loan_use_of_funds", "debt_certificate"], officeSources),
  document("private_loan_transfer", "개인차용 입출금·이자·변제 자료", "채무", "금융기관·채권자·의뢰인", "차용증만으로 확정하지 않고 실제 자금이동과 잔액 대조.", ["채권자", "차용일", "입금", "변제일·액", "이자지급", "현금거래 설명"], ["private_loan_transfer"], manualSources),
  document("security_register", "담보권 설정·목적물 권리자료", "채무", "인터넷등기소·차량등록기관·금융기관", "물건별 담보권·소유자·순위 확인. 등기·원부 유형은 담보물에 맞게 선택.", ["목적물", "소유자", "담보권자", "순위", "채권최고액", "담보 범위"], ["security_register"], manualSources),
  document("mortgage_balance", "담보대출·할부 현재잔액 자료", "채무", "담보권자·금융기관·할부사", "채권최고액과 현재 상환잔액을 구분.", ["채권자", "계약번호", "목적물", "원금", "이자", "기준일"], ["mortgage_balance", "vehicle_lien"], manualSources),
  document("guarantee_contract", "보증약정·주채무·구상청구 자료", "채무", "채권자·보증기관·당사자", "주채무자·보증인·대위변제와 현재 청구관계 확인.", ["주채무자", "보증인", "채권자", "보증 범위", "주채무잔액", "대위변제"], ["guarantee_contract"], manualSources),
  document("assignment_notice", "채권양도·대위변제 통지와 잔액 자료", "채무", "양도인·양수인·보증기관", "같은 원채무의 승계와 현재 권리자 확인.", ["원채권자", "현재 청구자", "통지일", "원계약", "승계금액", "대위변제일"], ["assignment_notice"], officeSources),
  document("tax_arrears", "세목별 체납·고지·납기 상세자료", "채무", "관할 세무서·지자체·홈택스·위택스", "실제 체납의 세목·과세기간·납기·원세·가산금 확인. 완납증명으로 대체하지 않음.", ["과세기관", "국세·지방세", "세목", "과세기간", "납부기한", "원세·가산금", "기준일"], ["tax_arrears"], ["SRC-INTAKE-GOV-TAX-FACT", ...manualSources]),
  document("national_tax_arrears_fact", "국세 사실증명(체납내역)", "채무", "홈택스·세무서", "국세 체납현황 확인. 지방세·사회보험 미납의 대체자료는 아님.", ["납세자", "세목", "귀속기간", "체납액", "기준일"], ["tax_arrears"], ["SRC-INTAKE-GOV-TAX-FACT"]),
  document("social_insurance_arrears", "사회보험료·기타징수금 미납내역", "채무", "국민건강보험공단·국민연금공단·근로복지공단", "보험료와 기타징수금, 납기 및 청구원인 구분.", ["기관", "보험·징수금 종류", "귀속기간", "납기", "미납액", "우선권 표시", "제2차 납부 여부"], ["tax_arrears", "priority_basis"], manualSources),
  document("litigation_record", "소장·판결·지급명령·집행 관련 자료", "채무", "담당 법원·의뢰인 보관", "분쟁 범위·청구액·송달·확정 여부 확인.", ["법원·사건번호", "당사자", "청구·다툼 금액", "송달일", "확정 여부", "집행 상태"], ["litigation_record", "garnishment_order"], manualSources),
  document("loan_use_of_funds", "차입금 입금·사용처·잔존자금 자료", "채무", "금융기관·카드사·거래상대", "대출과 자금 사용·상환·대체재산의 흐름 연결.", ["차입일", "차입금", "사용일", "수취인", "사용목적", "잔존액"], ["loan_use_of_funds"], officeSources),
  document("vehicle_registration", "자동차등록원부 갑·을", "재산", "정부24·차량등록사업소", "차량별 소유자·지분·저당·압류 등 권리 확인.", ["등록번호", "차대번호", "차종·연식", "소유자·지분", "저당·압류", "발급일"], ["vehicle_registration", "vehicle_lien"], [...courtSources, "SRC-INTAKE-GOV-VEHICLE"]),
  document("vehicle_valuation", "차량 시가 확인자료", "재산", "차량 시세자료·보험가액·감정 등", "차종·연식·상태가 맞는 평가자료 확보. 리스상품 가격을 소유차량 시가로 대입하지 않음.", ["차종", "연식", "상태", "평가일", "시가", "평가방법"], ["vehicle_registration"], courtSources),
  document("vehicle_lease_contract", "차량 리스·렌트 계약 및 정산자료", "재산", "리스사·렌트사·의뢰인", "소유자·보증금·해지·인수조건 확인. 이용차량 전체를 소유자산으로 확정하지 않음.", ["소유자", "이용자", "차량", "보증금", "월납입", "계약기간", "중도해지·인수조건"], ["vehicle_registration", "vehicle_lien"], officeSources),
  document("real_estate_register", "부동산등기사항전부증명서", "재산", "인터넷등기소·등기소", "물건별 소유지분·담보·권리변동 확인.", ["소재지", "소유자", "지분", "권리변동", "담보·압류", "발급일"], ["real_estate_register"]),
  document("real_estate_valuation", "부동산 시가·거래·감정 자료", "재산", "실거래가·공인 시세·감정 등", "물건·지분·평가일이 맞는 시가 자료 수집.", ["물건", "평가일", "시가", "거래사례", "평가방법", "지분"], ["real_estate_register"]),
  document("lease_contract", "임차인 측 임대차계약서", "재산", "의뢰인·임대인", "신청인이 돌려받을 보증금과 계약명의·권리 확인.", ["목적물", "임대인·임차인", "계약기간", "보증금", "월세", "확정일자"], ["lease_contract", "deposit_rights"]),
  document("deposit_rights", "보증금 지급·연체공제·반환 관련 자료", "재산", "은행·임대인·보증기관", "계약금액과 실제 반환가능액의 차이·담보·양도 확인.", ["보증금 입금", "연체 차임", "반환액", "양도·질권", "보증기관", "회수상태"], ["deposit_rights", "unreturned_deposit"], manualSources),
  document("insurance_surrender_statement", "보험별 예상해약환급금확인서", "재산", "각 보험회사", "계약자·환급금·기준일 확인. 피보험자와 권리자를 구분.", ["보험사", "계약번호", "계약자", "피보험자", "환급금", "기준일"], ["insurance_surrender_statement"]),
  document("insurance_loan_statement", "보험계약 대출·공제 내역", "재산", "각 보험회사", "환급금에서 공제되는 실제 대출과 정산액 확인.", ["계약번호", "대출원금", "이자", "공제내역", "기준일"], ["insurance_loan_statement"], manualSources),
  document("bank_balance_certificate", "계좌별 예금·적금 잔고확인 자료", "재산", "각 금융기관", "기준일 현재 잔액과 계좌명의 확인.", ["금융기관", "계좌 식별", "명의", "통화", "잔액", "기준일"], ["bank_balance_certificate"], manualSources),
  document("bank_statement", "계좌 거래내역", "재산", "각 금융기관", "잔액과 거래흐름의 보완 확인. 필요한 대상·조회기간을 명시.", ["계좌", "조회기간", "거래일", "상대방", "입출금", "잔액"], ["bank_balance_certificate", "disposal_records"], [...courtSources, ...officeSources]),
  document("securities_balance", "증권·펀드·출자지분 잔고 및 평가자료", "재산", "증권사·운용사·회사", "현재 보유와 가격·비상장 평가근거 확인.", ["계좌·회사", "명의", "종목", "수량·지분", "기준일", "평가액·방법"], ["securities_balance"], officeSources),
  document("securities_transactions", "증권 매매·출자·이체 내역", "재산", "증권사·회사·은행", "기왕 손실·현재 보유·처분대금의 구분 확인.", ["거래일", "종목", "수량", "매매금액", "입출고", "자금 이동"], ["securities_transactions"], officeSources),
  document("crypto_balance", "거래소·지갑별 가상자산 잔고자료", "재산", "각 거래소·지갑 보유기록", "기준일 보유수량·명의·시가 확인. 잔액이 없으면 그 상태를 자료로 확인.", ["거래소·지갑", "보유자", "종목", "수량", "기준일", "평가가격"], ["crypto_balance"], officeSources),
  document("crypto_transactions", "가상자산 매매·입출고 내역", "재산", "거래소·지갑·연결 은행", "외부이전·처분대금·보유자산 중복 확인.", ["거래일", "종목·수량", "입출고", "상대 주소", "연결 입출금"], ["crypto_transactions"], officeSources),
  document("business_asset_inventory", "사업 재고·설비·비품·권리금 자료", "재산", "장부·거래처·임대인·감정자료", "소유·리스·수량·시가·잔존가치 구분.", ["품목", "명의·소유", "수량", "장부가", "시가", "처분가능성", "권리금 계약"], ["business_asset_inventory", "business_asset_use"]),
  document("retirement_estimate", "퇴직금 예상액·퇴직연금 적립·잔액자료", "재산", "사용자·퇴직연금사업자·공제회", "제도별 현재 권리와 금액 확인.", ["제도 종류", "가입·근속기간", "기준일", "예상·적립액", "인출·지급조건"], ["retirement_estimate", "retirement_type"], manualSources),
  document("receivable_statement", "대여금·매출·반환채권 계약과 잔액자료", "재산", "계약상대·장부·법원·금융기관", "받을 돈의 원인·원금·회수기한·잔액 확인.", ["상대방", "발생원인", "원금", "기한", "변제내역", "현재잔액"], ["receivable_statement"], officeSources),
  document("receivable_collectability", "미회수 채권 회수가능성 자료", "재산", "독촉·소송·집행·거래상대 자료", "회수곤란 주장 근거 확인. 진술만으로 채권가치를 0원 처리하지 않음.", ["독촉·집행", "상대방 상태", "담보·보증", "회수내역", "미회수 사유"], ["receivable_collectability"], manualSources),
  document("dependent_evidence", "부양 대상 소득·거주·지원 자료", "가족·생계", "의뢰인·해당 가족·지급기관", "실제 부양과 독립소득을 확인. 법적 부양인정은 별도 검토.", ["대상자", "관계·나이", "동거", "소득", "실제 지원액", "지원기간"], ["dependent_evidence"], manualSources),
  document("spouse_asset_evidence", "필요성이 확인된 배우자·가족 재산 관련 자료", "가족·생계", "명의자·은행·등기소·과세기관", "신청인과의 실질 권리·자금관계 또는 법원의 구체적 요구 범위만 확인.", ["명의자", "재산", "취득자금", "신청인과 관계", "조사 필요성", "제출 가능 여부"], ["spouse_asset_evidence", "spouse_transfer_evidence"], [...courtSources, ...officeSources]),
  document("free_residence_confirmation", "무상거주사실확인 및 주거권원 자료", "가족·생계", "거주제공자·명의자", "거주 조건·제공자의 권원 확인. 서명자 확인자료는 관할 요구 범위를 확인.", ["거주자", "제공자", "주소", "무상 조건", "거주기간", "명의·권원"], ["resident_registration", "additional_living_evidence"]),
  document("medical_expense_evidence", "진단·치료계획·의료비 지급자료", "가족·생계", "병원·약국·금융기관·지급기관", "계속 필요한 의료비와 실부담·보전금 확인.", ["지출대상", "필요성", "치료기간", "실지출", "보험·지원 보전"], ["additional_living_evidence"], manualSources),
  document("housing_expense_evidence", "주거계약·월세 등 실지급자료", "가족·생계", "임대인·금융기관·관리주체", "실제 부담 주거비의 항목·기간 확인.", ["주거지", "계약당사자", "지출항목", "지급액", "기간", "다른 부담자"], ["additional_living_evidence"], manualSources),
  document("education_expense_evidence", "교육·특수교육 필요성 및 지급자료", "가족·생계", "학교·교육기관·금융기관", "대상·교육필요성·실지급·지원금 구분.", ["대상자", "교육내용", "필요성", "지급액", "기간", "지원금"], ["additional_living_evidence"], manualSources),
  document("closure_certificate", "휴업·폐업 사실증명·양도자료", "변동·절차", "홈택스·세무서·계약상대", "해당 사업의 중단·명의·양도일 확인.", ["사업체", "명의", "휴폐업·양도일", "사유", "잔존 영업"], ["closure_certificate"]),
  document("business_liquidation", "폐업·양도 정산 및 잔존재산 자료", "변동·절차", "의뢰인·거래처·은행·임대인", "보증금·권리금·재고·설비 처분대금과 사용처 확인.", ["대상재산", "처분일", "정산액", "수령·사용처", "잔존재산"], ["business_liquidation"]),
  document("disposal_records", "재산 처분계약·대금·사용처 자료", "변동·절차", "거래상대·은행·등록기관", "처분 전후 재산과 현금·상환·대체재산 흐름 연결.", ["재산", "일자", "상대방", "대가", "입금", "사용처", "잔존액"], ["disposal_records"]),
  document("selective_payment_records", "특정인 지급·상환·이전의 원인자료", "변동·절차", "금융기관·상대방·의뢰인", "거래사실을 확인하며 부인·편파 여부는 별도로 검토.", ["지급일", "수취인", "관계", "금액", "원인", "당시 채무상태", "대가"], ["selective_payment_records"], officeSources),
  document("inheritance_records", "상속·분할·포기·한정승인 관련 자료", "변동·절차", "가족관계기관·법원·상속인·금융기관", "상속의 개시·재산·채무·분할·절차 확인.", ["피상속인", "개시일", "상속인", "재산·채무", "분할", "신고·심판", "귀속·대금"], ["family_property_event", "family_property_flow"], officeSources),
  document("divorce_records", "혼인·이혼·재산분할·양육비 관련 자료", "변동·절차", "가족관계기관·법원·당사자·은행", "이혼과 재산분할·양육비의 원인·이행 구분.", ["혼인·이혼일", "합의·판결", "분할재산", "양육비", "지급일·액", "현재 권리"], ["family_property_event", "family_property_flow"], [...courtSources, ...officeSources]),
  document("prior_case_records", "종전 회생·파산 신청과 종국·면책 자료", "변동·절차", "종전 사건 법원·보관 기록", "사건별 신청·종국·면책 여부와 날짜 확인.", ["법원·사건번호", "신청일", "종국내역", "종국일", "면책 결정·확정일"], ["prior_case_records"], [...courtSources, "SRC-INTAKE-ADMIN-INFO"]),
  document("prior_creditor_list", "종전 채권자목록·계획·보정자료", "변동·절차", "종전 사건 법원·보관 기록", "재신청의 채무·사정변경을 비교할 때 필요한 자료.", ["종전 사건", "채권자목록", "계획", "보정사항", "사정변경"], ["prior_creditor_list"], [...courtSources, ...officeSources]),
  document("private_adjustment_records", "신복위·캠코 등 채무조정 자료", "변동·절차", "해당 조정기관", "신청·합의·변제내역과 재사용 가능한 기존 자료 확인.", ["기관", "신청일", "채권자", "합의내용", "변제내역", "현재상태"], ["prior_case_records"], [...courtSources, "SRC-INTAKE-SC-GUIDE"]),
  document("court_correction_order", "현재 사건 보정권고·명령 원문", "변동·절차", "현재 사건 법원·전자소송 기록", "법원의 구체적 요구와 기한을 확인하여 별도 세부 체크리스트 작성.", ["법원·사건번호", "송달일", "제출기한", "요구항목", "요구대상·기간", "이미 제출한 답변"], ["court_correction_order"], ["SRC-INTAKE-SC-GUIDE", ...officeSources]),
];

function need(documentTypeId: string, reason: string, options: Partial<Omit<IntakeDocumentNeed, "documentTypeId" | "reason">> = {}): IntakeDocumentNeed {
  return { documentTypeId, alternatives: [], alternativePolicy: "review_required", period: currentPeriod, requirement: "recommended", reason, ...options };
}
function rule(id: string, title: string, scope: IntakeScope, featureId: string | null, needs: IntakeDocumentNeed[], workflowIds: string[], options: Partial<Omit<IntakeRule, "id" | "title" | "scope" | "documents" | "workflowIds">> = {}): IntakeRule {
  return { id, title, scope, enabled: true, all: featureId ? [{ featureId, state: "present" }] : [], any: [], documents: needs, questions: [], workflowIds, sourceIds: officeSources, jurisdictions: [], effectiveFrom: null, effectiveTo: null, legalReviewRequired: false, ...options };
}
const debtNeed = () => need("debt_certificate", "현재 채권자·원금·이자·잔액 기준일을 채권별로 확인합니다.", { alternatives: ["creditor_request_copy"], alternativePolicy: "review_required" });
const wageNeeds = () => [
  need("employment_certificate", "현재 근로관계와 근무기간을 확인합니다.", { alternatives: ["employment_contract"], period: incomePeriod }),
  need("salary_withholding", "급여와 공제를 귀속기간별로 확인합니다. 대체자료의 적용 가능성은 담당자가 확인합니다.", { alternatives: ["salary_statement", "salary_bank_statement"], period: incomePeriod }),
];
const vehicleNeeds = () => [
  need("vehicle_registration", "해당 차량의 소유자·지분·담보·압류를 확인합니다."),
  need("vehicle_valuation", "원부의 차량과 일치하는 연식·차종·상태의 시가를 확인합니다."),
];
const propertyNeeds = () => [
  need("real_estate_register", "본인 소유지분과 권리제한을 물건별로 확인합니다."),
  need("real_estate_valuation", "같은 물건·평가일의 시가 산정근거를 확인합니다."),
];

const rules: IntakeRule[] = [
  rule("INTAKE-001", "기본 신원·주소·가족 확인", "case", null, [
    need("resident_registration", "신청인과 주소·관할의 기초를 확인합니다.", { requirement: "required_when_applicable", period: "신청 예정일 확인; 관공서 작성 첨부자료는 특별한 사정이 없는 한 신청일 기준 2개월 내 발급 원칙을 확인" }),
    need("family_relation", "가족관계와 부양 주장 대상의 확인에 필요한 범위를 준비합니다."),
  ], ["WF-01"], { sourceIds: ["SRC-INTAKE-SC-GUIDE", "SRC-INTAKE-ADMIN-INFO", ...officeSources], questions: ["신청 예정 법원과 실제 주소·거주지는 어디인가요?", "행정정보 공동이용 동의·조회로 대체 가능한 자료가 있는지 담당자와 확인해주세요."] }),
  rule("INTAKE-002", "복수 소득원 누락·중복 확인", "case", "case.multiple_income", [need("income_source_inventory", "각 소득원을 따로 조사하고 같은 입금을 여러 소득으로 합치지 않습니다.", { period: incomePeriod })], ["WF-04"]),
  rule("INTAKE-003", "근로소득 자료", "income", "income.wage", wageNeeds(), ["WF-02"], { sourceIds: [...courtSources, ...officeSources], questions: ["현재 직장별 입사일과 소득 귀속기간은 언제인가요?", "원천징수영수증을 구할 수 없다면 사용자가 확인한 명세 또는 입금자료를 준비할 수 있나요?"] }),
  rule("INTAKE-004", "개인사업 영업·매출·비용 자료", "income", "income.business", [
    need("business_status_evidence", "누가 어떤 사업을 실제 운영하는지 확인합니다.", { alternatives: ["business_registration", "business_contract"], period: incomePeriod }),
    need("business_income_report", "매출과 필요비를 분리하여 월별 실질 수입을 확인합니다.", { alternatives: ["financial_statement"], period: incomePeriod }),
    need("sales_purchase_summary", "해당 사업에 존재하는 매입·매출·카드·현금매출 자료를 대조합니다.", { period: incomePeriod }),
    need("operating_expenses", "사업비와 개인생활비를 구분하여 실제 지출을 확인합니다.", { period: incomePeriod }),
    need("income_amount_certificate", "신고된 소득과 최근 실수입의 차이를 확인합니다.", { period: incomePeriod }),
  ], ["WF-03"], { sourceIds: [...courtSources, ...officeSources], questions: ["사업자등록은 누구 명의이고 과세·면세·겸영 중 어디에 해당하나요?", "매출자료가 없는 기간·신규개업·현금매출이 있나요?"] }),
  rule("INTAKE-005", "등록 사업체 확인", "income", "income.business_registered", [need("business_registration", "본인 명의로 등록되었다고 진술한 해당 사업의 등록내용을 확인합니다.")], ["WF-03"], { sourceIds: ["SRC-INTAKE-GOV-BUSINESS", ...courtSources] }),
  rule("INTAKE-006", "미등록·타인명의 영업 보완", "income", "income.business", [need("business_contract", "본인 명의 등록이 없다고 진술한 사업의 실제 영업·명의관계를 소명할 자료를 준비합니다.", { alternatives: ["business_status_evidence"], period: incomePeriod })], ["WF-03", "WF-11"], { all: [{ featureId: "income.business", state: "present" }, { featureId: "income.business_registered", state: "absent" }], legalReviewRequired: true, questions: ["미등록인지 타인명의인지와 그 사유, 실제 운영자는 누구인지 확인해주세요."] }),
  rule("INTAKE-007", "과세사업 신고매출", "income", "income.vat_taxable", [need("vat_certificate", "과세사업이라고 확인된 소득원의 신고매출을 확인합니다.", { period: incomePeriod })], ["WF-03"], { sourceIds: ["SRC-INTAKE-GOV-VAT", ...courtSources], questions: ["일반·간이과세, 신고한 과세기간, 미신고 기간이 있나요?"] }),
  rule("INTAKE-008", "면세사업 신고수입", "income", "income.vat_exempt", [need("vat_exempt_certificate", "면세사업이라고 확인된 소득원에 맞는 신고자료를 확인합니다.", { period: incomePeriod })], ["WF-03"], { sourceIds: manualSources }),
  rule("INTAKE-009", "프리랜서·일용·플랫폼 소득", "income", "income.freelance", [need("platform_settlement", "업체·플랫폼별 실제 정산과 수수료를 확인합니다.", { period: incomePeriod }), need("income_bank_statement", "정산자료와 실제 지급을 대응시킵니다.", { period: incomePeriod }), need("income_amount_certificate", "신고된 소득자료가 있는지 확인합니다. 없다는 사실은 수입 0원을 의미하지 않습니다.", { period: incomePeriod })], ["WF-11"], { questions: ["상시 근로인지 독립 사업인지, 계약 상대방과 반복 지급 여부를 확인해주세요."] }),
  rule("INTAKE-010", "임대료 수입", "income", "income.rent", [need("rental_income_contract", "받는 임대료와 보증금 반환관계를 계약별로 확인합니다.", { period: incomePeriod }), need("income_bank_statement", "계약상 임대료와 실제 수령액을 대조합니다.", { period: incomePeriod })], ["WF-05"]),
  rule("INTAKE-011", "이자 수입", "income", "income.interest", [need("interest_income_statement", "원금 회수와 이자 수입을 분리하고 세전·세후를 확인합니다.", { period: incomePeriod })], ["WF-06"]),
  rule("INTAKE-012", "배당 수입", "income", "income.dividend", [need("dividend_statement", "배당과 주식 매도대금 및 지급주기를 구분합니다.", { period: incomePeriod })], ["WF-07"]),
  rule("INTAKE-013", "연금 수급", "income", "income.pension", [need("pension_certificate", "지급기관·종류·기간별 연금 실수령을 확인합니다.", { period: incomePeriod })], ["WF-08"], { sourceIds: ["SRC-INTAKE-ADMIN-INFO", ...officeSources], questions: ["공적연금·퇴직연금·개인연금 중 무엇인가요?"] }),
  rule("INTAKE-014", "소득원 변동 전후 확인", "income", "income.employment_changed", [need("employment_history", "전후 근무기간·급여를 나누어 현재 소득 산정범위를 확인합니다.", { period: "상담에서 확인된 이직·입사·휴직일 전후; 고정 조회월수는 관할과 실제 자료기간을 확인" })], ["WF-10"], { sourceIds: manualSources }),
  rule("INTAKE-015", "금융기관별 채무", "debt", "debt.financial", [debtNeed()], ["WF-15"], { sourceIds: ["SRC-INTAKE-SC-GUIDE"], questions: ["현재 채권자와 계약번호, 잔액 산정기준일을 확인해주세요."] }),
  rule("INTAKE-016", "카드·카드대출 채무", "debt", "debt.card", [debtNeed(), need("card_statement", "카드 사용·대출·결제내역과 현재 잔액을 구분합니다.", { period: transactionPeriod })], ["WF-15", "WF-23"], { sourceIds: ["SRC-INTAKE-SC-GUIDE", ...officeSources] }),
  rule("INTAKE-017", "개인 간 차용", "debt", "debt.private", [need("loan_contract", "채무 발생원인을 확인할 차용·대여약정 자료를 준비합니다.", { period: transactionPeriod }), need("private_loan_transfer", "실제 차용·이자·상환흐름을 확인하여 현재 잔액을 대조합니다.", { period: transactionPeriod })], ["WF-22"], { sourceIds: manualSources, legalReviewRequired: true }),
  rule("INTAKE-018", "담보부 채무", "debt", "debt.secured", [need("security_register", "담보물의 명의·담보권·순위를 확인합니다."), need("mortgage_balance", "등기의 채권최고액과 실제 대출잔액을 구분합니다.")], ["WF-19"], { sourceIds: manualSources, questions: ["담보물은 본인 소유인가요, 제3자 소유인가요?"] }),
  rule("INTAKE-019", "보증·연대·구상 관계", "debt", "debt.guarantee", [need("guarantee_contract", "주채무·보증·구상 관계와 대위변제 여부를 확인합니다."), debtNeed()], ["WF-20"], { sourceIds: manualSources, legalReviewRequired: true }),
  rule("INTAKE-020", "채권 승계", "debt", "debt.assigned", [need("assignment_notice", "원계약과 현재 채권자·대위변제 금액을 연결합니다."), debtNeed()], ["WF-21"], { sourceIds: ["SRC-INTAKE-SC-GUIDE", ...officeSources], legalReviewRequired: true }),
  rule("INTAKE-021", "국세·지방세 체납", "debt", "debt.tax", [need("tax_arrears", "체납 세목·귀속기간·납기를 구분한 실제 체납자료를 준비합니다. 완납증명을 요구하는 규칙이 아닙니다.", { alternatives: ["national_tax_arrears_fact"] })], ["WF-16"], { sourceIds: ["SRC-INTAKE-GOV-TAX-FACT", ...manualSources], questions: ["국세·지방세 중 무엇이고 제2차 납세의무 통지가 있나요?", "국세 체납내역 사실증명만으로 납기·귀속기간이 부족하면 고지·상세자료를 보완해주세요."] }),
  rule("INTAKE-022", "사회보험 미납", "debt", "debt.social_insurance", [need("social_insurance_arrears", "보험료와 기타징수금, 귀속기간·납기·청구원인을 확인합니다.")], ["WF-16", "WF-17"], { sourceIds: manualSources, legalReviewRequired: true }),
  rule("INTAKE-023", "다툼·소송·집행 자료", "debt", "debt.disputed", [need("litigation_record", "청구범위·송달·확정 및 집행상태를 원문으로 확인합니다.", { period: "관련 소송·집행의 발생일부터 현재 진행상태까지; 제출기한이 있으면 먼저 확인" })], ["WF-24"], { sourceIds: manualSources, legalReviewRequired: true }),
  rule("INTAKE-024", "최근 차입·증가 사용처", "debt", "debt.recent", [need("loan_use_of_funds", "해당 차입일의 입금과 사용·상환·잔존재산을 연결합니다.", { period: transactionPeriod })], ["WF-23"], { questions: ["최근이라고 진술한 채무의 정확한 발생일을 확인해주세요. 일률적인 기간이나 금액 문턱으로 판단하지 않습니다."] }),
  rule("INTAKE-025", "본인 소유 차량", "asset", "asset.vehicle_owned", vehicleNeeds(), ["WF-26"], { sourceIds: [...courtSources, "SRC-INTAKE-GOV-VEHICLE", ...officeSources], questions: ["차량별 공동소유·할부·저당·압류가 있나요?"] }),
  rule("INTAKE-026", "리스·렌트 차량", "asset", "asset.vehicle_leased", [need("vehicle_lease_contract", "차량 소유권과 별개로 보증금·계약상 권리·부담을 확인합니다.")], ["WF-26"], { questions: ["보증금·선납금·인수옵션이 있는지와 실제 소유명의를 확인해주세요."] }),
  rule("INTAKE-027", "차량 할부·담보 잔액", "asset", "asset.vehicle_financed", [need("mortgage_balance", "해당 차량 관련 실제 미상환액을 확인합니다."), need("vehicle_registration", "할부 진술과 실제 저당권 설정을 구분합니다.")], ["WF-26", "WF-19"], { sourceIds: manualSources }),
  rule("INTAKE-028", "본인 소유 부동산", "asset", "asset.real_estate", propertyNeeds(), ["WF-28"], { sourceIds: [...courtSources, ...officeSources], questions: ["물건별 공동소유·담보·임차인의 보증금이 있나요?"] }),
  rule("INTAKE-029", "임차보증금", "asset", "asset.lease_deposit", [need("lease_contract", "신청인이 돌려받을 보증금과 계약명의를 확인합니다."), need("deposit_rights", "실제 지급액과 연체공제·질권·미반환 상태를 확인합니다.")], ["WF-27"], { sourceIds: [...courtSources, ...manualSources], questions: ["보증금 대출·질권·양도·보증기관·미반환 분쟁이 있나요?"] }),
  rule("INTAKE-030", "보험 환급금", "asset", "asset.insurance", [need("insurance_surrender_statement", "계약별 환급금의 권리자와 기준일을 확인합니다.")], ["WF-31"], { sourceIds: [...courtSources, ...manualSources], questions: ["계약자는 누구이고 보험대출·공제가 실제로 있나요? 가입했다는 사실만으로 대출자료를 요구하지 않습니다."] }),
  rule("INTAKE-031", "예금·적금·현금", "asset", "asset.deposit", [need("bank_balance_certificate", "기관·계좌별 기준일 잔액과 명의를 확인합니다.")], ["WF-35"], { sourceIds: manualSources, questions: ["현금·외화·잔고가 없는 계좌·담보예금도 있는지 확인해주세요."] }),
  rule("INTAKE-032", "증권·출자지분", "asset", "asset.securities", [need("securities_balance", "현재 보유수량·지분과 평가근거를 확인합니다."), need("securities_transactions", "투자손실·보유잔액·처분대금을 구분합니다.", { period: transactionPeriod })], ["WF-34"]),
  rule("INTAKE-033", "가상자산", "asset", "asset.crypto", [need("crypto_balance", "거래소·지갑마다 기준일 잔고를 확인합니다."), need("crypto_transactions", "입출고·매매·은행이체를 연결합니다.", { period: transactionPeriod })], ["WF-33"]),
  rule("INTAKE-034", "사업용 자산", "asset", "asset.business", [need("business_asset_inventory", "사업재산의 소유·수량·시가·처분가능성을 확인합니다.")], ["WF-30", "WF-37"], { sourceIds: [...courtSources, ...officeSources], questions: ["리스 설비·담보·재고·별도 면허·권리금이 있나요?"] }),
  rule("INTAKE-035", "퇴직급여", "asset", "asset.retirement", [need("retirement_estimate", "퇴직금과 퇴직연금을 나누어 제도·잔액·지급조건을 확인합니다.")], ["WF-32"], { sourceIds: manualSources, legalReviewRequired: true }),
  rule("INTAKE-036", "받을 돈·미회수 채권", "asset", "asset.receivable", [need("receivable_statement", "상대방별 채권 발생·잔액·기한을 확인합니다."), need("receivable_collectability", "회수곤란 사유가 있으면 그 자료를 보완합니다.", { period: transactionPeriod })], ["WF-36"], { sourceIds: manualSources }),
  rule("INTAKE-037", "부양 주장 가족", "household", "household.dependents", [need("dependent_evidence", "실제 부양 대상의 소득·지원기간·금액을 확인합니다.", { period: "부양 주장을 하는 현재 기간과 그 근거기간; 법원의 요구와 실제 상황에 따라 확정" })], ["WF-38"], { sourceIds: manualSources, legalReviewRequired: true }),
  rule("INTAKE-038", "가족 명의 재산 확인 필요", "household", "household.spouse_assets", [need("spouse_asset_evidence", "상담에서 확인된 본인과의 재산·자금관계 또는 법원 요구에 한해 조사범위를 정합니다.")], ["WF-29"], { sourceIds: [...courtSources, ...officeSources], legalReviewRequired: true, questions: ["배우자·가족 자료가 필요한 구체적 이유와 제출 가능한 범위를 확인해주세요."] }),
  rule("INTAKE-039", "무상거주", "household", "household.free_residence", [need("free_residence_confirmation", "무상 조건과 거주제공자의 권원을 확인하는 사전 후보자료입니다.")], ["WF-01", "WF-39"], { sourceIds: [...courtSources, ...officeSources] }),
  rule("INTAKE-040", "의료·돌봄 지출", "expense", "expense.medical", [need("medical_expense_evidence", "반복적 필요성과 실제 본인부담을 확인합니다.", { period: "현재 치료·돌봄 기간과 예상 지속기간; 병원·지출내역이 확인되는 범위부터 준비" })], ["WF-39"], { sourceIds: manualSources, legalReviewRequired: true }),
  rule("INTAKE-041", "추가 주거비", "expense", "expense.housing", [need("housing_expense_evidence", "실제 부담 지출과 필요기간을 확인합니다.", { period: "해당 주거계약의 유효기간과 실제 지급월; 제출월수는 관할 요구로 확정" })], ["WF-39"], { sourceIds: manualSources, legalReviewRequired: true }),
  rule("INTAKE-042", "교육·특수교육비", "expense", "expense.education", [need("education_expense_evidence", "대상·필요성·실제 지급·지원금을 분리합니다.", { period: "관련 교육기간·학기와 실제 지급월; 관할 요구사항을 확인" })], ["WF-39"], { sourceIds: manualSources, legalReviewRequired: true }),
  rule("INTAKE-043", "휴폐업·사업양도 정산", "event", "event.business_closed", [need("closure_certificate", "중단·양도한 해당 사업의 일자·명의를 확인합니다.", { period: "해당 휴폐업·양도일의 사건자료와 현재 상태" }), need("business_liquidation", "재고·설비·보증금 처분대금과 잔존재산을 확인합니다.", { period: transactionPeriod })], ["WF-13", "WF-40"], { sourceIds: [...courtSources, ...officeSources] }),
  rule("INTAKE-044", "재산 처분·증여", "event", "event.asset_disposal", [need("disposal_records", "재산의 처분과 대금 사용·대체재산을 연결합니다.", { period: transactionPeriod })], ["WF-40"], { sourceIds: [...courtSources, ...officeSources], legalReviewRequired: true }),
  rule("INTAKE-045", "특정인 지급·상환", "event", "event.preferential_payment", [need("selective_payment_records", "지급원인과 당시 상황을 보존하고 법률상 효과는 별도 검토합니다.", { period: transactionPeriod })], ["WF-41"], { legalReviewRequired: true }),
  rule("INTAKE-046", "상속 관련 재산변동", "event", "event.inheritance", [need("inheritance_records", "상속·분할·신고의 사실과 현재 권리를 확인합니다.", { period: "상속 개시·분할·신고·심판의 해당 일자부터 현재 권리 상태까지" })], ["WF-42"], { legalReviewRequired: true }),
  rule("INTAKE-047", "이혼·재산분할", "event", "event.divorce", [need("divorce_records", "가족관계 변동과 재산분할·양육비 지급을 구분합니다.", { period: "해당 혼인·이혼·합의·판결·재산이전 일자 및 현재 이행상태" })], ["WF-42"], { sourceIds: [...courtSources, ...officeSources], legalReviewRequired: true }),
  rule("INTAKE-048", "과거 회생·파산 신청", "procedure", "procedure.previous", [need("prior_case_records", "신청이력과 면책이력을 별개로 확인합니다.", { period: "신청일 전 10년 이내 신청사건의 관련자료; 날짜가 불명확하면 먼저 확인", requirement: "required_when_applicable" }), need("prior_creditor_list", "재신청의 사정변경 비교가 필요한 경우 추가로 준비합니다.", { period: "해당 종전 사건의 기록; 구체적 범위는 관할·담당자 확인" })], ["WF-44"], { sourceIds: [...courtSources, "SRC-INTAKE-ADMIN-INFO"], legalReviewRequired: true, questions: ["종전 신청일이 예정 신청일 전 10년 이내인지와 면책 결정·확정일을 각각 확인해주세요."] }),
  rule("INTAKE-049", "사적 채무조정 이력", "procedure", "procedure.private_adjustment", [need("private_adjustment_records", "기존 조정자료와 변제현황을 확인하며 중복자료 재제출 필요성을 검토합니다.", { period: "해당 채무조정의 신청·합의부터 현재 진행·변제 상태까지" })], ["WF-44"], { sourceIds: [...courtSources, "SRC-INTAKE-SC-GUIDE"] }),
  rule("INTAKE-050", "현재 사건 법원 요구", "procedure", "procedure.court_order", [need("court_correction_order", "명령의 원문을 확보한 뒤 실제 요구항목·대상·기간을 별도 확인합니다. 상담만으로 법원이 요구한 문서를 만들어내지 않습니다.", { period: "현재 사건의 해당 명령·송달·제출기한", requirement: "court_ordered" })], ["WF-45"], { sourceIds: ["SRC-INTAKE-SC-GUIDE", ...officeSources], legalReviewRequired: true }),
  rule("INTAKE-051", "서울·부산 소유차량 첨부자료", "asset", "asset.vehicle_owned", vehicleNeeds().map(item => ({ ...item, requirement: "required_when_applicable" as const })), ["WF-26"], { jurisdictions: ["seoul", "busan"], sourceIds: courtSources }),
  rule("INTAKE-052", "서울·부산 소유부동산 첨부자료", "asset", "asset.real_estate", propertyNeeds().map(item => ({ ...item, requirement: "required_when_applicable" as const })), ["WF-28"], { jurisdictions: ["seoul", "busan"], sourceIds: courtSources }),
  rule("INTAKE-053", "서울·부산 급여소득 첨부자료", "income", "income.wage", wageNeeds().map(item => ({ ...item, requirement: "required_when_applicable" as const })), ["WF-02"], { jurisdictions: ["seoul", "busan"], sourceIds: courtSources, questions: ["해당 법원 제402호상 원천징수영수증 제출이 불가피하게 어려운 경우 대체자료 적용을 확인해주세요. 통장거래내역 대체는 최근 6개월 급여분입니다."] }),
  rule("INTAKE-054", "보험계약 대출·공제 확인", "asset", "asset.insurance_loan", [need("insurance_loan_statement", "보험대출이 있다고 진술한 계약의 실제 미상환액과 환급금 공제내역을 확인합니다.")], ["WF-31"], { sourceIds: manualSources }),
];

export const INTAKE_CATALOG_SEED: IntakeCatalog = {
  schemaVersion: INTAKE_SCHEMA_VERSION,
  version: 1,
  title: "상담이력 기반 1차 분류·의뢰인 필요서류 기준정보",
  features,
  documents,
  rules,
  sources,
  note: "상담 진술에서 여러 특성을 동시에 분류해 의뢰인이 준비할 증빙 후보를 매칭합니다. 신청서·채권자목록·재산목록·변제계획안 등의 최종 법원서식 작성은 기존 문서작성 단계입니다. 자료가 없거나 발급이 어렵다는 사정은 0원·비해당·검증완료로 바꾸지 않습니다. 추천자료, 관할별 첨부자료, 법원의 구체적 명령을 구분합니다. 관할별 기준과 기간은 확인된 범위만 적용하며 특히 배우자 자료·과거 거래자료를 전국 공통 필수로 요구하지 않습니다. 대체자료는 목적·대상·기간과 필요한 필드가 충족되는지 담당자가 검토합니다. 이 목록은 상담단계 준비 안내이며 사실·법률 인정이나 제출승인을 부여하지 않습니다.",
};
