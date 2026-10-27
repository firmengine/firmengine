import { currentFacts,normalizeMoney,touchCase,validSourceRef,type CaseData,type Fact,type SourceRef,type Json,type NumericInput } from "./domain.ts";
export const EDITABLE_COLLECTIONS=["incomes","debts","assets","transactions"] as const;
export type EditableCollection=(typeof EDITABLE_COLLECTIONS)[number];
export interface EditField {key:string;label:string;type:"text"|"money"|"date"|"number"|"select";options?:string[];decision?:boolean;}
export const OBJECT_FIELDS:Record<EditableCollection,EditField[]>={
  incomes:[{key:"label",label:"소득원 명칭",type:"text"},{key:"kind",label:"소득 유형",type:"select",options:["wage","business","rent","interest","dividend","pension","benefit","other"]},{key:"employer",label:"고용주·사업체",type:"text"},{key:"gross",label:"기간 총수입 (원)",type:"money"},{key:"expenses",label:"같은 기간 필요경비 (원)",type:"money"},{key:"net",label:"기간 순소득 (원)",type:"money"},{key:"amountBasis",label:"금액 기준",type:"select",options:["unknown","monthly","period_total"]},{key:"periodStart",label:"기간 시작",type:"date"},{key:"periodEnd",label:"기간 종료",type:"date"},{key:"periodMonths",label:"기간 개월 수",type:"number"},{key:"recurring",label:"계속·반복 소득",type:"select",options:["unknown","yes","no"]}],
  debts:[{key:"creditor",label:"현재 채권자",type:"text"},{key:"contractId",label:"계약 식별번호",type:"text"},{key:"principal",label:"잔존 원금 (원)",type:"money"},{key:"interest",label:"미지급 이자 (원)",type:"money"},{key:"secured",label:"담보 여부",type:"select",options:["unknown","yes","no"]},{key:"classification",label:"채권 분류",type:"select",options:["unknown","ordinary","secured","tax","estate","non_dischargeable","disputed"]},{key:"priority",label:"사건별 우선·재단 처리 검토",type:"select",options:["unknown","ordinary","priority","estate"],decision:true},{key:"asOf",label:"채무액 기준일",type:"date"},{key:"dueDate",label:"변제기",type:"date"}],
  assets:[{key:"label",label:"재산 명칭",type:"text"},{key:"kind",label:"재산 유형",type:"select",options:["cash","deposit","insurance","vehicle","real_estate","lease_deposit","business","receivable","retirement","other"]},{key:"grossValue",label:"평가액 (원)",type:"money"},{key:"securedPayoff",label:"담보 상환액 (원)",type:"money"},{key:"securedPayoffScope",label:"담보 상환액의 귀속 범위",type:"select",options:["unknown","applicant_interest","entire_collateral"]},{key:"disposalCosts",label:"처분비용 (원)",type:"money"},{key:"protectedValue",label:"면제재산 검토액 (원)",type:"money"},{key:"ownershipBps",label:"소유 지분 (100% = 10000)",type:"number"},{key:"asOf",label:"평가 기준일",type:"date"},{key:"valuationBasis",label:"평가 근거",type:"text"}],
  transactions:[{key:"date",label:"거래일",type:"date"},{key:"accountId",label:"계좌 식별번호",type:"text"},{key:"counterparty",label:"상대방·적요",type:"text"},{key:"direction",label:"방향",type:"select",options:["unknown","in","out"]},{key:"amount",label:"거래금액 (원)",type:"money"},{key:"kind",label:"거래 분류",type:"select",options:["unknown","income","expense","transfer","debt_payment","asset_disposal","tax"]}],
};
OBJECT_FIELDS.incomes.push(
  {key:"payerIdentityId",label:"원문 지급자 식별번호 (사업자·기관 ID)",type:"text"},
  {key:"aggregationTreatment",label:"기간별 소득 자료의 관계",type:"select",options:["unknown","series_observation","independent_source","component","duplicate"],decision:true},
  {key:"aggregationReviewed",label:"기간·중복·구성 관계 확인 완료",type:"select",options:["no","yes"],decision:true},
  {key:"aggregationReviewReason",label:"기간·중복·구성 관계 판단 근거",type:"text",decision:true},
);
OBJECT_FIELDS.debts.push(
  {key:"guaranteeDetails.liabilityRole",label:"보증 구조의 신청인 역할 (해당 시)",type:"select",options:["unknown","principal","guarantor","joint_and_several"]},
  {key:"guaranteeDetails.claimNature",label:"보증·조건부 청구권의 성격",type:"select",options:["unknown","fixed","contingent","disputed"]},
  {key:"guaranteeDetails.underlyingDebtId",label:"연결 주채무 ID 또는 계약번호",type:"text"},
  {key:"guaranteeDetails.recourseStatus",label:"대위·구상 이행 상태",type:"select",options:["unknown","not_applicable","unpaid","partially_paid","subrogated"]},
  {key:"guaranteeDetails.sourceGuaranteeAmount",label:"원문 보증 청구액 (신청인 원금과 별도)",type:"money"},
  {key:"guaranteeDetails.sourceGuaranteeLimit",label:"원문 보증한도 (신청인 원금과 별도)",type:"money"},
  {key:"guaranteeDetails.capTreatment",label:"법률 검토 · 채무한도 산입",type:"select",options:["unknown","include","exclude"],decision:true},
  {key:"guaranteeDetails.capTreatmentReviewed",label:"법률 검토 · 산입 근거 확인 완료",type:"select",options:["no","yes"],decision:true},
  {key:"guaranteeDetails.reviewReason",label:"법률 검토 · 산입·제외 판단 근거",type:"text",decision:true},
);
const prefixes={incomes:"income",debts:"debt",assets:"asset",transactions:"transaction"};
const aliases:Record<string,string>={grossValue:"gross_value",securedPayoff:"secured_payoff",securedPayoffScope:"secured_payoff_scope",disposalCosts:"disposal_costs",protectedValue:"protected_value",ownershipBps:"ownership_bps",asOf:"as_of",valuationBasis:"valuation_basis",contractId:"contract_id",dueDate:"due_date",periodStart:"period_start",periodEnd:"period_end",periodMonths:"period_months",amountBasis:"amount_basis",accountId:"account_id",payerIdentityId:"payer_identity_id"};
Object.assign(aliases,{"guaranteeDetails.liabilityRole":"liability_role","guaranteeDetails.claimNature":"claim_nature","guaranteeDetails.underlyingDebtId":"underlying_debt_id","guaranteeDetails.recourseStatus":"recourse_status","guaranteeDetails.sourceGuaranteeAmount":"guarantee_amount","guaranteeDetails.sourceGuaranteeLimit":"guarantee_limit"});
export function objectFieldValue(item:Record<string,unknown>,key:string):unknown{
  if(Object.hasOwn(item,key))return item[key];
  return key.split(".").reduce<unknown>((value,part)=>value&&typeof value==="object"?Object.hasOwn(value,part)?(value as Record<string,unknown>)[part]:undefined:undefined,item);
}
function setField(item:Record<string,unknown>,key:string,value:unknown){
  const parts=key.split(".");let target=item;
  for(const part of parts.slice(0,-1)){if(!target[part]||typeof target[part]!=="object")target[part]={};target=target[part] as Record<string,unknown>;}
  target[parts.at(-1)!]=value;
}
function fieldKey(collection:EditableCollection,key:string){return `${prefixes[collection]}.${aliases[key]||key}`;}
function validDate(value:string){return /^\d{4}-\d{2}-\d{2}$/.test(value)&&!Number.isNaN(Date.parse(value))&&new Date(value).toISOString().slice(0,10)===value;}
export function upsertObject(data:CaseData,collection:EditableCollection,item:Record<string,unknown>,source:SourceRef,reason:string,actor:string):CaseData{
  if(!EDITABLE_COLLECTIONS.includes(collection))throw new Error("편집 대상을 확인하세요.");
  if(!item||typeof item!=="object"||Array.isArray(item))throw new Error("편집할 항목이 필요합니다.");
  if(!reason.trim()||!validSourceRef(data,source))throw new Error("변경 이유와 유효한 원본 문서·페이지·인용이 필요합니다.");
  const n=touchCase(data),id=typeof item.id==="string"?item.id:crypto.randomUUID();
  const existing=data[collection].find(x=>x.id===id);
  if(item.id!==undefined&&(!id||!existing))throw new Error("현재 사건의 편집 대상이 아닙니다. 최신 목록에서 다시 선택하세요.");
  const result:Record<string,unknown>={...(existing??{}),id,factIds:[],recognition:"unreviewed",...(collection==="debts"?{legalReview:"unreviewed",excludedByReview:false}:{} )};
  const editableKeys=new Set(OBJECT_FIELDS[collection].filter(f=>!f.decision).map(f=>fieldKey(collection,f.key)));
  const preservedFacts=currentFacts(data).filter(f=>f.subjectId===id&&!editableKeys.has(f.key));
  const ids:string[]=preservedFacts.map(f=>f.id),writtenKeys=new Set(preservedFacts.map(f=>f.key));
  const guaranteeApplicable=collection==="debts"&&(!!(existing as {guaranteeDetails?:unknown}|undefined)?.guaranteeDetails||OBJECT_FIELDS.debts.some(f=>f.key.startsWith("guaranteeDetails.")&&!f.decision&&![undefined,null,"","unknown"].includes(objectFieldValue(item,f.key) as string|null|undefined)));
  for(const f of OBJECT_FIELDS[collection]){
    if(f.key.startsWith("guaranteeDetails.")&&!guaranteeApplicable)continue;
    const raw=objectFieldValue(item,f.key);let value:Json=null,numeric:NumericInput|undefined;
    if(f.type==="money"){
      numeric=normalizeMoney(raw===null||raw===undefined||raw===""?null:String(raw));
      if(!["exact","missing"].includes(numeric.normalizationStatus))throw new Error(`${f.label}: 원 단위 정수 금액을 확인하세요.`);
      setField(result,f.key,numeric);value=numeric.rawValue;
    }else if(f.type==="number"){
      if(raw===null||raw===undefined||raw===""){setField(result,f.key,null);continue;}
      if(!/^\d+$/.test(String(raw)))throw new Error(`${f.label}: 0 이상의 정수가 필요합니다.`);
      value=Number(raw);if(!Number.isSafeInteger(value)||value<0||f.key==="ownershipBps"&&value>10000||f.key==="periodMonths"&&value<1)throw new Error(`${f.label}: 허용 범위의 정수가 필요합니다.`);
      setField(result,f.key,value);
    }else{
      value=raw===undefined||raw===null?"":String(raw).trim();
      if(value.length>10000)throw new Error(`${f.label}: 입력이 너무 깁니다.`);
      if(f.type==="select"){
        if(value===""&&f.options?.includes("unknown"))value="unknown";
        if(value===""&&f.decision&&f.options?.includes("no"))value="no";
        if(!f.options?.includes(value))throw new Error(`${f.label}: 목록에서 확인한 값을 선택하세요.`);
      }
      if(f.type==="date"&&value&&!validDate(value))throw new Error(`${f.label}: 실제 날짜를 확인하세요.`);
      setField(result,f.key,value);
    }
    if(f.decision)continue;
    if(value===null||value==="")continue;
    const key=fieldKey(collection,f.key),prior=currentFacts(n).find(f=>f.subjectId===id&&f.key===key),fid=crypto.randomUUID();ids.push(fid);writtenKeys.add(key);
    // Human changes remain reported until independently checked against their source.
    const fact:Fact={id:fid,logicalId:prior?.logicalId||`${id}:${key}`,version:(prior?.version??0)+1,supersedes:prior?.id,subjectId:id,key,value,...(numeric?{numeric}:{}),state:"reported",recognition:"unreviewed",refs:[source],validation:[{code:"USER_EDIT",message:"전용 데이터 페이지에서 수정됨. 원문 확인과 법적 반영 검토가 필요합니다.",severity:"warning"}],reviewer:actor,reviewReason:reason,createdAt:new Date().toISOString()};
    n.facts.push(fact);
  }
  if(guaranteeApplicable){
    const details=result.guaranteeDetails as Record<string,unknown>;
    details.capTreatmentReviewed=details.capTreatmentReviewed==="yes";
    if(details.capTreatmentReviewed===true&&(!["include","exclude"].includes(String(details.capTreatment))||!String(details.reviewReason||"").trim()))throw new Error("보증채무 산입 검토 완료에는 산입 여부와 구체적인 법률 판단 근거가 필요합니다.");
  }
  if(collection==="incomes"){
    result.aggregationReviewed=result.aggregationReviewed==="yes";
    if(result.aggregationReviewed===true&&(result.aggregationTreatment==="unknown"||!String(result.aggregationReviewReason||"").trim()))throw new Error("소득 자료 관계의 확인 완료에는 기간별 관측·독립 소득·구성액·중복 중 하나와 구체적인 판단 근거가 필요합니다.");
    // An edited observation changes the basis of any prior representative-period review.
    n.context.incomePeriodReviewed=false;
  }
  if(collection==="incomes"&&result.periodStart&&result.periodEnd&&String(result.periodStart)>String(result.periodEnd))throw new Error("소득 기간 종료일이 시작일보다 앞섭니다.");
  result.factIds=ids;
  const rows=n[collection] as unknown as Record<string,unknown>[],index=rows.findIndex(x=>x.id===id);
  if(index>=0)rows[index]=result;else rows.push(result);
  const axis=collection==="incomes"?"income":collection==="debts"?"debt":collection==="assets"?"asset":null;
  if(axis)n.context.inventoryComplete[axis]="unknown";
  // Retire fields removed by the edit, preserving their audit history.
  if(existing)for(const f of currentFacts(data).filter(f=>f.subjectId===id&&!writtenKeys.has(f.key)))n.facts.push({...f,id:crypto.randomUUID(),version:f.version+1,supersedes:f.id,state:"retracted",recognition:"rejected",reviewReason:reason,reviewer:actor,createdAt:new Date().toISOString()});
  return n;
}
export function removeObject(data:CaseData,collection:EditableCollection,id:string,reason:string,actor:string):CaseData{
  if(!EDITABLE_COLLECTIONS.includes(collection)||!reason.trim())throw new Error("대상과 철회 이유가 필요합니다.");
  if(!data[collection].some(x=>x.id===id))throw new Error("대상 데이터를 찾을 수 없습니다.");
  const n=touchCase(data);(n as unknown as Record<string,unknown>)[collection]=n[collection].filter(x=>x.id!==id);
  if(collection==="incomes")n.context.incomePeriodReviewed=false;
  for(const f of currentFacts(data).filter(f=>f.subjectId===id))n.facts.push({...f,id:crypto.randomUUID(),version:f.version+1,supersedes:f.id,state:"retracted",recognition:"rejected",reviewer:actor,reviewReason:reason,createdAt:new Date().toISOString()});
  n.context.inventoryComplete={income:"unknown",debt:"unknown",asset:"unknown"};return n;
}
