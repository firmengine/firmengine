import { currentFacts,type CaseData } from "./domain.ts";
import { currentReferenceSnapshot } from "./reference-runtime.ts";

export type DisposalApplicabilityStatus="unknown"|"candidate"|"confirmed"|"stale";
export interface DisposalApplicabilityResult { status:DisposalApplicabilityStatus;reason:string|null;basisFingerprint:string;factIds:string[]; }
const assetRelevantFacts=(data:CaseData)=>{
 const ids=new Set(data.assets.map(asset=>asset.id));
 return currentFacts(data).filter(fact=>ids.has(fact.subjectId)&&fact.key.startsWith("asset.")).sort((a,b)=>a.id.localeCompare(b.id));
};
export function disposalApplicabilityBasisFactIds(data:CaseData):string[]{return assetRelevantFacts(data).map(fact=>fact.id);}
function canonical(value:unknown):string{
 if(value===null||typeof value!=="object")return JSON.stringify(value)??"null";
 if(Array.isArray(value))return `[${value.map(canonical).join(",")}]`;
 const record=value as Record<string,unknown>;
 return `{${Object.keys(record).sort().map(key=>`${JSON.stringify(key)}:${canonical(record[key])}`).join(",")}}`;
}
/** Deterministic semantic basis; assignments, this review, and case revision are deliberately excluded. */
export function disposalApplicabilityBasisFingerprint(data:CaseData):string{
 const assets=[...data.assets].sort((a,b)=>a.id.localeCompare(b.id)).map(asset=>({id:asset.id,kind:asset.kind,label:asset.label,grossValue:asset.grossValue,securedPayoff:asset.securedPayoff,disposalCosts:asset.disposalCosts,protectedValue:asset.protectedValue,ownershipBps:asset.ownershipBps,asOf:asset.asOf,valuationBasis:asset.valuationBasis,factIds:[...asset.factIds].sort()}));
 const facts=assetRelevantFacts(data).map(fact=>({id:fact.id,key:fact.key,value:fact.value,numeric:fact.numeric,rawValue:fact.rawValue,state:fact.state,recognition:fact.recognition,refs:fact.refs.map(ref=>({documentId:ref.documentId,page:ref.page,quote:ref.quote,sourceHash:ref.sourceHash??null,bbox:ref.bbox??null})),structuredRefs:fact.structuredRefs??[]}));
 const relevantDocumentIds=new Set(facts.flatMap(fact=>fact.refs.map(ref=>ref.documentId)));
 const documents=data.documents.filter(document=>relevantDocumentIds.has(document.id)).sort((a,b)=>a.id.localeCompare(b.id)).map(document=>({id:document.id,parentId:document.parentId??null,sha256:document.sha256,status:document.status,type:document.type??null,pages:[...document.pages].sort((a,b)=>a-b),extractionStatus:document.extractionStatus??null}));
 const pages=data.pages.filter(page=>relevantDocumentIds.has(page.documentId)).sort((a,b)=>a.documentId.localeCompare(b.documentId)||a.page-b.page).map(page=>({documentId:page.documentId,page:page.page,role:page.role,documentType:page.documentType??null,text:page.text??null}));
 const reference=currentReferenceSnapshot();
 const referenceIdentity=reference?{id:reference.id,revision:reference.revision,sha256:reference.sha256,bundleReview:reference.bundleReview?{status:reference.bundleReview.status,basedOnSha256:reference.bundleReview.basedOnSha256,artifactIds:[...reference.bundleReview.artifactIds].sort(),artifacts:[...reference.bundleReview.artifacts].sort((a,b)=>a.id.localeCompare(b.id))}:null}:null;
 const basis={context:{courtId:data.context.courtId,applicationDate:data.context.applicationDate,asOf:data.context.asOf,ruleReleaseId:data.context.ruleReleaseId,assetInventoryComplete:data.context.inventoryComplete.asset,referenceBundleId:data.context.referenceBundleId??null,referenceDateBasis:data.context.referenceDateBasis??null,referenceEffectiveDate:data.context.referenceEffectiveDate??null,referenceArtifactIds:[...(data.context.referenceArtifactIds??[])].sort(),referenceApplicationRequired:data.context.referenceApplicationRequired??false},assets,facts,documents,pages,referenceIdentity};
 return `disposal-applicability/2:${canonical(basis)}`;
}
/** An empty asset inventory can be reviewed explicitly; otherwise every current asset fact must be in scope. */
export function evaluateDisposalApplicability(data:CaseData):DisposalApplicabilityResult{
 const review=data.context.disposalApplicabilityReview,factIds=assetRelevantFacts(data).map(fact=>fact.id),basisFingerprint=disposalApplicabilityBasisFingerprint(data);
 if(!review||review.disposition!=="not_applicable")return {status:"unknown",reason:null,basisFingerprint,factIds};
 const selected=[...new Set(review.factIds)].sort(),expected=[...factIds].sort();
 const basisComplete=data.context.inventoryComplete.asset==="yes"&&(data.assets.length===0||expected.length>0&&JSON.stringify(selected)===JSON.stringify(expected));
 const basisMatches=review.basisFingerprint===basisFingerprint&&basisComplete;
 if(!basisMatches)return {status:"stale",reason:review.reason||"근거 재산 또는 조사범위가 변경되어 재검토가 필요합니다.",basisFingerprint,factIds};
 if(review.status==="confirmed"&&review.reviewedBy?.trim()&&review.reviewedAt)return {status:"confirmed",reason:review.reason,basisFingerprint,factIds};
 return {status:"candidate",reason:review.reason,basisFingerprint,factIds};
}
