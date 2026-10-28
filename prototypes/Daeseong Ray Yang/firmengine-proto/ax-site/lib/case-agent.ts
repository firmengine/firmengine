import { callCalculatorTool, snapshotSha256 } from "./calculator-tools.ts";
import { agentExecutionContext, type executeCaseNodes } from "./case-execution.ts";
import { EXECUTION_CONTRACT_VERSION } from "./execution-catalog.ts";
import { CURRENT_RULESET } from "./legal-rules.ts";
import type { CaseData } from "./domain.ts";

export type CaseExecution = ReturnType<typeof executeCaseNodes>;
export interface CalculatorExecutionReceipt {
  contractVersion:string; tool:"calculate_case"; transport:"in_process_mcp_dispatch";
  caseId:string; revision:number; inputSha256:string; ruleReleaseId:string;
  nodes:string[]; modelPerformedArithmetic:false;
}

/** The agent node invokes the exact readonly tool dispatcher used by both MCP transports.
 * Keeping the in-process boundary avoids a second HTTP read racing the DB snapshot.
 */
export async function runCaseCalculatorNode(data:CaseData) {
  const response=await callCalculatorTool("calculate_case",{
    caseData:data,expectedRevision:data.context.revision,ruleReleaseId:CURRENT_RULESET.id,
  });
  if(!response.ok)throw new Error(`Calculator node rejected the snapshot: ${response.error.code}`);
  if(!("caseId" in response)||response.caseId!==data.context.id||response.caseRevision!==data.context.revision||response.inputSha256!==await snapshotSha256(data))throw new Error("Calculator node returned a different case snapshot.");
  const execution=response.result as CaseExecution;
  const receipt:CalculatorExecutionReceipt={
    contractVersion:EXECUTION_CONTRACT_VERSION,tool:"calculate_case",transport:"in_process_mcp_dispatch",
    caseId:data.context.id,revision:data.context.revision,inputSha256:response.inputSha256,
    ruleReleaseId:CURRENT_RULESET.id,nodes:["case_planner","source_reconciler","calculator"],modelPerformedArithmetic:false,
  };
  return {execution,receipt,context:{...agentExecutionContext(execution),calculatorExecution:receipt}};
}
