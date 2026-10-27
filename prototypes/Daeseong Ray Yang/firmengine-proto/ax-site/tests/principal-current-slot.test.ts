import test from "node:test";
import assert from "node:assert/strict";
import { applyExtraction, createCase, currentFacts, DRAFT_RULESET } from "../lib/domain.ts";
import { calculateCase } from "../lib/assessment.ts";
import { buildFormBindings } from "../lib/form-mapping.ts";
import { applyFirstVerification, projectPage, type PageRead, type ReadField } from "../lib/extraction.ts";

const hash="b".repeat(64);
const field=(key:string,value:string|null,extra:Partial<ReadField>={}):ReadField=>({key,label:key,value,unit:"원",quote:value===null?null:`원금잔액 ${value}원`,confidence:"clear",bbox:[.2,.2,.4,.25],...extra});
const generic=()=>field("principal","810",{quote:"최초 대출원금 810원",bbox:[.2,.1,.4,.15]});
const current=(extra:Partial<ReadField>={})=>field("principal_balance","620",extra);
const read=(fields:ReadField[],documentType="debt_certificate"):PageRead=>({documentType,complete:true,warnings:[],records:[{category:"debt",label:"synthetic row",fields:[field("creditor","Synthetic Creditor",{quote:"채권자 Synthetic Creditor",unit:null,bbox:[.1,.1,.2,.2]}),...fields,field("interest","0",{quote:"이자 0원",bbox:[.2,.3,.4,.35]})]}]});
const project=(fields:ReadField[],documentType?:string)=>projectPage(read(fields,documentType),"synthetic-doc",1,hash);

test("original/generic and explicit current principal remain distinct, independent of field order",()=>{
  for(const fields of [[generic(),current()],[current(),generic()]]){
    const p=project(fields);
    assert.equal(p.debts?.[0].principal?.amountWon,"620");
    assert.equal(p.facts?.find(f=>f.key==="debt.principal")?.numeric?.amountWon,"810");
    assert.equal(p.facts?.find(f=>f.key==="debt.principal_balance")?.numeric?.amountWon,"620");
    assert.ok(!p.facts?.some(f=>f.validation?.some(v=>v.code==="FIELD_CONFLICT")));
    assert.ok(p.debts?.[0].factIds.includes(p.facts!.find(f=>f.key==="debt.principal_balance")!.id!));
  }
});

for(const [name,extra] of Object.entries({
  null:{value:null,quote:null},unreadable:{confidence:"unreadable"},uncertain:{confidence:"uncertain"},
  quote:{quote:null},meaning:{quote:"한도액 620원"},bbox:{bbox:null},invertedBox:{bbox:[.4,.2,.2,.25]},
  unit:{unit:null},foreignUnit:{unit:"USD"},number:{value:"?"},negative:{value:"-620",quote:"원금잔액 -620원"},
} as Record<string,Partial<ReadField>>))test(`explicit current ${name} cannot fall back to generic principal`,()=>{
  const p=project([field("principal","810",{quote:"원금 810원"}),current(extra)]);
  assert.equal(p.debts?.[0].principal,null);
});

test("generic fallback requires absent current slot; original/historical and generic balance never supply it",()=>{
  assert.equal(project([field("principal","810",{quote:"원금 810원"})]).debts?.[0].principal?.amountWon,"810");
  assert.equal(project([generic()]).debts?.[0].principal,null);
  assert.equal(project([field("original_principal","810",{quote:"최초 원금 810원"})]).debts?.[0].principal,null);
  assert.equal(project([field("current_balance","810",{quote:"전체 잔액 810원"})]).debts?.[0].principal,null);
  for(const type of ["credit_report","채권자변동정보 조회서"])assert.equal(project([generic(),current()],type).debts?.length,0);
});

test("current aliases conflict only with each other; identical duplicate and explicit zero retain source units",()=>{
  const alias=current({key:"outstanding_principal",value:"610",quote:"현재 원금 610원"});
  for(const fields of [[generic(),current(),alias],[alias,current(),generic()]]){
    const p=project(fields);assert.equal(p.debts?.[0].principal,null);
    assert.equal(p.facts?.filter(f=>f.validation?.some(v=>v.code==="FIELD_CONFLICT")).length,2);
    assert.ok(!p.facts?.find(f=>f.key==="debt.principal")?.validation?.some(v=>v.code==="FIELD_CONFLICT"));
  }
  assert.equal(project([current(),current({key:"debt.outstandingPrincipal"})]).debts?.[0].principal?.amountWon,"620");
  assert.equal(project([generic(),current({value:"0",quote:"원금잔액 0원"})]).debts?.[0].principal?.amountWon,"0");
  assert.equal(project([current({value:"62",quote:"원금잔액 62천원",unit:"천원"})]).debts?.[0].principal?.amountWon,"62000");
  assert.equal(project([current(),current({key:"outstanding_principal",value:null,quote:null})]).debts?.[0].principal,null);
});

test("a supported value with wrong field meaning remains blocked after the independent verifier",()=>{
  const source=read([field("principal","810",{quote:"원금 810원"}),current()]);
  const checks=source.records[0].fields.map((f,fieldIndex)=>({recordIndex:0,fieldIndex,status:"agrees" as const,meaningStatus:fieldIndex===2?"wrong_field":"supported",value:f.value,unit:f.unit,quote:f.quote,reason:"synthetic independent meaning check"}));
  const checked=applyFirstVerification(source,checks);
  assert.equal(projectPage(checked.read,"synthetic-doc",1,hash).debts?.[0].principal,null);
});

test("different records and reordered rows keep current amounts and sources on their own subject",()=>{
  const a=read([generic(),current()]).records[0],b=read([current({value:"470",quote:"원금잔액 470원",bbox:[.2,.6,.4,.65]})]).records[0];
  b.fields[0]=field("creditor","Other Creditor",{unit:null,quote:"채권자 Other Creditor"});
  for(const records of [[a,b],[b,a]]){
    const p=projectPage({documentType:"debt_certificate",complete:true,warnings:[],records},"synthetic-doc",1,hash);
    for(const row of p.debts!){
      assert.equal(row.principal?.amountWon,row.creditor==="Other Creditor"?"470":"620");
      assert.ok(row.factIds.every(id=>p.facts!.find(f=>f.id===id)?.subjectId===row.id));
    }
  }
});

test("reprojection retires obsolete automatic conflict groups and form basis uses only current principal",()=>{
  const data=createCase("synthetic principal","synthetic-case","2026-10-27");
  data.documents=[{id:"synthetic-doc",name:"synthetic.pdf",sha256:hash,status:"active",pages:[1]}];
  data.pages=[{documentId:"synthetic-doc",page:1,role:"evidence"}];
  const source=read([generic(),current()]),payload=projectPage(source,"synthetic-doc",1,hash),legacy=structuredClone(payload);
  for(const fact of legacy.facts!)if(["debt.principal","debt.principal_balance"].includes(fact.key!)){
    fact.logicalId=`${fact.subjectId}:principal:candidate:${fact.id!.split(":f").at(-1)}`;
    fact.validation=[{code:"FIELD_CONFLICT",severity:"error",message:"synthetic legacy alias collision"}];
  }
  const before=applyExtraction(data,legacy),after=applyExtraction(before,payload);
  assert.ok(currentFacts(before).some(f=>f.state==="disputed"));
  assert.ok(!currentFacts(after).some(f=>f.validation.some(v=>v.code==="FIELD_CONFLICT")));
  assert.ok(after.facts.some(f=>f.state==="retracted"&&f.validation.some(v=>v.code==="FIELD_CONFLICT")));
  const bindings=buildFormBindings(after,calculateCase(after,DRAFT_RULESET));
  assert.match(bindings.rows.creditor[0].principal_basis,/원금잔액 620원/);
  assert.ok(!bindings.rows.creditor[0].principal_basis.includes("810"));
});
