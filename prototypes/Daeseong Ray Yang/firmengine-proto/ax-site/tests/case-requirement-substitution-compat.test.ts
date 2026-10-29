import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";

const file=readFileSync(new URL("../lib/case-requirement-monitor.ts",import.meta.url),"utf8");
const js=ts.transpileModule(file,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;

function fixture(mode:"inactive"|"failed"|"active",options:{pending?:boolean;runId?:string|null}={}){
  let observedOptions:Record<string,unknown>|null=null;
  const caseId="synthetic-case",sourceId="source-document";
  const intakeRequirement={
    requirementId:"intake-requirement",caseId,consultationRunId:"consultation-run",
    documentTypeId:"salary_withholding",documentName:"Synthetic proof",
    subjectId:"subject-1",subjectLabel:"Applicant",period:"six months",
    requirement:"required_when_applicable",status:"requested",
    fieldPlan:{requiredSourceFields:["gross"],ocrCandidates:[],mappingStatus:"review_required"},
    fieldPlanStatus:"materialized"
  };
  const workflowRequirement={
    requirementId:"workflow-requirement",intakeRunId:"consultation-run",
    intakeDocumentTypeId:"salary_withholding",requiredPeriod:"six months",
    sourceEvidenceFields:["gross"],retired:false,waivedByReview:false,notApplicableConfirmed:false
  };
  const caseData={context:{id:caseId,revision:4},documents:[{id:sourceId,status:"active"}],
    workflowState:{requirements:[workflowRequirement]}};
  const database={
    prepare(sql:string){
      return {bind(..._args:unknown[]){
        return {
          async all(){
            if(sql.includes("FROM document_instances"))return {results:[]};
            if(sql.includes("FROM case_extraction_heads"))return {results:[]};
            if(sql.includes("FROM page_jobs"))return {results:[]};
            throw new Error("Unexpected all: "+sql);
          },
          async first(){
            if(sql.includes("MAX(id) AS id FROM case_document_work_events"))return {id:9};
            if(sql.includes("FROM consultation_heads h"))return {runId:options.runId===undefined?"consultation-run":options.runId,catalogVersion:2};
            if(sql.includes("FROM intake_catalog_head"))return {version:2};
            if(sql.includes("FROM legal_monitor_alerts"))return {pending:options.pending?1:0,latest:null};
            throw new Error("Unexpected first: "+sql);
          }
        };
      }};
    }
  };
  const mocks:Record<string,unknown>={
    "./case-document-requirement-store.ts":{listCaseDocumentRequirements:async()=>({caseId,activeRunId:"consultation-run",requirements:[intakeRequirement]})},
    "./case-data-watch.ts":{getCaseDataUpdateState:async()=>({dataVersion:1,lastEventId:6,isQuiet:true})},
    "./shared-document-catalog.ts":{parseDocumentRoute:()=>null},
    "./case-workflow-view.ts":{buildCaseWorkflowView:async(_data:unknown,opts:Record<string,unknown>)=>{
      observedOptions=opts;
      if(mode==="failed")throw new Error("SYNTHETIC_PROJECTION_FAILURE");
      const activeRequest=mode==="active";
      return {requirementStates:[{requirementId:"workflow-requirement",
        substitution:{status:activeRequest?"restored":"inactive_by_substitution",activeRequest,reasonCodes:activeRequest?["SOURCE_CHANGED"]:[]},
        requirementStatus:activeRequest?"missing":"satisfied"}]};
    }}
  };
  const module={exports:{} as Record<string,any>};
  new Function("require","module","exports",js)((id:string)=>{
    if(!(id in mocks))throw new Error("Unexpected module: "+id);
    return mocks[id];
  },module,module.exports);
  return {read:()=>module.exports.caseRequirementMonitor(database,caseData),get options(){return observedOptions;}};
}

test("case monitor preserves the independent consultation and workflow requirement IDs",async()=>{
  const f=fixture("inactive"),result=await f.read();
  assert.equal(result.requirements[0].requirementId,"intake-requirement");
  assert.equal(result.requirements[0].fieldPlanStatus,"materialized");
  assert.equal(result.workflowRequests[0].requirementId,"workflow-requirement");
  assert.equal(result.workflowRequests[0].activeRequest,false);
  assert.equal(result.workflowRequests[0].statusSource,"live_source_and_court_projection");
  assert.equal(result.activeWorkflowRequestCount,0);
  assert.equal(result.workflowProjectionStatus,"current");
});

test("missing or failed live substitution proof never silently suppresses originals",async()=>{
  for(const mode of ["failed","active"] as const){
    const result=await fixture(mode).read();
    assert.equal(result.workflowRequests[0].activeRequest,true);
    assert.equal(result.activeWorkflowRequestCount,1);
    if(mode==="failed")assert.equal(result.workflowProjectionStatus,"unavailable_fail_closed");
  }
});

test("current consultation head and unresolved court policy reach the live projection",async()=>{
  const f=fixture("active",{pending:true,runId:null});
  const result=await f.read();
  assert.equal(f.options?.activeIntakeRunId,null);
  assert.equal(f.options?.pendingCourtPolicyChange,true);
  assert.equal(result.workflowRequests[0].activeRequest,true);
});

test("substitution and document event migrations have unique, ordered journal identities",()=>{
  const journal=JSON.parse(readFileSync(new URL("../drizzle/meta/_journal.json",import.meta.url),"utf8"));
  const entries=journal.entries as Array<{idx:number;when:number;tag:string}>;
  for(let i=0;i<entries.length;i++){
    assert.equal(entries[i].idx,i);
    if(i)assert.ok(entries[i].when>entries[i-1].when,"strictly increasing migration times");
  }
  assert.equal(new Set(entries.map(e=>e.tag)).size,entries.length);
  for(const file of ["0014_case_substitution_watch.sql","0015_case_document_work_events.sql"]){
    const sql=readFileSync(new URL("../drizzle/"+file,import.meta.url),"utf8");
    const statements=(sql.match(/CREATE (?:TABLE|INDEX|TRIGGER)/g)??[]).length;
    const breaks=(sql.match(/--> statement-breakpoint/g)??[]).length;
    assert.equal(breaks,statements-1,"D1 must receive one prepared statement per migration segment: "+file);
  }
});
