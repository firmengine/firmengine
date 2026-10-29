import catalog from "./legal-catalog.json" with {type:"json"};
import exceptions from "./legal-exceptions.json" with {type:"json"};
import templates from "../public/templates/catalog.json" with {type:"json"};
import { canonicalMonitorUrl, isOfficialMonitorUrl, type MonitorSource, type MonitorSourceKind } from "./legal-monitor-core.ts";

/** Source settings are data. Pinned citations remain monitored alongside mutable discovery pages. */
const COURT_KEYWORDS=["개인회생","개인파산","도산","실무준칙","생계비","제출목록","제출서류","변제계획","변제기간","채무자 회생","채무자회생"];
const LAW_KEYWORDS=["채무자","개인회생","민사집행","개인파산","생계비","주택임대차","회생사건"];
const rows:MonitorSource[]=[];
function append(source:MonitorSource){
  if(!isOfficialMonitorUrl(source.url,source.officialDomains))throw new Error(`INVALID_OFFICIAL_MONITOR_SOURCE:${source.id}`);
  const existing=rows.find(s=>canonicalMonitorUrl(s.url)===canonicalMonitorUrl(source.url)&&s.api?.target===source.api?.target&&s.api?.query===source.api?.query);
  if(existing){existing.sourceAliases=[...new Set([...(existing.sourceAliases??[]),source.id,...source.sourceAliases??[]])];return;}
  rows.push(source);
}
function sourceKind(url:string,authority=""):MonitorSourceKind {
  if(/court_practice/.test(authority)||/practice_rule\.pdf/.test(url))return "practice_rule";
  if(/AttachDownload|\.hwp(?:\?|$)|\.pdf(?:\?|$)/i.test(url))return "attachment";
  if(/admrul/i.test(url)||/directive/.test(authority))return "administrative_rule";
  if(/precInfo/.test(url))return "case_law";
  return new URL(url).hostname.endsWith("scourt.go.kr")?"court_notice":"law";
}

// Mutable publication indexes take precedence in each rotation. Later source rows verify exact citations and original files.
for(const source of [
  {id:"watch-current-rehabilitation-law",title:"채무자 회생 및 파산에 관한 법률 현행 한글주소",agent:"legislation",url:"https://www.law.go.kr/법령/채무자회생및파산에관한법률",kind:"law",officialDomains:["law.go.kr"],sourceAliases:["law-3","law-383","law-579","law-580","law-583","law-584","law-586","law-589","law-595","law-603","law-610","law-611","law-614","law-624","law-625","S1"]},
  {id:"watch-current-rehabilitation-rule",title:"채무자 회생 및 파산에 관한 규칙 현행 한글주소",agent:"legislation",url:"https://www.law.go.kr/법령/채무자회생및파산에관한규칙",kind:"law",officialDomains:["law.go.kr"],sourceAliases:["rule-79"]},
  {id:"watch-current-rehabilitation-decree",title:"채무자 회생 및 파산에 관한 법률 시행령 현행 한글주소",agent:"legislation",url:"https://www.law.go.kr/법령/채무자회생및파산에관한법률시행령",kind:"law",officialDomains:["law.go.kr"],sourceAliases:["decree-17"]},
  {id:"watch-current-civil-enforcement-decree",title:"민사집행법 시행령 현행 한글주소",agent:"legislation",url:"https://www.law.go.kr/법령/민사집행법시행령",kind:"law",officialDomains:["law.go.kr"],sourceAliases:["S11"]},
  {id:"watch-current-rehabilitation-directive",title:"개인회생사건 처리지침 현행 한글주소",agent:"legislation",url:"https://www.law.go.kr/행정규칙/개인회생사건처리지침",kind:"administrative_rule",officialDomains:["law.go.kr"],sourceAliases:["directive-2026","S2"]},
  {id:"watch-seoul-notices",title:"서울회생법원 새소식·공고",agent:"court_documents",url:"https://slb.scourt.go.kr/dcboard/new/DcNewsListAction.work?gubun=41",kind:"court_notice",officialDomains:["scourt.go.kr"],court:"서울회생법원",keywords:COURT_KEYWORDS,discoverLinks:true,sourceAliases:["seoul-practice-2026","seoul-living-2026"]},
  {id:"watch-seoul-press",title:"서울회생법원 실무준칙 개정 보도자료",agent:"court_documents",url:"https://slb.scourt.go.kr/dcboard/new/DcNewsListAction.work?gubun=172",kind:"court_notice",officialDomains:["scourt.go.kr"],court:"서울회생법원",keywords:COURT_KEYWORDS,discoverLinks:true,sourceAliases:["seoul-practice-2026","S3","S4"]},
  {id:"watch-court-forms",title:"회생법원 민원서식 양식모음",agent:"court_documents",url:"https://slb.scourt.go.kr/rel/information/min/MinListAction.work?pageIndex=1",kind:"court_forms",officialDomains:["scourt.go.kr"],keywords:COURT_KEYWORDS,discoverLinks:true},
  {id:"watch-busan-home",title:"부산회생법원 새소식·서식 공고",agent:"court_documents",url:"https://bsb.scourt.go.kr/main/new/Main.work",kind:"court_notice",officialDomains:["scourt.go.kr"],court:"부산회생법원",keywords:COURT_KEYWORDS,discoverLinks:true},
  {id:"watch-suwon-home",title:"수원회생법원 새소식·서식 공고",agent:"court_documents",url:"https://swb.scourt.go.kr/main/new/Main.work",kind:"court_notice",officialDomains:["scourt.go.kr"],court:"수원회생법원",keywords:COURT_KEYWORDS,discoverLinks:true},
  {id:"watch-daegu-home",title:"대구회생법원 새소식·생계비·필수제출목록",agent:"court_documents",url:"https://dgb.scourt.go.kr/main/new/Main.work",kind:"court_notice",officialDomains:["scourt.go.kr"],court:"대구회생법원",keywords:COURT_KEYWORDS,discoverLinks:true},
  {id:"watch-daejeon-home",title:"대전회생법원 새소식·서식 공고",agent:"court_documents",url:"https://djb.scourt.go.kr/main/new/Main.work",kind:"court_notice",officialDomains:["scourt.go.kr"],court:"대전회생법원",keywords:COURT_KEYWORDS,discoverLinks:true},
  {id:"watch-gwangju-practice-index",title:"광주회생법원 실무준칙 및 직무편람",agent:"court_documents",url:"https://gjb.scourt.go.kr/gjb/info/info_01/index.html",kind:"practice_rule",officialDomains:["scourt.go.kr"],court:"광주회생법원",keywords:COURT_KEYWORDS,discoverLinks:true},
  {id:"watch-gwangju-practice",title:"광주회생법원 실무준칙 공식 통합본",agent:"court_documents",url:"https://gjb.scourt.go.kr/gjb/info/info_01/practice_rule_gjb.pdf?v=1",kind:"practice_rule",officialDomains:["scourt.go.kr"],court:"광주회생법원"},
  {id:"watch-national-bills",title:"국민참여입법센터 국회입법현황",agent:"legislation",url:"https://opinion.lawmaking.go.kr/gcom/nsmLmSts/out",kind:"bill_index",officialDomains:["lawmaking.go.kr","assembly.go.kr"],keywords:LAW_KEYWORDS,discoverLinks:true},
] satisfies MonitorSource[])append(source);

for(const source of catalog.source_catalog){const kind=sourceKind(source.url,source.authority);append({id:source.id,title:source.title,url:source.url,agent:source.url.includes("scourt.go.kr")?"court_documents":"legislation",kind,officialDomains:source.url.includes("scourt.go.kr")?["scourt.go.kr"]:["law.go.kr"]});
  if("attachment_url" in source&&typeof source.attachment_url==="string")append({id:`${source.id}:attachment`,title:`${source.title} 공식 첨부`,url:source.attachment_url,agent:"court_documents",kind:"attachment",officialDomains:["scourt.go.kr"],sourceAliases:[source.id]});}
for(const source of exceptions.sources)append({id:source.id,title:source.officialTitle,url:source.url,agent:source.url.includes("scourt.go.kr")?"court_documents":"legislation",kind:sourceKind(source.url),officialDomains:source.url.includes("scourt.go.kr")?["scourt.go.kr"]:["law.go.kr"]});
for(const form of templates.forms)for(const original of form.originals)append({id:`form:${form.code}:${original.path.split(".").at(-1)}`,title:`${form.code} ${form.title} 공식 원본`,url:original.url,agent:"court_documents",kind:"attachment",officialDomains:["scourt.go.kr"],sourceAliases:[form.code,`form.${form.kind}`,`form:${form.code}`]});

// A supplied, existing LAW_OPEN_DATA_OC enables these API routes. No demonstration/test credentials are embedded.
for(const spec of [
  {id:"api-rehabilitation-law",title:"국가법령정보 시행예정·현행 법령 목록",target:"eflaw",query:"채무자 회생 및 파산에 관한 법률",aliases:["law-579","law-611","law-614"]},
  {id:"api-rehabilitation-rule",title:"국가법령정보 시행예정·현행 대법원규칙 목록",target:"eflaw",query:"채무자 회생 및 파산에 관한 규칙",aliases:["rule-79"]},
  {id:"api-rehabilitation-directive",title:"국가법령정보 행정규칙 개정 목록",target:"admrul",query:"개인회생사건 처리지침",aliases:["directive-2026","S2"]},
] as const)append({id:spec.id,title:spec.title,agent:"legislation",url:`https://www.law.go.kr/DRF/lawSearch.do?target=${spec.target}&query=${encodeURIComponent(spec.query)}`,kind:"law_api",officialDomains:["law.go.kr"],sourceAliases:[...spec.aliases],api:{target:spec.target,query:spec.query}});

export const LEGAL_MONITOR_SOURCES:readonly MonitorSource[]=Object.freeze(rows.map(s=>Object.freeze(s)));
export const LEGAL_MONITOR_SOURCE_POLICY={
  version:"legal-monitor-sources-v1",checkedAt:"2026-10-29",pollingIntervalMinutes:1440,
  legislationAgent:"법령·시행령·대법원규칙·재판예규의 공포·시행예정·시행과 법률안 진행상황을 분리하여 변경 후보를 생성",
  courtDocumentsAgent:"법원 실무준칙·생계비 공고·필수제출목록·공식 서식 및 첨부파일의 변경 후보를 생성",
  activation:"모든 후보는 사람 검토 대상이며 계산 기준·서식·사건 인정 상태를 자동 변경하지 않음",
  apiCredential:"LAW_OPEN_DATA_OC가 없으면 해당 DRF 경로만 disabled로 기록하고 공식 공개 페이지/도메인 검색 감시는 계속함",
  timeliness:"하루 한 번 정기 확인 후 알림. 원문 공개·검색색인·API 반영 지연이 있으며 일자별 조문 개정이력 API는 전일 기준.",
  scope:"등록된 원문·서식·공고 목록 및 공식 도메인 검색. 전국 모든 법원 문서의 완전성 또는 실시간 배포를 보증하지 않음.",
} as const;
