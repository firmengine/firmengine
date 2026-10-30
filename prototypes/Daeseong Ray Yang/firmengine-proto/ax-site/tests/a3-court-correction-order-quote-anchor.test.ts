import test from "node:test";
import assert from "node:assert/strict";
import {createCase,type CaseData} from "../lib/domain.ts";
import {validateCorrectionItemDraft,type CorrectionItemDraft} from "../lib/preapproval-correction-item-store.ts";

/** Fully synthetic court excerpt: not an actual party, case, order or receipt. */
const excerpt="submit the debt statement by 2026-11-09";
function fixture(input:{pageText?:string;page?:number;quote?:string}={}){
 const data=createCase("synthetic applicant","synthetic court quote", "2026-10-30");
 data.documents=[{id:"court",name:"synthetic-order.pdf",sha256:"a".repeat(64),status:"active",pages:[1,2]}];
 data.pages=[{documentId:"court",page:input.page??1,role:"evidence",text:input.pageText??excerpt}];
 data.workflowState={procedureEvents:[{id:"court-order",state:"correction_requested",actor:"court",
   courtReference:"synthetic-docket",occurredAt:"2026-10-30",recordedAt:"2026-10-30",
   reason:"synthetic source review",relatedFields:[],sourceDocumentIds:["court"],artifactIds:[]}]} as CaseData["workflowState"];
 const draft:CorrectionItemDraft={
   courtEventId:"court-order",itemNo:1,orderDocumentId:"court",orderPage:1,
   orderQuote:input.quote??excerpt,
   requiredCanonicalFieldIds:[],unmappedRequiredFieldLabels:["채무 증빙 확인"],
   requiredDocumentTypeIds:[],requiredPeriod:null,
   deadline:null,responseEventId:null,responseDocumentIds:[],receiptDocumentId:null,
   expectedCaseRevision:data.context.revision,expectedSourceDataVersion:1,
   expectedHeadId:null,reason:"법원 보정명령 원본 재확인",
 };
 return {data,draft};
}
test("staff excerpt actually present on selected court order page stays a review draft",()=>{
 const {data,draft}=fixture();
 const checked=validateCorrectionItemDraft(data,draft);
 assert.equal(checked.payload.orderQuote,excerpt);
});
test("equivalent OCR whitespace does not create a false mismatch",()=>{
 const {data,draft}=fixture({pageText:"submit the  debt statement\nby 2026-11-09"});
 assert.equal(validateCorrectionItemDraft(data,draft).payload.orderQuote,excerpt);
});
test("fabricated excerpt in an otherwise active court PDF is not source-anchored",()=>{
 const {data,draft}=fixture({quote:"A fabricated order absent from the source page"});
 assert.throws(()=>validateCorrectionItemDraft(data,draft),/CORRECTION_ORDER_QUOTE_NOT_SOURCE_ANCHORED/);
});
test("text located on another page cannot support the selected order page",()=>{
 const {data,draft}=fixture({page:2});
 assert.throws(()=>validateCorrectionItemDraft(data,draft),/CORRECTION_ORDER_QUOTE_NOT_SOURCE_ANCHORED/);
});
test("missing OCR text requires reviewed page transcription rather than fabricated quote",()=>{
 const {data,draft}=fixture({pageText:""});
 assert.throws(()=>validateCorrectionItemDraft(data,draft),/CORRECTION_ORDER_QUOTE_NOT_SOURCE_ANCHORED/);
});
test("a different page quote, although long enough, cannot be accepted as the court request",()=>{
 const {data,draft}=fixture({pageText:"only a synthetic document cover page is available"});
 assert.throws(()=>validateCorrectionItemDraft(data,draft),/CORRECTION_ORDER_QUOTE_NOT_SOURCE_ANCHORED/);
});
