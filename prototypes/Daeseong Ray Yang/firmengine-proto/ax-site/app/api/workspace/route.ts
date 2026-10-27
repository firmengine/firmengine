import { caseSummary,connection,db,errorResponse } from "../../../lib/server-store";
import { CURRENT_RULESET, LEGAL_CATALOG, RISK_CATALOG } from "../../../lib/legal-rules";
import { BENCHMARK } from "../../../lib/sample-manifest";
import { getChatGPTUser } from "../../chatgpt-auth";
import type { CaseData } from "../../../lib/domain";
export async function GET(){try{
  const rows=await db().prepare("SELECT id,name,payload,revision,updated_at AS updatedAt FROM cases ORDER BY updated_at DESC LIMIT 100").all<{id:string,name:string,payload:string,revision:number,updatedAt:string}>();
  const user=await getChatGPTUser();
  return Response.json({cases:rows.results.map(r=>{const stored=JSON.parse(r.payload) as CaseData|{_storage?:string;caseId?:string;revision?:number;summary?:{documents:number;facts:number;status:string}};const summary=stored&&"_storage" in stored&&stored._storage==="r2-case-v1"?stored.caseId===r.id&&stored.revision===r.revision&&stored.summary?stored.summary:null:caseSummary(stored as CaseData);if(!summary)throw new Error("사건 목록 저장 상태가 올바르지 않습니다.");return {id:r.id,name:r.name,updatedAt:r.updatedAt,documents:summary.documents,facts:summary.facts,status:summary.status};}),connection:connection(),rules:CURRENT_RULESET,legalCatalog:LEGAL_CATALOG,riskCatalog:RISK_CATALOG,benchmark:BENCHMARK,user:user?{name:user.displayName}:null},{headers:{"Cache-Control":"no-store"}});
}catch(e){return errorResponse(e);}}
