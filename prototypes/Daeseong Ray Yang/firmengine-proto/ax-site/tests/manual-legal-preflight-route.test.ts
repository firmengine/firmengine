import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";

// Run the actual POST function body with synthetic API/storage/model stubs.
// This is an isolated branch-contract test, not a D1/R2 or full HTTP test.
const source=readFileSync(new URL("../app/api/cases/[id]/process/route.ts",import.meta.url),"utf8");
const ast=ts.createSourceFile("case-process-route.ts",source,ts.ScriptTarget.Latest,true);
const declaration=ast.statements.find(node=>ts.isFunctionDeclaration(node)&&node.name?.text==="POST");
assert.ok(declaration,"case process route POST must exist");
const code=ts.transpileModule(declaration.getText(ast),{
  compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}
}).outputText.replace(/^export /m,"");

function fixture(sourceReady:boolean,calculationReady:boolean){
  const calls={source:0,calculation:0,legal:0};
  const ok={ready:true,retryable:false,status:"ready",blockers:[],nextAction:""};
  const blocked=(code:string)=>({ready:false,retryable:false,status:"review_required",blockers:[code],nextAction:"Human source review required"});
  class HttpError extends Error{status:number;constructor(status:number,message:string){super(message);this.status=status;}}
  const failed=(error:unknown)=>{
    const e=error as {status?:number;message?:string};
    return {status:e.status??500,message:e.message??"unexpected"};
  };
  const context={
    requireSameOrigin:()=>undefined,
    jsonBody:async()=>({action:"legal"}),
    getCase:async()=>({referenceTest:false,structuredTest:false,context:{id:"synthetic-case",revision:1}}),
    db:()=>({}),
    caseExtras:async()=>({processingReadiness:{complete:true}}),
    inspectLegalAutomationSourceReadiness:async()=>{calls.source++;return sourceReady?ok:blocked("CURRENT_EVIDENCE_PAGE_HEAD_MISSING");},
    inspectLegalAutomationCalculationReadiness:async()=>{calls.calculation++;return calculationReady?ok:blocked("REQUIRED_LEGAL_CALCULATOR_OUTPUT_UNRESOLVED:monthlyIncomeWon");},
    reviewLegal:async()=>{calls.legal++;return {stage:"legal_review",remaining:89};},
    caseProgress:async()=>({stage:"legal_review"}),
    jsonResponse:(data:unknown)=>({status:200,data}),
    errorResponse:failed,
    failure:failed,
    HttpError
  };
  const POST=vm.runInNewContext(code+"\nPOST",context,{timeout:1000}) as
    (request:Request,ctx:{params:Promise<{id:string}>})=>Promise<{status:number;message?:string}>;
  return {calls,run:()=>POST({url:"https://example.invalid/process"} as Request,{params:Promise.resolve({id:"synthetic-case"})})};
}

test("manual legal action rejects missing source without spending model or querying calculation",async()=>{
  const s=fixture(false,true),response=await s.run();
  assert.equal(response.status,409);
  assert.match(response.message??"",/LEGAL_REVIEW_PREFLIGHT_BLOCKED/);
  assert.deepEqual(s.calls,{source:1,calculation:0,legal:0});
});
test("manual legal action rejects invalid or missing required calculation",async()=>{
  const s=fixture(true,false),response=await s.run();
  assert.equal(response.status,409);
  assert.deepEqual(s.calls,{source:1,calculation:1,legal:0});
});
test("manual legal action retains the human-requested review when both gates are ready",async()=>{
  const s=fixture(true,true),response=await s.run();
  assert.equal(response.status,200);
  assert.deepEqual(s.calls,{source:1,calculation:1,legal:1});
});
