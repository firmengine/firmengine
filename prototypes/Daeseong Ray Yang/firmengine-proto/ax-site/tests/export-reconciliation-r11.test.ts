import test from 'node:test';
import assert from 'node:assert/strict';
import { reconcileExportEvidence } from '../lib/export-reconciliation.ts';
const H='a'.repeat(64), B='b'.repeat(64);
const row = (id:string) => ({id, caseId:'synthetic-case', revision:4, objectKey:`cases/synthetic-case/artifacts/${id}`, hash:H});
const proof=(id:string,exists:boolean|null=true,sha:string|null=H)=>({objectKey:`cases/synthetic-case/artifacts/${id}`,exists,verifiedSha256:sha});
const base=()=>({caseId:'synthetic-case',currentRevision:4,manifest:[{id:'B',hash:H,status:'current'}],artifactRows:[row('B')],receipts:[{requestId:'req-B',status:'committed' as const,artifactIds:['B']}],objectProofs:[proof('B')]});
const codes=(a:ReturnType<typeof reconcileExportEvidence>)=>a.issues.map(e=>e.code);
test('R2 upload succeeded, D1 record failed: untracked same-case bytes must be reported, never deleted',()=>{
 const input=base();const out=reconcileExportEvidence({...input,objectProofs:[...input.objectProofs,proof('untracked')]});
 assert.ok(codes(out).includes('R2_UNTRACKED_OBJECT_PRESERVE'));assert.equal(out.autoDeleteAllowed,false);
});
test('R2 HEAD timeout/503 with missing D1 row is unknown rather than missing or zero',()=>{
 const input=base();const out=reconcileExportEvidence({...input,objectProofs:[...input.objectProofs,proof('timeout',null,null)]});
 assert.ok(codes(out).includes('R2_UNTRACKED_PROOF_UNKNOWN'));assert.ok(!codes(out).includes('R2_UNTRACKED_OBJECT_PRESERVE'));
});
test('confirmed missing untracked key must not be labeled present',()=>{
 const input=base();const out=reconcileExportEvidence({...input,objectProofs:[...input.objectProofs,proof('missing',false,null)]});
 assert.ok(!codes(out).some(x=>x.startsWith('R2_UNTRACKED_')));assert.equal(out.autoDeleteAllowed,false);
});
test('object proofs belonging to other cases never appear in this-case findings',()=>{
 const input=base();const out=reconcileExportEvidence({...input,objectProofs:[...input.objectProofs,{objectKey:'cases/other-case/artifacts/Z',exists:true,verifiedSha256:H}]});
 assert.deepEqual(codes(out),[]);
});
test('conflicting R2 observations cannot pass current artifact verification',()=>{
 const input=base();const out=reconcileExportEvidence({...input,objectProofs:[...input.objectProofs,proof('B',false,null)]});
 assert.ok(codes(out).includes('R2_PROOF_CONFLICT'));assert.equal(out.currentArtifactsVerified,false);assert.equal(out.autoDeleteAllowed,false);
});
test('contradictory byte hashes for the same object key never pass based on last entry',()=>{
 const input=base();const out=reconcileExportEvidence({...input,objectProofs:[...input.objectProofs,proof('B',true,B)]});
 assert.ok(codes(out).includes('R2_PROOF_CONFLICT'));assert.equal(out.currentArtifactsVerified,false);
});
test('identical duplicate proof is idempotent and does not create a conflict',()=>{
 const input=base();const out=reconcileExportEvidence({...input,objectProofs:[...input.objectProofs,proof('B')]});
 assert.deepEqual(codes(out),[]);assert.equal(out.currentArtifactsVerified,true);
});
test('uncertain untracked proof with conflicting retries remains uncertain',()=>{
 const input=base();const out=reconcileExportEvidence({...input,objectProofs:[...input.objectProofs,proof('untracked',true),proof('untracked',false,null)]});
 assert.ok(codes(out).includes('R2_PROOF_CONFLICT'));assert.ok(codes(out).includes('R2_UNTRACKED_PROOF_UNKNOWN'));assert.ok(!codes(out).includes('R2_UNTRACKED_OBJECT_PRESERVE'));
});
test('last-success-wins race is a false-ready regression: failed R2 probe before a successful duplicate still blocks',()=>{
 const input=base();const out=reconcileExportEvidence({...input,objectProofs:[proof('B',false,null),proof('B',true,H)]});
 assert.ok(codes(out).includes('R2_PROOF_CONFLICT'));assert.equal(out.currentArtifactsVerified,false);
});
