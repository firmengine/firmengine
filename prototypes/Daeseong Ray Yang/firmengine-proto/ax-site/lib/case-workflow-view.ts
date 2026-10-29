import { currentFacts, validSourceRef, type CaseData, type Fact } from "./domain.ts";
import type { CaseRequirement } from "./case-requirements.ts";
import type { DocumentMatch } from "./document-fulfillment.ts";
import { aggregateDocumentReception, deriveRequirementStatus, fulfillmentDependencyFingerprint, type DocumentReceptionView, type FulfillmentDependencyInput, type ReceptionFieldIssue, type ReceptionPage, type RequirementStatus } from "./document-fulfillment.ts";
import type { RequirementStaffDisposition } from "./case-requirements.ts";
import { reconcileDocumentSubstitution, type SubstitutionPageType, type SubstitutionView } from "./document-substitution.ts";

export interface CaseWorkflowRequirementView {
  requirementId: string;
  required: boolean;
  engineFulfillment: "missing"|"partial"|"complete"|"conflict"|"mapping_required"|"stale";
  staffDisposition: "unreviewed"|"confirmed"|"rejected"|"waived"|"stale";
  requirementStatus: RequirementStatus;
  substitution: SubstitutionView;
  requiredFieldCoverage: { required: string[]; covered: string[]; missing: string[] };
  mappingOptions: { crosswalkId:string|null; familyId:string|null; contractVersion:string|null; availableFieldIds:string[]; targetFamilies:string[] };
  matchedDocumentCount: number;
  reception: Pick<DocumentReceptionView,"primaryStatus"|"uploadState"|"processingCountsByStatus"|"pageCountsByRole"|"requiredPageCoverage"|"sourceRevision">[];
}
export interface CaseWorkflowView {
  requirementStates: CaseWorkflowRequirementView[];
  requirementFingerprints: Record<string,string>;
  requirementCompleteness: {
    total:number; required:number; satisfied:number; eligibleForConfirmation:number; missing:number; partial:number;
    conflict:number; mappingRequired:number; stale:number; legalReview:number; qualificationNeeded:number; unresolved:number; complete:boolean;
  };
}
const readableFactState=(fact:Fact)=>fact.state==="extracted"||fact.state==="verified";
function matchPageNumber(pageId:string,documentId:string):number|null {
  const prefix=`${documentId}:`;if(!pageId.startsWith(prefix))return null;
  const value=pageId.slice(prefix.length);if(!/^\d{1,5}$/.test(value))return null;
  const page=Number(value);return Number.isSafeInteger(page)&&page>0?page:null;
}
function pageContentReady(page:CaseData["pages"][number]):boolean {
  return !!page.text?.trim()||!!page.imageUrl||!!page.fieldCoverage;
}
function factHasField(fact:Fact,fieldId:string):boolean {
  return fact.canonicalFieldId===fieldId||fact.fieldObservation?.canonicalFieldId===fieldId;
}
function sourceFactForMatch(data:CaseData,fact:Fact,fieldId:string,matches:readonly DocumentMatch[]):boolean {
  if(!readableFactState(fact)||fact.recognition==="rejected"||!factHasField(fact,fieldId))return false;
  return fact.refs.some(ref=>{
    const doc=data.documents.find(d=>d.id===ref.documentId&&d.status==="active");
    const page=data.pages.find(p=>p.documentId===ref.documentId&&p.page===ref.page&&p.role==="evidence");
    const inMatch=matches.some(m=>m.state==="accepted"&&m.documentId===ref.documentId&&m.pageIds.includes(`${ref.documentId}:${ref.page}`)&&m.sourceDocumentHash===doc?.sha256);
    return !!doc&&!!page&&inMatch&&ref.sourceHash===doc.sha256&&validSourceRef(data,ref);
  });
}
function mapFieldState(state:string):ReceptionFieldIssue["state"] {
  if(state==="illegible"||state==="unreadable")return "unreadable";
  if(state==="conflicting"||state==="conflict")return "conflict";
  if(state==="masked"||state==="source_obscured")return "masked";
  if(state==="present"||state==="readable"||state==="value_read")return "readable";
  if(state==="unknown"||state==="not_seen"||state==="blank"||state==="source_empty")return "missing";
  return "unknown";
}
function sanitizedReception(view:DocumentReceptionView):CaseWorkflowRequirementView["reception"][number] {
  return {primaryStatus:view.primaryStatus,uploadState:view.uploadState,processingCountsByStatus:{...view.processingCountsByStatus},pageCountsByRole:{...view.pageCountsByRole},requiredPageCoverage:{required:[...view.requiredPageCoverage.required],completed:[...view.requiredPageCoverage.completed],missing:[...view.requiredPageCoverage.missing],incomplete:[...view.requiredPageCoverage.incomplete]},sourceRevision:view.sourceRevision};
}
function latestConfirmation(data:CaseData,requirementId:string):{requirementId:string;fingerprint:string;actor:string;at:string;reason:string}|undefined {
  return [...(data.workflowState?.requirementConfirmations??[])].reverse().find(item=>item.requirementId===requirementId);
}
function confirmationReceipt(confirmation:ReturnType<typeof latestConfirmation>):RequirementStaffDisposition|undefined {
  if(!confirmation)return undefined;
  // requirement.confirm is guarded by the authenticated caseworker role in the
  // command reducer. This receipt only records workflow disposition; it never
  // changes fact recognition or source verification.
  return {state:"confirmed",dependencyFingerprint:confirmation.fingerprint,reviewer:confirmation.actor,role:"caseworker_review",reason:confirmation.reason,basisRefs:[]};
}

/** Read-only projection. It returns state and opaque fingerprints, never source values or auth material. */
export async function buildCaseWorkflowView(data:CaseData,options: {catalogVersion?:number|null;pendingCourtPolicyChange?:boolean;pageTypes?:readonly SubstitutionPageType[]}={}):Promise<CaseWorkflowView> {
  const workflow=data.workflowState;
  const requirements=workflow?.requirements??[], matches=workflow?.documentMatches??[], links=workflow?.subjectLinks??[];
  const facts=currentFacts(data), requirementStates:CaseWorkflowRequirementView[]=[], requirementFingerprints:Record<string,string>={};
  for(const requirement of requirements){
    const baseMatches=matches.filter(m=>m.requirementId===requirement.requirementId);
    const subjectLink=links.find(link=>link.linkId===requirement.subjectLinkId);
    const effectiveMatches:DocumentMatch[]=baseMatches.map(match=>{
      if(match.state!=="accepted"&&match.state!=="proposed")return match;
      const doc=data.documents.find(item=>item.id===match.documentId&&item.status==="active");
      const pages=match.pageIds.map(id=>matchPageNumber(id,match.documentId));
      const valid=!!doc&&doc.sha256===match.sourceDocumentHash&&pages.length>0&&pages.every((pageNo):pageNo is number=>pageNo!==null&&data.pages.some(page=>page.documentId===match.documentId&&page.page===pageNo&&page.role==="evidence"&&pageContentReady(page)));
      return valid?match:{...match,state:"stale"};
    });
    const accepted=effectiveMatches.filter(m=>m.state==="accepted");
    const requiredFields=[...new Set(requirement.requiredFieldGroups.flat())].sort();
    const fieldFactMap=new Map(requiredFields.map(fieldId=>[fieldId,facts.filter(fact=>sourceFactForMatch(data,fact,fieldId,accepted))]));
    const covered=requiredFields.filter(fieldId=>(fieldFactMap.get(fieldId)?.length??0)>0),missing=requiredFields.filter(fieldId=>!covered.includes(fieldId));
    const sourceFactIds=[...new Set([...fieldFactMap.values()].flat().map(fact=>fact.id))].sort();
    const requiredFieldGroupsMet=missing.length===0;
    const currentDocumentHashes=Object.fromEntries(data.documents.map(doc=>[doc.id,doc.sha256]));
    const applicability:FulfillmentDependencyInput["applicability"]=subjectLink?.status==="confirmed"&&requirement.intakeStatus!=="qualification_needed"?"confirmed":"unknown";
    const legalReview=requirement.intakeStatus==="legal_review";
    const sourceFactFingerprints=[...new Set([...fieldFactMap.values()].flat().map(fact=>JSON.stringify({id:fact.id,version:fact.version,state:fact.state,recognition:fact.recognition,canonicalFieldId:fact.canonicalFieldId,value:fact.value,rawValue:fact.rawValue,fieldObservation:fact.fieldObservation??null,refs:fact.refs})))].sort();
    const fulfillmentInput={requirement,matches:effectiveMatches,subjectLink,currentDocumentHashes,sourceFactIds,sourceFactFingerprints,requiredFieldGroupsMet,applicability,staffConfirmationRequired:requirement.requirement!=="recommended",legalReview};
    const fingerprint=await fulfillmentDependencyFingerprint(fulfillmentInput);requirementFingerprints[requirement.requirementId]=fingerprint;
    const receipt=confirmationReceipt(latestConfirmation(data,requirement.requirementId));
    const derived=await deriveRequirementStatus({...fulfillmentInput,...(receipt?{staffDispositionReceipt:receipt}:{})});
    let engineFulfillment=derived.engineFulfillment,requirementStatus=derived.requirementStatus;
    if(requirement.intakeStatus==="conflict"){engineFulfillment="conflict";requirementStatus="conflict";}
    const substitution=await reconcileDocumentSubstitution({
      requirement,matches:effectiveMatches,documents:data.documents,pages:data.pages,facts,subjectLink,
      courtId:String(data.context.courtId??""),asOf:String(data.context.asOf??""),
      catalogVersion:options.catalogVersion,pendingCourtPolicyChange:options.pendingCourtPolicyChange,
      pageTypes:options.pageTypes
    });
    if(substitution.status==="inactive_by_substitution"&&requirement.intakeStatus!=="conflict"&&requirement.intakeStatus!=="qualification_needed"&&requirement.intakeStatus!=="legal_review"){
      engineFulfillment="complete";requirementStatus="satisfied";
    }else if(requirement.substitutionReview||requirement.selectedAlternativeId){
      // A selected or previously-approved substitute cannot bypass fresh proof validation.
      if(requirementStatus==="satisfied"||requirementStatus==="eligible_for_confirmation"){
        engineFulfillment="mapping_required";requirementStatus="legal_review";
      }
    }else if(requirement.alternatives.length&&accepted.some(match=>{
      const candidateTypeIds=new Set(requirement.alternatives.map(alt=>alt.id));
      return match.pageIds.some(pageId=>{
        const prefix=match.documentId+":";
        if(!pageId.startsWith(prefix))return false;
        const pageNo=Number(pageId.slice(prefix.length));
        const observed=options.pageTypes?.find(item=>item.documentId===match.documentId&&item.page===pageNo)?.documentTypeId
          ?? /^shared-document:([a-z0-9_]+)@/.exec(data.pages.find(page=>page.documentId===match.documentId&&page.page===pageNo)?.documentType??"")?.[1];
        return observed?candidateTypeIds.has(observed):false;
      });
    })){
      // An unapproved alternate document must not satisfy a primary request.
      if(requirementStatus==="satisfied"||requirementStatus==="eligible_for_confirmation"){
        engineFulfillment="mapping_required";requirementStatus="legal_review";
      }
    }
    const docs=new Set(effectiveMatches.filter(m=>["accepted","proposed","stale"].includes(m.state)).map(m=>m.documentId));
    const reception:CaseWorkflowRequirementView["reception"]=[];
    for(const documentId of [...docs].sort()){
      const doc=data.documents.find(item=>item.id===documentId);if(!doc)continue;
      const pageRows=data.pages.filter(page=>page.documentId===documentId);
      const requiredPages=[...new Set(effectiveMatches.filter(m=>m.documentId===documentId&&m.state==="accepted").flatMap(m=>m.pageIds.map(id=>matchPageNumber(id,documentId)).filter((n):n is number=>n!==null)))];
      const receptionPages:ReceptionPage[]=pageRows.map(page=>({documentId,page:page.page,role:page.role,status:page.fieldCoverage?.completeReadClaim===true?"completed":page.fieldCoverage?"review_required":"legacy_unknown",imageReady:pageContentReady(page)}));
      const fieldIssues:ReceptionFieldIssue[]=[];
      for(const page of pageRows){
        for(const observation of page.fieldCoverage?.observations??[]){
          const fieldId=observation.canonicalFieldId;if(!fieldId)continue;
          const isRequired=requiredFields.includes(fieldId),hasFact=(fieldFactMap.get(fieldId)?.some(fact=>fact.refs.some(ref=>ref.documentId===documentId&&ref.page===page.page))??false);
          const state=mapFieldState(observation.sourceState);
          if(isRequired&&hasFact)continue;
          if(state!=="readable"||isRequired)fieldIssues.push({documentId,page:page.page,fieldId,required:isRequired,state:isRequired&&state==="readable"?"missing":state,quote:null,bbox:null});
        }
      }
      for(const fieldId of missing)if(!fieldIssues.some(issue=>issue.fieldId===fieldId&&issue.required))fieldIssues.push({documentId,page:requiredPages[0]??0,fieldId,required:true,state:"missing"});
      const view=aggregateDocumentReception({document:{id:doc.id,status:doc.status,originalReady:doc.pages.length>0,pagesReady:doc.pages.every(pageNo=>pageRows.some(p=>p.page===pageNo&&pageContentReady(p)))},pages:receptionPages,requiredPages,fieldIssues,sourceRevision:data.context.revision});
      reception.push(sanitizedReception(view));
    }
    requirementStates.push({requirementId:requirement.requirementId,required:requirement.requirement==="required_when_applicable"||requirement.requirement==="court_ordered",engineFulfillment,staffDisposition:substitution.status==="inactive_by_substitution"?"confirmed":derived.staffDisposition,requirementStatus,substitution,requiredFieldCoverage:{required:requiredFields,covered,missing},mappingOptions:{crosswalkId:requirement.crosswalkId??null,familyId:requirement.familyId??null,contractVersion:requirement.crosswalkVersion??null,availableFieldIds:[...(requirement.availableFieldIds??[])],targetFamilies:["source_only","incomes[]","debts[]","assets[]","transactions[]","household[]"]},matchedDocumentCount:new Set(accepted.map(m=>m.documentId)).size,reception});
  }
  const count=(status:RequirementStatus)=>requirementStates.filter(state=>state.requirementStatus===status).length;
  const required=requirementStates.filter(state=>state.required&&state.requirementStatus!=="retired"),resolved=new Set<RequirementStatus>(["satisfied","waived_by_review","not_applicable_confirmed","retired"]);
  const unresolved=required.filter(state=>!resolved.has(state.requirementStatus)).length;
  return {requirementStates,requirementFingerprints,requirementCompleteness:{total:requirementStates.length,required:required.length,satisfied:count("satisfied"),eligibleForConfirmation:count("eligible_for_confirmation"),missing:count("missing"),partial:count("partial"),conflict:count("conflict"),mappingRequired:count("mapping_required"),stale:count("stale"),legalReview:count("legal_review"),qualificationNeeded:count("qualification_needed"),unresolved,complete:unresolved===0}};
}
