import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";

const output=ts.transpileModule(readFileSync(new URL("../lib/luna.ts",import.meta.url),"utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
function boundary(abort=false){
  let deadline=0,calls=0,body:any;
  const controller=new AbortController(),module={exports:{} as Record<string,any>};
  const mocks:Record<string,unknown>={"cloudflare:workers":{env:{OPENAI_API_KEY:"synthetic-test-only"}},"./domain":{AI_MODEL:"gpt-6-luna"},"./server-store":{HttpError:class extends Error{status:number;constructor(status:number,message:string){super(message);this.status=status;}}}};
  const fetcher=async(_url:string,init:RequestInit)=>{
    calls++;body=JSON.parse(init.body as string);assert.equal(init.signal,controller.signal);
    if(abort)throw new DOMException("synthetic bounded timeout","TimeoutError");
    return {ok:true,json:async()=>({status:"completed",output:[{content:[{type:"output_text",text:'{"ok":true}'}]}],usage:{input_tokens:1,output_tokens:1}})};
  };
  new Function("require","module","exports","fetch","AbortSignal",output)((name:string)=>{if(name in mocks)return mocks[name];throw new Error(name);},module,module.exports,fetcher,{timeout:(ms:number)=>{deadline=ms;return controller.signal;}});
  return {call:(reasoningEffort?:"low"|"medium")=>module.exports.callLuna({agent:"synthetic_boundary",instructions:"Synthetic",input:[],schema:{},maxOutput:100,...(reasoningEffort?{reasoningEffort}:{})}),get deadline(){return deadline;},get calls(){return calls;},get body(){return body;}};
}

test("Luna deadline leaves a checkpoint window before the observed hosting disconnect",async()=>{
  const f=boundary();assert.deepEqual((await f.call()).value,{ok:true});
  assert.ok(f.deadline>0&&f.deadline<=70_000,"leave at least 20 seconds for persistence before a 90-second proxy boundary");
  assert.equal(f.body.model,"gpt-6-luna");assert.equal(f.body.store,false);assert.equal(f.calls,1);
  assert.equal(f.body.reasoning.effort,"low");
});

test("consultation classification can request medium effort without changing model or call bounds",async()=>{
  const f=boundary();await f.call("medium");
  assert.equal(f.body.reasoning.effort,"medium");
  assert.equal(f.body.model,"gpt-6-luna");assert.equal(f.body.store,false);assert.equal(f.calls,1);
  assert.equal(f.deadline,65_000);
});

test("deadline errors reach the durable pipeline without an unbounded retry or model fallback",async()=>{
  const f=boundary(true);await assert.rejects(f.call(),{name:"TimeoutError"});
  assert.equal(f.calls,1);assert.equal(f.body.model,"gpt-6-luna");
});
