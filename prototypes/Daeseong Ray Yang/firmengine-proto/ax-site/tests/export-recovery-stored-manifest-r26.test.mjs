import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { inspectStoredExportRecovery } from '../lib/export-recovery-stored-manifest.mjs';
// Synthetic fixture only; no operational D1/R2/Word data or legal approval.
const canonical = v => v === undefined ? 'null' : Array.isArray(v) ?
  '['+v.map(canonical).join(',')+']' : v && typeof v === 'object' ?
  '{'+Object.entries(v).filter(([,x]) => x !== undefined).sort(([a],[b]) => a.localeCompare(b)).map(([k,x]) => JSON.stringify(k)+':'+canonical(x)).join(',')+'}' : JSON.stringify(v);
const hash = async value => createHash('sha256').update(canonical(value)).digest('hex');
const H='a'.repeat(64), I='artifact-aaaaaaaa', R='request-aaaaaaaa';
async function fixture() {
  const files=[{id:I,kind:'application',name:'draft.docx',hash:H}];
  const fingerprint=await hash({caseId:'case-synthetic',requestId:R,mode:'draft',caseRevision:3,sourceDataVersion:7,referenceSha256:H,files});
  return {receipt:{caseId:'case-synthetic',requestId:R,mode:'draft',caseRevision:3,sourceDataVersion:7,
      referenceSha256:H,manifestFingerprint:fingerprint,status:'committed',artifactIdsJson:JSON.stringify([I])},
    caseData:{context:{id:'case-synthetic',revision:3},exportManifest:{
      exportRequestId:R,caseRevision:3,sourceDataVersionAtExport:7,mode:'draft',
      files:files.map(f=>({...f,status:'current'})),
      documentWriter:{caseId:'case-synthetic',caseRevision:3,mode:'draft',referenceRelease:{sha256:H}}}},
    caseSnapshot:{caseId:'case-synthetic',revision:3,sourceDataVersion:7,referenceSha256:H},
    artifactRows:[{id:I,caseId:'case-synthetic',revision:3,objectKey:'cases/case-synthetic/artifacts/'+I,hash:H}],
    objectProofs:[{objectKey:'cases/case-synthetic/artifacts/'+I,exists:true,verifiedSha256:H}],
    auditEvents:[{type:'document_writer.prepared',caseId:'case-synthetic',requestId:R,revision:3},
      {type:'export.generated',caseId:'case-synthetic',requestId:R,revision:3}]};
}
const consistent = input => {
  assert.equal(input.manifest.requestId,R);
  assert.equal(input.manifest.artifactIds[0],I);
  assert.equal(input.manifest.fingerprint,input.receipt.manifestFingerprint);
  return {classification:'evidence_consistent_review_required',codes:[],canReplay:true,canApprove:true};
};
const noAuthority = x => {
  for(const key of ['canReplay','canApprove','canDelete','canMarkCommitted']) assert.equal(x[key],false,key);
};
test('real persisted keys projected with independent canonical hash, never approval', async()=>{
  const out=await inspectStoredExportRecovery(await fixture(),hash,consistent);
  assert.equal(out.classification,'evidence_consistent_review_required');noAuthority(out);
});
const cases=[
 ['missing exportRequestId','inconclusive','STORED_EXPORT_REQUEST_NOT_OBSERVED',f=>{delete f.caseData.exportManifest.exportRequestId;}],
 ['different request','historical','STORED_EXPORT_REQUEST_DIFFERENT',f=>{f.caseData.exportManifest.exportRequestId='request-bbbbbbbb';}],
 ['foreign case','conflict','STORED_CASE_IDENTITY_CONFLICT',f=>{f.caseData.context.id='case-foreign';}],
 ['source absent','inconclusive','STORED_MANIFEST_SOURCE_NOT_OBSERVED',f=>{delete f.caseData.exportManifest.sourceDataVersionAtExport;}],
 ['source zero','conflict','STORED_MANIFEST_SOURCE_INVALID',f=>{f.caseData.exportManifest.sourceDataVersionAtExport=0;}],
 ['source changed','conflict','STORED_RECEIPT_SOURCE_CONFLICT',f=>{f.caseData.exportManifest.sourceDataVersionAtExport=8;}],
 ['case revision changed','stale','STORED_MANIFEST_REVISION_STALE',f=>{f.caseData.context.revision=4;}],
 ['malformed digest','conflict','STORED_RECEIPT_DIGEST_INVALID',f=>{f.receipt.manifestFingerprint='bad';}],
 ['bytes hash mismatch','conflict','STORED_MANIFEST_FINGERPRINT_CONFLICT',f=>{f.caseData.exportManifest.files[0].hash='b'.repeat(64);}],
 ['artifact ID replacement','conflict','STORED_MANIFEST_FINGERPRINT_CONFLICT',f=>{f.caseData.exportManifest.files[0].id='artifact-bbbbbbbb';}],
 ['missing writer','inconclusive','STORED_WRITER_NOT_OBSERVED',f=>{delete f.caseData.exportManifest.documentWriter;}],
 ['malformed writer','conflict','STORED_WRITER_INVALID',f=>{f.caseData.exportManifest.documentWriter=0;}],
 ['duplicate artifact','conflict','STORED_MANIFEST_FILES_INVALID',f=>{f.caseData.exportManifest.files.push({...f.caseData.exportManifest.files[0]});}],
 ['receipt fingerprint altered','conflict','STORED_MANIFEST_FINGERPRINT_CONFLICT',f=>{f.receipt.manifestFingerprint='b'.repeat(64);}],
];
for(const [title,want,code,mutate] of cases) test(title,async()=>{
  const f=await fixture(); mutate(f);
  const out=await inspectStoredExportRecovery(f,hash,()=>{throw Error('triage must not run');});
  assert.equal(out.classification,want); assert.deepEqual(out.codes,[code]); noAuthority(out);
});
for(const status of ['claimed','uncertain','failed']) test(status+' receipt cannot be committed',async()=>{
  const f=await fixture();f.receipt.status=status;
  const out=await inspectStoredExportRecovery(f,hash,consistent);
  assert.equal(out.classification,'inconclusive');
  assert.deepEqual(out.codes,['STORED_RECEIPT_NOT_COMMITTED']);noAuthority(out);
});
test('uncertain keeps independently observed R2 conflict',async()=>{
  const f=await fixture();f.receipt.status='uncertain';
  const out=await inspectStoredExportRecovery(f,hash,()=>({classification:'conflict',codes:['R2_BYTES_HASH_CONFLICT'],canDelete:true}));
  assert.equal(out.classification,'conflict');
  assert.deepEqual(out.codes,['R2_BYTES_HASH_CONFLICT','STORED_RECEIPT_NOT_COMMITTED']);noAuthority(out);
});
test('hash calculator unavailable does not reuse receipt fingerprint',async()=>{
  const out=await inspectStoredExportRecovery(await fixture(),null,consistent);
  assert.equal(out.classification,'inconclusive'); noAuthority(out);
});
test('triage throws => no replay',async()=>{
  const out=await inspectStoredExportRecovery(await fixture(),hash,()=>{throw Error('timeout');});
  assert.equal(out.classification,'inconclusive');noAuthority(out);
});
