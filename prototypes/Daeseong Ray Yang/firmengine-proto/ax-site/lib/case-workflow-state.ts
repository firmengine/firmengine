import type { IntakeCaseWorkflow } from "./intake-case-bridge.ts";
import type { CaseTask } from "./case-tasks.ts";
import type { LegalCheckDisposition } from "./legal-check-dispositions.ts";
import type { ProcedureEvent } from "./case-procedure-events.ts";
export interface CaseWorkflowState extends IntakeCaseWorkflow {
  tasks:CaseTask[];
  legalDispositions:LegalCheckDisposition[];
  procedureEvents:ProcedureEvent[];
  projectionBlockers:{code:string;factIds:string[];reason:string}[];
  reviewHistory:{at:string;actor:string;reason:string;before:unknown}[];
  decisions:{id:string;path:string;proposedValue:unknown;status:"proposed"|"adopted"|"rejected"|"stale";baseFingerprint:string;actor:string;reason:string;at:string;calculationOverride?:import("./calculation-overrides.ts").CalculationOverride}[];
  documentEdits:{id:string;fieldId:string;rowId:string|null;kind:"prose"|"layout";baseValue:string;value:string;artifactId:string;actor:string;reason:string;at:string}[];
  requirementConfirmations:{requirementId:string;fingerprint:string;actor:string;at:string;reason:string}[];
}
export function emptyCaseWorkflow():CaseWorkflowState{return {schema:"case-workflow/1",version:1,requirements:[],subjectLinks:[],documentMatches:[],tasks:[],legalDispositions:[],procedureEvents:[],projectionBlockers:[],reviewHistory:[],decisions:[],documentEdits:[],requirementConfirmations:[]};}
export const caseWorkflow=(input?:Partial<CaseWorkflowState>):CaseWorkflowState=>structuredClone({...emptyCaseWorkflow(),...input});
