/** Reviewable, explicit contract proposals; active release changes are approved
 * separately by a distinct reference_approve human via /api/reference-data.
 */
import {db,errorResponse,HttpError,jsonBody,requireHumanActor,requireSameOrigin} from "../../../lib/server-store.ts";
import {loadReferenceSnapshot} from "../../../lib/reference-context.ts";
import {proposeReferenceChange} from "../../../lib/reference-store.ts";
import {LEGAL_EVIDENCE_POLICY_REFERENCE_ID,LEGAL_EVIDENCE_POLICY_SEED,legalEvidenceInventory,validateLegalEvidencePolicy,type LegalEvidenceCriterion,type LegalEvidencePolicy} from "../../../lib/legal-evidence-criteria.ts";
export async function GET(request:Request){try{
 requireSameOrigin(request);
 const u=new URL(request.url);
 return Response.json({policyId:LEGAL_EVIDENCE_POLICY_REFERENCE_ID,
   contracts:legalEvidenceInventory(u.searchParams.get("courtId")??undefined,u.searchParams.get("applicationDate")??undefined),
   officialFieldRequirednessVerified:false,autoLegalApproval:false},{headers:{"Cache-Control":"no-store"}});
}catch(e){return errorResponse(e);}}
export async function POST(request:Request){try{
 requireSameOrigin(request);const human=await requireHumanActor(),body=await jsonBody(request);
 if(body.action!=="propose_check"||!body.contract||typeof body.contract!=="object"||Array.isArray(body.contract)||typeof body.expectedActiveSha256!=="string")throw new HttpError(400,"법률 위험 피처 계약 제안과 현재 기준 판본을 지정하세요.");
 const current=await loadReferenceSnapshot(db());
 if(current.sha256!==body.expectedActiveSha256)throw new HttpError(409,"기준정보 판본이 변경되었습니다.");
 const policy=structuredClone(current.values[LEGAL_EVIDENCE_POLICY_REFERENCE_ID]??LEGAL_EVIDENCE_POLICY_SEED) as LegalEvidencePolicy;
 const contract=body.contract as LegalEvidenceCriterion;
 const next:LegalEvidencePolicy={...policy,checks:[...policy.checks.filter(c=>c.checkId!==contract.checkId),contract]};
 try{validateLegalEvidencePolicy(next);}catch(e){throw new HttpError(400,e instanceof Error?e.message:"피처 계약을 확인하세요.");}
 const proposal=await proposeReferenceChange(db(),{id:LEGAL_EVIDENCE_POLICY_REFERENCE_ID,value:next,
   reason:String(body.reason??""),sourceUrls:contract.sourceUrls,
   effectiveFrom:contract.effectiveFrom,expectedActiveSha256:current.sha256},human);
 return Response.json({proposalId:proposal.id,status:"pending_review",checkId:contract.checkId,
   activation:"a different authorized human must approve via /api/reference-data",activeUnchanged:true},{headers:{"Cache-Control":"no-store"}});
}catch(e){return errorResponse(e);}}
