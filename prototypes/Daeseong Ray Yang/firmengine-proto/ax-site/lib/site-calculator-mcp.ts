import { McpServer, createMcpHandler } from "@modelcontextprotocol/server";
import * as z from "zod-mcp";
import { callCalculatorTool, CALCULATOR_TOOL_DESCRIPTIONS, TOOL_INPUT_SCHEMAS } from "./calculator-tools.ts";
import { EXECUTION_CONTRACT_VERSION } from "./execution-catalog.ts";
import { CURRENT_RULESET } from "./legal-rules.ts";
import type { CaseData } from "./domain.ts";

/** Hosted tools resolve canonical case data on the server; agent-supplied snapshots are not accepted. */
export function createSiteCalculatorHandler(loadCase:(caseId:string)=>Promise<CaseData>) {
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
    return server;
  },{responseMode:"json",maxRequestBodySize:2_000_000,keepAliveMs:0});
}
