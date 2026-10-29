import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";
import { AI_MODEL, CONSULTATION_AI_MODEL } from "../lib/domain.ts";

const output=ts.transpileModule(readFileSync(new URL("../lib/luna.ts",import.meta.url),"utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
function boundary(abort=false){
  let deadline=0,calls=0,body:any;
  const controller=new AbortController(),module={exports:{} as Record<string,any>};
  const mocks:Record<string,unknown>={"cloudflare:workers":{env:{OPENAI_API_KEY:"synthetic-test-only"}},"./domain":{AI_MODEL,CONSULTATION_AI_MODEL},"./server-store":{HttpError:class extends Error{status:number;constructor(status:number,message:string){super(message);this.status=status;}}}};
  const fetcher=async(_url:string,init:RequestInit)=>{
    calls++;body=JSON.parse(init.body as string);assert.equal(init.signal,controller.signal);
    if(abort)throw new DOMException("synthetic bounded timeout","TimeoutError");
    return {ok:true,json:async()=>({status:"completed",output:[{content:[{type:"output_text",text:'{"ok":true}'}]}],usage:{input_tokens:1,output_tokens:1}})};
  };
  new Function("require","module","exports","fetch","AbortSignal",output)((name:string)=>{if(name in mocks)return mocks[name];throw new Error(name);},module,module.exports,fetcher,{timeout:(ms:number)=>{deadline=ms;return controller.signal;}});
  return {call:(reasoningEffort?:"low"|"medium",agent="evidence_extractor")=>module.exports.callLuna({agent,instructions:"Synthetic",input:[],schema:{},maxOutput:100,...(reasoningEffort?{reasoningEffort}:{})}),callTerra:()=>module.exports.callLuna({model:"gpt-6.1-terra",agent:"synthetic_ocr",instructions:"Synthetic OCR",input:[],schema:{},maxOutput:100}),get deadline(){return deadline;},get calls(){return calls;},get body(){return body;}};
}

test("Terra OCR deadline leaves a checkpoint window before the observed hosting disconnect",async()=>{
  const f=boundary();assert.deepEqual((await f.call()).value,{ok:true});
  assert.ok(f.deadline>0&&f.deadline<=70_000,"leave at least 20 seconds for persistence before a 90-second proxy boundary");
  assert.equal(f.body.model,"gpt-6.1-terra");assert.equal(f.body.store,false);assert.equal(f.calls,1);
  assert.equal(f.body.reasoning.effort,"low");
});

test("consultation classification can request medium effort without changing model or call bounds",async()=>{
  const f=boundary();await f.call("medium","consultation_classifier");
  assert.equal(f.body.reasoning.effort,"medium");
  assert.equal(f.body.model,"gpt-6-luna");assert.equal(f.body.store,false);assert.equal(f.calls,1);
  assert.equal(f.deadline,65_000);
});

test("deadline errors reach the durable pipeline without an unbounded retry or model fallback",async()=>{
  const f=boundary(true);await assert.rejects(f.call(),{name:"TimeoutError"});
  assert.equal(f.calls,1);assert.equal(f.body.model,"gpt-6.1-terra");
});

test("every OCR stage and legal review use Terra while consultation and monitors retain Luna",async()=>{
  for(const agent of ["document_classifier","document_classifier_recovery","evidence_extractor","source_verifier","targeted_rereader","legal_checklist_reviewer"]){
    const f=boundary();const response=await f.call(undefined,agent);
    assert.equal(f.body.model,"gpt-6.1-terra");assert.equal(response.usage.model,"gpt-6.1-terra");
  }
  for(const agent of ["consultation_classifier","legal_monitor_change_analysis","legal_monitor_all_discovery"]){
    const f=boundary();const response=await f.call(undefined,agent);
    assert.equal(f.body.model,"gpt-6-luna");assert.equal(response.usage.model,"gpt-6-luna");
  }
});


test("Terra OCR override is explicit, bounded, and recorded in usage",async()=>{const f=boundary();const r=await f.callTerra();assert.equal(f.body.model,"gpt-6.1-terra");assert.equal(r.usage.model,"gpt-6.1-terra");assert.equal(f.body.store,false);assert.equal(f.calls,1);assert.equal(f.deadline,65_000);});
