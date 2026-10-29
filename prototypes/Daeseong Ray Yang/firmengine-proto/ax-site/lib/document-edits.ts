export type EditableFieldKind = "source"|"decision"|"prose"|"layout";
export interface DocumentEdit { fieldId:string; value:string; kind:EditableFieldKind; rowId?:string; baseValue?:string; baseValueHash?:string; }
export interface EditConflict { key:string; fieldId:string; rowId?:string; baseValue?:string; userValue:string; regeneratedValue?:string; reason:"concurrent_change"|"orphaned_row"; }
export interface EditMergeResult { overlays:DocumentEdit[]; conflicts:EditConflict[]; orphaned:DocumentEdit[]; redirectedCommands:DocumentEdit[]; }
const keyOf=(e:DocumentEdit)=>`${e.rowId??"$"}\u0000${e.fieldId}`;
const equal=(a:string|undefined,b:string|undefined)=>a===b;
/** Three-way B/U/N merge. Only prose and layout are document overlays; source/decision edits must be applied through their owning command. */
export function mergeDocumentEdits(base:DocumentEdit[],user:DocumentEdit[],next:DocumentEdit[]):EditMergeResult {
  const b=new Map(base.map(e=>[keyOf(e),e])),u=new Map(user.map(e=>[keyOf(e),e])),n=new Map(next.map(e=>[keyOf(e),e]));
  const overlays:DocumentEdit[]=[],conflicts:EditConflict[]=[],orphaned:DocumentEdit[]=[],redirectedCommands:DocumentEdit[]=[];
  for(const [key,edit] of u) {
    if(edit.kind==="source"||edit.kind==="decision") { redirectedCommands.push(edit); continue; }
    const original=b.get(key), regenerated=n.get(key);
    if(edit.rowId && !regenerated) { orphaned.push(edit); conflicts.push({key,fieldId:edit.fieldId,rowId:edit.rowId,baseValue:original?.value,userValue:edit.value,reason:"orphaned_row"}); continue; }
    const userChanged=!equal(edit.value,original?.value), nextChanged=!equal(regenerated?.value,original?.value);
    if(!userChanged) continue;
    if(!nextChanged || equal(edit.value,regenerated?.value)) { overlays.push({...edit,baseValue:regenerated?.value}); continue; }
    conflicts.push({key,fieldId:edit.fieldId,rowId:edit.rowId,baseValue:original?.value,userValue:edit.value,regeneratedValue:regenerated?.value,reason:"concurrent_change"});
  }
  return {overlays,conflicts,orphaned,redirectedCommands};
}
async function sha256(value:unknown):Promise<string>{
 const bytes=new TextEncoder().encode(JSON.stringify(value));
 const digest=await globalThis.crypto.subtle.digest("SHA-256",bytes);
 return [...new Uint8Array(digest)].map(b=>b.toString(16).padStart(2,"0")).join("");
}
export async function computeDocumentIdentity(input:{formId:string;templateHash:string;formContractHash?:string;evaluationId:string;evaluationResultHash:string;documentEdits:DocumentEdit[];documentEditsHashOverride?:string;requiredKinds:string[];generatorVersion?:string;parentArtifactId?:string|null;artifactHashes?:string[]}) {
 const persistedEdits=input.documentEdits.filter(edit=>edit.kind==="prose"||edit.kind==="layout").map(edit=>({fieldId:edit.fieldId,rowId:edit.rowId??null,kind:edit.kind,value:edit.value,baseValue:edit.baseValue??null,baseValueHash:edit.baseValueHash??null})).sort((a,b)=>`${a.rowId??"$"}\u0000${a.fieldId}`.localeCompare(`${b.rowId??"$"}\u0000${b.fieldId}`));
 const documentEditsHash=input.documentEditsHashOverride??await sha256(persistedEdits);
 const identity={formId:input.formId,formContractHash:input.formContractHash??null,templateHash:input.templateHash,evaluationId:input.evaluationId,evaluationResultHash:input.evaluationResultHash,documentEditsHash,requiredKinds:[...input.requiredKinds].sort(),generatorVersion:input.generatorVersion??"unspecified",parentArtifactId:input.parentArtifactId??null,artifactHashes:[...(input.artifactHashes??[])].sort()};
 return {...identity,artifactIdentityHash:await sha256(identity)};
}
