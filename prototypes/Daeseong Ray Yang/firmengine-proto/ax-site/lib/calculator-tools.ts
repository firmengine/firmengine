import * as z from "zod-mcp";
import { calculateDisposal } from "./assessment.ts";
import { executeCaseNodes } from "./case-execution.ts";
import { executionCatalog, EXECUTION_CONTRACT_VERSION } from "./execution-catalog.ts";
import { CURRENT_RULESET } from "./legal-rules.ts";
import type { CaseData, NumericInput } from "./domain.ts";

const text=z.string().max(16000), id=z.string().min(1).max(300), tri=z.enum(["yes","no","unknown"]);
const money=z.object({rawValue:z.union([z.string().max(100),z.number().int().safe(),z.null()]),amountWon:z.string().regex(/^-?\d{1,80}$/).nullable(),unit:z.string().max(50),currency:z.string().max(10),normalizationStatus:z.enum(["exact","missing","invalid","review_required"])});
const optionalMoney=money.nullable().optional();
const ids=z.array(id).max(50000), recognition=z.enum(["unreviewed","accepted","rejected"]);
const row=z.object({id,factIds:ids}).passthrough();
const inputSnapshot=z.object({
  context:z.object({id,caseName:text,revision:z.number().int().positive(),applicationDate:text,asOf:text,courtId:text,ruleReleaseId:id,ruleApplicationReviewed:z.boolean(),inventoryComplete:z.object({income:tri,debt:tri,asset:tri}),planMonths:z.number().int().min(1).max(1200).nullable().optional(),monthlyTrusteeFee:optionalMoney,monthlyPriorityPayment:optionalMoney,monthlyEstatePayment:optionalMoney,approvedMonthlyPayment:optionalMoney,approvedPresentValue:optionalMoney}).passthrough(),
  documents:z.array(z.object({id,sha256:text,name:text,status:z.enum(["active","deleted"]),pages:z.array(z.number().int().positive())}).passthrough()).max(10000),
  pages:z.array(z.object({documentId:id,page:z.number().int().positive(),role:z.enum(["evidence","filed_form","administrative","unknown"])}).passthrough()).max(50000),
  facts:z.array(z.object({id,logicalId:id,version:z.number().int().positive(),subjectId:id,key:id,value:z.unknown(),state:z.enum(["reported","extracted","verified","disputed","retracted"]),recognition,refs:z.array(z.object({documentId:id,page:z.number().int().positive(),quote:text,bbox:z.tuple([z.number(),z.number(),z.number(),z.number()]).optional(),sourceHash:text.optional()})),validation:z.array(z.object({code:text,message:text,severity:z.enum(["info","warning","error"])})),numeric:money.optional()}).passthrough()).max(50000),
  incomes:z.array(row.extend({kind:z.enum(["wage","business","rent","interest","dividend","pension","benefit","other"]),label:text,gross:optionalMoney,expenses:optionalMoney,net:optionalMoney,amountBasis:z.enum(["monthly","period_total","unknown"]).optional(),recurring:tri.optional(),periodMonths:z.number().int().min(1).max(1200).nullable().optional()})).max(10000),
  debts:z.array(row.extend({creditor:text,principal:optionalMoney,interest:optionalMoney,secured:tri,classification:z.enum(["ordinary","secured","tax","estate","non_dischargeable","disputed","unknown"])})).max(10000),
  assets:z.array(row.extend({kind:z.enum(["cash","deposit","insurance","vehicle","real_estate","lease_deposit","business","receivable","retirement","other"]),label:text,grossValue:optionalMoney,securedPayoff:optionalMoney,disposalCosts:optionalMoney,protectedValue:optionalMoney,ownershipBps:z.number().int().min(0).max(10000).nullable().optional()})).max(10000),
  household:z.object({factIds:ids,recognizedLivingCost:optionalMoney,additionalLivingCost:optionalMoney,livingCostIncludesAdditional:z.boolean().optional()}).passthrough(),
  transactions:z.array(row.extend({date:text,kind:z.enum(["income","expense","transfer","debt_payment","asset_disposal","tax","unknown"]),direction:z.enum(["in","out","unknown"]),amount:money})).max(30000),
}).passthrough();
const snapshotRequest=z.object({caseData:inputSnapshot,expectedRevision:z.number().int().positive(),ruleReleaseId:id}).strict();
export const TOOL_INPUT_SCHEMAS={
  get_execution_catalog:z.object({section:z.enum(["calculations","workflows","legalRules","risks","sourceFamilies","exceptions"]).default("calculations"),offset:z.number().int().min(0).default(0),limit:z.number().int().min(1).max(50).default(20)}).strict(),
  plan_case:snapshotRequest,
  calculate_case:snapshotRequest,
  build_document_payload:snapshotRequest,
  calculate_disposal:z.object({saleAmount:money,securedPayoff:money,costs:money}).strict(),
};
export type CalculatorToolName=keyof typeof TOOL_INPUT_SCHEMAS;
export const CALCULATOR_TOOL_DESCRIPTIONS:Record<CalculatorToolName,string>={
  get_execution_catalog:"현재 버전의 문서·계산·피처·판단 명세를 페이지 단위로 읽습니다.",
  plan_case:"사건 스냅샷에서 문서·계산·추출 피처·확인할 조건·에이전트 노드 계획을 작성합니다. 상태를 저장하거나 인정하지 않습니다.",
  calculate_case:"공통 BigInt 엔진으로 사건 계산·계산 근거·검토 후보·누락 입력을 반환합니다. 호출자가 전달한 스냅샷의 주장만으로 제출 승인을 만들지 않습니다.",
  build_document_payload:"동일 스냅샷으로 계산한 결과와 서식 필드 값을 함께 반환합니다. 임의 계산 결과를 입력받지 않으며 파일 작성·제출은 수행하지 않습니다.",
  calculate_disposal:"명시된 매각대금·담보상환·비용으로 순유입·잔존현금·부족액을 분리합니다. 처분 승인과 별개입니다.",
};

function stable(value:unknown):string {
  if(value===null||typeof value!=="object") return JSON.stringify(value)??"null";
  if(Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  return `{${Object.keys(value).sort().filter(k=>(value as Record<string,unknown>)[k]!==undefined).map(k=>`${JSON.stringify(k)}:${stable((value as Record<string,unknown>)[k])}`).join(",")}}`;
}
export async function snapshotSha256(value:unknown) {
  const bytes=new TextEncoder().encode(stable(value));
  const digest=await crypto.subtle.digest("SHA-256",bytes);
  return [...new Uint8Array(digest)].map(b=>b.toString(16).padStart(2,"0")).join("");
}
function assertInputSize(value:unknown) {
  const serialized=JSON.stringify(value);
  if(!serialized || serialized.length>32_000_000) throw new Error("INPUT_SIZE_LIMIT");
  const visit=(v:unknown,depth:number):void=>{
    if(depth>40)throw new Error("INPUT_DEPTH_LIMIT");
    if(v&&typeof v==="object")for(const [key,item] of Object.entries(v)){
      if(["__proto__","prototype","constructor"].includes(key))throw new Error("UNSAFE_OBJECT_KEY");
      visit(item,depth+1);
    }
  };visit(value,0);
}
function assertSnapshot(data:CaseData,revision:number,ruleReleaseId:string,planning=false) {
  if(data.context.revision!==revision)throw new Error("CASE_REVISION_MISMATCH");
  if(ruleReleaseId!==CURRENT_RULESET.id || !planning && data.context.ruleReleaseId!==ruleReleaseId)throw new Error("RULE_VERSION_MISMATCH");
  for(const rows of [data.facts,data.documents,data.incomes,data.debts,data.assets,data.transactions]){
    const values=rows.map(row=>row.id);if(new Set(values).size!==values.length)throw new Error("DUPLICATE_INPUT_ID");
  }
  const factIds=new Set(data.facts.map(f=>f.id));
  if([...data.incomes,...data.debts,...data.assets,...data.transactions,data.household].some(row=>row.factIds.some(id=>!factIds.has(id))))throw new Error("UNKNOWN_SOURCE_FACT_ID");
}

/** Transport-neutral read-only boundary. App routes and MCP invoke this exact function. */
export async function callCalculatorTool(name:CalculatorToolName,input:unknown) {
  try {
    assertInputSize(input);
    if(!Object.hasOwn(TOOL_INPUT_SCHEMAS,name))throw new Error("UNKNOWN_TOOL");
    const parsed=TOOL_INPUT_SCHEMAS[name].safeParse(input);
    if(!parsed.success)return {ok:false as const,version:EXECUTION_CONTRACT_VERSION,error:{code:"INVALID_INPUT",fields:parsed.error.issues.slice(0,20).map(issue=>({path:issue.path.join("."),code:issue.code}))}};
    if(name==="get_execution_catalog"){
      const args=parsed.data as z.infer<typeof TOOL_INPUT_SCHEMAS.get_execution_catalog>,catalog=executionCatalog(),rows=catalog[args.section];
      return {ok:true as const,version:EXECUTION_CONTRACT_VERSION,ruleReleaseId:CURRENT_RULESET.id,result:{section:args.section,total:rows.length,offset:args.offset,items:rows.slice(args.offset,args.offset+args.limit),nextOffset:args.offset+args.limit<rows.length?args.offset+args.limit:null}};
    }
    if(name==="calculate_disposal")return {ok:true as const,version:EXECUTION_CONTRACT_VERSION,inputSha256:await snapshotSha256(parsed.data),courtApprovalInferred:false,result:calculateDisposal(parsed.data as {saleAmount:NumericInput;securedPayoff:NumericInput;costs:NumericInput})};
    const args=parsed.data as unknown as {caseData:CaseData;expectedRevision:number;ruleReleaseId:string};
    assertSnapshot(args.caseData,args.expectedRevision,args.ruleReleaseId,name==="plan_case");
    const execution=executeCaseNodes(args.caseData,{includeDocumentBindings:name==="build_document_payload"});
    // A caller-provided review flag is an assertion, not a server-authenticated review.
    // The tool cannot authorize finalization, even for a fully populated snapshot.
    const finalization={canGenerateDraft:execution.assessment.generationGate.canGenerateDraft,canFinalize:false,reasons:[...execution.assessment.generationGate.reasons,"CALLER_SNAPSHOT_REQUIRES_TRUSTED_REVIEW"]};
    execution.assessment.generationGate=finalization;execution.plan.generationGate=finalization;
    const result=name==="plan_case"?execution.plan:execution;
    return {ok:true as const,version:EXECUTION_CONTRACT_VERSION,caseId:args.caseData.context.id,caseRevision:args.expectedRevision,ruleReleaseId:CURRENT_RULESET.id,inputSha256:await snapshotSha256(args.caseData),trust:"caller_supplied_snapshot" as const,courtApprovalInferred:false as const,result};
  } catch(error) {
    const code=error instanceof Error&&/^[A-Z_]+$/.test(error.message)?error.message:"CALCULATION_INPUT_REJECTED";
    return {ok:false as const,version:EXECUTION_CONTRACT_VERSION,error:{code}};
  }
}
