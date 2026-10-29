import { referenceIdentity } from "./reference-runtime.ts";
import referenceRelease from "./reference-release.json" with { type: "json" };
import { EXECUTION_CONTRACT_VERSION } from "./execution-catalog.ts";
import { executeCaseNodes } from "./case-execution.ts";
import type { CaseData } from "./domain.ts";

export const DERIVED_EVALUATION_SCHEMA = "deterministic-case-evaluation/1";
export const DERIVED_EVALUATION_INLINE_LIMIT = 250_000;
export type ExecutionSnapshot = ReturnType<typeof executeCaseNodes>;
export interface DerivedEvaluationEnvelope {
  schemaVersion: typeof DERIVED_EVALUATION_SCHEMA;
  status: "pending" | "complete";
  revision: number;
  storageToken: string;
  inputSha256: string;
  engineVersion: string;
  referenceSha256?: string;
  generatedAt: string;
  evaluationSha256?: string;
  execution?: ExecutionSnapshot;
  executionPointer?: { key: string; sha256: string };
}

export function buildDerivedExecution(data: CaseData): ExecutionSnapshot {
  return executeCaseNodes(data,{includeDocumentBindings:true});
}

export function pendingDerivedEvaluation(input: {
  revision: number; storageToken: string; inputSha256: string; generatedAt: string;
}): DerivedEvaluationEnvelope {
  return {schemaVersion:DERIVED_EVALUATION_SCHEMA,status:"pending",...input,engineVersion:EXECUTION_CONTRACT_VERSION,referenceSha256:referenceIdentity()?.sha256??referenceRelease.sha256};
}

export function completeDerivedEvaluation(pending: DerivedEvaluationEnvelope, execution: ExecutionSnapshot, evaluationSha256: string): DerivedEvaluationEnvelope {
  if(pending.status!=="pending")throw new Error("DERIVED_EVALUATION_NOT_PENDING");
  return {...pending,status:"complete",evaluationSha256,execution};
}

export function isDerivedEvaluation(value: unknown): value is DerivedEvaluationEnvelope {
  if(!value||typeof value!=="object")return false;
  const item=value as Partial<DerivedEvaluationEnvelope>;
  return item.schemaVersion===DERIVED_EVALUATION_SCHEMA
    && (item.status==="pending"||item.status==="complete")
    && Number.isSafeInteger(item.revision)
    && typeof item.storageToken==="string"
    && /^[a-f0-9]{64}$/.test(item.inputSha256??"")
    && typeof item.engineVersion==="string"
    && typeof item.generatedAt==="string";
}
