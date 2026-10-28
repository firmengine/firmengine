import { McpServer } from "@modelcontextprotocol/server";
import { serveStdio } from "@modelcontextprotocol/server/stdio";
import { callCalculatorTool, TOOL_INPUT_SCHEMAS, CALCULATOR_TOOL_DESCRIPTIONS, type CalculatorToolName } from "../lib/calculator-tools.ts";
import { EXECUTION_CONTRACT_VERSION } from "../lib/execution-catalog.ts";
import * as z from "zod-mcp";

export function createCalculatorMcpServer() {
  const server=new McpServer({name:"firmengine-calculator",version:EXECUTION_CONTRACT_VERSION});
  for(const name of Object.keys(TOOL_INPUT_SCHEMAS) as CalculatorToolName[]) {
    server.registerTool(name,{
      description:CALCULATOR_TOOL_DESCRIPTIONS[name],inputSchema:TOOL_INPUT_SCHEMAS[name],
      outputSchema:z.object({ok:z.boolean(),version:z.string()}).passthrough(),
      annotations:{readOnlyHint:true,destructiveHint:false,idempotentHint:true,openWorldHint:false},
    },async(input:unknown)=>{
      const result=await callCalculatorTool(name,input);
      return {content:[{type:"text" as const,text:JSON.stringify(result)}],structuredContent:result,...(!result.ok?{isError:true}:{})};
    });
  }
  return server;
}
// Protocol owns stdout. No secrets, case data, logging, filesystem or network side effects.
serveStdio(createCalculatorMcpServer,{onerror:error=>console.error("MCP transport:",error.message)});
