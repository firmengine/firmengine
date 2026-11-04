import test from "node:test";
import assert from "node:assert/strict";
import {recordBestEffortLegalUsageEvent} from "../lib/legal-model-usage-checkpoint.ts";
test("successful supplemental event preserves success status",async()=>{
 let n=0;
 assert.equal(await recordBestEffortLegalUsageEvent(async()=>{n++;}),false);
 assert.equal(n,1);
});
test("lost usage-event ACK is reported but not propagated as another paid attempt",async()=>{
 let n=0;
 const warning=await recordBestEffortLegalUsageEvent(async()=>{n++;throw Error("SYNTHETIC_D1_EVENT_FAILURE")});
 assert.equal(warning,true);assert.equal(n,1);
});
test("synchronous failure of event callback also yields explicit warning",async()=>{
 const warning=await recordBestEffortLegalUsageEvent(()=>{throw Error("SYNTHETIC_EVENT_ERROR")});
 assert.equal(warning,true);
});
