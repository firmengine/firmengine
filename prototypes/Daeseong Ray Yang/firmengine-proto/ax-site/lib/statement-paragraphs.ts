import { createCaseReadIndex, currentFacts, factSourceLineageIssues, validSourceRef } from "./domain.ts";
import type { CaseData, CaseReadIndex, Fact } from "./domain.ts";
import { documentFamily } from "./document-routing.ts";
import { parseStatementScopeRelation,sameSourceQuote,sourceQuoteOccurrenceCount } from "./statement-scope-relation.ts";

const statementSource=(data:CaseData,fact:Fact,index:CaseReadIndex)=>{
  if(fact.key!=="statement.text"||fact.refs.length!==1)return null;
  const ref=fact.refs[0],document=data.documents.find(item=>item.id===ref.documentId),page=data.pages.find(item=>item.documentId===ref.documentId&&item.page===ref.page);
  if(!document||document.status!=="active"||!page||page.role!=="evidence"||documentFamily(page.documentType??document.type??"")!=="client_statement")return null;
  return {documentId:document.id,page:ref.page};
};
const statementRecord=(fact:Fact)=>fact.subjectId;
const sourceBacked=(data:CaseData,fact:Fact,index:CaseReadIndex)=>fact.state!=="disputed"&&fact.state!=="retracted"&&fact.recognition!=="rejected"&&typeof fact.value==="string"&&!!fact.value.trim()&&fact.refs.length===1&&validSourceRef(data,fact.refs[0],index)&&!fact.validation.some(issue=>issue.severity==="error"||["UNCERTAIN_READING","NORMALIZATION_REVIEW"].includes(issue.code))&&!factSourceLineageIssues(data,[fact.id],index).some(issue=>issue!=="SOURCE_VERIFICATION_REQUIRED");
const meaningVerified=(data:CaseData,fact:Fact,index:CaseReadIndex)=>fact.state==="verified"&&fact.sourceVerification?.verificationScope==="field_meaning_v1"&&factSourceLineageIssues(data,[fact.id],index).length===0;
const scopedValue=(fact:Fact)=>typeof fact.value==="string"?fact.value.normalize("NFKC").trim().toLocaleLowerCase():"";
const validBbox=(bbox:Fact["refs"][number]["bbox"]):bbox is [number,number,number,number]=>!!bbox&&bbox.length===4&&bbox.every(value=>Number.isFinite(value)&&value>=0&&value<=1)&&bbox[0]<bbox[2]&&bbox[1]<bbox[3];
const bboxOverlaps=(a:[number,number,number,number],b:[number,number,number,number])=>a[0]<b[2]&&b[0]<a[2]&&a[1]<b[3]&&b[1]<a[3];
function latestFactsIncludingRetractions(data:CaseData):Fact[]{
  const groups=new Map<string,Fact[]>();
  for(const fact of data.facts)groups.set(fact.logicalId,[...(groups.get(fact.logicalId)??[]),fact]);
  return [...groups.values()].flatMap(items=>{const version=Math.max(...items.map(fact=>fact.version));return items.filter(fact=>fact.version===version);});
}

/** A conservative draft-only join. Applicant authorship must be explicitly
 * anchored in the source, and each paragraph record must cite the same explicit
 * statement scope. A repeated name or record position never creates a link. */
/** Builds a draft source transcription only; this is not a blind model check,
 * identity finding, legal recognition, or approval. */
export function sourceStatementText(data:CaseData,index:CaseReadIndex=createCaseReadIndex(data)):string|undefined{
  const facts=currentFacts(data,index),paragraphFacts=facts.filter(fact=>fact.key==="statement.text");
  const sources=paragraphFacts.map(fact=>({fact,source:statementSource(data,fact,index)})).filter((item):item is {fact:Fact;source:{documentId:string;page:number}}=>item.source!==null);
  const documentIds=[...new Set(sources.map(item=>item.source.documentId))];
  if(documentIds.length!==1||sources.length===0)return undefined;
  const sourceFacts=sources.filter(item=>item.source.documentId===documentIds[0]);
  // Page-to-page joins can cross people or separate statements in one PDF. Keep
  // them blocked until page continuity is represented by its own verified link.
  if(new Set(sourceFacts.map(({source})=>source.page)).size!==1)return undefined;
  const page=sourceFacts[0].source.page,documentId=documentIds[0],allLatestFacts=latestFactsIncludingRetractions(data);
  const isFreshPageWithdrawal=(fact:Fact)=>fact.state==="retracted"&&fact.recognition==="rejected"&&!fact.reviewer&&fact.reviewReason==="완전한 페이지 재추출로 이전 자동 후보 철회";
  const supersededByCompleteReread=(fact:Fact):boolean=>{
    const originalValue=fact.value;
    if(!isFreshPageWithdrawal(fact)||typeof originalValue!=="string")return false;
    const ref=fact.refs.find(item=>item.documentId===documentId&&item.page===page);if(!ref)return false;
    const historicalScopes=data.facts.filter(candidate=>candidate.key==="statement.author_scope"&&candidate.subjectId===fact.subjectId&&candidate.state!=="retracted"&&candidate.refs.some(item=>item.documentId===documentId&&item.page===page));
    const oldScopes=[...new Set(historicalScopes.map(scopedValue))];if(oldScopes.length!==1||!oldScopes[0])return false;
    const sameOccurrence=(candidate:Fact)=>candidate.key===fact.key&&typeof candidate.value==="string"&&candidate.value.normalize("NFKC").trim()===originalValue.normalize("NFKC").trim()&&candidate.refs.some(item=>item.documentId===documentId&&item.page===page&&item.quote.normalize("NFKC").trim()===ref.quote.normalize("NFKC").trim());
    const replacementValid=(candidate:Fact)=>{
      if(!index.byId.has(candidate.id)||!sourceBacked(data,candidate,index)||(candidate.key!=="statement.text"&&!meaningVerified(data,candidate,index)))return false;
      const currentScopes=allLatestFacts.filter(scope=>scope.key==="statement.author_scope"&&scope.subjectId===candidate.subjectId&&scope.state!=="retracted"&&scope.refs.some(item=>item.documentId===documentId&&item.page===page));
      return currentScopes.length===1&&sourceBacked(data,currentScopes[0],index)&&meaningVerified(data,currentScopes[0],index)&&scopedValue(currentScopes[0])===oldScopes[0];
    };
    const withdrawnCount=allLatestFacts.filter(candidate=>isFreshPageWithdrawal(candidate)&&candidate.refs.some(item=>item.documentId===documentId&&item.page===page)&&sameOccurrence(candidate)).length;
    const replacementCount=allLatestFacts.filter(candidate=>candidate.state!=="retracted"&&sameOccurrence(candidate)&&replacementValid(candidate)).length;
    // A complete reread can change record IDs/bboxes. Retire its old fact only
    // when the new read independently preserves every same source occurrence;
    // absent or ambiguous text remains a blocker rather than being cherry-picked.
    return withdrawnCount>0&&replacementCount>=withdrawnCount;
  };
  const unresolvedPageWithdrawal=allLatestFacts.some(fact=>fact.key==="statement.text"&&fact.state==="retracted"&&fact.refs.some(ref=>ref.documentId===documentId&&ref.page===page)&&!supersededByCompleteReread(fact));
  if(unresolvedPageWithdrawal)return undefined;
  const sourceScopedFacts=allLatestFacts.filter(fact=>fact.key.startsWith("statement.")&&fact.refs.some(ref=>ref.documentId===documentId&&ref.page===page)&&!(fact.state==="retracted"&&supersededByCompleteReread(fact)));
  const anchors=sourceScopedFacts.filter(fact=>["statement.author_role","statement.applicant_intent","statement.author_signature"].includes(fact.key));
  const roles=anchors.filter(fact=>fact.key==="statement.author_role"),intents=anchors.filter(fact=>fact.key==="statement.applicant_intent"),signatures=anchors.filter(fact=>fact.key==="statement.author_signature");
  // Competing or malformed evidence is itself ambiguity. Do not discard it and
  // choose the remaining applicant-looking anchors.
  if(roles.length!==1||intents.length!==1||signatures.length!==1||anchors.some(fact=>!sourceBacked(data,fact,index)||!meaningVerified(data,fact,index)))return undefined;
  const role=roles[0],intent=intents[0],signature=signatures[0];
  // These source-semantic proofs are not a legal identity decision. Require the
  // three independently verified anchors to belong to one statement record.
  if(scopedValue(role)!=="applicant"||!scopedValue(intent)||!scopedValue(signature)||new Set([statementRecord(role),statementRecord(intent),statementRecord(signature)]).size!==1)return undefined;
  const anchorSubject=statementRecord(role);
  const scopeFacts=sourceScopedFacts.filter(fact=>fact.key==="statement.author_scope");
  const relationFacts=sourceScopedFacts.filter(fact=>fact.key==="statement.scope_relation");
  if(scopeFacts.some(fact=>!sourceBacked(data,fact,index)||!meaningVerified(data,fact,index)))return undefined;
  if(relationFacts.length>0&&(relationFacts.length!==1||!sourceBacked(data,relationFacts[0],index)||!meaningVerified(data,relationFacts[0],index)))return undefined;
  if(!scopeFacts.length&&!relationFacts.length)return undefined;
  const scopesByRecord=new Map<string,Fact[]>();
  for(const fact of scopeFacts)scopesByRecord.set(statementRecord(fact),[...(scopesByRecord.get(statementRecord(fact))??[]),fact]);
  const paragraphRecords=[...new Set(sourceFacts.map(({fact})=>statementRecord(fact)))];
  const scopeSubjects=new Set([...paragraphRecords,anchorSubject]);
  if(scopeFacts.length){
    if([...scopesByRecord.keys()].some(subjectId=>!scopeSubjects.has(subjectId)))return undefined;
    const scopeFor=(subjectId:string):string=>{const values=scopesByRecord.get(subjectId)??[];return values.length===1?scopedValue(values[0]):"";};
    const anchorScope=scopeFor(anchorSubject),scopeValues=paragraphRecords.map(scopeFor);
    if(!anchorScope||scopeValues.some(value=>!value)||scopeValues.some(value=>value!==anchorScope))return undefined;
  }
  // Any other statement paragraph on the same source page may belong to a
  // spouse, a second signer, or a separate section; never silently omit it.
  const allPageParagraphs=paragraphFacts.filter(fact=>fact.refs.some(ref=>ref.documentId===documentId&&ref.page===page));
  if(allPageParagraphs.length!==sourceFacts.length)return undefined;
  // sourceFacts already contains every current statement.text on this client
  // statement page. Other document families in the same uploaded PDF are not
  // narrative paragraphs and must not suppress this statement. Same-page
  // extras are checked above; additional client-statement pages were rejected
  // when selecting sourceFacts.
  if(sourceFacts.some(({fact})=>!sourceBacked(data,fact,index)))return undefined;
  const ordered=sourceFacts.map((entry,index)=>({...entry,index}));
  const pagesWithCompleteBoxes=new Set(ordered.map(item=>item.source.page).filter(page=>ordered.filter(item=>item.source.page===page).every(item=>item.fact.refs[0].bbox!==undefined)));
  ordered.sort((a,b)=>{
    if(a.source.page!==b.source.page)return a.source.page-b.source.page;
    return pagesWithCompleteBoxes.has(a.source.page)?(a.fact.refs[0].bbox![1]-b.fact.refs[0].bbox![1]||a.fact.refs[0].bbox![0]-b.fact.refs[0].bbox![0]):a.index-b.index;
  });
  if(relationFacts.length){
    const relationFact=relationFacts[0],relation=parseStatementScopeRelation(relationFact.value),sourceDocument=data.documents.find(item=>item.id===documentId),sourcePage=data.pages.find(item=>item.documentId===documentId&&item.page===page);
    if(!relation||relationFact.subjectId!==anchorSubject||!sourceDocument||relationFact.refs.length!==1||relationFact.refs[0].sourceHash!==sourceDocument.sha256||!sameSourceQuote(relationFact.refs[0].quote,relation.openingQuote))return undefined;
    const hashBound=(fact:Fact)=>fact.refs.length===1&&fact.refs[0].documentId===documentId&&fact.refs[0].page===page&&fact.refs[0].sourceHash===sourceDocument.sha256;
    const paragraphFactsInOrder=ordered.map(({fact})=>fact),memberQuotes=relation.members.map(member=>member.quote);
    const relationEvidence=[relationFact,role,intent,signature,...paragraphFactsInOrder];
    if(relationEvidence.some(fact=>fact.reviewer||fact.reviewReason||fact.recognition!=="unreviewed")||paragraphFactsInOrder.some(fact=>!hashBound(fact)||!meaningVerified(data,fact,index)||!validBbox(fact.refs[0].bbox))||!hashBound(role)||!hashBound(intent)||!hashBound(signature)||!validBbox(relationFact.refs[0].bbox)||!validBbox(role.refs[0].bbox)||!validBbox(intent.refs[0].bbox)||!validBbox(signature.refs[0].bbox)||!bboxOverlaps(relationFact.refs[0].bbox,role.refs[0].bbox))return undefined;
    if(memberQuotes.length!==paragraphFactsInOrder.length||memberQuotes.some((quote,i)=>!sameSourceQuote(quote,paragraphFactsInOrder[i].refs[0].quote)))return undefined;
    if(!sameSourceQuote(relation.openingQuote,role.refs[0].quote)||!sameSourceQuote(relation.signatureQuote,signature.refs[0].quote))return undefined;
    const firstQuote=paragraphFactsInOrder[0].refs[0].quote,lastQuote=paragraphFactsInOrder.at(-1)!.refs[0].quote,openingKey=relation.openingQuote.normalize("NFKC").replace(/\s+/g,"").toLocaleLowerCase(),closingKey=relation.closingQuote.normalize("NFKC").replace(/\s+/g,"").toLocaleLowerCase(),firstKey=firstQuote.normalize("NFKC").replace(/\s+/g,"").toLocaleLowerCase(),lastKey=lastQuote.normalize("NFKC").replace(/\s+/g,"").toLocaleLowerCase();
    if(!openingKey||!firstKey.includes(openingKey)||!closingKey||!lastKey.includes(closingKey))return undefined;
    const allQuotes=[relation.openingQuote,roles[0].refs[0].quote,intent.refs[0].quote,relation.closingQuote,relation.signatureQuote,...memberQuotes];
    if(sourcePage?.text?.trim()&&allQuotes.some(quote=>sourceQuoteOccurrenceCount(sourcePage.text!,quote)!==1))return undefined;
    const lastBox=paragraphFactsInOrder.at(-1)!.refs[0].bbox!,signatureBox=signature.refs[0].bbox!;
    if(signatureBox[1]<lastBox[3])return undefined;
  }
  return ordered.map(({fact})=>String(fact.value).trim()).join("\n\n");
}

/** Existing context text has no provenance marker, so preserve it as an
 * explicit entry. New automatic text is derived from the current ledger only. */
export function applicantStatementForForm(data:CaseData,index:CaseReadIndex=createCaseReadIndex(data)):string|undefined{
  const saved=data.context.applicant?.statement?.trim();
  return saved||sourceStatementText(data,index);
}
