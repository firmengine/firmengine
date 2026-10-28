import test from "node:test";
import assert from "node:assert/strict";
import { applyExtraction, createCase, currentFacts, factSourceLineageIssues, reviewFact } from "../lib/domain.ts";
import { hasBoundExtractionProvenance, hasCurrentProjection, PAGE_PROJECTION_VERSION, prepareStoredReadReprojection, reprojectStoredPage, requireReprojectionProvenance, type StoredPageJobForReprojection, type StoredReadResult } from "../lib/reprojection.ts";
import { projectPage,type PageRead } from "../lib/extraction.ts";
import { createSourceVerificationReceipts, sourceVerificationFieldLocation, type ReviewPass } from "../lib/source-verification.ts";

const hash = "d".repeat(64), imageHash = "e".repeat(64);
const read: PageRead = { documentType: "synthetic_income", complete: true, warnings: [], records: [{ category: "income", label: "synthetic salary row", fields: [
  { key: "label", label: "income source", value: "monthly salary", unit: null, quote: "synthetic source monthly salary", confidence: "clear", bbox: [.1,.1,.9,.2] },
  { key: "employer", label: "employer", value: "Synthetic Co", unit: null, quote: "synthetic source Synthetic Co", confidence: "clear", bbox: [.1,.1,.9,.2] },
  { key: "net", label: "net", value: "3000000", unit: "원", quote: "synthetic source net 3000000원", confidence: "clear", bbox: [.1,.1,.9,.2] },
  { key: "period_start", label: "start", value: "2026-01-01", unit: null, quote: "synthetic start 2026-01-01", confidence: "clear", bbox: [.1,.1,.9,.2] },
  { key: "period_end", label: "end", value: "2026-01-31", unit: null, quote: "synthetic end 2026-01-31", confidence: "clear", bbox: [.1,.1,.9,.2] },
  { key: "amount_basis", label: "basis", value: "monthly", unit: null, quote: "synthetic monthly", confidence: "clear", bbox: [.1,.1,.9,.2] },
] }] };
function fixture(role: "evidence" | "filed_form" | "administrative" = "evidence") {
  const data = createCase("Synthetic reprojection", "synthetic-case", "2026-10-27");
  data.documents = [{ id: "doc-1", name: "synthetic.pdf", sha256: hash, status: "active", pages: [1] }];
  data.pages = [{ documentId: "doc-1", page: 1, role, documentType: "synthetic_income", text: read.records.flatMap(record => record.fields.map(field => field.quote ?? "")).join("\n"), imageUrl: "/synthetic" }];
  const job: StoredPageJobForReprojection = { id: "job-1", caseId: data.context.id, documentId: "doc-1", page: 1, role, status: "completed", stage: "completed", leaseUntil: null, imageKey: "synthetic/image", imageHash, cacheKey: JSON.stringify(["doc-1", hash, [1], "income", "historical-prompt-1.0", "gpt-6-luna", "rules-previous"]), result: "{}" };
  const saved: StoredReadResult = { read:structuredClone(read), firstRead:structuredClone(read), extractionRead:structuredClone(read), review: { checks: [], warnings: [] }, verifierPasses: [], sourceReceiptCount: 0 };
  const prepare = (changes: Partial<Parameters<typeof prepareStoredReadReprojection>[0]> = {}) => prepareStoredReadReprojection({ data, job, saved, originalReady: true, imageReady: true, activeProcessingJobs: 0, ...changes });
  return { data, job, saved, prepare };
}

function proofFixture(){
  const f=fixture(),readCopy=structuredClone(read),promptVersion="synthetic-cross-read-1.0",verifiedAt="2026-10-27T00:00:00.000Z",promptHash="f".repeat(64);
  const payload=projectPage(readCopy,"doc-1",1,hash),data=applyExtraction(f.data,payload);
  const checks=readCopy.records.flatMap((record,recordIndex)=>record.fields.map((field,fieldIndex)=>({recordIndex,fieldIndex,meaningStatus:"supported",status:"agrees" as const,value:field.value,unit:field.unit,quote:field.quote,bbox:field.bbox})));
  const receipts=createSourceVerificationReceipts({documentId:"doc-1",page:1,sourceHash:hash,promptVersion,verifiedAt,originalRead:readCopy,read:readCopy,passes:[{kind:"verify",checks,model:"gpt-6-luna",promptVersion,promptHash,verifiedAt}]});
  for(const receipt of receipts){
    const location=sourceVerificationFieldLocation(receipt,readCopy)!;
    const record=readCopy.records[location.recordIndex],sourceId=`doc-1:p1:${record.category}:${location.recordIndex}:f${location.fieldIndex}`;
    const raw=payload.facts?.find(fact=>fact.id===sourceId)!;
    const fact=currentFacts(data).find(item=>item.subjectId===raw.subjectId&&item.key===raw.key&&item.refs.some(ref=>ref.quote===receipt.field.quote))!;
    fact.state="verified";fact.recognition="unreviewed";fact.sourceVerification={...receipt,factBinding:{id:fact.id,logicalId:fact.logicalId,version:fact.version}};
  }
  return {...f,data,saved:{...f.saved,extractionRead:readCopy,read:readCopy,verifierPasses:[{kind:"verify"}],sourceReceiptCount:receipts.length},receipts};
}

test("legacy read remains inspectable but live reprojection requires bound extraction provenance",()=>{
  const f=fixture();f.saved.sourceReceiptCount=99;
  const prepared=f.prepare();
  assert.equal(hasBoundExtractionProvenance(f.saved,f.job,prepared.provenance),false);
  assert.throws(()=>requireReprojectionProvenance(f.saved,f.job,prepared.provenance),{status:409});
  f.saved.extractionPasses=[{model:"gpt-6-luna",promptVersion:"historical-prompt-1.0",promptHash:"a".repeat(64),sourceHash:hash,baseImageHash:imageHash,verifiedAt:"2026-10-27T00:00:00.000Z"}];
  assert.doesNotThrow(()=>requireReprojectionProvenance(f.saved,f.job,prepared.provenance));
  const result=reprojectStoredPage(f.data,prepared);
  assert.equal(result.newReceiptsCreated,0);assert.ok(currentFacts(result.data).every(f=>!f.sourceVerification));
});

test("a count, partial or mismatched provenance cannot authorize stored-read mutation",()=>{
  const f=fixture(),provenance=f.prepare().provenance;
  const pass={model:"gpt-6-luna",promptVersion:"historical-prompt-1.0",promptHash:"a".repeat(64),sourceHash:hash,baseImageHash:imageHash,verifiedAt:"2026-10-27T00:00:00.000Z"};
  for(const change of [{model:"other-model"},{promptVersion:" "},{promptHash:"forged"},{sourceHash:"a".repeat(64)},{baseImageHash:"a".repeat(64)},{verifiedAt:"invalid"}]){
    f.saved.extractionPasses=[{...pass,...change}];assert.throws(()=>requireReprojectionProvenance(f.saved,f.job,provenance),{status:409});
  }
  for(const value of [[],[pass,null],[pass,{}],99]){f.saved.extractionPasses=value;assert.throws(()=>requireReprojectionProvenance(f.saved,f.job,provenance),{status:409});}
});

test("stored historical read reprojects deterministically without a model call or new proof", () => {
  const f = fixture(), prepared = f.prepare(), result = reprojectStoredPage(f.data, prepared);
  assert.equal(prepared.provenance.promptVersion, "historical-prompt-1.0");
  assert.equal(prepared.provenance.model, "gpt-6-luna");
  assert.equal(currentFacts(result.data).length, 6);
  assert.ok(currentFacts(result.data).every(fact => fact.state === "extracted" && !fact.sourceVerification));
  assert.equal(result.newReceiptsCreated, 0);
});

test("reprojection is idempotent for facts and records that historical prompts remain historical", () => {
  const f = fixture(), first = reprojectStoredPage(f.data, f.prepare());
  const second = reprojectStoredPage(first.data, f.prepare({ data: first.data }));
  assert.equal(currentFacts(second.data).length, currentFacts(first.data).length);
  assert.deepEqual(currentFacts(second.data).map(x => x.logicalId), currentFacts(first.data).map(x => x.logicalId));
  assert.equal(f.prepare().provenance.promptVersion, "historical-prompt-1.0");
});

test("matching projection version, source hash and cache key make a repeated action a no-op", () => {
  const f = fixture();
  f.saved.projection = { version: PAGE_PROJECTION_VERSION, appliedAt: "2026-10-27T00:00:00.000Z", caseRevision: 2, sourceSha256: hash, cacheKey: f.job.cacheKey };
  assert.equal(hasCurrentProjection(f.saved, f.job, hash), true);
  assert.equal(hasCurrentProjection(f.saved, f.job, "f".repeat(64)), false);
  assert.equal(hasCurrentProjection(f.saved, { ...f.job, cacheKey: "changed" }, hash), false);
});

test("existing human-reviewed facts and typed object decisions survive reprojection", () => {
  const f = fixture(), first = reprojectStoredPage(f.data, f.prepare());
  const fact = currentFacts(first.data).find(x => x.key === "income.net")!;
  const reviewed = reviewFact(first.data, fact.id, { state: "verified", recognition: "accepted", actor: "synthetic-reviewer", reason: "synthetic source comparison" });
  const income = reviewed.incomes[0]; income.recognition = "accepted"; income.label = "human-reviewed name";
  const next = reprojectStoredPage(reviewed, f.prepare({ data: reviewed }));
  assert.ok(currentFacts(next.data).some(x => x.id === currentFacts(reviewed).find(y => y.logicalId === fact.logicalId)?.id && x.state === "verified" && x.recognition === "accepted"));
  assert.equal(next.data.incomes[0].label, "human-reviewed name");
  assert.equal(next.newReceiptsCreated, 0);
});

test("held-out/admin jobs, source hash mismatch, missing uploads and active processing are rejected", () => {
  const held = fixture("filed_form"); assert.throws(() => held.prepare(), /분리 페이지/);
  const admin = fixture("administrative"); assert.throws(() => admin.prepare(), /분리 페이지/);
  const mismatch = fixture(); assert.throws(() => mismatch.prepare({ job: { ...mismatch.job, cacheKey: JSON.stringify(["doc-1", "f".repeat(64), [1], "income", "p", "gpt-6-luna", "rules"]) } }), /출처/);
  const pending = fixture(); assert.throws(() => pending.prepare({ job: { ...pending.job, status: "pending", stage: "extract" } }), /판독이 완료/);
  const missingOriginal = fixture(); assert.throws(() => missingOriginal.prepare({ originalReady: false }), /원본 파일/);
  const missingImage = fixture(); assert.throws(() => missingImage.prepare({ imageReady: false }), /원본 파일/);
  const busy = fixture(); assert.throws(() => busy.prepare({ activeProcessingJobs: 1 }), /다른 페이지 처리/);
});

test("legacy stored reads without verification passes stay unverified", () => {
  const f = fixture(); delete f.saved.verifierPasses; f.saved.sourceReceiptCount = 99;
  const prepared = f.prepare();
  assert.equal(prepared.provenance.verificationPasses, 0);
  assert.equal(prepared.provenance.storedReceiptCount, 99);
  const result = reprojectStoredPage(f.data, prepared);
  assert.ok(currentFacts(result.data).every(fact => fact.state !== "verified" && !fact.sourceVerification));
});

test("exact historical machine receipts survive trusted reprojection with only fact binding changed",()=>{
  const f=proofFixture(),before=currentFacts(f.data).filter(fact=>fact.sourceVerification);
  assert.ok(before.length>0);
  const result=reprojectStoredPage(f.data,f.prepare());
  const after=currentFacts(result.data).filter(fact=>fact.sourceVerification);
  assert.equal(after.length,before.length);assert.equal(result.retainedReceipts,before.length);assert.equal(result.newReceiptsCreated,0);
  for(const prior of before){
    const next=after.find(fact=>fact.logicalId===prior.logicalId)!;
    assert.equal(next.state,"verified");assert.equal(next.recognition,"unreviewed");assert.deepEqual(factSourceLineageIssues(result.data,[next.id]),[]);
    const oldProof=prior.sourceVerification!,newProof=next.sourceVerification!;
    assert.equal(newProof.method,oldProof.method);assert.equal(newProof.model,oldProof.model);assert.equal(newProof.promptVersion,oldProof.promptVersion);assert.equal(newProof.verifiedAt,oldProof.verifiedAt);
    assert.equal(newProof.fieldFingerprint,oldProof.fieldFingerprint);assert.deepEqual(newProof.field,oldProof.field);assert.deepEqual(newProof.verificationQuotes,oldProof.verificationQuotes);assert.deepEqual(newProof.proofReads,oldProof.proofReads);assert.deepEqual(newProof.proofReadIndexes,oldProof.proofReadIndexes);assert.deepEqual(newProof.extractionReading,oldProof.extractionReading);assert.deepEqual(newProof.source,oldProof.source);
    assert.deepEqual(newProof.factBinding,{id:next.id,logicalId:next.logicalId,version:next.version});
  }
});

test("bbox-located equal source fields preserve the exact row proof across reprojection",()=>{
  const boxes:[[number,number,number,number],[number,number,number,number],[number,number,number,number]]=[[0.05,0.1,0.2,0.2],[0.3,0.1,0.45,0.2],[0.6,0.1,0.75,0.2]];
  const duplicateRead:PageRead={documentType:"insurance",complete:true,warnings:[],records:boxes.map((bbox,index)=>({category:"asset",label:`synthetic insurance row ${index+1}`,fields:[{key:"gross_value",label:"surrender amount",value:"7250",unit:"원",quote:"환급가액 7,250원",confidence:"clear",bbox}]}))};
  const data=createCase("Synthetic duplicate source rows","synthetic-duplicate-case","2026-10-27"),image="e".repeat(64),promptVersion="synthetic-cross-read-1.0",promptHash="f".repeat(64),verifiedAt="2026-10-27T00:00:00.000Z";
  data.documents=[{id:"doc-duplicate",name:"synthetic.pdf",sha256:hash,status:"active",pages:[1],type:"insurance"}];
  data.pages=[{documentId:"doc-duplicate",page:1,role:"evidence",documentType:"insurance",text:duplicateRead.records.map(record=>record.fields[0].quote).join("\n"),imageUrl:"/synthetic"}];
  const payload=projectPage(duplicateRead,"doc-duplicate",1,hash),projected=applyExtraction(data,payload);
  const checks=duplicateRead.records.map((record,recordIndex)=>({recordIndex,fieldIndex:0,meaningStatus:"supported",status:"agrees" as const,value:record.fields[0].value,unit:record.fields[0].unit,quote:record.fields[0].quote,bbox:boxes[recordIndex]}));
  const verifier:ReviewPass={kind:"verify",checks,bindingStatus:"bound",model:"gpt-6-luna",promptVersion,promptHash,verifiedAt};
  const receipts=createSourceVerificationReceipts({documentId:"doc-duplicate",page:1,sourceHash:hash,promptVersion,verifiedAt,originalRead:duplicateRead,read:duplicateRead,passes:[verifier]});
  assert.equal(receipts.length,3);
  for(const receipt of receipts){
    const location=sourceVerificationFieldLocation(receipt,duplicateRead)!;
    const raw=payload.facts!.find(fact=>fact.id===`doc-duplicate:p1:asset:${location.recordIndex}:f${location.fieldIndex}`)!;
    const fact=currentFacts(projected).find(item=>item.logicalId===raw.logicalId)!;
    fact.state="verified";fact.recognition="unreviewed";fact.sourceVerification={...receipt,factBinding:{id:fact.id,logicalId:fact.logicalId,version:fact.version}};
  }
  const job:StoredPageJobForReprojection={id:"job-duplicate",caseId:data.context.id,documentId:"doc-duplicate",page:1,role:"evidence",status:"completed",stage:"completed",leaseUntil:null,imageKey:"synthetic/image",imageHash:image,cacheKey:JSON.stringify(["doc-duplicate",hash,[1],"insurance","historical-prompt-1.0","gpt-6-luna","rules-previous"]),result:"{}"};
  const saved:StoredReadResult={read:duplicateRead,firstRead:duplicateRead,extractionRead:duplicateRead,verifierPasses:[verifier],extractionPasses:[{model:"gpt-6-luna",promptVersion,promptHash,sourceHash:hash,baseImageHash:image,verifiedAt}],sourceReceiptCount:3};
  const prepared=prepareStoredReadReprojection({data:projected,job,saved,originalReady:true,imageReady:true,activeProcessingJobs:0});
  const result=reprojectStoredPage(projected,prepared),retained=currentFacts(result.data).filter(fact=>fact.key==="asset.gross_value"&&fact.refs.some(ref=>ref.documentId==="doc-duplicate"&&ref.page===1));
  assert.equal(result.retainedReceipts,3);assert.equal(result.newReceiptsCreated,0);assert.equal(retained.length,3);
  assert.deepEqual(retained.map(fact=>fact.sourceVerification?.field.locator?.bbox).sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b))),boxes.slice().sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b))));
  assert.ok(retained.every(fact=>fact.state==="verified"&&fact.recognition==="unreviewed"&&factSourceLineageIssues(result.data,[fact.id]).length===0));
});

test("historical value-unit-quote receipts stay explicitly legacy through reprojection",()=>{
  const f=proofFixture();
  for(const fact of currentFacts(f.data)){
    const proof=fact.sourceVerification;if(!proof)continue;
    delete proof.verificationScope;
    delete proof.geometry;delete proof.field.locator;delete proof.extractionReading.bbox;
    for(const read of proof.proofReads){delete read.meaningStatus;delete read.bbox;}
    const norm=(value:string)=>value.normalize("NFKC").trim();
    proof.fieldFingerprint=JSON.stringify([proof.source.sha256.toLowerCase(),proof.source.documentId,proof.source.page,norm(proof.field.recordCategory),proof.field.key,norm(proof.field.value),proof.field.unit===null?null:norm(proof.field.unit),norm(proof.field.quote),proof.verificationQuotes.map(norm),[norm(proof.extractionReading.value),proof.extractionReading.unit===null?null:norm(proof.extractionReading.unit),norm(proof.extractionReading.quote)]]);
  }
  const before=currentFacts(f.data).filter(fact=>fact.sourceVerification);assert.ok(before.length>0);assert.ok(before.every(fact=>fact.sourceVerification!.verificationScope===undefined));
  const after=currentFacts(reprojectStoredPage(f.data,f.prepare()).data).filter(fact=>fact.sourceVerification);
  assert.equal(after.length,before.length);assert.ok(after.every(fact=>fact.sourceVerification!.verificationScope===undefined));assert.ok(after.every(fact=>fact.sourceVerification!.proofReads.every(read=>read.meaningStatus===undefined)));
});

test("adding exact normalization of the same attested source value and unit preserves the original receipt",()=>{
  const f=proofFixture(),prior=currentFacts(f.data).find(fact=>fact.key==="income.net")!;
  const oldProof=structuredClone(prior.sourceVerification!);delete prior.numeric;
  assert.deepEqual(factSourceLineageIssues(f.data,[prior.id]),[]);
  const result=reprojectStoredPage(f.data,f.prepare({data:f.data})),next=currentFacts(result.data).find(fact=>fact.key==="income.net")!;
  assert.equal(next.numeric?.amountWon,"3000000");assert.equal(next.state,"verified");assert.equal(result.newReceiptsCreated,0);
  assert.notEqual(next.id,prior.id);assert.deepEqual(factSourceLineageIssues(result.data,[next.id]),[]);
  const {factBinding:oldBinding,...original}=oldProof,{factBinding:newBinding,...retained}=next.sourceVerification!;
  assert.deepEqual(retained,original);assert.notEqual(newBinding.id,oldBinding.id);
  // A migration already applied without a proof can recover that same receipt
  // from valid history; it cannot mint a new timestamp or verification pass.
  const lost=applyExtraction(f.data,projectPage(read,"doc-1",1,hash));
  const recovered=reprojectStoredPage(lost,f.prepare({data:lost}));
  assert.equal(currentFacts(recovered.data).find(fact=>fact.key==="income.net")?.sourceVerification?.verifiedAt,oldProof.verifiedAt);
});

test("normalization enrichment cannot reuse a changed-scale or invalid numeric receipt",()=>{
  const changed=proofFixture(),prior=currentFacts(changed.data).find(fact=>fact.key==="income.net")!;delete prior.numeric;
  const prepared=changed.prepare({data:changed.data});prepared.read.records[0].fields[2].unit="천원";
  assert.equal(currentFacts(reprojectStoredPage(changed.data,prepared).data).find(fact=>fact.key==="income.net")?.sourceVerification,undefined);
  const invalid=proofFixture(),bad=currentFacts(invalid.data).find(fact=>fact.key==="income.net")!;bad.numeric!.amountWon="999";
  const result=reprojectStoredPage(invalid.data,invalid.prepare({data:invalid.data}));
  assert.equal(currentFacts(result.data).find(fact=>fact.key==="income.net")?.sourceVerification,undefined);
});

test("a later reprojection can recover a valid historical proof after the current field was already downgraded",()=>{
  const f=proofFixture(),lost=applyExtraction(f.data,projectPage(read,"doc-1",1,hash));
  assert.ok(currentFacts(lost).every(fact=>fact.state==="extracted"&&!fact.sourceVerification));
  const prepared=f.prepare({data:lost}),recovered=reprojectStoredPage(lost,prepared);
  assert.equal(currentFacts(recovered.data).filter(fact=>fact.sourceVerification).length,f.receipts.length);
  assert.ok(currentFacts(recovered.data).filter(fact=>fact.sourceVerification).every(fact=>fact.state==="verified"&&fact.recognition==="unreviewed"&&fact.sourceVerification!.factBinding.id===fact.id&&fact.sourceVerification!.factBinding.version===fact.version&&factSourceLineageIssues(recovered.data,[fact.id]).length===0));
  const repeated=reprojectStoredPage(recovered.data,f.prepare({data:recovered.data}));
  assert.equal(currentFacts(repeated.data).filter(fact=>fact.sourceVerification).length,f.receipts.length);
  assert.deepEqual(currentFacts(repeated.data).map(fact=>[fact.logicalId,fact.value,fact.sourceVerification?.fieldFingerprint]),currentFacts(recovered.data).map(fact=>[fact.logicalId,fact.value,fact.sourceVerification?.fieldFingerprint]));
});

test("proof follows the unique exact source field across record-index drift without trusting a row label",()=>{
  const f=proofFixture(),lost=applyExtraction(f.data,projectPage(read,"doc-1",1,hash));
  const prepared=f.prepare({data:lost});prepared.read.records.unshift({category:"other",label:"synthetic non-evidence row",fields:[]});
  const recovered=reprojectStoredPage(lost,prepared),proofFacts=currentFacts(recovered.data).filter(fact=>fact.sourceVerification);
  assert.equal(proofFacts.length,f.receipts.length);
  assert.ok(proofFacts.every(fact=>fact.subjectId.endsWith(":income:1")&&fact.state==="verified"&&factSourceLineageIssues(recovered.data,[fact.id]).length===0));
});

test("changed unit or quote, changed source hash, and dropped source fields cannot reuse an old receipt",()=>{
  const unit=proofFixture(),unitPrepared=unit.prepare();unitPrepared.read.records[0]!.fields[2]!.unit="천원";
  const changedUnit=reprojectStoredPage(unit.data,unitPrepared);assert.ok(!currentFacts(changedUnit.data).some(fact=>fact.logicalId===currentFacts(unit.data).find(old=>old.key==="income.net")?.logicalId&&fact.sourceVerification));
  const quote=proofFixture(),quotePrepared=quote.prepare();quotePrepared.read.records[0]!.fields[2]!.quote="synthetic source net 3000000원 amended";quotePrepared.read.records[0]!.fields[2]!.confidence="clear";quotePrepared.read.records[0]!.fields[2]!.value="3000000";
  const changedQuote=reprojectStoredPage(quote.data,quotePrepared);assert.ok(!currentFacts(changedQuote.data).some(fact=>fact.logicalId===currentFacts(quote.data).find(old=>old.key==="income.net")?.logicalId&&fact.sourceVerification));
  const source=proofFixture(),newHash="a".repeat(64);source.data.documents[0]!.sha256=newHash;const changedJob={...source.job,cacheKey:JSON.stringify(["doc-1",newHash,[1],"income","historical-prompt-1.0","gpt-6-luna","rules-previous"])};
  const changedSource=reprojectStoredPage(source.data,source.prepare({data:source.data,job:changedJob}));assert.ok(!currentFacts(changedSource.data).some(fact=>fact.sourceVerification));
  const dropped=proofFixture(),droppedPrepared=dropped.prepare();droppedPrepared.read.records[0]!.fields.splice(2,1);
  const changedFields=reprojectStoredPage(dropped.data,droppedPrepared);assert.ok(!currentFacts(changedFields.data).some(fact=>fact.key==="income.net"&&fact.sourceVerification));
});

test("missing or forged receipts and a later human rejection never restore machine verification",()=>{
  const missing=proofFixture(),target=currentFacts(missing.data).find(fact=>fact.sourceVerification)!;target.sourceVerification=undefined;
  const missingResult=reprojectStoredPage(missing.data,missing.prepare());assert.ok(!currentFacts(missingResult.data).some(fact=>fact.logicalId===target.logicalId&&fact.sourceVerification));
  const forged=proofFixture(),forgedTarget=currentFacts(forged.data).find(fact=>fact.sourceVerification)!;forgedTarget.sourceVerification!.fieldFingerprint="forged";
  const forgedLost=applyExtraction(forged.data,projectPage(read,"doc-1",1,hash)),forgedResult=reprojectStoredPage(forgedLost,forged.prepare({data:forgedLost}));
  assert.ok(!currentFacts(forgedResult.data).some(fact=>fact.logicalId===forgedTarget.logicalId&&fact.sourceVerification));
  const reviewed=proofFixture(),reviewedTarget=currentFacts(reviewed.data).find(fact=>fact.sourceVerification)!;
  const rejected=reviewFact(reviewed.data,reviewedTarget.id,{recognition:"rejected",actor:"synthetic reviewer",reason:"synthetic rejection"});
  const rejectedResult=reprojectStoredPage(rejected,reviewed.prepare({data:rejected}));
  const current=currentFacts(rejectedResult.data).find(fact=>fact.logicalId===reviewedTarget.logicalId)!;
  assert.equal(current.recognition,"rejected");assert.ok(current.reviewer);assert.equal(current.sourceVerification,undefined);
});

test("invalid stored read and malformed historical cache provenance are rejected", () => {
  const invalid = fixture(); invalid.saved.read = { nope: true };
  assert.throws(() => invalid.prepare(), /형식/);
  const badCache = fixture(); assert.throws(() => badCache.prepare({ job: { ...badCache.job, cacheKey: "not-json" } }), /출처/);
});


test("unchanged fact readings still refresh stale derived objects under new projection semantics",()=>{
  const f=proofFixture();
  // An old projection could have retained an incorrect amount despite the
  // same underlying source fact. Equal facts alone are not a projection cache.
  f.data.incomes[0]!.net={...f.data.incomes[0]!.net!,amountWon:"99999999"};
  const result=reprojectStoredPage(f.data,f.prepare());
  assert.equal(result.data.incomes[0]!.net?.amountWon,"3000000");
  assert.equal(result.retainedReceipts,f.receipts.length);
  assert.ok(currentFacts(result.data).filter(f=>f.sourceVerification).every(f=>factSourceLineageIssues(result.data,[f.id]).length===0));
});
