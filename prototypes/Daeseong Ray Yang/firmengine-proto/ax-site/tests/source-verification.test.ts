import test from "node:test";
import assert from "node:assert/strict";
import { AI_MODEL, OCR_MODEL, applyExtraction, createCase, currentFacts, factLineageIssues, factSourceLineageIssues, normalizeMoney } from "../lib/domain.ts";
import { assessCase } from "../lib/assessment.ts";
import { createPreservedOmissionReceipts,createSourceVerificationReceipts,sourceVerificationFieldLocation,sourceVerificationReceiptMatches } from "../lib/source-verification.ts";
import type { Check, PageRead, ReviewPass } from "../lib/source-verification.ts";
import type { CaseData, Fact } from "../lib/domain.ts";

const hash = "a".repeat(64), docId = "proof-doc", pageNum = 1;
const promptHash = "c".repeat(64), at = "2026-10-27T10:00:00.000Z";
const field = (key:string,value:string,unit:string|null,quote:string,confidence:"clear"|"uncertain"|"unreadable"="clear")=>({key,value,unit,quote,confidence,bbox:[.1,.2,.4,.25]});
const check=(ri:number,fi:number,status:Check["status"],value:string|null,unit:string|null,quote:string|null,meaningStatus:Check["meaningStatus"]="supported"):Check=>({recordIndex:ri,fieldIndex:fi,categoryStatus:"supported",meaningStatus,status,value,unit,quote,bbox:[.1,.2,.4,.25]});
const pass=(kind:"verify"|"repair",checks:Check[]):ReviewPass=>({kind,checks,model:AI_MODEL,promptVersion:"luna-evidence-3.20.0",promptHash,verifiedAt:at});
function sourceInput(read:PageRead,passes:ReviewPass[],sourceHash=hash,errors?:{recordIndex:number;fieldIndex:number;code:string}[]){return{documentId:docId,page:pageNum,sourceHash,promptVersion:"luna-evidence-3.20.0",verifiedAt:at,originalRead:read,read,passes,errors};}
function fixture():CaseData{const d=createCase("합성", "c", "2026-10-27");d.documents=[{id:docId,name:"synthetic",sha256:hash,status:"active",pages:[pageNum]}];d.pages=[{documentId:docId,page:pageNum,role:"evidence"}];return d;}
function rawFact(value:string,quote:string):Partial<Fact>{return{id:"model-id",logicalId:"debt-source",subjectId:"loan",key:"debt.principal",value,rawValue:value,numeric:normalizeMoney(value,"만원"),state:"verified",recognition:"accepted",sourceVerification:{fake:true} as never,refs:[{documentId:docId,page:pageNum,quote,sourceHash:hash,bbox:[.1,.2,.4,.25]}],validation:[]};}

test("verified agreement receipt is bound to current source and exact fact version but stays legally unreviewed",()=>{
  const read:PageRead={documentType:"debt_certificate",complete:true,records:[{category:"debt",fields:[field("principal","500","만원","원금 500만원")]}]};
  const receipts=createSourceVerificationReceipts(sourceInput(read,[pass("verify",[check(0,0,"agrees","500","만원","원금 500만원")])]));
  assert.equal(receipts.length,1);assert.equal(receipts[0].model,AI_MODEL);assert.equal(receipts[0].recognition,"unreviewed");assert.equal(receipts[0].verificationScope,"field_meaning_v1");
  assert.equal(receipts[0].proofReads.length,1);assert.equal(receipts[0].proofReads[0].promptHash,promptHash);
  assert.equal(sourceVerificationReceiptMatches(receipts[0],{documentId:docId,page:pageNum,sourceHash:hash,read}),true);
  assert.ok(receipts[0].geometry?.verifierReads.length===1,"the actual location read is bound into the receipt");
  const strippedGeometry=structuredClone(receipts[0]);delete strippedGeometry.geometry;
  assert.equal(sourceVerificationReceiptMatches(strippedGeometry,{documentId:docId,page:pageNum,sourceHash:hash,read}),false,"a geometry-bound fingerprint cannot be stripped and accepted as a historical receipt");
  assert.equal(sourceVerificationReceiptMatches(receipts[0],{documentId:docId,page:pageNum,sourceHash:"b".repeat(64),read}),false);
  const strippedScope=structuredClone(receipts[0]);delete strippedScope.verificationScope;
  assert.equal(sourceVerificationReceiptMatches(strippedScope,{documentId:docId,page:pageNum,sourceHash:hash,read}),false,"meaning status and fingerprint marker cannot be stripped to masquerade as a legacy receipt");
});


test("v3.20 receipt creation fails closed for missing or unsupported record category consensus",()=>{
  const read:PageRead={documentType:"synthetic",complete:true,records:[{category:"transaction",fields:[field("principal","500","만원","입금 500만원"),field("creditor","A",null,"상대방 A")]}]};
  const mixed=[check(0,0,"agrees","500","만원","입금 500만원"),{...check(0,1,"agrees","A",null,"상대방 A"),categoryStatus:"wrong_category" as const}];
  assert.deepEqual(createSourceVerificationReceipts(sourceInput(read,[pass("verify",mixed)])),[]);
  const missing={...check(0,0,"agrees","500","만원","입금 500만원")};delete (missing as Partial<Check>).categoryStatus;
  assert.deepEqual(createSourceVerificationReceipts(sourceInput(read,[pass("verify",[missing])])),[]);
});


test("receipt matcher requires category status when any embedded read uses v3.20, even with a legacy parent",()=>{
  const read:PageRead={documentType:"debt_certificate",complete:true,records:[{category:"debt",fields:[field("principal","500","만원","원금 500만원")]}]};
  const [receipt]=createSourceVerificationReceipts(sourceInput(read,[pass("verify",[check(0,0,"agrees","500","만원","원금 500만원")])]));
  const tampered=structuredClone(receipt);tampered.promptVersion="luna-evidence-3.19.0";delete tampered.proofReads[0].categoryStatus;delete tampered.geometry!.verifierReads[0].categoryStatus;
  assert.equal(sourceVerificationReceiptMatches(tampered,{documentId:docId,page:pageNum,sourceHash:hash,read}),false);
});

test("well-formed pre-v3.20 receipts retain historical category-status omission",()=>{
  const read:PageRead={documentType:"debt_certificate",complete:true,records:[{category:"debt",fields:[field("principal","500","만원","원금 500만원")]}]};
  const oldPass={...pass("verify",[{...check(0,0,"agrees","500","만원","원금 500만원")}]),promptVersion:"luna-evidence-3.19.0"};delete oldPass.checks[0].categoryStatus;
  const oldInput={...sourceInput(read,[oldPass]),promptVersion:"luna-evidence-3.19.0"};assert.equal(createSourceVerificationReceipts(oldInput).length,1);
});

test("new receipts require verifier quotes to overlap the extracted field quote literally",()=>{
  const make=(fieldQuote:string,verifyQuote:string,value="500",unit:string|null="만원",key="principal")=>{
    const read:PageRead={documentType:"debt_certificate",complete:true,records:[{category:"debt",fields:[field(key,value,unit,fieldQuote)]}]};
    return {read,receipts:createSourceVerificationReceipts(sourceInput(read,[pass("verify",[check(0,0,"agrees",value,unit,verifyQuote)])]))};
  };
  assert.equal(make("원금 500만원","채권자 500만원").receipts.length,0,"same value and bbox cannot make an unrelated source quote valid");
  assert.equal(make("원금 500만원","원금 500만원").receipts.length,1,"exact quote remains accepted");
  assert.equal(make("원금\n500만원","원금 500만원").receipts.length,1,"whitespace-normalized quote remains accepted");
  assert.equal(make("대출 원금은 500만원이고 납부기한은 3월입니다","원금은 500만원").receipts.length,1,"a shortened literal excerpt remains accepted");
  assert.equal(make("원금 500만원","채무자의 원금 500만원은 현재 잔액입니다").receipts.length,1,"a longer literal excerpt remains accepted");
  assert.equal(make("거래내역\n2026-10-01 입금 500만원","2026-10-01 입금 500만원","500","만원","transaction_amount").receipts.length,1,"multiline statement-scope evidence remains accepted when text overlaps");
  const {receipts}=make("원금 500만원","원금 500만원");
  const tampered=structuredClone(receipts[0]);tampered.proofReads[0].quote="채권자 500만원";tampered.verificationQuotes[0]=tampered.proofReads[0].quote;
  assert.equal(sourceVerificationReceiptMatches(tampered,{documentId:docId,page:pageNum,sourceHash:hash,read:make("원금 500만원","원금 500만원").read}),false,"persisted new proof is rechecked even if quote/index fields are changed together");
});

test("corrected proof reads must both remain anchored to the final extraction quote",()=>{
  const read:PageRead={documentType:"debt_certificate",complete:true,records:[{category:"debt",fields:[field("principal","500","만원","원금 500만원; 잔액 기준")]}]};
  const original:PageRead={...read,records:[{category:"debt",fields:[field("principal","450","만원","최초 기재 450만원","uncertain")]}]};
  const valid=[pass("verify",[check(0,0,"corrected","500","만원","원금 500만원")]),pass("repair",[check(0,0,"corrected","500","만원","원금 500만원; 잔액 기준")])];
  assert.equal(createSourceVerificationReceipts({...sourceInput(read,valid),originalRead:original}).length,1,"two distinct but overlapping reads remain valid");
  const unrelated=[pass("verify",[check(0,0,"corrected","500","만원","계좌번호 500만원")]),pass("repair",[check(0,0,"corrected","500","만원","잔액 기준: 원금 500만원")])];
  assert.equal(createSourceVerificationReceipts({...sourceInput(read,unrelated),originalRead:original}).length,0,"a corrected value cannot legitimize an unrelated quote from the same page");
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
  const corrected=[pass("verify",[check(0,0,"corrected","500","만원","잔액 500만원")]),pass("repair",[check(0,0,"corrected","500","만원","잔액 500만원")])];
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
  const read:PageRead={documentType:"debt_certificate",complete:true,records:[{category:"debt",fields:[field("principal","100","원","원금과 이자 잔액 100원"),field("interest","100","원","원금과 이자 잔액 100원")]}]};
  const receipts=createSourceVerificationReceipts(sourceInput(read,[pass("verify",[check(0,0,"agrees","100","원","원금과 이자 잔액 100원"),check(0,1,"agrees","100","원","원금과 이자 잔액 100원")])]));
  assert.equal(receipts.length,2);
  assert.deepEqual(receipts.map(r=>r.field.key).sort(),["interest","principal"]);
  assert.deepEqual(receipts.map(r=>sourceVerificationFieldLocation(r,read)).sort((a,b)=>(a?.fieldIndex??-1)-(b?.fieldIndex??-1)),[{recordIndex:0,fieldIndex:1},{recordIndex:0,fieldIndex:0}].sort((a,b)=>a.fieldIndex-b.fieldIndex));
});

test("duplicate equal source fields require an exact disjoint bbox locator and survive safe row-order drift",()=>{
  const boxes:[[number,number,number,number],[number,number,number,number],[number,number,number,number]]=[[0.05,0.1,0.2,0.2],[0.3,0.1,0.45,0.2],[0.6,0.1,0.75,0.2]];
  const makeRead=(ordered=boxes):PageRead=>({documentType:"synthetic_asset",complete:true,records:ordered.map(bbox=>({category:"asset",fields:[{...field("gross_value","7250","원","환급가액 7,250원"),bbox}]}))});
  const read=makeRead(),checks=read.records.map((record,recordIndex)=>check(recordIndex,0,"agrees","7250","원","환급가액 7,250원"));
  checks.forEach((item,index)=>{item.bbox=boxes[index];});
  const verify=pass("verify",checks);verify.bindingStatus="bound";
  const receipts=createSourceVerificationReceipts(sourceInput(read,[verify]));
  assert.equal(receipts.length,3);
  assert.ok(receipts.every(receipt=>receipt.field.locator?.version==="bbox_v1"));
  assert.deepEqual(receipts.map(receipt=>sourceVerificationFieldLocation(receipt,read)?.recordIndex),[0,1,2]);
  assert.ok(receipts.every(receipt=>sourceVerificationReceiptMatches(receipt,{documentId:docId,page:pageNum,sourceHash:hash,read})));
  const shifted=makeRead([boxes[2],boxes[0],boxes[1]]);
  assert.deepEqual(receipts.map(receipt=>sourceVerificationFieldLocation(receipt,shifted)?.recordIndex),[1,2,0]);
  assert.ok(receipts.every(receipt=>sourceVerificationReceiptMatches(receipt,{documentId:docId,page:pageNum,sourceHash:hash,read:shifted})));
  const stripped=structuredClone(receipts[0]);delete stripped.field.locator;
  assert.equal(sourceVerificationReceiptMatches(stripped,{documentId:docId,page:pageNum,sourceHash:hash,read}),false);
  assert.equal(sourceVerificationFieldLocation(stripped,read),null,"location lookup must reject a stripped locator before attachment");
  const retargeted=structuredClone(receipts[0]);retargeted.field.locator!.bbox=[...boxes[1]];
  assert.equal(sourceVerificationReceiptMatches(retargeted,{documentId:docId,page:pageNum,sourceHash:hash,read}),false);
  assert.equal(sourceVerificationFieldLocation(retargeted,read),null,"location lookup must reject a retargeted bbox");
  const forgedFingerprint=structuredClone(receipts[0]);forgedFingerprint.fieldFingerprint="[]";
  assert.equal(sourceVerificationFieldLocation(forgedFingerprint,read),null,"location lookup must validate the bbox-bearing fingerprint");
  const strippedProofBox=structuredClone(receipts[0]);delete strippedProofBox.proofReads[0].bbox;
  assert.equal(sourceVerificationReceiptMatches(strippedProofBox,{documentId:docId,page:pageNum,sourceHash:hash,read}),false);
  const strippedGeometry=structuredClone(receipts[0]);delete strippedGeometry.field.locator;delete strippedGeometry.extractionReading.bbox;for(const proof of strippedGeometry.proofReads)delete proof.bbox;
  assert.equal(sourceVerificationReceiptMatches(strippedGeometry,{documentId:docId,page:pageNum,sourceHash:hash,read}),false,"the extended fingerprint cannot be accepted as a legacy receipt after every locator property is stripped");
  assert.equal(sourceVerificationFieldLocation(strippedGeometry,read),null);

  const held=(candidate:PageRead, candidatePass=verify, errors?:{recordIndex:number;fieldIndex:number;code:string}[])=>createSourceVerificationReceipts({...sourceInput(candidate,[candidatePass]),errors});
  const overlap=makeRead([[0.05,0.1,0.3,0.2],[0.2,0.1,0.45,0.2],boxes[2]]);
  assert.equal(held(overlap).length,0,"overlapping field locations must remain held");
  const missing=makeRead([[0.05,0.1,0.2,0.2],null as unknown as typeof boxes[number],boxes[2]]);
  assert.equal(held(missing).length,0,"a missing bbox must not fall back to lexical matching");
  const mismatchChecks=checks.map(item=>({...item}));mismatchChecks[1].bbox=[0.8,0.6,0.9,0.7];
  const mismatchPass=pass("verify",mismatchChecks);mismatchPass.bindingStatus="bound";
  assert.equal(held(read,mismatchPass).length,2,"a mismatched row is held without suppressing independently bound rows");
  const unboundPass=pass("verify",checks.map(item=>({...item})));unboundPass.bindingStatus="unbound";
  assert.equal(held(read,unboundPass).length,0,"index-unbound verifier checks cannot distinguish repeated fields");
  const unclearChecks=checks.map(item=>({...item}));unclearChecks[2].meaningStatus="unclear";
  const unclearPass=pass("verify",unclearChecks);unclearPass.bindingStatus="bound";
  assert.equal(held(read,unclearPass).length,2,"an unclear row is held without suppressing independently bound rows");
  assert.equal(held(read,verify,[{recordIndex:2,fieldIndex:0,code:"FIELD_CONFLICT"}]).length,2,"an errored row is held without suppressing independently bound rows");
  const oldOriginal=makeRead();oldOriginal.records[1].fields[0].bbox=[0.8,0.6,0.9,0.7];
  assert.equal(createSourceVerificationReceipts({...sourceInput(read,[verify]),originalRead:oldOriginal}).length,2,"an extraction bbox mismatch holds only its field");
  const uncertain=makeRead();uncertain.records[2].fields[0].confidence="uncertain";
  const partialPass=pass("verify",checks.slice(0,2).map(item=>({...item})));partialPass.bindingStatus="bound";
  assert.equal(held(uncertain,partialPass).length,2,"an unreadable/uncertain row is held while other disjoint rows remain provable");
});

test("bbox-located receipt lineage requires the exact source-ref bbox and an intact fingerprint",()=>{
  const boxes:[[number,number,number,number],[number,number,number,number],[number,number,number,number]]=[[0.05,0.1,0.2,0.2],[0.3,0.1,0.45,0.2],[0.6,0.1,0.75,0.2]];
  const read:PageRead={documentType:"synthetic_asset",complete:true,records:boxes.map(bbox=>({category:"asset",fields:[{...field("gross_value","7250","원","환급가액 7,250원"),bbox}]}))};
  const checks=read.records.map((_,recordIndex)=>({...check(recordIndex,0,"agrees","7250","원","환급가액 7,250원"),bbox:boxes[recordIndex]}));
  const verify=pass("verify",checks);verify.bindingStatus="bound";
  const receipts=createSourceVerificationReceipts(sourceInput(read,[verify]));
  const data=fixture();
  const facts:Fact[]=receipts.map((receipt,index)=>{
    const id=`asset-fact-${index}`,logicalId=`asset-logical-${index}`;
    const result:Fact={id,logicalId,version:1,subjectId:`asset-row-${index}`,key:"asset.gross_value",value:"7250",rawValue:"7250",sourceUnit:"원",numeric:normalizeMoney("7250","원"),state:"verified",recognition:"unreviewed",refs:[{documentId:docId,page:pageNum,quote:receipt.field.quote,sourceHash:hash,bbox:boxes[index]}],validation:[]};
    result.sourceVerification={...receipt,factBinding:{id,logicalId,version:1}};
    return result;
  });
  data.facts=facts;
  assert.ok(facts.every(fact=>factSourceLineageIssues(data,[fact.id]).length===0));
  const mismatched=structuredClone(data),fact=mismatched.facts[1];fact.refs[0].bbox=[0.8,0.6,0.9,0.7];
  assert.ok(factSourceLineageIssues(mismatched,[fact.id]).includes("SOURCE_VERIFICATION_RECEIPT_INVALID"));
  const stripped=structuredClone(data),target=stripped.facts[0];delete target.sourceVerification!.field.locator;
  assert.ok(factSourceLineageIssues(stripped,[target.id]).includes("SOURCE_VERIFICATION_RECEIPT_INVALID"));
  const strippedGeometry=structuredClone(data),strippedFact=strippedGeometry.facts[0],strippedProof=strippedFact.sourceVerification!;
  delete strippedProof.field.locator;delete strippedProof.extractionReading.bbox;for(const proofRead of strippedProof.proofReads)delete proofRead.bbox;
  assert.ok(factSourceLineageIssues(strippedGeometry,[strippedFact.id]).includes("SOURCE_VERIFICATION_RECEIPT_INVALID"),"an extended bbox fingerprint cannot be treated as legacy after every geometry property is stripped");
  const forged=structuredClone(data),forgedFact=forged.facts[2];forgedFact.sourceVerification!.fieldFingerprint="[]";
  assert.ok(factSourceLineageIssues(forged,[forgedFact.id]).includes("SOURCE_VERIFICATION_RECEIPT_INVALID"));
  const missingCategory=structuredClone(data),missingCategoryFact=missingCategory.facts[0],missingCategoryProof=missingCategoryFact.sourceVerification!;delete missingCategoryProof.proofReads[0].categoryStatus;delete missingCategoryProof.geometry!.verifierReads[0].categoryStatus;
  assert.ok(factSourceLineageIssues(missingCategory,[missingCategoryFact.id]).includes("SOURCE_VERIFICATION_RECEIPT_INVALID"),"modern lineage requires category status on both proof and geometry reads");
  const wrongCategory=structuredClone(data),wrongCategoryFact=wrongCategory.facts[0];(wrongCategoryFact.sourceVerification!.proofReads[0] as unknown as {categoryStatus:string}).categoryStatus="wrong_category";
  assert.ok(factSourceLineageIssues(wrongCategory,[wrongCategoryFact.id]).includes("SOURCE_VERIFICATION_RECEIPT_INVALID"));
  const modernEmbeddedLegacyParent=structuredClone(data),embeddedFact=modernEmbeddedLegacyParent.facts[0],embeddedProof=embeddedFact.sourceVerification!;embeddedProof.promptVersion="luna-evidence-3.19.0";delete embeddedProof.proofReads[0].categoryStatus;embeddedProof.geometry!.verifierReads[0].promptVersion="luna-evidence-3.20.0";delete embeddedProof.geometry!.verifierReads[0].categoryStatus;
  assert.ok(factSourceLineageIssues(modernEmbeddedLegacyParent,[embeddedFact.id]).includes("SOURCE_VERIFICATION_RECEIPT_INVALID"),"embedded modern geometry cannot inherit its legacy parent exemption");
  const validGeometryProof=data.facts[0].sourceVerification!.geometry!.verifierReads[0];
  const unrelatedQuote=structuredClone(data),unrelatedFact=unrelatedQuote.facts[0],unrelatedProof=unrelatedFact.sourceVerification!;
  unrelatedProof.proofReads[0].quote="채권자 7250원";unrelatedProof.verificationQuotes[0]=unrelatedProof.proofReads[0].quote;
  unrelatedProof.geometry!.verifierReads[0].quote=unrelatedProof.proofReads[0].quote;
  const quoteFingerprint=JSON.parse(unrelatedProof.fieldFingerprint);quoteFingerprint[8]=unrelatedProof.verificationQuotes;const geometryFingerprint=quoteFingerprint.find((part:unknown)=>!!part&&typeof part==="object"&&Object.hasOwn(part,"bbox_corroboration"));geometryFingerprint.bbox_corroboration=unrelatedProof.geometry;
  unrelatedProof.fieldFingerprint=JSON.stringify(quoteFingerprint);
  assert.ok(factSourceLineageIssues(unrelatedQuote,[unrelatedFact.id]).includes("SOURCE_VERIFICATION_RECEIPT_INVALID"),"persisted fact lineage rejects internally fingerprint-consistent but text-unrelated verifier quotes");
  for(const malformedReads of [null,[null],[{...validGeometryProof,recordIndex:0.5}],[validGeometryProof,{...validGeometryProof}]]){
    const malformed=structuredClone(data),malformedFact=malformed.facts[0];malformedFact.sourceVerification!.geometry!.verifierReads=malformedReads as never;
    assert.doesNotThrow(()=>factSourceLineageIssues(malformed,[malformedFact.id]));
    assert.ok(factSourceLineageIssues(malformed,[malformedFact.id]).includes("SOURCE_VERIFICATION_RECEIPT_INVALID"));
    assert.equal(sourceVerificationReceiptMatches(malformedFact.sourceVerification as never,{documentId:docId,page:pageNum,sourceHash:hash,read}),false);
  }
});

test("omission reread reuses only baseline-agreed fields still present verbatim after row-index drift",()=>{
  const baseline:PageRead={documentType:"debt_certificate",complete:true,records:[{category:"debt",fields:[field("contract_id","C-1",null,"계약번호 C-1"),field("principal","500","만원","잔액 500만원")]}]};
  const baselinePass=pass("verify",[check(0,0,"agrees","C-1",null,"계약번호 C-1"),check(0,1,"agrees","500","만원","잔액 500만원")]);
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


test("Terra OCR receipt keeps its model identity, never relabels Luna",()=>{const read:PageRead={documentType:"debt_certificate",complete:true,records:[{category:"debt",fields:[field("principal","500","만원","원금 500만원")]}]};const terraPass:ReviewPass={...pass("verify",[check(0,0,"agrees","500","만원","원금 500만원")]),model:OCR_MODEL};const [receipt]=createSourceVerificationReceipts(sourceInput(read,[terraPass]));assert.ok(receipt);assert.equal(receipt.model,OCR_MODEL);assert.equal(receipt.proofReads[0].model,OCR_MODEL);assert.equal(sourceVerificationReceiptMatches(receipt,{documentId:docId,page:pageNum,sourceHash:hash,read}),true);const fake=structuredClone(receipt);fake.model=AI_MODEL;assert.equal(sourceVerificationReceiptMatches(fake,{documentId:docId,page:pageNum,sourceHash:hash,read}),false);});
