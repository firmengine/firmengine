import test from "node:test";
import assert from "node:assert/strict";
import { applyExtraction,createCase,createCaseReadIndex,DRAFT_RULESET } from "../lib/domain.ts";
import { projectPage,type ReadField,type PageRead } from "../lib/extraction.ts";
import { calculateCase } from "../lib/assessment.ts";
import { buildFormBindings,MISSING_FORM_VALUE } from "../lib/form-mapping.ts";
import { buildCourtPackage } from "../lib/exports.ts";
import { assessCase } from "../lib/assessment.ts";
import { applicantIdentityValue,reconcileApplicantContext } from "../lib/applicant-identity.ts";
import type { Fact } from "../lib/domain.ts";

const hash="f".repeat(64);
const f=(key:string,value:string,unit:string|null=null):ReadField=>({key,label:key,value,unit,quote:key==="gross_value"?`해약환급금 ${value}${unit??""}`:`${key} ${value}`,confidence:"clear",bbox:null});
function fixture(conflicting=false){
  let data=createCase("Synthetic output linkage","synthetic-output","2026-10-27");
  data.documents=[{id:"evidence",name:"synthetic.pdf",sha256:hash,status:"active",pages:[1,2]}];
  for(const page of [1,2]){
    const read:PageRead={documentType:"insurance",complete:true,warnings:[],records:[{category:"asset",label:"합성 보험",fields:[f("kind","insurance"),f("label","합성 보험"),f("policy_number","SYNTHETIC-POLICY-1234"),f("issuer_identity_id","ISSUER-1001"),f("owner_identity_id","OWNER-2002"),f("insurer","합성 보험사"),f("gross_value",conflicting&&page===2?"5000":"4000","원"),f("as_of",conflicting&&page===2?"2026-09-30":"2026-10-27"),f("ownership_bps","10000"),f("valuation_basis","합성 환급 증명"),f("secured_payoff","0","원"),f("disposal_costs","0","원"),f("protected_value","0","원")]}]};
    data.pages.push({documentId:"evidence",page,role:"evidence",imageUrl:`/synthetic/${page}.png`,text:read.records[0].fields.map(x=>x.quote).join("\n")});
    data=applyExtraction(data,projectPage(read,"evidence",page,hash));
  }
  data.context.inventoryComplete.asset="yes";
  return data;
}

test("공식 서식·Office 부록·계산이 동일하게 확인된 중복 자산을 한 번만 표시한다",()=>{
  const data=fixture(),calc=calculateCase(data,DRAFT_RULESET),bindings=buildFormBindings(data,calc),pack=buildCourtPackage(data,DRAFT_RULESET);
  assert.equal(data.assets.length,2,"source observations remain in the ledger");
  assert.equal(calc.assetRows.length,1);
  assert.equal(bindings.rows.asset.length,1);
  assert.equal(bindings.rows.asset[0].institution,"합성 보험사");
  assert.equal(bindings.rows.asset[0].account_number,"SYNTHETIC-POLICY-1234");
  assert.equal(bindings.scalars.insurance_surrender,"4,000");
  assert.equal(pack.documents.find(d=>d.kind==="assets")?.tables[0].rows.length,1);
  assert.equal(pack.workbook.find(s=>s.name==="재산청산가치")?.rows.length,2);
});

test("같은 자산의 상충하는 평가일·금액을 서식 집계에서 합산하거나 임의 선택하지 않는다",()=>{
  const data=fixture(true),calc=calculateCase(data,DRAFT_RULESET),bindings=buildFormBindings(data,calc);
  assert.equal(calc.assetRows.length,2);
  assert.equal(calc.liquidationValueWon,null);
  assert.equal(bindings.rows.asset.length,2);
  assert.equal(bindings.scalars.insurance_surrender,MISSING_FORM_VALUE);
});

test("채권자·가족 person.name 관측은 신청인 성명으로 채워지지 않는다",()=>{
  const data=fixture();
  const add=(id:string,subjectId:string,key:string,value:string,quote:string)=>data.facts.push({id,logicalId:id,version:1,subjectId,key,value,state:"extracted",recognition:"unreviewed",refs:[{documentId:"evidence",page:1,sourceHash:hash,quote}],validation:[]});
  data.pages[0].text+="\nCreditor person.name Creditor Kim\nFamily person.name Relative Lee";
  add("creditor-person-name","debt:creditor-1","person.name","Creditor Kim","Creditor person.name Creditor Kim");
  add("family-person-name","family:member-1","person.name","Relative Lee","Family person.name Relative Lee");
  const bindings=buildFormBindings(data,calculateCase(data,DRAFT_RULESET));
  const pack=buildCourtPackage(data,DRAFT_RULESET);
  const applicant=pack.documents.find(doc=>doc.kind==="application")!.tables[0].rows.find(row=>row[0]==="성명")!;
  assert.equal(bindings.scalars.client_name,MISSING_FORM_VALUE);
  assert.equal(applicant[1],MISSING_FORM_VALUE);

  data.pages[0].text+="\nApplicant applicant.name Synthetic Applicant";
  add("applicant-name","source:p1:person:applicant","applicant.name","Synthetic Applicant","Applicant applicant.name Synthetic Applicant");
  assert.equal(buildFormBindings(data,calculateCase(data,DRAFT_RULESET)).scalars.client_name,"Synthetic Applicant");
  assert.equal(buildCourtPackage(data,DRAFT_RULESET).documents.find(doc=>doc.kind==="application")!.tables[0].rows.find(row=>row[0]==="성명")![1],"Synthetic Applicant");
});

test("person 신원은 같은 대상의 명시된 applicant 역할에서만 연결하고 충돌·불인정은 거부한다",()=>{
  const data=fixture();
  const add=(id:string,subjectId:string,key:string,value:string,quote:string,options:{state?:"extracted"|"verified"|"disputed"|"retracted";recognition?:"unreviewed"|"accepted"|"rejected";logicalId?:string;version?:number}={})=>data.facts.push({id,logicalId:options.logicalId??id,version:options.version??1,subjectId,key,value,state:options.state??"extracted",recognition:options.recognition??"unreviewed",refs:[{documentId:"evidence",page:1,sourceHash:hash,quote}],validation:[]});
  data.pages[0].text+="\nApplicant role applicant\nApplicant person.name Applicant Kim\nFamily role family\nFamily person.name Family Kim\nCreditor role creditor\nCreditor person.name Creditor Kim";
  add("role-a","row-applicant","person.role","applicant","Applicant role applicant");
  add("name-a","row-applicant","person.name","Applicant Kim","Applicant person.name Applicant Kim");
  add("role-f","row-family","person.role","family","Family role family");
  add("name-f","row-family","person.name","Family Kim","Family person.name Family Kim");
  add("role-c","row-creditor","person.role","creditor","Creditor role creditor");
  add("name-c","row-creditor","person.name","Creditor Kim","Creditor person.name Creditor Kim");
  assert.equal(applicantIdentityValue(data,"name"),"Applicant Kim");
  assert.equal(buildFormBindings(data,calculateCase(data,DRAFT_RULESET)).scalars.client_name,"Applicant Kim");
  assert.equal(buildCourtPackage(data,DRAFT_RULESET).documents.find(doc=>doc.kind==="application")!.tables[0].rows.find(row=>row[0]==="성명")![1],"Applicant Kim");

  data.pages[0].text+="\nAlternate applicant name Applicant Park";
  add("name-a-conflict","row-applicant","person.name","Applicant Park","Alternate applicant name Applicant Park");
  assert.equal(applicantIdentityValue(data,"name"),"[상충: 원문 대조 필요]");
  data.facts=data.facts.filter(fact=>fact.id!=="name-a-conflict");
  add("conflict-role","row-applicant","person.role","family","Applicant is a family member");
  assert.equal(applicantIdentityValue(data,"name"),MISSING_FORM_VALUE,"conflicting roles are not enough to associate that identity with the applicant");
  data.facts=data.facts.filter(fact=>fact.id!=="conflict-role");
  add("rejected-name","row-applicant","applicant.name","Wrong Person","Applicant name wrong",{recognition:"rejected"});
  assert.equal(applicantIdentityValue(data,"name"),MISSING_FORM_VALUE,"a rejected explicit identity conflicts with the same subject's person name");
  data.facts=data.facts.filter(fact=>fact.id!=="name-a");
  assert.equal(applicantIdentityValue(data,"name"),"[확인 필요]","a rejected identity cannot be used as fallback");
  const stale=structuredClone(data);stale.pages[0].text+="\nOld role applicant Old name";
  stale.facts.push({id:"stale-role",logicalId:"stale-role",version:1,subjectId:"stale-row",key:"person.role",value:"applicant",state:"extracted",recognition:"unreviewed",refs:[{documentId:"evidence",page:1,sourceHash:hash,quote:"Old role applicant"}],validation:[]});
  stale.facts.push({id:"stale-name-v1",logicalId:"stale-name",version:1,subjectId:"stale-row",key:"person.name",value:"Old name",state:"extracted",recognition:"unreviewed",refs:[{documentId:"evidence",page:1,sourceHash:hash,quote:"Old name"}],validation:[]});
  stale.facts.push({id:"stale-name-v2",logicalId:"stale-name",version:2,subjectId:"stale-row",key:"person.name",value:"Old name",state:"retracted",recognition:"rejected",refs:[{documentId:"evidence",page:1,sourceHash:hash,quote:"Old name"}],validation:[]});
  assert.equal(applicantIdentityValue(stale,"name"),MISSING_FORM_VALUE,"a superseded/retracted identity version is not current");

  const crud=structuredClone(data);crud.context.applicant={name:"Manually Entered",address:"Manual Address"};
  assert.deepEqual(reconcileApplicantContext(crud),{name:"Manually Entered",address:"Manual Address"});
  assert.deepEqual(reconcileApplicantContext(data),{},"reconciliation must not promote OCR names into persistent CRUD context");
});

test("지분 미확정도 인용된 재산 총액은 초안에 표시하고 신청인 귀속 계산은 비운다",()=>{
  const data=fixture();
  for(const asset of data.assets) asset.ownershipBps=null;
  const bindings=buildFormBindings(data,calculateCase(data,DRAFT_RULESET));
  assert.equal(bindings.rows.asset[0].value,"4,000");
  assert.equal(bindings.rows.asset[0].applicant_share_value,MISSING_FORM_VALUE);
  assert.match(bindings.rows.asset[0].attribution_status,/귀속분 미확정/);
  assert.equal(bindings.scalars.insurance_surrender,MISSING_FORM_VALUE);
});

test("다른 사람의 단독 연락처·등록주소도 신청인 역할 없이 신청서에 채우지 않는다",()=>{
  const data=fixture();
  const add=(id:string,subjectId:string,key:string,value:string)=>{
    const quote=`${key}: ${value}`;
    data.pages[0].text+="\n"+quote;
    data.facts.push({id,logicalId:id,version:1,subjectId,key,value,state:"extracted",recognition:"unreviewed",refs:[{documentId:"evidence",page:1,sourceHash:hash,quote}],validation:[]});
  };
  add("other-phone","other-person","person.phone","02-000-0000");
  add("other-address","other-person","person.registered_address","Synthetic other address");
  let bindings=buildFormBindings(data,calculateCase(data,DRAFT_RULESET));
  assert.equal(bindings.scalars.phone,MISSING_FORM_VALUE);
  assert.equal(bindings.scalars.registered_address,MISSING_FORM_VALUE);
  add("other-role","other-person","person.role","creditor");
  add("applicant-phone","applicant-person","person.phone","010-0000-0000");
  add("applicant-address","applicant-person","person.registered_address","Synthetic applicant address");
  add("applicant-role","applicant-person","person.role","applicant");
  bindings=buildFormBindings(data,calculateCase(data,DRAFT_RULESET));
  assert.equal(bindings.scalars.phone,"010-0000-0000");
  assert.equal(bindings.scalars.registered_address,"Synthetic applicant address");
  assert.ok(data.facts.every(f=>f.recognition==="unreviewed"));
});

test("출처가 인용돼도 무효인 기계 검증 증명은 공개 양식의 값으로 사용하지 않는다",()=>{
  const data=fixture(),quote="사업장명 Synthetic firm";
  data.pages[0].text+="\n"+quote;
  const fact:Fact={id:"business-name",logicalId:"business-name",version:1,subjectId:"business",key:"business.name",value:"Synthetic firm",state:"extracted",recognition:"unreviewed",refs:[{documentId:"evidence",page:1,sourceHash:hash,quote}],validation:[]};
  data.facts.push(fact);
  assert.equal(buildFormBindings(data,calculateCase(data,DRAFT_RULESET)).scalars.business_name,"Synthetic firm");
  fact.state="verified";
  fact.sourceVerification={method:"independent_luna_cross_read"} as NonNullable<Fact["sourceVerification"]>;
  assert.equal(buildFormBindings(data,calculateCase(data,DRAFT_RULESET)).scalars.business_name,MISSING_FORM_VALUE);
});

test("채무 우선·보증·양도 충돌은 채권자 초안의 원문관측 표에 모두 보존한다",()=>{
  const data=fixture();
  const add=(id:string,key:string,value:string,quote:string)=>data.facts.push({
    id,logicalId:id,version:1,subjectId:"debt:synthetic-contract",key,value,state:"extracted",recognition:"unreviewed",
    refs:[{documentId:"evidence",page:1,sourceHash:hash,quote}],validation:[],
  });
  add("priority-a","debt.priority_basis","tax notice","priority_basis tax notice");
  add("priority-b","debt.priority_basis","court order","priority_basis court order");
  add("guarantee","debt.liability_role","guarantor","liability_role guarantor");
  add("assignment","debt.assignment_order","assigned","assignment_order assigned");
  data.pages.find(page=>page.page===1)!.text += "\npriority_basis tax notice\npriority_basis court order\nliability_role guarantor\nassignment_order assigned";
  const pack=buildCourtPackage(data,DRAFT_RULESET);
  const table=pack.documents.find(doc=>doc.kind==="creditors")?.tables.find(item=>item.title.includes("원문 관측"));
  assert.ok(table);
  assert.ok(table.rows.some(row=>row[1]==="debt.priority_basis"&&row[7].includes("상충")));
  assert.ok(table.rows.some(row=>row[1]==="debt.liability_role"&&row[2]==="guarantor"));
  assert.ok(table.rows.some(row=>row[1]==="debt.assignment_order"&&row[2]==="assigned"));
});

test("차량·보험 세부 행은 각 자산 ID의 명시 fact만 연결하고 충돌은 보류한다",()=>{
  const data=fixture();
  const add=(id:string,subjectId:string,key:string,value:string,quote:string)=>data.facts.push({id,logicalId:id,version:1,subjectId,key,value,state:"extracted",recognition:"unreviewed",refs:[{documentId:"evidence",page:2,sourceHash:hash,quote}],validation:[]});
  data.pages.find(page=>page.page===2)!.text+="\nvehicle.class sedan\nvehicle.market_value 9000원\nvehicle.market_value 9500원\nvehicle.owner_name Applicant\nvehicle.year 2020";
  add("vc","vehicle-01","vehicle.class","sedan","vehicle.class sedan");
  add("vm1","vehicle-01","vehicle.market_value","9000","vehicle.market_value 9000원");
  add("vm2","vehicle-01","vehicle.market_value","9500","vehicle.market_value 9500원");
  add("vo","vehicle-01","vehicle.owner_name","Applicant","vehicle.owner_name Applicant");
  add("vy","vehicle-01","vehicle.year","2020","vehicle.year 2020");
  data.assets.push({id:"vehicle-01",kind:"vehicle",label:"Synthetic Vehicle",grossValue:null,securedPayoff:null,ownershipBps:null,recognition:"unreviewed",factIds:["vc","vm1","vm2","vo","vy"]});
  const pack=buildCourtPackage(data,DRAFT_RULESET);
  const table=pack.documents.find(doc=>doc.kind==="assets")?.tables.find(item=>item.title.includes("차량·보험 세부"));
  assert.ok(table);
  const vehicle=table.rows.find(row=>row[0]==="vehicle-01")!;
  assert.equal(vehicle[3],"sedan");
  assert.equal(vehicle[4],"[상충·선택 보류]");
  assert.equal(vehicle[5],"Applicant");
  assert.equal(vehicle[8],"2020");
  const insurance=table.rows.find(row=>row[0]===data.assets[0].id)!;
  assert.equal(insurance[5],"[확인 필요]");
  assert.equal(insurance[6],"OWNER-2002");
  assert.equal(insurance[9],"합성 보험사");
  assert.ok(insurance[10].includes("4000"));
  const policyColumn=table.headers.indexOf("보험 증권번호(원문 마스킹 보존)");
  assert.ok(policyColumn>=0);
  assert.equal(insurance[policyColumn],"SYNTHETIC-POLICY-1234");
  assert.equal(vehicle[policyColumn],"[해당 없음]");
});

test("조건부 공식 서식은 명시 단서와 미확인 사유를 보여주되 증빙만으로 자동 선택하지 않는다",()=>{
  const data=fixture();
  const fact={id:"stay-kind",logicalId:"stay-kind",version:1,subjectId:"enforcement-1",key:"enforcement.kind",value:"wage garnishment",state:"extracted" as const,recognition:"unreviewed" as const,refs:[{documentId:"evidence",page:1,sourceHash:hash,quote:"Quoted synthetic enforcement evidence"}],validation:[]};
  data.facts.push(fact);
  data.pages[0].text+="\nQuoted synthetic enforcement evidence";
  const index=buildCourtPackage(data,DRAFT_RULESET).documents.find(doc=>doc.kind==="evidence_index")?.tables.find(item=>item.title.includes("조건부 공식 서식"));
  assert.ok(index);
  const stay=index.rows.find(row=>row[0].startsWith("D5113"))!;
  const prohibition=index.rows.find(row=>row[0].startsWith("D5114"))!;
  assert.ok(stay[1].includes("wage garnishment"));
  assert.match(stay[2],/자동 선택하지 않음/);
  assert.ok(prohibition[1].includes("wage garnishment"));
  assert.match(prohibition[2],/자동 선택하지 않음/);
  assert.match(prohibition[3],/신청 의사/);
});

test("request index and shared form bindings preserve assessment, package tables and form bindings",()=>{
  const data=fixture(),index=createCaseReadIndex(data),calc=calculateCase(data,DRAFT_RULESET);
  assert.deepEqual(buildFormBindings(data,calc,index),buildFormBindings(data,calc));
  const a=assessCase(data,DRAFT_RULESET),b=assessCase(data,DRAFT_RULESET,index);
  assert.deepEqual(b,a);
  const before=buildCourtPackage(data,DRAFT_RULESET,a),after=buildCourtPackage(data,DRAFT_RULESET,b,index);
  delete (before as Partial<typeof before>).generatedAt;
  delete (after as Partial<typeof after>).generatedAt;
  assert.deepEqual(after,before);
});
