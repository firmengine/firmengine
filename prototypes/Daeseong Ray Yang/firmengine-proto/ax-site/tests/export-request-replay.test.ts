import test from "node:test";
import assert from "node:assert/strict";
import { parseExportRequestId, inspectExportRequestReplay } from "../lib/export-request-replay.ts";
import type { ExportManifest } from "../lib/domain.ts";

const requestId="11111111-2222-4333-8444-555555555555";
const ref="a".repeat(64), digest="b".repeat(64);
const saved = (): ExportManifest => ({
  caseRevision: 7,mode:"draft",requiredKinds:["application"],
  exportRequestId:requestId,sourceDataVersionAtExport:4,
  files:[{id:"artifact-a",kind:"application",name:"application.docx",hash:digest,status:"current"}],
  reviews:{caseworker:null,lawyer:null},
  documentWriter:{caseRevision:7,mode:"draft",referenceRelease:{id:"rev",revision:1,sha256:ref}} as ExportManifest["documentWriter"]
});
const input=()=>({requestId,manifest:saved(),caseRevision:7,mode:"draft" as const,sourceDataVersion:4,referenceSha256:ref});

test("legacy omission stays compatible but invalid explicit IDs fail",()=>{
  assert.equal(parseExportRequestId(undefined),null);
  assert.equal(parseExportRequestId(null),null);
  assert.equal(parseExportRequestId(requestId.toUpperCase()),requestId);
  for(const invalid of ["","random","../../other","0".repeat(100),42,{},"11111111-2222-1333-8444-555555555555"]){
    assert.throws(()=>parseExportRequestId(invalid),/EXPORT_REQUEST_ID_INVALID/);
  }
});

test("new request and absent manifest generate a fresh export",()=>{
  assert.equal(inspectExportRequestReplay({...input(),manifest:undefined}),"new");
  assert.equal(inspectExportRequestReplay({...input(),requestId:null}),"new");
  assert.equal(inspectExportRequestReplay({...input(),requestId:"aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee"}),"new");
});

test("exact committed manifest can be safely replayed without generating new artifacts",()=>{
  assert.equal(inspectExportRequestReplay(input()),"reuse");
});

test("same request id fails closed on source change, court reference change, case or mode change",()=>{
  assert.equal(inspectExportRequestReplay({...input(),sourceDataVersion:5}),"conflict");
  assert.equal(inspectExportRequestReplay({...input(),sourceDataVersion:null}),"conflict");
  assert.equal(inspectExportRequestReplay({...input(),referenceSha256:"z".repeat(64)}),"conflict");
  assert.equal(inspectExportRequestReplay({...input(),caseRevision:8}),"conflict");
  assert.equal(inspectExportRequestReplay({...input(),mode:"final"}),"conflict");
});

test("same request id cannot revive archived or orphaned/incomplete artifact set",()=>{
  const archived=saved();archived.files[0]!.status="archived";
  assert.equal(inspectExportRequestReplay({...input(),manifest:archived}),"conflict");
  const empty=saved();empty.files=[];
  assert.equal(inspectExportRequestReplay({...input(),manifest:empty}),"conflict");
  const noProof=saved();delete noProof.documentWriter;
  assert.equal(inspectExportRequestReplay({...input(),manifest:noProof}),"conflict");
  const badHash=saved();badHash.files[0]!.hash="";
  assert.equal(inspectExportRequestReplay({...input(),manifest:badHash}),"conflict");
});

test("same request id cannot revive a manifest with no source version attestation",()=>{
  const m=saved();delete m.sourceDataVersionAtExport;
  assert.equal(inspectExportRequestReplay({...input(),manifest:m}),"conflict");
});

// This models the route's replay branch after a successful CAS but a failed
// independent event insert; it does not simulate Cloudflare D1/R2 or Next.js.
test("post-commit event failure + same request retry does not allocate another artifact ID",async()=>{
  let manifest:ExportManifest|undefined;
  const objects=new Map<string,Uint8Array>(), rows=new Map<string,string>();
  let generated=0, eventAttempts=0;
  async function post(id:string){
    const decision=inspectExportRequestReplay({requestId:id,manifest,caseRevision:7,mode:"draft",sourceDataVersion:4,referenceSha256:ref});
    if(decision==="conflict")throw new Error("409 conflict");
    if(decision==="reuse"){
      for(const f of manifest!.files){assert.equal(rows.get(f.id),f.hash);assert.ok(objects.has(f.id));}
      return manifest!.files[0]!.id;
    }
    generated++;const artifactId="artifact-"+generated;
    objects.set(artifactId,new Uint8Array([1]));rows.set(artifactId,digest);
    const current=saved();current.files[0]!.id=artifactId;
    manifest=current;eventAttempts++;
    if(eventAttempts===1)throw new Error("EVENT_INSERT_FAILED_AFTER_MANIFEST_COMMIT");
    return artifactId;
  }
  await assert.rejects(post(requestId),/EVENT_INSERT_FAILED/);
  const result=await post(requestId);
  assert.equal(result,"artifact-1");assert.equal(generated,1);assert.equal(rows.size,1);assert.equal(objects.size,1);
  const changed=await post("aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee");
  assert.equal(changed,"artifact-2","new explicit generation intent gets independent artifacts");
  assert.equal(generated,2);
});
