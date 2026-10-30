import { referenceIdentity } from "./reference-runtime.ts";
import type { CaseData } from "./domain.ts";
import type { DerivedEvaluationEnvelope, ExecutionSnapshot } from "./reactive-evaluation.ts";
import { BASIC_FORM_CODES } from "./form-mapping.ts";
import type { FormBindings } from "./form-mapping.ts";
import { FORM_CONTRACTS, FORM_CONTRACT_VERSION, type FormContract } from "./form-contracts.ts";
import { evaluateDocumentPreflight, type DocumentPreflightResult } from "./document-preflight.ts";
import { computeDocumentIdentity, mergeDocumentEdits, type DocumentEdit } from "./document-edits.ts";
import { MISSING_FORM_VALUE } from "./form-mapping.ts";
import { createCaseReadIndex, currentFacts, factHasValidStructuredRefs, factSourceLineageIssues, validSourceRef } from "./domain.ts";
import type { DocumentFieldBase } from "./document-field-bases.ts";

export interface WriterFormResult {
  artifactKind:string; formCode:string; templateHash:string; formContractHash:string; documentEditsHash:string;
  artifactIdentityHash:string; parentArtifactId:string|null; status:DocumentPreflightResult["status"];
  blockers:DocumentPreflightResult["blockers"]; warnings:DocumentPreflightResult["warnings"];
  unresolved:string[];
}
export interface DocumentWriterReceipt {
  schemaVersion:"document-writer-receipt/2";
  caseId:string;
  caseRevision:number;
  inputSha256:string;
  evaluationId:string;
  evaluationResultHash:string;
  generatorVersion:string;
  requiredKinds:string[];
  bindingsSha256:string;
  referenceRelease?:{id:string;revision:number;sha256:string};
  mode:"draft"|"final";
  status:"ready"|"review_required";
  generatedAt:string;
  courtApprovalInferred:false;
  outputPurpose:"review";
  readyForElectronicFiling:false;
  officialFormParity:"not_verified";
  formContractVersion:string;
  formResults:WriterFormResult[];
  appliedEditIds:string[];
  documentEditsHash:string;
  artifactHashes:string[];
  fieldBases?:DocumentFieldBase[];
}
export interface PreparedDocumentWrite { execution:ExecutionSnapshot; receipt:DocumentWriterReceipt; }
const digest=async(value:unknown)=>{
  const bytes=new TextEncoder().encode(JSON.stringify(value));
  return [...new Uint8Array(await crypto.subtle.digest("SHA-256",bytes))].map(v=>v.toString(16).padStart(2,"0")).join("");
};
type DocEditState={id:string;fieldId:string;rowId:string|null;kind:"prose"|"layout";baseValue:string;value:string;artifactId:string;actor:string;reason:string;at:string};
export function stableFormRowIds(group:string,data:CaseData,execution:ExecutionSnapshot,bindings:FormBindings):string[]|null {
  const calculation=execution.assessment.calculation;
  if(group==="creditor") return calculation.debtRows.map(row=>row.id);
  if(["secured","disputed","priority","estate","assignment"].includes(group)) {
    const ids=calculation.debtRows.map(row=>row.id);
    if(group==="assignment") return ids.filter((_,index)=>bindings.rows.creditor?.[index]?.assignment_order!==MISSING_FORM_VALUE);
    return ids.filter(id=>{const debt=data.debts.find(item=>item.id===id);return !!debt&&(group==="secured"?(debt.secured==="yes"||debt.classification==="secured"):group==="disputed"?debt.classification==="disputed":group==="priority"?debt.priority==="priority":debt.classification==="estate");});
  }
  if(group==="asset") return calculation.assetRows.map(row=>row.id);
  if(group==="month") return calculation.incomeRows.map(row=>row.id);
  if(group==="attachment") return data.documents.filter(d=>d.status==="active").map(row=>row.id);
  if(["career","enforcement","prior","family"].includes(group)) {
    const prefixes=[group,`statement.${group}`,`household.${group}`];
    const index=createCaseReadIndex(data),facts=currentFacts(data,index).filter(f=>{
      const linked=f.structuredRefs!==undefined?factHasValidStructuredRefs(data,f):!!f.refs.length&&f.refs.every(ref=>validSourceRef(data,ref,index));
      return f.state!=="disputed"&&f.recognition!=="rejected"&&linked&&!f.validation.some(v=>v.severity==="error"||["UNCERTAIN_READING","NORMALIZATION_REVIEW"].includes(v.code))&&!factSourceLineageIssues(data,[f.id],index).some(code=>code!=="SOURCE_VERIFICATION_REQUIRED");
    });
    return [...new Set(facts.filter(f=>prefixes.some(prefix=>f.key.replace(/[A-Z]/g,x=>"_"+x.toLowerCase()).startsWith(prefix+"."))).map(f=>f.subjectId))];
  }
  return null;
}
function targetFor(edit:DocEditState,bindings:FormBindings,data:CaseData,execution:ExecutionSnapshot):{location:"scalar"|"row";group?:string;leaf:string;index?:number;rowIdentity?:string;value:string}|null {
  if(!edit.fieldId.includes(".")) {
    if(edit.rowId) return null;
    const value=bindings.scalars[edit.fieldId];
    return value===undefined?null:{location:"scalar",leaf:edit.fieldId,value};
  }
  const [group,...parts]=edit.fieldId.split("."),leaf=parts.join("."),rows=bindings.rows[group];
  if(!rows||!edit.rowId) return null;
  const ids=stableFormRowIds(group,data,execution,bindings);
  if(!ids) return null;
  const index=ids.indexOf(edit.rowId);
  if(index<0||index>=rows.length) return null;
  const value=rows[index]?.[leaf];
  const rowIdentity=rows[index]?.entity??rows[index]?.creditor_name??rows[index]?.label;
  return value===undefined?null:{location:"row",group,leaf,index,...(rowIdentity?{rowIdentity}:{}),value};
}
function setTarget(bindings:FormBindings,target:NonNullable<ReturnType<typeof targetFor>>,value:string):void {
  if(target.location==="scalar") bindings.scalars[target.leaf]=value;
  else bindings.rows[target.group!]![target.index!]![target.leaf]=value;
}
function editableContract(fieldId:string,kind:string):boolean {
  const contracts=Object.values(FORM_CONTRACTS).flatMap(form=>form.fields.filter(field=>field.token===fieldId));
  return contracts.length>0&&contracts.some(field=>field.kind===kind)&&!contracts.some(field=>field.kind==="source"||field.kind==="derived");
}
function replacePayloadBase(execution:ExecutionSnapshot,baseValue:string,value:string,rowId?:string,rowIdentity?:string):void {
  // Some generated appendix tables repeat a form value. Replace only exact, unambiguous rendered cells.
  const docs=execution.documentPayloads as unknown as {paragraphs:string[];tables:{rows:string[][]}[]}[];
  const matches:Array<()=>void>=[];
  for(const doc of docs){
    if(!rowId){doc.paragraphs?.forEach((current,index)=>{if(current===baseValue)matches.push(()=>{doc.paragraphs[index]=value;});});}
    doc.tables?.forEach(table=>table.rows?.forEach((row,r)=>{
      if(rowId&&!row.some(cell=>cell===rowId||!!rowIdentity&&cell===rowIdentity))return;
      row.forEach((cell,c)=>{if(cell===baseValue)matches.push(()=>{table.rows[r]![c]=value;});});
    }));
  }
  if(matches.length===1) matches[0]!();
}
function applyWorkflowEdits(data:CaseData,execution:ExecutionSnapshot):{execution:ExecutionSnapshot;appliedEditIds:string[];documentEdits:DocumentEdit[]} {
  const raw=(data.workflowState?.documentEdits??[]) as DocEditState[];
  if(!raw.length)return {execution,appliedEditIds:[],documentEdits:[]};
  const edited=structuredClone(execution),bindings=edited.formBindings as FormBindings;
  const overlays:DocumentEdit[]=[],conflicts:string[]=[],orphaned:string[]=[],appliedEditIds:string[]=[];
  // Commands append an immutable edit history. Resolve the latest value for a
  // stable field/row before merging it against the current generated bindings;
  // otherwise an earlier overlay makes the next edit look like a regeneration conflict.
  const latestByField=new Map<string,DocEditState>();
  for(const edit of raw)latestByField.set(`${edit.rowId??"$"}\u0000${edit.fieldId}`,edit);
  for(const edit of latestByField.values()){
    if(edit.kind!=="prose"&&edit.kind!=="layout")throw new Error("DOCUMENT_EDIT_SOURCE_COMMAND_REQUIRED");
    if(!editableContract(edit.fieldId,edit.kind)){
      const field=Object.values(FORM_CONTRACTS).flatMap(form=>form.fields).find(candidate=>candidate.token===edit.fieldId);
      throw new Error(field&&(field.kind==="source"||field.kind==="derived")?"DOCUMENT_EDIT_SOURCE_COMMAND_REQUIRED":"DOCUMENT_EDIT_FIELD_NOT_OVERLAYABLE");
    }
    const target=targetFor(edit,bindings,data,edited);
    if(!target){orphaned.push(edit.id);continue;}
    const rowId=edit.rowId??undefined;
    const base:DocumentEdit={fieldId:edit.fieldId,kind:edit.kind,value:edit.baseValue,...(rowId?{rowId}:{})};
    const user:DocumentEdit={...base,value:edit.value};
    const next:DocumentEdit={...base,value:target.value};
    const merged=mergeDocumentEdits([base],[user],[next]);
    if(merged.conflicts.length){conflicts.push(edit.id);continue;}
    if(merged.orphaned.length){orphaned.push(edit.id);continue;}
    for(const overlay of merged.overlays){setTarget(bindings,target,overlay.value);replacePayloadBase(edited,overlay.baseValue??target.value,overlay.value,edit.rowId??undefined,target.rowIdentity);overlays.push(overlay);appliedEditIds.push(edit.id);}
  }
  if(conflicts.length)throw new Error("DOCUMENT_EDIT_CONFLICT:"+conflicts.join(","));
  if(orphaned.length)throw new Error("DOCUMENT_EDIT_ORPHAN:"+orphaned.join(","));
  return {execution:edited,appliedEditIds,documentEdits:overlays};
}

/** Validates and prepares a document write from the current trusted, persisted evaluation. */
export async function prepareDocumentWrite(input:{data:CaseData;evaluation:DerivedEvaluationEnvelope|{status:"pending";revision:number;inputSha256:string;storageToken?:string}|null|undefined;processingComplete:boolean;mode:"draft"|"final";requiredKinds:string[];now?:string}):Promise<PreparedDocumentWrite>{
  const {data,evaluation,mode}=input;
  if(!evaluation||evaluation.status!=="complete"||!evaluation.execution)throw new Error("DOCUMENT_EVALUATION_PENDING");
  const execution=evaluation.execution;
  const referenceRelease=referenceIdentity();
  if(referenceRelease&&evaluation.referenceSha256!==referenceRelease.sha256)throw new Error("DOCUMENT_REFERENCE_RELEASE_STALE");
  if(evaluation.revision!==data.context.revision||execution.caseRevision!==data.context.revision||execution.caseId!==data.context.id)throw new Error("DOCUMENT_EVALUATION_STALE");
  const inputSha256=await digest(data);
  if(evaluation.inputSha256!==inputSha256)throw new Error("DOCUMENT_EVALUATION_INPUT_MISMATCH");
  if(!execution.formBindings||!execution.documentPayloads)throw new Error("DOCUMENT_BINDINGS_MISSING");
  if(data.referenceTest?.finalSubmissionProhibited||data.structuredTest?.mode==="assumed_extracted_synthetic"){
    if(mode==="final")throw new Error("SYNTHETIC_FINAL_PROHIBITED");
  }
  if(!execution.assessment.generationGate.canGenerateDraft)throw new Error("DOCUMENT_DRAFT_GATE_BLOCKED");
  if(mode==="final"&&(!input.processingComplete||!execution.assessment.generationGate.canFinalize))throw new Error("DOCUMENT_FINAL_REVIEW_REQUIRED");
  const edited=applyWorkflowEdits(data,execution),preparedExecution=edited.execution;
  const bindingTypes=preparedExecution.documentPayloads!.map(item=>item.kind).filter((kind):kind is keyof typeof BASIC_FORM_CODES=>!!BASIC_FORM_CODES[kind as keyof typeof BASIC_FORM_CODES]);
  const forms=[...new Set([...input.requiredKinds,...bindingTypes])].map(kind=>({kind,code:BASIC_FORM_CODES[kind as keyof typeof BASIC_FORM_CODES]})).filter((item):item is {kind:keyof typeof BASIC_FORM_CODES;code:NonNullable<typeof item.code>}=>!!item.code);
  const formResults:WriterFormResult[]=[];
  for(const {kind,code} of forms){
    const contract=FORM_CONTRACTS[code];if(!contract)throw new Error("DOCUMENT_FORM_CONTRACT_MISSING:"+code);
    const formEdits=edited.documentEdits.filter(edit=>contract.fields.some(field=>field.token===edit.fieldId));
    const preliminary=await computeDocumentIdentity({formId:code,templateHash:contract.templateHash,evaluationId:evaluation.evaluationSha256??evaluation.inputSha256,evaluationResultHash:evaluation.evaluationSha256??evaluation.inputSha256,documentEdits:formEdits,requiredKinds:input.requiredKinds,generatorVersion:FORM_CONTRACT_VERSION});
    const preflight=await evaluateDocumentPreflight({formCode:code,bindings:preparedExecution.formBindings!,identity:{evaluationId:evaluation.evaluationSha256??evaluation.inputSha256,evaluationResultHash:evaluation.evaluationSha256??evaluation.inputSha256,referenceBundleHash:evaluation.referenceSha256??"",templateHash:contract.templateHash,documentEditsHash:preliminary.documentEditsHash},mode,contract});
    if(mode==="final"&&preflight.blockers.length)throw new Error("DOCUMENT_PREFLIGHT_BLOCKED:"+JSON.stringify({formCode:code,blockers:preflight.blockers}));
    const parentArtifactId=data.exportManifest?.files.find(file=>file.kind===kind&&file.status==="current")?.id??null;
    const identity=await computeDocumentIdentity({formId:code,templateHash:contract.templateHash,formContractHash:preflight.contractHash,evaluationId:evaluation.evaluationSha256??evaluation.inputSha256,evaluationResultHash:evaluation.evaluationSha256??evaluation.inputSha256,documentEdits:formEdits,requiredKinds:input.requiredKinds,generatorVersion:FORM_CONTRACT_VERSION,parentArtifactId});
    formResults.push({artifactKind:kind,formCode:code,templateHash:contract.templateHash,formContractHash:preflight.contractHash,documentEditsHash:identity.documentEditsHash,artifactIdentityHash:identity.artifactIdentityHash,parentArtifactId,status:preflight.status,blockers:preflight.blockers,warnings:preflight.warnings,unresolved:preflight.unresolved});
  }
  const bindingsSha256=await digest({formBindings:preparedExecution.formBindings,documentPayloads:preparedExecution.documentPayloads});
  const documentEditsHash=await digest(edited.documentEdits);
  const evaluationId=evaluation.evaluationSha256??evaluation.inputSha256;
  return {execution:preparedExecution,receipt:{schemaVersion:"document-writer-receipt/2",caseId:data.context.id,caseRevision:data.context.revision,inputSha256,evaluationId,evaluationResultHash:evaluationId,generatorVersion:FORM_CONTRACT_VERSION,requiredKinds:[...input.requiredKinds],bindingsSha256,referenceRelease,mode,status:mode==="final"?"ready":"review_required",generatedAt:input.now??new Date().toISOString(),courtApprovalInferred:false,outputPurpose:"review",readyForElectronicFiling:false,officialFormParity:"not_verified",formContractVersion:FORM_CONTRACT_VERSION,formResults,appliedEditIds:edited.appliedEditIds,documentEditsHash,artifactHashes:[]}};
}

/** Attach hashes of the concrete rendered files and recompute form artifact identities after rendering. */
export async function finalizeDocumentWriterReceipt(receipt:DocumentWriterReceipt,generated:{kind:string;hash:string}[]):Promise<DocumentWriterReceipt>{
  const formResults=await Promise.all((receipt.formResults??[]).map(async form=>{
    const artifactHashes=generated.filter(file=>file.kind===form.artifactKind).map(file=>file.hash).sort();
    if(!artifactHashes.length)throw new Error("DOCUMENT_RENDERER_ARTIFACT_MISSING:"+form.artifactKind);
    const identity=await computeDocumentIdentity({formId:form.formCode,templateHash:form.templateHash,formContractHash:form.formContractHash,evaluationId:receipt.evaluationId,evaluationResultHash:receipt.evaluationResultHash,documentEdits:[],documentEditsHashOverride:form.documentEditsHash,requiredKinds:receipt.requiredKinds,generatorVersion:receipt.generatorVersion,parentArtifactId:form.parentArtifactId,artifactHashes});
    return {...form,artifactIdentityHash:identity.artifactIdentityHash};
  }));
  return {...receipt,artifactHashes:generated.map(file=>file.hash).sort(),formResults};
}
