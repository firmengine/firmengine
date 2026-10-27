import { createCaseReadIndex, currentFacts, factSourceLineageIssues, validSourceRef } from "./domain.ts";
import type { CaseData, CaseReadIndex, Fact } from "./domain.ts";
import { documentFamily } from "./document-routing.ts";

const statementSource=(data:CaseData,fact:Fact,index:CaseReadIndex)=>{
  if(fact.key!=="statement.text"||fact.refs.length!==1)return null;
  const ref=fact.refs[0],document=data.documents.find(item=>item.id===ref.documentId),page=data.pages.find(item=>item.documentId===ref.documentId&&item.page===ref.page);
  if(!document||document.status!=="active"||!page||page.role!=="evidence"||documentFamily(page.documentType??document.type??"")!=="client_statement")return null;
  return {documentId:document.id,page:ref.page};
};
const recordIdentity=(fact:Fact)=>fact.subjectId.match(/:p\d+:statement:(\d+)$/)?.[1]??fact.subjectId;

/** A conservative draft-only join. One active client-statement document and one
 * stable record sequence must contain every paragraph; ambiguous sources stay empty. */
/** Builds a draft source transcription only; this is not a blind model check,
 * identity finding, legal recognition, or approval. */
export function sourceStatementText(data:CaseData,index:CaseReadIndex=createCaseReadIndex(data)):string|undefined{
  const facts=currentFacts(data,index),paragraphFacts=facts.filter(fact=>fact.key==="statement.text");
  const sources=paragraphFacts.map(fact=>({fact,source:statementSource(data,fact,index)})).filter((item):item is {fact:Fact;source:{documentId:string;page:number}}=>item.source!==null);
  const documentIds=[...new Set(sources.map(item=>item.source.documentId))];
  if(documentIds.length!==1||sources.length===0)return undefined;
  const sourceFacts=sources.filter(item=>item.source.documentId===documentIds[0]);
  // Page-to-page joins can cross people or separate statements in one PDF. Until
  // an explicit continuation/author link exists, populate only one page.
  if(new Set(sourceFacts.map(({source})=>source.page)).size!==1)return undefined;
  // A disputed/edited/uncited paragraph from this source prevents silently
  // producing a partial narrative that could look complete in the filing.
  if(sourceFacts.length!==paragraphFacts.filter(fact=>fact.refs.some(ref=>ref.documentId===documentIds[0])).length)return undefined;
  if(sourceFacts.some(({fact})=>fact.state==="disputed"||fact.state==="retracted"||fact.recognition==="rejected"||typeof fact.value!=="string"||!fact.value.trim()||fact.validation.some(issue=>issue.severity==="error"||["UNCERTAIN_READING","NORMALIZATION_REVIEW"].includes(issue.code))||!validSourceRef(data,fact.refs[0],index)||factSourceLineageIssues(data,[fact.id],index).some(issue=>issue!=="SOURCE_VERIFICATION_REQUIRED")))return undefined;
  const recordIds=[...new Set(sourceFacts.map(({fact})=>recordIdentity(fact)))];
  if(recordIds.length!==1)return undefined;
  const ordered=sourceFacts.map((entry,index)=>({...entry,index}));
  const pagesWithCompleteBoxes=new Set(ordered.map(item=>item.source.page).filter(page=>ordered.filter(item=>item.source.page===page).every(item=>item.fact.refs[0].bbox!==undefined)));
  ordered.sort((a,b)=>{
    if(a.source.page!==b.source.page)return a.source.page-b.source.page;
    return pagesWithCompleteBoxes.has(a.source.page)?(a.fact.refs[0].bbox![1]-b.fact.refs[0].bbox![1]||a.fact.refs[0].bbox![0]-b.fact.refs[0].bbox![0]):a.index-b.index;
  });
  return ordered.map(({fact})=>String(fact.value).trim()).join("\n\n");
}

/** Existing context text has no provenance marker, so preserve it as an
 * explicit entry. New automatic text is derived from the current ledger only. */
export function applicantStatementForForm(data:CaseData,index:CaseReadIndex=createCaseReadIndex(data)):string|undefined{
  const saved=data.context.applicant?.statement?.trim();
  return saved||sourceStatementText(data,index);
}
