/** Read-only D1 inventory of ACTUAL committed OCR source coverage for the active case.
 * The 693 canonical IDs are a catalog, not 693 facts guaranteed to be present.
 * This module never promotes an OCR observation to verified fact/legal acceptance.
 */
import type {CaseData} from "./domain.ts";
import canonicalIndex from "./canonical-field-id-index.json" with {type:"json"};
export const PREAPPROVAL_OCR_STORAGE_AUDIT_VERSION="preapproval-ocr-storage-audit/1" as const;
type HeadRow={documentId:string;page:number;headCaseRevision:number;sourceHash:string;stage:string;dbHash:string};
type CoverageRow={canonicalFieldId:string;schemaSlots:number;observed:number;requiresReview:number;notObservedSlots:number};
const known=new Set<string>(canonicalIndex.ids);
const blocks=<T>(rows:readonly T[],size:number)=>Array.from({length:Math.ceil(rows.length/size)},(_,i)=>rows.slice(i*size,(i+1)*size));
export async function inspectPreapprovalOcrStorage(database:D1Database,data:CaseData){
 const caseId=data.context.id,active=data.documents.filter(d=>d.status==="active");
 const sourceIds=[...new Set(active.map(d=>d.id))];
 if(sourceIds.length>500)throw Error("PREAPPROVAL_SOURCE_TOO_MANY_ACTIVE_DOCUMENTS");
 const expectedPages=active.flatMap(doc=>doc.pages.filter(pageNo=>
   !data.pages.some(page=>page.documentId===doc.id&&page.page===pageNo&&["filed_form","administrative"].includes(page.role)))
   .map(pageNo=>({documentId:doc.id,page:pageNo,sha256:doc.sha256})));
 if(expectedPages.length>6000)throw Error("PREAPPROVAL_SOURCE_TOO_MANY_ACTIVE_PAGES");
 const heads:HeadRow[]=[],coverage:CoverageRow[]=[];
 for(const ids of blocks(sourceIds,40)){
  const slots=ids.map(()=>"?").join(",");
  const clause="h.case_id=? AND h.source_document_id IN ("+slots+")";
  const headSql="SELECT h.source_document_id AS documentId,h.page,h.case_revision AS headCaseRevision,"+
    "r.source_hash AS sourceHash,r.stage AS stage,d.sha256 AS dbHash FROM case_extraction_heads h "+
    "JOIN extraction_runs r ON r.id=h.run_id JOIN documents d ON d.id=h.source_document_id "+
    "WHERE d.case_id=? AND "+clause;
  const result=(await database.prepare(headSql).bind(caseId,caseId,...ids).all<HeadRow>()).results??[];
  heads.push(...result);
  const covSql="SELECT c.canonical_field_id AS canonicalFieldId,COUNT(*) AS schemaSlots,"+
    "SUM(c.observed_count) AS observed,SUM(c.review_count) AS requiresReview,"+
    "SUM(CASE WHEN c.observation_status='not_observed_on_page' THEN 1 ELSE 0 END) AS notObservedSlots "+
    "FROM case_extraction_heads h JOIN extraction_runs r ON r.id=h.run_id "+
    "JOIN documents d ON d.id=h.source_document_id "+
    "JOIN extraction_field_coverage c ON c.run_id=r.id "+
    "WHERE d.case_id=? AND "+clause+" AND r.stage='committed' AND d.sha256=r.source_hash "+
    "GROUP BY c.canonical_field_id ORDER BY c.canonical_field_id LIMIT 2001";
  const found=(await database.prepare(covSql).bind(caseId,caseId,...ids).all<CoverageRow>()).results??[];
  if(found.length>2000)throw Error("PREAPPROVAL_SOURCE_CANONICAL_COVERAGE_TRUNCATED");
  coverage.push(...found);
 }
 const activeHash=new Map(active.map(doc=>[doc.id,doc.sha256] as const));
 const validHeads=heads.filter(h=>activeHash.get(h.documentId)===h.sourceHash && h.dbHash===h.sourceHash &&
   h.stage==="committed"&&h.headCaseRevision<=data.context.revision);
 const allValid=new Set(validHeads.map(h=>h.documentId+":"+h.page));
 const missingOrInvalidPages=expectedPages.filter(p=>!allValid.has(p.documentId+":"+p.page));
 const unexpectedOrInvalidHeads=heads.filter(h=>!validHeads.includes(h)).map(h=>({documentId:h.documentId,page:h.page,sourceHash:h.sourceHash,stage:h.stage}));
 const byId=new Map<string,{schemaSlots:number;observed:number;requiresReview:number;notObservedSlots:number}>();
 for(const row of coverage){
  const item=byId.get(row.canonicalFieldId)??{schemaSlots:0,observed:0,requiresReview:0,notObservedSlots:0};
  item.schemaSlots+=Number(row.schemaSlots);item.observed+=Number(row.observed);
  item.requiresReview+=Number(row.requiresReview);item.notObservedSlots+=Number(row.notObservedSlots);
  byId.set(row.canonicalFieldId,item);
 }
 const unknownCanonicalIds=[...byId.keys()].filter(id=>!known.has(id));
 const registeredButNotInCurrentSchema=canonicalIndex.ids.filter(id=>!byId.has(id));
 const rows=[...byId].map(([canonicalFieldId,values])=>({canonicalFieldId,...values,
  status:values.requiresReview>0?"source_review_required":
    values.observed>0?"observed_source_only":"not_observed_in_current_schema_pages"}));
 const state=!active.length?"no_active_documents":
   missingOrInvalidPages.length||unexpectedOrInvalidHeads.length||unknownCanonicalIds.length?
   "source_integrity_or_page_gap":"observed_page_coverage_only";
 return {schemaVersion:PREAPPROVAL_OCR_STORAGE_AUDIT_VERSION,caseId,caseRevision:data.context.revision,
   status:state,registeredCanonicalCount:canonicalIndex.ids.length,
   applicableCanonicalCount:rows.length,notApplicableOrNotInCurrentSchemaCount:registeredButNotInCurrentSchema.length,
   expectedEvidencePages:expectedPages.length,currentCommittedPages:validHeads.length,
   missingOrInvalidPages,unexpectedOrInvalidHeads,unknownCanonicalIds,
   sourceOnly:true as const,legalAcceptanceInferred:false as const,sourceVerificationInferred:false as const,
   byCanonicalField:rows,notInCurrentSchemaFieldIds:registeredButNotInCurrentSchema,
   note:"OCR committed page/schema coverage excludes deleted case documents. Observation/zero/not-seen do not imply legal recognition, applicability or completeness."};
}
