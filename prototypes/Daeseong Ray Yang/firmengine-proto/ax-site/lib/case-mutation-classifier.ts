/** Distinguish human workflow/manifest writes from evidence mutations.
 * This is a *narrow assertion*, not a user-supplied flag: any unrelated
 * case-data difference throws before a database write. Source changes always
 * use the existing mutation and 10-minute recalculation path.
 */
import type {CaseData} from "./domain.ts";

export type NonSourceMutationCategory="review_only"|"artifact_only";
export const REVIEW_ONLY_COMMANDS=new Set([
 "legalCheck.dispose","document.review","document.edit","task.update"
]);
type RecordLike=Record<string,unknown>;
function projected(snapshot:CaseData,category:NonSourceMutationCategory,commandType?:string):RecordLike{
 const state=structuredClone(snapshot) as unknown as RecordLike;
 if(category==="artifact_only"){
   delete state.exportManifest;
   return state;
 }
 const w=state.workflowState as RecordLike|undefined;
 if(w){
   w.version=0;
   if(commandType==="legalCheck.dispose")w.legalDispositions=[];
   else if(commandType==="task.update")w.tasks=[];
   else if(commandType==="document.edit")w.documentEdits=[];
 }
 const manifest=state.exportManifest as RecordLike|undefined;
 if(manifest&&(commandType==="document.review"||commandType==="document.edit")){
   manifest.reviews={caseworker:null,lawyer:null};
 }
 if(manifest&&commandType==="document.edit"){
   const files=manifest.files;
   if(Array.isArray(files))manifest.files=files.map(item=>{
      if(!item||typeof item!=="object")return item;
      return {...item as object,status:"_document_edit_review_projection_"};
   });
 }
 return state;
}
export function assertNonSourceCaseChange(previous:CaseData,next:CaseData,
 category:NonSourceMutationCategory,commandType?:string):void{
 if(previous===next)throw new Error("NON_SOURCE_CASE_PREVIOUS_SNAPSHOT_REQUIRED");
 if(previous.context.id!==next.context.id||previous.context.revision!==next.context.revision)
   throw new Error("NON_SOURCE_CASE_REVISION_CHANGED");
 if(category==="review_only"&&!commandType||category==="review_only"&&!REVIEW_ONLY_COMMANDS.has(commandType!))
   throw new Error("NON_SOURCE_MUTATION_COMMAND_NOT_ALLOWED");
 if(category==="artifact_only"&&commandType)throw new Error("NON_SOURCE_ARTIFACT_COMMAND_UNEXPECTED");
 const before=projected(previous,category,commandType),after=projected(next,category,commandType);
 if(JSON.stringify(before)!==JSON.stringify(after))throw new Error("NON_SOURCE_MUTATION_CHANGED_EVIDENCE");
 // A review-only save must actually be an authenticated workflow change;
 // a source snapshot may not be re-labelled by a generic caller.
 if(category==="review_only"&&JSON.stringify(previous)===JSON.stringify(next))
   throw new Error("NON_SOURCE_MUTATION_NO_CHANGE");
 if(category==="artifact_only"&&!next.exportManifest)throw new Error("NON_SOURCE_ARTIFACT_MANIFEST_MISSING");
}
