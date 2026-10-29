import test from "node:test";
import assert from "node:assert/strict";
import { clearLegacyCommandId, isKnownMutationRejection, legacyCommandId, MutationHttpError, requireUsableCaseSnapshot, type MutableRef, type PendingClientMutation } from "../lib/client-mutation.ts";

const ref=():MutableRef<PendingClientMutation|null>=>({current:null});
const snapshot=(caseId="case-1")=>({case:{context:{id:caseId,revision:2},clientStateFingerprint:"state-hash"}});

test("202 pending and malformed 2xx retain the frozen command ID until a usable snapshot arrives",()=>{
  const pending=ref(),key="frozen body and base hash",id=legacyCommandId(pending,key);
  for(const response of [{committed:true,pending:true,code:"EVALUATION_PENDING"},{case:null},{case:{context:{id:"case-1",revision:2}}}]){
    assert.throws(()=>requireUsableCaseSnapshot(response,"case-1",202),MutationHttpError);
    assert.equal(isKnownMutationRejection(new MutationHttpError("uncertain",202)),false);
    assert.equal(legacyCommandId(pending,key),id,"retry must reuse the original command ID");
  }
  assert.throws(()=>legacyCommandId(pending,"changed body"),/저장 결과를 확인하지 못한 변경/);
  assert.equal(requireUsableCaseSnapshot(snapshot(),"case-1",200).case.context.revision,2);
  clearLegacyCommandId(pending,key);
  assert.notEqual(legacyCommandId(pending,key),id,"a confirmed commit releases the frozen retry identity");
});

test("a successful response for another case is uncertain and cannot clear the pending ID",()=>{
  const pending=ref(),id=legacyCommandId(pending,"same payload");
  assert.throws(()=>requireUsableCaseSnapshot(snapshot("case-2"),"case-1",200));
  assert.equal(legacyCommandId(pending,"same payload"),id);
});

test("known client rejection releases the pending ID, while server and network uncertainty keep it",()=>{
  const pending=ref(),key="same payload",id=legacyCommandId(pending,key);
  const rejected=new MutationHttpError("invalid command",422);
  assert.equal(isKnownMutationRejection(rejected),true);
  if(isKnownMutationRejection(rejected))clearLegacyCommandId(pending,key);
  assert.notEqual(legacyCommandId(pending,key),id);
  const retryId=legacyCommandId(pending,key);
  for(const uncertain of [new MutationHttpError("server error",500),new MutationHttpError("pending",202),new Error("network lost")]){
    assert.equal(isKnownMutationRejection(uncertain),false);
    if(isKnownMutationRejection(uncertain))clearLegacyCommandId(pending,key);
    assert.equal(legacyCommandId(pending,key),retryId);
  }
});
