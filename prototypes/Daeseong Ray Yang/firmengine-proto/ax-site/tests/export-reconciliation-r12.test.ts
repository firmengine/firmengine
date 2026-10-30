import test from 'node:test';
import assert from 'node:assert/strict';
import { reconcileExportEvidence } from '../lib/export-reconciliation.ts';
const H = 'a'.repeat(64), J = 'b'.repeat(64);
const row = (id:string, caseId='synthetic-case', revision=4, hash=H) =>
  ({id,caseId,revision,objectKey:"cases/"+caseId+"/artifacts/"+id,hash});
const proof = (id:string, hash:string|null=H) =>
  ({objectKey:"cases/synthetic-case/artifacts/"+id,exists:true as const,verifiedSha256:hash});
const baseline=()=>({caseId:'synthetic-case',currentRevision:4,
  manifest:[{id:'B',hash:H,status:'current'}],artifactRows:[row('B')],
  receipts:[{requestId:'req-B',status:'committed' as const,artifactIds:['B']}],objectProofs:[proof('B')]});
const codes=(input: ReturnType<typeof baseline>)=>reconcileExportEvidence(input);

test('foreign duplicate artifact ID followed by valid row cannot create false verified current state',()=>{
 const input=baseline(),result=codes({...input,artifactRows:[row('B','other-case'),row('B')]});
 assert.ok(result.issues.some(x=>x.code==='ARTIFACT_EVIDENCE_CONFLICT' && x.artifactId==='B'));
 assert.equal(result.currentArtifactsVerified,false);
 assert.equal(result.autoDeleteAllowed,false);
});
test('reverse arrival order of foreign collision also blocks, independent of SQL enumeration order',()=>{
 const input=baseline(),result=codes({...input,artifactRows:[row('B'),row('B','other-case')]});
 assert.ok(result.issues.some(x=>x.code==='ARTIFACT_EVIDENCE_CONFLICT'));
 assert.equal(result.currentArtifactsVerified,false);
});
test('same ID with two conflicting revisions must not be silently chosen by Map last-wins',()=>{
 const input=baseline(),result=codes({...input,artifactRows:[row('B','synthetic-case',3),row('B')]});
 assert.ok(result.issues.some(x=>x.code==='ARTIFACT_EVIDENCE_CONFLICT'));
 assert.equal(result.currentArtifactsVerified,false);
});
test('historical A evidence conflict remains preserved without asserting B current is stale',()=>{
 const input=baseline(),result=codes({...input,
  artifactRows:[row('A','synthetic-case',3),row('A','synthetic-case',2,J),row('B')],
  receipts:[{requestId:'req-A',status:'committed' as const,artifactIds:['A']},...input.receipts],
  objectProofs:[proof('A'),proof('B')]});
 assert.ok(result.issues.some(x=>x.code==='ARTIFACT_EVIDENCE_CONFLICT' && x.artifactId==='A'));
 assert.equal(result.currentArtifactsVerified,true);
 assert.equal(result.autoDeleteAllowed,false);
});
test('unrelated foreign evidence is ignored to avoid cross-case disclosure',()=>{
 const input=baseline(),result=codes({...input,artifactRows:[row('X','other-case'),row('B')]});
 assert.deepEqual(result.issues,[]);
 assert.equal(result.currentArtifactsVerified,true);
});
test('ordinary one-row current case remains verified with actual byte hash proof',()=>{
 const result=codes(baseline());
 assert.deepEqual(result.issues,[]);assert.equal(result.currentArtifactsVerified,true);
});
test('unknown R2 byte proof remains unknown and never grants cleanup permission',()=>{
 const input=baseline(),result=codes({...input,objectProofs:[{objectKey:proof('B').objectKey,exists:null,verifiedSha256:null}]});
 assert.ok(result.issues.some(x=>x.code==='R2_PROOF_UNKNOWN'));
 assert.equal(result.currentArtifactsVerified,false);
 assert.equal(result.autoDeleteAllowed,false);
});
