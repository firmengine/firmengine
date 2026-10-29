import { McpServer, createMcpHandler } from "@modelcontextprotocol/server";
import * as z from "zod-mcp";
import { callCalculatorTool, CALCULATOR_TOOL_DESCRIPTIONS, TOOL_INPUT_SCHEMAS } from "./calculator-tools.ts";
import { EXECUTION_CONTRACT_VERSION } from "./execution-catalog.ts";
import { CURRENT_RULESET } from "./legal-rules.ts";
import type { CaseData } from "./domain.ts";

/** Hosted tools resolve canonical case data on the server; agent-supplied snapshots are not accepted. */
export interface ReferenceMcpServices {
  catalog:(input:{kind?:string;q?:string;offset?:number;limit?:number})=>Promise<unknown>;
  monitor:(input:{agent?:"all"|"legislation"|"court_documents";cursor?:number;maxSources?:number})=>Promise<unknown>;
  alerts:()=>Promise<unknown>;
  intake?:()=>Promise<unknown>;
}
export function createSiteCalculatorHandler(loadCase:(caseId:string)=>Promise<CaseData>,references?:ReferenceMcpServices) {
  return createMcpHandler(()=>{
    const server=new McpServer({name:"firmengine-case-calculator",version:EXECUTION_CONTRACT_VERSION});
    const annotations={readOnlyHint:true,destructiveHint:false,idempotentHint:true,openWorldHint:false};
    const respond=(result:unknown)=>({content:[{type:"text" as const,text:JSON.stringify(result)}],structuredContent:result as Record<string,unknown>,...((result as {ok:boolean}).ok?{}:{isError:true})});
    for(const name of ["plan_case","calculate_case","build_document_payload"] as const) {
      server.registerTool(name,{description:CALCULATOR_TOOL_DESCRIPTIONS[name]+" 사건 DB의 현재 값을 읽습니다.",
        inputSchema:z.object({caseId:z.string().min(1).max(300),expectedRevision:z.number().int().positive().optional()}).strict(),annotations},
        async(input:{caseId:string;expectedRevision?:number})=>{
          try{
            const data=await loadCase(input.caseId);
            const result=await callCalculatorTool(name,{caseData:data,expectedRevision:input.expectedRevision??data.context.revision,ruleReleaseId:CURRENT_RULESET.id});
            return respond({...result,dataOrigin:"stored_case_snapshot",approvalAuthority:"existing_case_and_export_review_only"});
          }catch{return respond({ok:false,version:EXECUTION_CONTRACT_VERSION,error:{code:"CASE_UNAVAILABLE"}});}
        });
    }
    for(const name of ["get_execution_catalog","calculate_disposal"] as const)server.registerTool(name,{description:CALCULATOR_TOOL_DESCRIPTIONS[name],inputSchema:TOOL_INPUT_SCHEMAS[name],annotations},async(input:unknown)=>respond(await callCalculatorTool(name,input)));
    if(references){
      const referenceResponse=async(run:()=>Promise<unknown>)=>{try{return respond({ok:true,result:await run()});}catch{return respond({ok:false,error:{code:"REFERENCE_OPERATION_FAILED"}});}};
      server.registerTool("get_reference_catalog",{description:"법령·실무준칙·계산 파라미터·문서/필드·프롬프트 규약과 출처·시행일·소비 코드·현재 판본을 페이지별로 조회합니다. 사건 데이터는 읽지 않습니다.",inputSchema:z.object({kind:z.string().max(100).optional(),q:z.string().max(500).optional(),offset:z.number().int().min(0).optional(),limit:z.number().int().min(1).max(100).optional()}).strict(),annotations},async input=>referenceResponse(()=>references.catalog(input)));
      server.registerTool("run_legal_monitors",{description:"법령 개정과 법원 실무준칙·공고·서식·안내 서류 종류의 변경을 공식 출처에서 확인합니다. 하루 1회 웹검색과 제한된 출처 구간 수집을 수행하고 기준본·실패상태·검토 알림을 저장합니다. nextCursor가 있으면 같은 agent로 이어 호출합니다. 사건·법적 인정·현재 적용 기준을 변경하지 않습니다.",inputSchema:z.object({agent:z.enum(["all","legislation","court_documents"]).default("all"),cursor:z.number().int().min(0).optional(),maxSources:z.number().int().min(1).max(20).optional()}).strict(),annotations:{readOnlyHint:false,destructiveHint:false,idempotentHint:true,openWorldHint:true}},async input=>referenceResponse(()=>references.monitor(input)));
      server.registerTool("get_legal_change_alerts",{description:"기준정보 변경 후보, 관련 기준 ID, 법원 서식·서류 종류 변경 알림, 수집 실패와 일일 점검 진행 상태를 조회합니다. 변경 없음과 확인 실패를 구분하며 법률안·공포·시행·문서 변경을 구별합니다.",inputSchema:z.object({}).strict(),annotations},async()=>referenceResponse(()=>references.alerts()));
      if(references.intake)server.registerTool("get_intake_reference",{description:"상담·서류 안내 봇이 실제 사용하는 별도 기준표의 현재 판본·해시와 분류 피처·서류 종류·조건 규칙·출처를 조회합니다. 관할·시점·대체서류·권고/조건부 필수의 구분을 보존합니다. 상담이력·사건 자료를 읽거나 저장하지 않습니다.",inputSchema:z.object({}).strict(),annotations},async()=>referenceResponse(()=>references.intake!()));
    }
    return server;
  },{responseMode:"json",maxRequestBodySize:2_000_000,keepAliveMs:0});
}
