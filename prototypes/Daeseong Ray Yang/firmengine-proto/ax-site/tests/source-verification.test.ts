import test from "node:test";
import assert from "node:assert/strict";
import { AI_MODEL, applyExtraction, createCase, currentFacts, factLineageIssues, factSourceLineageIssues, normalizeMoney } from "../lib/domain.ts";
import { assessCase } from "../lib/assessment.ts";
import { createPreservedOmissionReceipts,createSourceVerificationReceipts,sourceVerificationFieldLocation,sourceVerificationReceiptMatches } from "../lib/source-verification.ts";
import type { Check, PageRead, ReviewPass } from "../lib/source-verification.ts";
import type { CaseData, Fact } from "../lib/domain.ts";

const hash = "a".repeat(64), docId = "proof-doc", pageNum = 1;
const promptHash = "c".repeat(64), at = "2026-10-27T10:00:00.000Z";
const field = (key:string,value:string,unit:string|null,quote:string,confidence:"clear"|"uncertain"|"unreadable"="clear")=>({key,value,unit,quote,confidence});
const check=(ri:number,fi:number,status:Check["status"],value:string|null,unit:string|null,quote:string|null,meaningStatus:Check["meaningStatus"]="supported"):Check=>({recordIndex:ri,fieldIndex:fi,meaningStatus,status,value,unit,quote});
const pass=(kind:"verify"|"repair",checks:Check[]):ReviewPass=>({kind,checks,model:AI_MODEL,promptVersion:"luna-evidence-3.11.0",promptHash,verifiedAt:at});
function sourceInput(read:PageRead,passes:ReviewPass[],sourceHash=hash,errors?:{recordIndex:number;fieldIndex:number;code:string}[]){return{documentId:docId,page:pageNum,sourceHash,promptVersion:"luna-evidence-3.11.0",verifiedAt:at,originalRead:read,read,passes,errors};}
function fixture():CaseData{const d=createCase("합성", "c", "2026-10-27");d.documents=[{id:docId,name:"synthetic",sha256:hash,status:"active",pages:[pageNum]}];d.pages=[{documentId:docId,page:pageNum,role:"evidence"}];return d;}
function rawFact(value:string,quote:string):Partial<Fact>{return{id:"model-id",logicalId:"debt-source",subjectId:"loan",key:"debt.principal",value,rawValue:value,numeric:normalizeMoney(value,"만원"),state:"verified",recognition:"accepted",sourceVerification:{fake:true} as never,refs:[{documentId:docId,page:pageNum,quote,sourceHash:hash}],validation:[]};}

test("verified agreement receipt is bound to current source and exact fact version but stays legally unreviewed",()=>{
  const read:PageRead={documentType:"debt_certificate",complete:true,records:[{category:"debt",fields:[field("principal","500","만원","원금 500만원")]}]};
  const receipts=createSourceVerificationReceipts(sourceInput(read,[pass("verify",[check(0,0,"agrees","500","만원","원금 잔액 500만원")])]));
  assert.equal(receipts.length,1);assert.equal(receipts[0].model,AI_MODEL);assert.equal(receipts[0].recognition,"unreviewed");assert.equal(receipts[0].verificationScope,"field_meaning_v1");
  assert.equal(receipts[0].proofReads.length,1);assert.equal(receipts[0].proofReads[0].promptHash,promptHash);
  assert.equal(sourceVerificationReceiptMatches(receipts[0],{documentId:docId,page:pageNum,sourceHash:hash,read}),true);
  assert.equal(sourceVerificationReceiptMatches(receipts[0],{documentId:docId,page:pageNum,sourceHash:"b".repeat(64),read}),false);
  const strippedScope=structuredClone(receipts[0]);delete strippedScope.verificationScope;
  assert.equal(sourceVerificationReceiptMatches(strippedScope,{documentId:docId,page:pageNum,sourceHash:hash,read}),false,"meaning status and fingerprint marker cannot be stripped to masquerade as a legacy receipt");
});

test("wrong, unclear, or missing field meaning never receives a new semantic receipt",()=>{
  const read:PageRead={documentType:"debt_certificate",complete:true,records:[{category:"debt",fields:[field("interest","500","만원","연체이자 500만원")]}]};
  for(const meaning of ["wrong_field","unclear"] as const){const result=createSourceVerificationReceipts(sourceInput(read,[pass("verify",[check(0,0,"agrees","500","만원","연체이자 500만원",meaning)])]));assert.equal(result.length,0);}
  const missing=createSourceVerificationReceipts(sourceInput(read,[pass("verify",[{recordIndex:0,fieldIndex:0,status:"agrees",value:"500",unit:"만원",quote:"연체이자 500만원"}])]));assert.equal(missing.length,0);
  const supported=createSourceVerificationReceipts(sourceInput(read,[pass("verify",[check(0,0,"agrees","500","만원","연체이자 500만원","supported")])]));assert.equal(supported.length,1);assert.equal(supported[0].verificationScope,"field_meaning_v1");
});

test("first corrected disagreement needs second identical value+unit correction; missing first check can use an independent agrees",()=>{
  const read:PageRead={documentType:"x",complete:true,records:[{category:"debt",fields:[field("principal","500","만원","잔액 500만원")] }]};
  const wrongFirst=[pass("verify",[check(0,0,"corrected","500","원","원금 500원")]),pass("repair",[check(0,0,"corrected","500","만원","잔액 500만원")])];
  assert.equal(createSourceVerificationReceipts(sourceInput(read,wrongFirst)).length,0);
  const corrected=[pass("verify",[check(0,0,"corrected","500","만원","원금 500만원")]),pass("repair",[check(0,0,"corrected","500","만원","잔액 500만원")])];
  const original:PageRead={...read,records:[{category:"debt",fields:[field("principal","450","만원","최초 원금 450만원","uncertain")] }]};
  const correctedReceipt=createSourceVerificationReceipts({...sourceInput(read,corrected),originalRead:original});
  assert.equal(correctedReceipt.length,1);assert.equal(correctedReceipt[0].extractionReading.value,"450");assert.equal(correctedReceipt[0].field.value,"500");
  assert.deepEqual(correctedReceipt[0].proofReads.map(p=>[p.status,p.value,p.unit]),[["corrected","500","만원"],["corrected","500","만원"]]);
  const missing=[pass("verify",[]),pass("repair",[check(0,0,"agrees","500","만원","잔액 500만원")])];
  const receipt=createSourceVerificationReceipts(sourceInput(read,missing));assert.equal(receipt.length,1);assert.equal(receipt[0].proofReadIndexes[0].pass,"repair");
});

test("null/unsupported money units, missing or unsolicited checks, errors, uncertainty, and duplicate field evidence cannot verify",()=>{
  const money:PageRead={documentType:"x",complete:true,records:[{category:"debt",fields:[field("principal","500","달러","원금 500달러")]}]};
  assert.equal(createSourceVerificationReceipts(sourceInput(money,[pass("verify",[check(0,0,"agrees","500","달러","원금 500달러")])])).length,0);
  const clear:PageRead={...money,records:[{category:"person",fields:[field("phone","010-***",null,"전화 010-***")] }]};
  assert.equal(createSourceVerificationReceipts(sourceInput(clear,[pass("verify",[])])).length,0);
  assert.equal(createSourceVerificationReceipts(sourceInput(clear,[pass("verify",[check(0,0,"agrees","010-***",null,"전화 010-***")])],hash,[{recordIndex:0,fieldIndex:0,code:"FIELD_CONFLICT"}])).length,0);
  const uncertain:PageRead={...clear,records:[{category:"person",fields:[field("phone","010-***",null,"전화 010-***","uncertain")] }]};
  assert.equal(createSourceVerificationReceipts(sourceInput(uncertain,[pass("verify",[check(0,0,"agrees","010-***",null,"전화 010-***")])])).length,0);
  const duplicate:PageRead={...clear,records:[clear.records[0],clear.records[0]]};
  assert.equal(createSourceVerificationReceipts(sourceInput(duplicate,[pass("verify",[check(0,0,"agrees","010-***",null,"전화 010-***")])])).length,0);
});

test("receipt identity survives index drift but current receipt remains fact-version bound",()=>{
  const row={category:"debt",fields:[field("creditor","은행A",null,"채권자 은행A"),field("principal","500","만원","원금 500만원")]};
  const original:PageRead={documentType:"debt_certificate",complete:true,records:[row]};
  const receipt=createSourceVerificationReceipts(sourceInput(original,[pass("verify",[check(0,1,"agrees","500","만원","원금 500만원")])]))[0];
  const shifted:PageRead={...original,records:[{category:"income",fields:[field("net","200","만원","급여 200만원")]},row]};
  assert.equal(sourceVerificationReceiptMatches(receipt,{documentId:docId,page:pageNum,sourceHash:hash,read:shifted}),true);
  assert.equal(receipt.proofReadIndexes[0].recordIndex,0);
});

test("same quote and numeric value on different source keys retain distinct receipt identity and target the right fact",()=>{
  const read:PageRead={documentType:"debt_certificate",complete:true,records:[{category:"debt",fields:[field("principal","100","원","잔액 100원"),field("interest","100","원","잔액 100원")]}]};
  const receipts=createSourceVerificationReceipts(sourceInput(read,[pass("verify",[check(0,0,"agrees","100","원","원금 100원"),check(0,1,"agrees","100","원","이자 100원")])]));
  assert.equal(receipts.length,2);
  assert.deepEqual(receipts.map(r=>r.field.key).sort(),["interest","principal"]);
  assert.deepEqual(receipts.map(r=>sourceVerificationFieldLocation(r,read)).sort((a,b)=>(a?.fieldIndex??-1)-(b?.fieldIndex??-1)),[{recordIndex:0,fieldIndex:1},{recordIndex:0,fieldIndex:0}].sort((a,b)=>a.fieldIndex-b.fieldIndex));
});

test("omission reread reuses only baseline-agreed fields still present verbatim after row-index drift",()=>{
  const baseline:PageRead={documentType:"debt_certificate",complete:true,records:[{category:"debt",fields:[field("contract_id","C-1",null,"계약번호 C-1"),field("principal","500","만원","잔액 500만원")]}]};
  const baselinePass=pass("verify",[check(0,0,"agrees","C-1",null,"계약번호 C-1"),check(0,1,"agrees","500","만원","원금잔액 500만원")]);
  const merged:PageRead={documentType:"debt_certificate",complete:true,records:[{category:"income",fields:[field("net","200","만원","급여 200만원")]},{category:"debt",fields:[field("contract_id","C-1",null,"계약번호 C-1"),field("principal","500","만원","잔액 500만원")]}]};
  const receipts=createPreservedOmissionReceipts({documentId:docId,page:pageNum,sourceHash:hash,promptVersion:baselinePass.promptVersion,verifiedAt:baselinePass.verifiedAt,baselineRead:baseline,baselinePass,mergedRead:merged});
  assert.equal(receipts.length,2);assert.deepEqual(receipts.map(r=>r.field.key).sort(),["contract_id","principal"]);
  const changed:PageRead={...merged,records:[merged.records[0],{...merged.records[1],fields:[merged.records[1].fields[0],field("principal","600","만원","잔액 600만원")]}]};
  const safe=createPreservedOmissionReceipts({documentId:docId,page:pageNum,sourceHash:hash,promptVersion:baselinePass.promptVersion,verifiedAt:baselinePass.verifiedAt,baselineRead:baseline,baselinePass,mergedRead:changed});
  assert.deepEqual(safe.map(r=>r.field.key),["contract_id"]);
});

test("applyExtraction strips model-supplied verification/acceptance, and changed machine-verified facts are invalidated",()=>{
  let data=fixture();
  const quote="원금 500만원";
  data=applyExtraction(data,{facts:[rawFact("500",quote)]});
  let fact=currentFacts(data)[0];assert.equal(fact.state,"extracted");assert.equal(fact.recognition,"unreviewed");assert.equal(fact.sourceVerification,undefined);
  const read:PageRead={documentType:"debt_certificate",complete:true,records:[{category:"debt",fields:[field("principal","500","만원",quote)]}]};
  const [proof]=createSourceVerificationReceipts(sourceInput(read,[pass("verify",[check(0,0,"agrees","500","만원",quote)])]));
  fact.state="verified";fact.sourceVerification={...proof,factBinding:{id:fact.id,logicalId:fact.logicalId,version:fact.version}};
  assert.deepEqual(factSourceLineageIssues(data,[fact.id]),[]);assert.ok(factLineageIssues(data,[fact.id]).includes("LEGAL_RECOGNITION_REQUIRED"));assert.equal(fact.recognition,"unreviewed");
  const strippedScope=structuredClone(fact.sourceVerification!);delete strippedScope.verificationScope;fact.sourceVerification=strippedScope;
  assert.ok(factSourceLineageIssues(data,[fact.id]).includes("SOURCE_VERIFICATION_RECEIPT_INVALID"),"domain lineage rejects a new semantic proof with its scope marker removed");
  fact.sourceVerification={...proof,factBinding:{id:fact.id,logicalId:fact.logicalId,version:fact.version}};
  data=applyExtraction(data,{facts:[rawFact("600","원금 600만원")]});
  const current=currentFacts(data)[0];assert.equal(current.state,"extracted");assert.equal(current.value,"600");assert.equal(current.sourceVerification,undefined);assert.notEqual(current.id,fact.id);assert.equal(current.state,"extracted");
});

test("assessment does not require legal acceptance for verified raw contact metadata",()=>{
  const d=fixture();
  // The core synthetic fixture from the domain suite is deliberately too broad;
  // this minimal check targets the fact-level gate without granting any object decision.
  d.facts.push({id:"phone",logicalId:"phone",version:1,subjectId:"applicant",key:"person.phone",value:"010-***",state:"extracted",recognition:"unreviewed",refs:[{documentId:docId,page:pageNum,quote:"연락처 010-***",sourceHash:hash}],validation:[]});
  const result=assessCase(d,{id:"draft",status:"draft",sources:[]});
  assert.ok(!result.findings.some(f=>f.id==="recognition_phone"));
  assert.ok(result.findings.some(f=>f.id==="verification_phone")); // active drafts still require source cross-read
});
