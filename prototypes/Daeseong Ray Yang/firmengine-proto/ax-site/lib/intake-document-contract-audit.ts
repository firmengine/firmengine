/** Read-only 85-document crosswalk inspector. "Routing ready" is not proof
 * that a consultation label, canonical field, calculated input and official
 * form token agree. Never upgrades an unreviewed mapping.
 */
import type {IntakeCatalog} from "./intake-types.ts";
import {buildSharedDocumentCatalog} from "./shared-document-catalog.ts";
import {buildIntakeCrosswalk} from "./intake-case-bridge.ts";
export const INTAKE_DOCUMENT_AUDIT_VERSION="intake-document-crosswalk-audit/1" as const;
export function auditIntakeDocumentContracts(catalog:IntakeCatalog,catalogSha256:string,input:{documentTypeId?:string}={}){
 const shared=buildSharedDocumentCatalog(catalog,catalogSha256);
 const links=buildIntakeCrosswalk(catalog);
 const all=catalog.documents.map(doc=>{
  const routes=links.filter(x=>x.intakeDocumentTypeId===doc.id);
  const sharedRow=shared.documents.find(x=>x.documentTypeId===doc.id);
  const ocrIds=[...new Set((sharedRow?.fieldContracts??[]).flatMap(c=>c.fields.map(f=>f.id)))].sort();
  const directRules=catalog.rules.filter(rule=>rule.enabled&&rule.documents.some(need=>need.documentTypeId===doc.id));
  const alternativeRules=catalog.rules.filter(rule=>rule.enabled&&rule.documents.some(need=>need.alternatives.includes(doc.id)));
  const approved=routes.filter(route=>route.reviewState==="approved"&&route.mappingState==="mapped"
    &&route.requiredFieldGroups.length>0&&route.typedTargets.length>0);
  const requiredCanonical=[...new Set(approved.flatMap(x=>x.requiredFieldGroups.flat()))];
  const coverage=approved.length===routes.length&&routes.length>0?"reviewed_mapping":
    !routes.length||!ocrIds.length?"routing_gap":"source_to_canonical_review_required";
  return {documentTypeId:doc.id,documentName:doc.name,collectionMode:sharedRow?.collectionMode??"unregistered",
   sourceLabelCount:doc.fields.length,requiredSourceLabels:[...doc.fields],
   directRuleIds:directRules.map(x=>x.id),alternativeInRuleIds:alternativeRules.map(x=>x.id),
   allowedFamilyIds:sharedRow?.allowedFamilyIds??[],ocrCandidateCanonicalIds:ocrIds,
   workflowTypeIds:[...doc.workflowDocumentTypes],routes:routes.map(route=>({
    crosswalkId:route.crosswalkId,workflowDocumentType:route.workflowDocumentType,
    familyId:route.familyId,coveragePolicy:route.coveragePolicy,mappingState:route.mappingState,
    reviewerApprovedCanonicalGroups:route.requiredFieldGroups,typedTargets:route.typedTargets})),
   approvedCanonicalIds:requiredCanonical,sourceLabelToCanonicalVerified:coverage==="reviewed_mapping",
   mappingStatus:coverage,
   blockers:[...(directRules.length||alternativeRules.length?[]:["NO_INTAKE_REQUIREMENT_RULE"]),
    ...(!routes.length?["NO_WORKFLOW_CROSSWALK"]:[]),
    ...(!ocrIds.length?["NO_OCR_FIELD_CONTRACT"]:[]),
    ...(coverage!=="reviewed_mapping"?["SOURCE_LABEL_CANONICAL_FIELD_MAPPING_NOT_REVIEWED"]:[])],
   legalSufficiencyInferred:false,officialFormParity:"not_verified" as const};
 });
 const selected=input.documentTypeId?all.filter(r=>r.documentTypeId===input.documentTypeId):all;
 if(input.documentTypeId&&!selected.length)throw new Error("UNKNOWN_INTAKE_DOCUMENT_TYPE");
 return {schemaVersion:INTAKE_DOCUMENT_AUDIT_VERSION,catalogVersion:catalog.version,catalogSha256,
  summary:{total:all.length,selected:selected.length,missingRequestRule:all.filter(r=>r.blockers.includes("NO_INTAKE_REQUIREMENT_RULE")).length,
   sourceMappingUnreviewed:all.filter(r=>!r.sourceLabelToCanonicalVerified).length,
   noOcrCandidates:all.filter(r=>r.blockers.includes("NO_OCR_FIELD_CONTRACT")).length,
   manualReviewRequired:all.filter(r=>r.mappingStatus!=="reviewed_mapping").length},
  documents:selected,courtRequirednessVerified:false,autoLegalApproval:false};
}
