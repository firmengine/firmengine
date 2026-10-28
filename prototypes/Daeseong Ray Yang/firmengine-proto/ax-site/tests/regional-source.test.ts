import test from "node:test";
import assert from "node:assert/strict";
import {AI_MODEL} from "../lib/domain.ts";
import {applyFirstVerification,type PageRead} from "../lib/extraction.ts";
import {createSourceVerificationReceipts,sourceVerificationReceiptMatches,type ReviewPass} from "../lib/source-verification.ts";
import {pageCoordinateChecks,pageCoordinateRead,pageCoordinateReviewPass} from "../lib/regional-source.ts";

const sourceHash="b".repeat(64),verifiedAt="2026-10-28T10:00:00.000Z",promptHash="c".repeat(64),promptVersion="regional-test-v1";
const crop:[number,number,number,number]=[.25,.25,.75,.75];
const local:[number,number,number,number]=[.2,.2,.4,.4];
const page:[number,number,number,number]=[.35,.35,.45,.45];

test("regional reads and verifier checks use page coordinates for receipts; raw audit checks stay local",()=>{
  const localRead:PageRead={documentType:"debt_certificate",complete:true,warnings:[],records:[{category:"debt",label:"row",fields:[{key:"principal",label:"원금",value:"500",unit:"원",quote:"원금 500원",confidence:"clear",bbox:local}]}]};
  const rawCheck={recordIndex:0,fieldIndex:0,meaningStatus:"supported",status:"agrees" as const,value:"500",unit:"원",quote:"원금 500원",bbox:local,reason:"region source read"};
  const localPass:ReviewPass={kind:"verify",checks:[rawCheck],originalChecks:[rawCheck],model:AI_MODEL,promptVersion,promptHash,verifiedAt,bindingStatus:"bound"};
  const mappedRead=pageCoordinateRead(localRead,crop),mappedPass=pageCoordinateReviewPass(localPass,crop);
  assert.deepEqual(mappedRead.records[0].fields[0].bbox,page);
  assert.deepEqual(mappedPass.checks[0].bbox,page);
  assert.deepEqual(mappedPass.originalChecks?.[0].bbox,local,"the raw model response remains in its original local frame");
  assert.deepEqual(pageCoordinateChecks([rawCheck],crop)[0].bbox,page);

  const mappedChecks=pageCoordinateChecks(localPass.checks,crop).map(check=>({...check,reason:check.reason??""}));
  const verifiedRead=applyFirstVerification(mappedRead,mappedChecks).read;
  const input={documentId:"regional-doc",page:1,sourceHash,promptVersion,verifiedAt,originalRead:mappedRead,read:verifiedRead,passes:[mappedPass]};
  const [receipt]=createSourceVerificationReceipts(input);
  assert.ok(receipt);
  assert.deepEqual(receipt.geometry?.finalBBox,page);
  assert.equal(sourceVerificationReceiptMatches(receipt,{documentId:input.documentId,page:input.page,sourceHash,read:verifiedRead}),true);
});

test("invalid crop or source geometry is converted to null and cannot mint a receipt",()=>{
  const invalidRead:PageRead={documentType:"debt_certificate",complete:true,warnings:[],records:[{category:"debt",label:"row",fields:[{key:"principal",label:"원금",value:"500",unit:"원",quote:"원금 500원",confidence:"clear",bbox:[.8,.2,.4,.3]}]}]};
  const invalidCheck={recordIndex:0,fieldIndex:0,meaningStatus:"supported",status:"agrees" as const,value:"500",unit:"원",quote:"원금 500원",bbox:[.2,.2,.4,.4],reason:"source read"};
  const badRegion=pageCoordinateRead(invalidRead,[.8,.2,.4,.7]);
  assert.equal(badRegion.records[0].fields[0].bbox,null);
  assert.equal(pageCoordinateRead(invalidRead,crop).records[0].fields[0].bbox,null);
  assert.equal(pageCoordinateChecks([invalidCheck],crop)[0].bbox?.length,4);
  const badPass:ReviewPass={kind:"verify",checks:[{...invalidCheck,bbox:null}],model:AI_MODEL,promptVersion,promptHash,verifiedAt};
  const mapped=pageCoordinateRead(invalidRead,crop),mappedPass=pageCoordinateReviewPass(badPass,crop);
  const mappedChecks=pageCoordinateChecks(badPass.checks,crop).map(check=>({...check,reason:check.reason??""}));
  const verified=applyFirstVerification(mapped,mappedChecks).read;
  assert.deepEqual(createSourceVerificationReceipts({documentId:"regional-doc",page:1,sourceHash,promptVersion,verifiedAt,originalRead:mapped,read:verified,passes:[mappedPass]}),[]);
});
