import test from "node:test";
import assert from "node:assert/strict";
import { createCase } from "../lib/domain.ts";
import type { CaseData, Fact } from "../lib/domain.ts";
import type { CalculationResult } from "../lib/assessment.ts";
import { buildFormBindings } from "../lib/form-mapping.ts";
import { applicantStatementForForm,sourceStatementText } from "../lib/statement-paragraphs.ts";
import { EXTRACT_INSTRUCTIONS,sourceInstructions } from "../lib/extraction.ts";

function fixture(){
  const data=createCase("Synthetic","synthetic","2026-10-27"),hash="a".repeat(64);
  const addDocument=(id:string,pages:number[])=>{
    data.documents.push({id,name:`${id}.pdf`,type:"client_statement",sha256:hash,status:"active",pages});
    for(const page of pages)data.pages.push({documentId:id,page,role:"evidence",documentType:"client_statement",text:`Synthetic statement page ${page}. Paragraph source quote ${id}-${page}.`});
  };
  const addFact=(id:string,documentId:string,page:number,record:number,value:string,quote:string,bbox?:[number,number,number,number],state:Fact["state"]="extracted")=>data.facts.push({
    id,logicalId:`${documentId}:p${page}:statement:${record}:text:paragraph:${bbox?`box-${bbox.join("-")}`:`ordinal-${id}`}`,version:1,
    subjectId:`${documentId}:p${page}:statement:${record}`,key:"statement.text",value,rawValue:value,state,recognition:"unreviewed",
    refs:[{documentId,page,quote,sourceHash:hash,...(bbox?{bbox}:{})}],validation:[],
  });
  return {data,addDocument,addFact};
}
const calculation={caseRevision:1,computedBy:"deterministic-bigint",incomeRows:[],incomeGroups:[],debtRows:[],assetRows:[],monthlyIncomeWon:null,debtPrincipalWon:null,debtInterestWon:null,totalDebtWon:null,securedDebtWon:null,unsecuredDebtWon:null,recognizedLivingCostWon:null,disposableIncomeWon:null,liquidationValueWon:null,monthlyPaymentWon:null,planTotalWon:null,presentValueWon:null,liquidationComparison:"unknown",allocations:[],traces:[],issues:[],excludedDuplicateIds:[]} as unknown as CalculationResult;

test("one source statement joins ordered paragraphs from a single page into a filing draft",()=>{
  const {data,addDocument,addFact}=fixture();addDocument("statement",[1]);
  // Deliberately reverse ledger order; source positions determine the page order.
  addFact("p2","statement",1,0,"second paragraph","Paragraph source quote statement-1.",[.1,.3,.9,.4]);
  addFact("p1","statement",1,0,"first paragraph","Paragraph source quote statement-1.",[.1,.1,.9,.2]);
  assert.equal(sourceStatementText(data),"first paragraph\n\nsecond paragraph");
  assert.equal(buildFormBindings(data,calculation).scalars.statement,"first paragraph\n\nsecond paragraph");
});

test("source statement join blocks same-area conflict and multiple record identities",()=>{
  const conflict=fixture();conflict.addDocument("statement",[1]);
  conflict.addFact("a","statement",1,0,"first reading","Paragraph source quote statement-1.",[.1,.1,.9,.2],"disputed");
  conflict.addFact("b","statement",1,0,"second reading","Paragraph source quote statement-1.",[.1,.1,.9,.2],"disputed");
  assert.equal(sourceStatementText(conflict.data),undefined);
  const records=fixture();records.addDocument("statement",[1]);
  records.addFact("a","statement",1,0,"author A text","Paragraph source quote statement-1.");
  records.addFact("b","statement",1,1,"author B text","Paragraph source quote statement-1.");
  assert.equal(sourceStatementText(records.data),undefined);
});

test("different client statement documents never get merged and a reviewer value wins",()=>{
  const {data,addDocument,addFact}=fixture();addDocument("one",[1]);addDocument("two",[1]);
  addFact("a","one",1,0,"first document text","Paragraph source quote one-1.");
  addFact("b","two",1,0,"second document text","Paragraph source quote two-1.");
  assert.equal(sourceStatementText(data),undefined);
  data.context.applicant={statement:"reviewer-entered statement"};
  assert.equal(buildFormBindings(data,calculation).scalars.statement,"reviewer-entered statement");
});

test("multi-page continuation without an explicit link is blocked; uncertain paragraph blocks the whole statement",()=>{
  const pages=fixture();pages.addDocument("statement",[1,2]);pages.addFact("a","statement",1,0,"page one","Paragraph source quote statement-1.");pages.addFact("b","statement",2,0,"page two","Paragraph source quote statement-2.");
  assert.equal(sourceStatementText(pages.data),undefined);
  const uncertain=fixture();uncertain.addDocument("statement",[1]);uncertain.addFact("a","statement",1,0,"clear paragraph","Paragraph source quote statement-1.");
  uncertain.addFact("b","statement",1,0,"unclear paragraph","Paragraph source quote statement-1.");uncertain.data.facts[1].validation=[{code:"UNCERTAIN_READING",message:"synthetic uncertainty",severity:"warning"}];
  assert.equal(sourceStatementText(uncertain.data),undefined);
});

test("automatic text comes from the current ledger while explicit context text, even an exact quote, remains authoritative",()=>{
  const {data,addDocument,addFact}=fixture();addDocument("statement",[1]);
  addFact("current","statement",1,0,"old paragraph","Paragraph source quote statement-1.");
  assert.equal(applicantStatementForForm(data),"old paragraph");
  data.facts[0].state="retracted";assert.equal(applicantStatementForForm(data),undefined);
  data.facts.push({...data.facts[0],id:"replacement",logicalId:"replacement",version:1,supersedes:undefined,state:"extracted",value:"new paragraph",rawValue:"new paragraph",refs:[{documentId:"statement",page:1,quote:"Paragraph source quote statement-1.",sourceHash:"a".repeat(64)}]});
  assert.equal(applicantStatementForForm(data),"new paragraph");
  data.context.applicant={statement:"new paragraph"};assert.equal(applicantStatementForForm(data),"new paragraph");
  data.context.applicant={statement:"reviewer-written text"};assert.equal(applicantStatementForForm(data),"reviewer-written text");
});

test("client statement route receives the three-evidence applicant-role rule without weakening the global restriction",()=>{
  const route=sourceInstructions("client_statement");
  for(const item of ["작성 주체","1인칭","서명/날인","unreviewed","채무잔액증명서","대리/제3자"])assert.ok(route.includes(item),`route missing ${item}`);
  assert.ok(EXTRACT_INSTRUCTIONS.includes("person.role=applicant"));assert.ok(EXTRACT_INSTRUCTIONS.includes("세 근거"));
});
