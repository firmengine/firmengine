import test from "node:test";
import assert from "node:assert/strict";
import { strFromU8, unzipSync } from "fflate";
import { AI_MODEL, applyExtraction, createCase, DRAFT_RULESET } from "../lib/domain.ts";
import type { CaseData, Fact } from "../lib/domain.ts";
import type { CalculationResult } from "../lib/assessment.ts";
import { buildFormBindings } from "../lib/form-mapping.ts";
import { writeOfficePackage } from "../lib/office-writer.ts";
import { applicantStatementForForm,sourceStatementText } from "../lib/statement-paragraphs.ts";
import { EXTRACT_INSTRUCTIONS,PROMPT_VERSION,projectPage,sourceInstructions,type PageRead } from "../lib/extraction.ts";
import { createSourceVerificationReceipts } from "../lib/source-verification.ts";

function fixture(){
  const data=createCase("Synthetic","synthetic","2026-10-27"),hash="a".repeat(64);
  const addDocument=(id:string,pages:number[])=>{
    data.documents.push({id,name:`${id}.pdf`,type:"client_statement",sha256:hash,status:"active",pages});
    for(const page of pages)data.pages.push({documentId:id,page,role:"evidence",documentType:"client_statement",text:`Synthetic statement page ${page}. Paragraph source quote ${id}-${page}. Applicant-authored statement; I request personal rehabilitation; author signed; scope: main narrative; scope: spouse narrative; scope: applicant narrative.`});
  };
  const addFact=(id:string,documentId:string,page:number,record:number,value:string,quote:string,bbox?:[number,number,number,number],state:Fact["state"]="extracted")=>data.facts.push({
    id,logicalId:`${documentId}:p${page}:statement:${record}:text:paragraph:${bbox?`box-${bbox.join("-")}`:`ordinal-${id}`}`,version:1,
    subjectId:`${documentId}:p${page}:statement:${record}`,key:"statement.text",value,rawValue:value,state,recognition:"unreviewed",
    refs:[{documentId,page,quote,sourceHash:hash,...(bbox?{bbox}:{})}],validation:[],
  });
  const authorize=(documentId:string,page:number,records:number[],scope="main narrative",anchorScope=scope)=>{
    const add=(id:string,subjectId:string,key:string,value:string,quote:string)=>{
      const read={documentType:"client_statement",complete:true,records:[{category:"statement",fields:[{key:key.slice("statement.".length),value,unit:null,quote,confidence:"clear" as const}]}]};
      const verifiedAt="2026-10-27T10:00:00.000Z";
      const [receipt]=createSourceVerificationReceipts({documentId,page,sourceHash:hash,promptVersion:PROMPT_VERSION,verifiedAt,originalRead:read,read,passes:[{kind:"verify",model:AI_MODEL,promptVersion:PROMPT_VERSION,promptHash:"c".repeat(64),verifiedAt,checks:[{recordIndex:0,fieldIndex:0,meaningStatus:"supported",status:"agrees",value,unit:null,quote}]}]});
      const fact={id,logicalId:id,version:1,subjectId,key,value,rawValue:value,state:"verified" as const,recognition:"unreviewed" as const,refs:[{documentId,page,quote,sourceHash:hash}],validation:[],sourceVerification:{...receipt,factBinding:{id,logicalId:id,version:1}}};
      data.facts.push(fact);
    };
    const anchorSubject=`${documentId}:p${page}:statement:author`;
    add(`${documentId}-${page}-author`,anchorSubject,"statement.author_role","applicant","Applicant-authored statement");
    add(`${documentId}-${page}-intent`,anchorSubject,"statement.applicant_intent","I request personal rehabilitation","I request personal rehabilitation");
    add(`${documentId}-${page}-signature`,anchorSubject,"statement.author_signature","author signed","author signed");
    add(`${documentId}-${page}-anchor-scope`,anchorSubject,"statement.author_scope",anchorScope,`scope: ${anchorScope}`);
    for(const record of records)add(`${documentId}-${page}-${record}-scope`,`${documentId}:p${page}:statement:${record}`,"statement.author_scope",scope,`scope: ${scope}`);
  };
  return {data,addDocument,addFact,authorize};
}
const calculation={caseRevision:1,computedBy:"deterministic-bigint",incomeRows:[],incomeGroups:[],debtRows:[],assetRows:[],monthlyIncomeWon:null,debtPrincipalWon:null,debtInterestWon:null,totalDebtWon:null,securedDebtWon:null,unsecuredDebtWon:null,recognizedLivingCostWon:null,disposableIncomeWon:null,liquidationValueWon:null,monthlyPaymentWon:null,planTotalWon:null,presentValueWon:null,liquidationComparison:"unknown",allocations:[],traces:[],issues:[],excludedDuplicateIds:[]} as unknown as CalculationResult;

test("same-page paragraphs across record IDs flow through the generated statement DOCX",async()=>{
  const {data,addDocument,addFact,authorize}=fixture();addDocument("statement",[1]);
  // Deliberately reverse ledger order; source positions determine the page order.
  addFact("p2","statement",1,0,"second paragraph","Paragraph source quote statement-1.",[.1,.3,.9,.4]);
  addFact("p1","statement",1,0,"first paragraph","Paragraph source quote statement-1.",[.1,.1,.9,.2]);
  // One explicit applicant-author anchor scopes contiguous paragraphs even
  // though extraction emitted distinct record IDs.
  data.facts[0].subjectId="statement:p1:statement:2";data.facts[1].subjectId="statement:p1:statement:3";
  authorize("statement",1,[2,3]);
  assert.equal(sourceStatementText(data),"first paragraph\n\nsecond paragraph");
  assert.equal(buildFormBindings(data,calculation).scalars.statement,"first paragraph\n\nsecond paragraph");
  const files=await writeOfficePackage({data,rules:DRAFT_RULESET,mode:"draft"});
  const archive=unzipSync(files.find(file=>file.kind==="statement")!.bytes);
  const xml=strFromU8(archive["word/document.xml"]);
  assert.ok(xml.includes("first paragraph"));assert.ok(xml.includes("second paragraph"));
  assert.ok(xml.indexOf("first paragraph")<xml.indexOf("second paragraph"));
});

test("other document families on the same uploaded PDF do not suppress a scoped statement draft",()=>{
  const {data,addDocument,addFact,authorize}=fixture();addDocument("mixed-bundle",[1]);
  addFact("applicant-paragraph","mixed-bundle",1,0,"synthetic applicant narrative","Paragraph source quote mixed-bundle-1.");
  authorize("mixed-bundle",1,[0]);
  data.documents[0].type="other";
  data.documents[0].pages.push(2);
  data.pages.push({documentId:"mixed-bundle",page:2,role:"evidence",documentType:"debt_certificate",text:"Synthetic debt source; unrelated extracted text quote."});
  addFact("other-family-text","mixed-bundle",2,0,"synthetic non-statement metadata","unrelated extracted text quote.");
  assert.equal(sourceStatementText(data),"synthetic applicant narrative","a debt-certificate page in the same PDF is not another applicant paragraph");
});

test("a complete page reread with changed record IDs and bboxes supersedes exact old paragraph occurrences",()=>{
  const {data,addDocument,addFact,authorize}=fixture();addDocument("statement",[1]);
  const paragraph="same paragraph after fresh OCR",quote="Applicant statement paragraph: same paragraph after fresh OCR.";
  data.pages[0].text+=` ${quote}`;
  addFact("old-paragraph","statement",1,7,paragraph,quote,[.1,.1,.9,.2]);authorize("statement",1,[7]);
  const read:PageRead={documentType:"client_statement",complete:true,warnings:[],records:[
    {category:"statement",label:"paragraph record",fields:[
      {key:"text",label:"statement paragraph",value:paragraph,unit:null,quote,bbox:[.1,.3,.9,.4],confidence:"clear"},
      {key:"author_scope",label:"statement scope",value:"main narrative",unit:null,quote:"scope: main narrative",bbox:null,confidence:"clear"},
    ]},
    {category:"statement",label:"author anchor",fields:[
      {key:"author_role",label:"author role",value:"applicant",unit:null,quote:"Applicant-authored statement",bbox:null,confidence:"clear"},
      {key:"applicant_intent",label:"petition intent",value:"I request personal rehabilitation",unit:null,quote:"I request personal rehabilitation",bbox:null,confidence:"clear"},
      {key:"author_signature",label:"signature",value:"author signed",unit:null,quote:"author signed",bbox:null,confidence:"clear"},
      {key:"author_scope",label:"statement scope",value:"main narrative",unit:null,quote:"scope: main narrative",bbox:null,confidence:"clear"},
    ]},
  ]};
  const refreshed=applyExtraction(data,projectPage(read,"statement",1,"a".repeat(64)));
  for(const fact of refreshed.facts.filter(item=>item.key.startsWith("statement.")&&item.key!=="statement.text"&&item.state!=="retracted")){
    const key=fact.key.slice("statement.".length),value=String(fact.value),factQuote=fact.refs[0].quote;
    const receiptRead={documentType:"client_statement",complete:true,records:[{category:"statement",fields:[{key,value,unit:null,quote:factQuote,confidence:"clear" as const}]}]};
    const verifiedAt="2026-10-27T10:00:00.000Z";
    const [receipt]=createSourceVerificationReceipts({documentId:"statement",page:1,sourceHash:"a".repeat(64),promptVersion:PROMPT_VERSION,verifiedAt,originalRead:receiptRead,read:receiptRead,passes:[{kind:"verify",model:AI_MODEL,promptVersion:PROMPT_VERSION,promptHash:"c".repeat(64),verifiedAt,checks:[{recordIndex:0,fieldIndex:0,meaningStatus:"supported",status:"agrees",value,unit:null,quote:factQuote}]}]});
    fact.state="verified";fact.sourceVerification={...receipt,factBinding:{id:fact.id,logicalId:fact.logicalId,version:fact.version}};
  }
  assert.ok(refreshed.facts.some(fact=>fact.state==="retracted"&&fact.reviewReason==="완전한 페이지 재추출로 이전 자동 후보 철회"&&fact.key==="statement.text"));
  assert.equal(sourceStatementText(refreshed),paragraph);
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

test("missing, scope-mismatched, mixed, or withdrawn author evidence blocks drafting",()=>{
  const missing=fixture();missing.addDocument("statement",[1]);missing.addFact("p","statement",1,0,"borrower narrative","Paragraph source quote statement-1.");
  assert.equal(sourceStatementText(missing.data),undefined,"a single record without explicit applicant evidence is not enough");
  const wrongScope=fixture();wrongScope.addDocument("statement",[1]);wrongScope.addFact("p","statement",1,0,"another narrative","Paragraph source quote statement-1.");wrongScope.authorize("statement",1,[0],"spouse narrative","applicant narrative");
  assert.equal(sourceStatementText(wrongScope.data),undefined,"applicant anchors from another explicit scope cannot authorize this paragraph");
  const mixed=fixture();mixed.addDocument("statement",[1]);mixed.addFact("a","statement",1,0,"applicant narrative","Paragraph source quote statement-1.");mixed.addFact("b","statement",1,1,"second author's narrative","Paragraph source quote statement-1.");mixed.authorize("statement",1,[0,1]);
  const applicantAnchor=mixed.data.facts.find(fact=>fact.key==="statement.author_role")!;
  mixed.data.facts.push({...applicantAnchor,id:"other-author",logicalId:"other-author",version:1,value:"spouse",rawValue:"spouse",state:"extracted",sourceVerification:undefined,validation:[{code:"UNCERTAIN_READING",message:"synthetic uncertain competing author",severity:"warning"}]});
  assert.equal(sourceStatementText(mixed.data),undefined,"conflicting source author roles block a mixed page");
  const withdrawnCompeting=fixture();withdrawnCompeting.addDocument("statement",[1]);withdrawnCompeting.addFact("p","statement",1,0,"statement text","Paragraph source quote statement-1.");withdrawnCompeting.authorize("statement",1,[0]);
  const role=withdrawnCompeting.data.facts.find(fact=>fact.key==="statement.author_role")!;
  withdrawnCompeting.data.facts.push({...role,id:"withdrawn-spouse-role",logicalId:"withdrawn-spouse-role",version:1,value:"spouse",rawValue:"spouse",state:"retracted"});
  assert.equal(sourceStatementText(withdrawnCompeting.data),undefined,"a latest retracted competing author anchor is not silently discarded");
  const withdrawn=fixture();withdrawn.addDocument("statement",[1]);withdrawn.addFact("p","statement",1,0,"statement text","Paragraph source quote statement-1.");withdrawn.authorize("statement",1,[0]);
  withdrawn.data.facts.find(fact=>fact.key==="statement.author_signature")!.state="retracted";
  assert.equal(sourceStatementText(withdrawn.data),undefined,"withdrawn signature evidence cannot authorize drafting");
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
  const {data,addDocument,addFact,authorize}=fixture();addDocument("statement",[1]);
  addFact("current","statement",1,0,"old paragraph","Paragraph source quote statement-1.");
  authorize("statement",1,[0]);
  assert.equal(applicantStatementForForm(data),"old paragraph");
  data.facts[0].state="retracted";assert.equal(applicantStatementForForm(data),undefined);
  data.facts.push({...data.facts[0],id:"replacement",logicalId:data.facts[0].logicalId,version:2,supersedes:data.facts[0].id,state:"extracted",value:"new paragraph",rawValue:"new paragraph",refs:[{documentId:"statement",page:1,quote:"Paragraph source quote statement-1.",sourceHash:"a".repeat(64)}]});
  assert.equal(applicantStatementForForm(data),"new paragraph");
  data.context.applicant={statement:"new paragraph"};assert.equal(applicantStatementForForm(data),"new paragraph");
  data.context.applicant={statement:"reviewer-written text"};assert.equal(applicantStatementForForm(data),"reviewer-written text");
});

test("client statement route receives explicit author-scope and three-evidence rules without weakening global restrictions",()=>{
  const route=sourceInstructions("client_statement");
  for(const item of ["작성 주체","1인칭","서명/날인","unreviewed","채무잔액증명서","대리/제3자"])assert.ok(route.includes(item),`route missing ${item}`);
  assert.ok(EXTRACT_INSTRUCTIONS.includes("person.role=applicant"));assert.ok(EXTRACT_INSTRUCTIONS.includes("세 근거"));
  assert.ok(route.includes("statement.author_scope"));assert.ok(route.includes("statement.author_signature"));
});
