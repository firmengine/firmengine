import test from "node:test";
import assert from "node:assert/strict";
import { hasCommittedCommandReceipt } from "../lib/command-submit-outcome.ts";

test("only explicit committed=true acknowledges a server command write",()=>{
  for(const body of [null,undefined,{},[],{receipt:{id:"x"}},{committed:false},{committed:"true"},{pending:true,code:"EVALUATION_PENDING"}])
    assert.equal(hasCommittedCommandReceipt(body),false);
  for(const body of [{committed:true,receipt:{id:"receipt-1"}},{committed:true,pending:true,code:"EVALUATION_PENDING"}])
    assert.equal(hasCommittedCommandReceipt(body),true);
});
