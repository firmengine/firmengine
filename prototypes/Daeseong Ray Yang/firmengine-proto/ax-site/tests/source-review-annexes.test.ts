import test from "node:test";
import assert from "node:assert/strict";
import { buildCourtPackage } from "../lib/exports.ts";
import { writeOfficePackage } from "../lib/office-writer.ts";
import * as XLSX from "xlsx";
import { strFromU8, unzipSync } from "fflate";
import { createCase, createCaseReadIndex, DRAFT_RULESET, normalizeMoney, type CaseData, type Fact, type Transaction } from "../lib/domain.ts";
import { scanTransactions } from "../lib/transaction-review.ts";
import { transactionSourceAnnex } from "../lib/source-review-annexes.ts";

const hash="a".repeat(64);
function fixture():CaseData{
  const data=createCase("Synthetic source review","synthetic-source-review","2026-10-27");
  data.documents=[{id:"doc",name:"synthetic-statement.pdf",sha256:hash,status:"active",pages:[1]}];
  data.pages=[{documentId:"doc",page:1,role:"evidence",text:"Synthetic statement evidence"}];
  return data;
}
function fact(data:CaseData,id:string,subjectId:string,key:string,value:string,opts:{numeric?:boolean;recognition?:Fact["recognition"];version?:number;state?:Fact["state"];page?:number;quote?:string;logicalId?:string}={}):Fact{
  const quote=opts.quote??`${key} ${value}${opts.numeric?"원":""}`;
  const page=data.pages.find(item=>item.page===(opts.page??1))!;
  page.text=`${page.text??""} | ${quote}`;
  const row:Fact={id,logicalId:opts.logicalId??id,version:opts.version??1,subjectId,key,value,rawValue:value,...(opts.numeric?{numeric:normalizeMoney(value,"원")}:{ }),state:opts.state??"verified",recognition:opts.recognition??"unreviewed",refs:[{documentId:"doc",page:opts.page??1,sourceHash:hash,quote}],validation:[]};
  data.facts.push(row);return row;
}
function transaction(data:CaseData,id:string,amount:string):Transaction{
  const tx:Transaction={id,date:"2026-10-01",accountId:"synthetic-account",kind:"unknown",direction:"out",amount:normalizeMoney(amount,"원"),factIds:[]};
  for(const [key,value,numeric] of [["transaction.amount",amount,true],["transaction.date",tx.date,false],["transaction.direction",tx.direction,false],["transaction.kind","unknown",false],["transaction.account_id",tx.accountId!,false],["transaction.counterparty","Synthetic counterparty",false],["transaction.memo","Synthetic transaction memo",false]] as const)tx.factIds.push(fact(data,`${id}-${key}`,id,key,value,{numeric}).id);
  data.transactions.push(tx);return tx;
}

test("four unreviewed transaction source rows appear in court evidence and workbook without totals",()=>{
  const data=fixture();
  for(let n=1;n<=4;n++)transaction(data,`transaction-${n}`,String(n*100));
  const review=scanTransactions(data);
  assert.equal(data.transactions.length,4);assert.equal(review.coverage.unresolvedRowCount,4);
  assert.equal(review.totals.inputComplete,false);assert.equal(review.totals.inflowWon,null);assert.equal(review.totals.outflowWon,null);
  const pack=buildCourtPackage(data,DRAFT_RULESET);
  const evidence=pack.documents.find(document=>document.kind==="evidence_index")!;
  const annex=evidence.tables.find(table=>table.title.includes("거래 관측·검토 요약"))!;
  const sourceRows=evidence.tables.find(table=>table.title.includes("거래 원문 인용·행 연결"))!;
  const canonical=transactionSourceAnnex(data,createCaseReadIndex(data));
  const workbook=pack.workbook.find(sheet=>sheet.name==="거래원문검토")!;
  assert.equal(annex.rows.length,4);assert.equal(workbook.rows.length,6);
  for(let n=1;n<=4;n++){
    const row=annex.rows.find(value=>value[0]===`T${String(n).padStart(3,"0")}`)!;
    assert.ok(row[2]!.includes(`${n*100} 원`));assert.match(row[3]!,/Synthetic transaction memo/);assert.match(row[3]!,/인정 전/);
    const provenance=sourceRows.rows.find(value=>value[0]!.startsWith(`T${String(n).padStart(3,"0")} / source ID: transaction-${n}`))!;
    assert.ok(provenance[1]!.includes(`transaction.amount ${n*100}원`));
    const full=canonical.rows.find(value=>value[0]===`transaction-${n}`)!;
    assert.equal(full[6],"synthetic-account");assert.equal(full[7],"Synthetic counterparty");assert.equal(full[8],"Synthetic transaction memo");
  }
  assert.ok(!annex.rows.some(row=>row[0]==="합계"));
});

test("explicitly accepting one transaction changes only that row; stale, retracted, and wrong-subject values stay held",()=>{
  const data=fixture(),accepted=transaction(data,"accepted-tx","100"),stale=transaction(data,"stale-tx","200"),retracted=transaction(data,"retracted-tx","300"),wrong=transaction(data,"wrong-tx","400"),ambiguous=transaction(data,"ambiguous-tx","500");
  for(const id of accepted.factIds){const f=data.facts.find(item=>item.id===id)!;f.recognition="accepted";}
  const oldAmount=data.facts.find(item=>item.id===stale.factIds[0])!;
  data.facts.push({...structuredClone(oldAmount),id:"stale-tx-amount-v2",version:2,supersedes:oldAmount.id,value:"250",rawValue:"250",numeric:normalizeMoney("250","원")});
  const oldRetracted=data.facts.find(item=>item.id===retracted.factIds[0])!;
  data.facts.push({...structuredClone(oldRetracted),id:"retracted-tx-amount-v2",version:2,supersedes:oldRetracted.id,state:"retracted"});
  const wrongAmount=data.facts.find(item=>item.id===wrong.factIds[0])!;wrongAmount.subjectId="another-transaction-row";
  fact(data,"ambiguous-tx-amount-conflict","ambiguous-tx","transaction.amount","501",{numeric:true});
  fact(data,"candidate-only-amount","candidate-only-tx","transaction.amount","900",{numeric:true});
  const review=scanTransactions(data);
  assert.equal(review.coverage.usableAmountAndSourceCount,1);assert.equal(review.totals.inflowWon,null);assert.equal(review.totals.outflowWon,null);
  const annex=transactionSourceAnnex(data,createCaseReadIndex(data));
  assert.match(annex.rows.find(row=>row[0]==="accepted-tx")![10]!,/원문·인정 검토 완료/);
  assert.equal(annex.rows.find(row=>row[0]==="stale-tx")![2],"[값·단위 검토 보류]");
  assert.equal(annex.rows.find(row=>row[0]==="retracted-tx")![2],"[현재 연결 대조 필요]");
  assert.match(annex.rows.find(row=>row[0]==="wrong-tx")![9]!,/wrong-subject/);
  assert.equal(annex.rows.find(row=>row[0]==="wrong-tx")![2],"[관측 없음]");
  assert.equal(annex.rows.find(row=>row[0]==="ambiguous-tx")![2],"[상충·선택 보류]");
  const untypedCandidate=annex.rows.find(row=>row[0]==="candidate-only-tx")!;
  assert.equal(untypedCandidate[1],"typed 거래 미생성·원문 후보");assert.match(untypedCandidate[9]!,/인정 전/);
});

test("an unresolved current amount alternative blocks an otherwise accepted transaction amount",()=>{
  const data=fixture(),tx=transaction(data,"alternative-tx","100");
  for(const id of tx.factIds)data.facts.find(item=>item.id===id)!.recognition="accepted";
  fact(data,"alternative-current","alternative-tx","transaction.amount","101",{numeric:true,state:"reported"});
  const annex=transactionSourceAnnex(data,createCaseReadIndex(data));
  const row=annex.rows.find(item=>item[0]==="alternative-tx")!;
  assert.equal(row[2],"[값·단위 검토 보류]");assert.match(row[10]!,/검토 전|보류/);
});

test("verified facts with unresolved validation findings cannot fall back to a clean alias",()=>{
  const data=fixture(),tx=transaction(data,"validation-conflict-tx","100");
  for(const id of tx.factIds)data.facts.find(item=>item.id===id)!.recognition="accepted";
  const conflict=fact(data,"validation-conflict-alias","validation-conflict-tx","transaction.amount","100",{numeric:true});
  conflict.validation=[{code:"FIELD_CONFLICT",message:"Synthetic unresolved field conflict",severity:"warning"}];
  const annex=transactionSourceAnnex(data,createCaseReadIndex(data));
  const row=annex.rows.find(item=>item[0]==="validation-conflict-tx")!;
  assert.equal(row[2],"[값·단위 검토 보류]");assert.match(row[10]!,/원문 충돌·보류/);
});

test("amount display requires Fact.value, raw numeric value, source unit, numeric unit, and quote to agree",()=>{
  const data=fixture(),tx=transaction(data,"numeric-mismatch-tx","100");
  const amount=data.facts.find(item=>item.id===tx.factIds[0])!;
  amount.sourceUnit="원";
  amount.numeric={...amount.numeric!,rawValue:"999",amountWon:"999"};
  const row=transactionSourceAnnex(data,createCaseReadIndex(data)).rows.find(item=>item[0]==="numeric-mismatch-tx")!;
  assert.equal(row[2],"[값·단위 검토 보류]");

  const unitMismatch=fixture(),unitTx=transaction(unitMismatch,"unit-mismatch-tx","100"),unitFact=unitMismatch.facts.find(item=>item.id===unitTx.factIds[0])!;
  unitFact.sourceUnit="천원";
  const unitRow=transactionSourceAnnex(unitMismatch,createCaseReadIndex(unitMismatch)).rows.find(item=>item[0]==="unit-mismatch-tx")!;
  assert.equal(unitRow[2],"[값·단위 검토 보류]");
});

test("source-only guarantee facts appear by their own subject without creating a debt or converting a limit",()=>{
  const data=fixture();
  fact(data,"guarantee-role","guarantee-only-row","debt.liability_role","guarantor");
  fact(data,"guarantee-beneficiary","guarantee-only-row","debt.guarantee_beneficiary","Synthetic beneficiary");
  fact(data,"guarantee-limit","guarantee-only-row","debt.guarantee_limit","500000",{numeric:true});
  fact(data,"other-party-name","unrelated-person-row","person.name","Other synthetic person");
  const pack=buildCourtPackage(data,DRAFT_RULESET);
  assert.equal(data.debts.length,0);
  const creditors=pack.documents.find(document=>document.kind==="creditors")!;
  const annex=creditors.tables.find(table=>table.title.includes("보증·연대 원문 관측"))!;
  const workbook=pack.workbook.find(sheet=>sheet.name==="보증원문검토")!;
  assert.equal(annex.rows.length,3);assert.equal(workbook.rows.length,5);
  assert.ok(annex.rows.every(row=>row[0]==="guarantee-only-row"));
  const limit=annex.rows.find(row=>row[1]==="debt.guarantee_limit")!;
  assert.equal(limit[2],"500000 원");assert.match(limit[3]!,/산입 판단은 채권별 명세·검토기록/);assert.equal(limit[4],"[이 표에서 합계·한도 미산출]");
  assert.ok(!JSON.stringify(annex.rows).includes("Other synthetic person"));
  assert.equal(pack.assessment.calculation.debtRows.length,0);
});

test("conflicting or retracted guarantee source fields are held and never select a first value",()=>{
  const data=fixture();
  fact(data,"limit-a","same-guarantee-row","debt.guarantee_limit","500000",{numeric:true});
  fact(data,"limit-b","same-guarantee-row","debt.guarantee_limit","600000",{numeric:true});
  const role=fact(data,"role-current","same-guarantee-row","debt.liability_role","guarantor");
  data.facts.push({...structuredClone(role),id:"role-retracted",version:2,supersedes:role.id,state:"retracted"});
  const pack=buildCourtPackage(data,DRAFT_RULESET);
  const annex=pack.documents.find(document=>document.kind==="creditors")!.tables.find(table=>table.title.includes("보증·연대 원문 관측"))!;
  assert.ok(annex.rows.filter(row=>row[1]==="debt.guarantee_limit").every(row=>row[2]==="[상충·선택 보류]"));
  assert.equal(annex.rows.find(row=>row[1]==="debt.liability_role")![2],"[값·근거 보류]");
  assert.ok(annex.rows.find(row=>row[1]==="debt.liability_role")![5]!.includes("현재 사실 없음·철회"));
});

test("guarantee limit units and numeric source metadata are part of field conflict identity",()=>{
  const data=fixture();
  const first=fact(data,"unit-limit-a","unit-guarantee-row","debt.guarantee_limit","500000",{numeric:true});first.sourceUnit="원";
  const second=fact(data,"unit-limit-b","unit-guarantee-row","debt.guarantee_limit","500000",{numeric:true,quote:"보증한도 500000천원"});
  second.sourceUnit="천원";second.numeric=normalizeMoney("500000","천원");
  const mismatch=fact(data,"metadata-limit","metadata-guarantee-row","debt.guarantee_limit","700000",{numeric:true});
  mismatch.numeric={...mismatch.numeric!,rawValue:"900000",amountWon:"900000"};
  const annex=buildCourtPackage(data,DRAFT_RULESET).documents.find(document=>document.kind==="creditors")!.tables.find(table=>table.title.includes("보증·연대 원문 관측"))!;
  assert.ok(annex.rows.filter(row=>row[0]==="unit-guarantee-row").every(row=>row[2]==="[상충·선택 보류]"));
  assert.equal(annex.rows.find(row=>row[0]==="metadata-guarantee-row")![2],"[값·근거 보류]");
});

test("visible quote units override metadata and every amount-speaking reference must agree",()=>{
  const data=fixture();
  const suffixMismatch=fact(data,"suffix-unit-mismatch","suffix-unit-row","debt.guarantee_limit","100",{numeric:true,quote:"보증한도 100원"});
  suffixMismatch.sourceUnit="만원";suffixMismatch.numeric=normalizeMoney("100","만원");
  const refsConflict=fact(data,"conflicting-reference","reference-conflict-row","debt.guarantee_limit","100",{numeric:true});
  refsConflict.refs.push({documentId:"doc",page:1,sourceHash:hash,quote:"보증한도 200원"});
  const withinQuote=fact(data,"multiple-amounts","multiple-amount-row","debt.guarantee_limit","100",{numeric:true,quote:"보증한도 100원, 보증한도 200원"});
  const annex=buildCourtPackage(data,DRAFT_RULESET).documents.find(document=>document.kind==="creditors")!.tables.find(table=>table.title.includes("보증·연대 원문 관측"))!;
  for(const subject of ["suffix-unit-row","reference-conflict-row","multiple-amount-row"]){
    assert.equal(annex.rows.find(row=>row[0]===subject)![2],"[값·근거 보류]",subject);
  }
  assert.equal(suffixMismatch.numeric?.unit,"만원");assert.ok(refsConflict.refs.length===2);assert.ok(withinQuote);
});

test("a parenthetical prefix unit is accepted only when it agrees with the normalized source amount",()=>{
  const data=fixture();
  const amount=fact(data,"prefix-unit-limit","prefix-unit-row","debt.guarantee_limit","100",{numeric:true,quote:"보증한도(만원) 100"});
  amount.sourceUnit="만원";amount.numeric=normalizeMoney("100","만원");
  const annex=buildCourtPackage(data,DRAFT_RULESET).documents.find(document=>document.kind==="creditors")!.tables.find(table=>table.title.includes("보증·연대 원문 관측"))!;
  assert.equal(annex.rows[0]![2],"100 만원");assert.match(annex.rows[0]![5]!,/인정 전/);
});

test("amount labels reject malformed numeric and unsupported currency tails instead of accepting a numeric prefix",()=>{
  for(const [subject,quote] of [
    ["foreign-dollar-word","보증한도 100달러"],
    ["malformed-decimal-tail","보증한도 100.0.6원"],
    ["foreign-dollar-code","보증한도 100USD"],
    ["unknown-currency-code","보증한도 100 CHF"],
    ["currency-code-after-won","보증한도 100원 CADX"],
    ["numeric-range","보증한도 100-200원"],
    ["numeric-fraction","보증한도 100/200원"],
    ["won-currency-symbol","보증한도 100₩"],
    ["one-letter-code-u","보증한도 100원 U"],
    ["one-letter-code-a","보증한도 100원 A"],
    ["unicode-currency-unit","보증한도 100円"],
  ] as const){
    const data=fixture();
    fact(data,`bad-token-${subject}`,subject,"debt.guarantee_limit","100",{numeric:true,quote});
    const pack=buildCourtPackage(data,DRAFT_RULESET);
    const annex=pack.documents.find(document=>document.kind==="creditors")!.tables.find(table=>table.title.includes("보증·연대 원문 관측"))!;
    const row=annex.rows.find(item=>item[0]===subject)!;
    assert.ok(row.some(cell=>cell.includes("보류")||cell.includes("확인 필요")),`${quote} must remain held`);
    assert.ok(!row.includes("100 원"),`${quote} must not render a normalized 100원 value`);
  }
});

test("a recognized unit can be followed by spaced Korean source prose",()=>{
  const data=fixture();fact(data,"amount-with-korean-prose","korean-prose-row","debt.guarantee_limit","100",{numeric:true,quote:"보증한도 100원 지급 완료"});
  const annex=buildCourtPackage(data,DRAFT_RULESET).documents.find(document=>document.kind==="creditors")!.tables.find(table=>table.title.includes("보증·연대 원문 관측"))!;
  assert.equal(annex.rows.find(row=>row[0]==="korean-prose-row")![2],"100 원");
});

test("a delimited single amount cell is accepted only with same-subject matching direction evidence",()=>{
  const data=fixture(),tx=transaction(data,"delimited-valid-row","12500");
  const amount=data.facts.find(item=>item.id===tx.factIds[0])!;
  amount.refs[0]!.quote="2026-10-01 | 출금 | 12,500원 | synthetic memo";
  data.pages[0]!.text+=` | ${amount.refs[0]!.quote}`;
  let row=transactionSourceAnnex(data,createCaseReadIndex(data)).rows.find(item=>item[0]===tx.id)!;
  assert.equal(row[2],"12500 원");

  const mismatch=fixture(),mismatchTx=transaction(mismatch,"delimited-direction-mismatch","12500");
  const mismatchAmount=mismatch.facts.find(item=>item.id===mismatchTx.factIds[0])!;
  mismatchAmount.refs[0]!.quote="2026-10-01 | 입금 | 12,500원 | synthetic memo";
  mismatch.pages[0]!.text+=` | ${mismatchAmount.refs[0]!.quote}`;
  row=transactionSourceAnnex(mismatch,createCaseReadIndex(mismatch)).rows.find(item=>item[0]===mismatchTx.id)!;
  assert.equal(row[2],"[값·단위 검토 보류]");

  const crossSubject=fixture(),crossTx=transaction(crossSubject,"delimited-cross-subject-direction","12500");
  const crossAmount=crossSubject.facts.find(item=>item.id===crossTx.factIds[0])!,foreignDirection=crossSubject.facts.find(item=>item.id===crossTx.factIds[2])!;
  crossAmount.refs[0]!.quote="2026-10-01 | 출금 | 12,500원 | synthetic memo";
  crossSubject.pages[0]!.text+=` | ${crossAmount.refs[0]!.quote}`;
  foreignDirection.subjectId="different-row";
  row=transactionSourceAnnex(crossSubject,createCaseReadIndex(crossSubject)).rows.find(item=>item[0]===crossTx.id)!;
  assert.equal(row[2],"[값·단위 검토 보류]");
});

test("delimited amount rows can retain source-proven Korean dates and numeric memo counters",()=>{
  for(const [id,date] of [["delimited-korean-row","2026년 10월 1일"],["delimited-iso-row","2026-10-01"]] as const){
    const data=fixture(),tx=transaction(data,id,"12500"),quote=`${date} | 출금 | 12,500원 | 관리비 2회`;
    for(const factId of tx.factIds){const rowFact=data.facts.find(item=>item.id===factId)!;rowFact.refs[0]!.quote=quote;}
    data.pages[0]!.text+=` | ${quote}`;
    const row=transactionSourceAnnex(data,createCaseReadIndex(data)).rows.find(item=>item[0]===tx.id)!;
    assert.equal(row[2],"12500 원");assert.equal(row[3],"2026-10-01");assert.equal(row[8],"Synthetic transaction memo");
  }
});

test("delimited transaction amounts hold on extra monetary cells, malformed amount cells, and ambiguous direction cells",()=>{
  const quotes=[
    "2026-10-01 | 출금 | 12,500원 | 잔액 90,000원",
    "2026-10-01 | 출금 | 12,500원 | 90000",
    "2026-10-01 | 출금 | 12,500-13,000원 | synthetic memo",
    "2026-10-01 | 입금 | 출금 | 12,500원 | synthetic memo",
  ];
  for(const [index,quote] of quotes.entries()){
    const data=fixture(),tx=transaction(data,`delimited-invalid-${index}`,"12500");
    const amount=data.facts.find(item=>item.id===tx.factIds[0])!;
    amount.refs[0]!.quote=quote;data.pages[0]!.text+=` | ${quote}`;
    const row=transactionSourceAnnex(data,createCaseReadIndex(data)).rows.find(item=>item[0]===tx.id)!;
    assert.equal(row[2],"[값·단위 검토 보류]",quote);
  }
});

test("a delimited amount cannot borrow direction evidence from a different page or a retracted current competitor",()=>{
  const otherPage=fixture(),pageTx=transaction(otherPage,"delimited-other-page-direction","12500");
  otherPage.documents[0]!.pages.push(2);
  otherPage.pages.push({documentId:"doc",page:2,role:"evidence",text:"Synthetic other page direction"});
  const pageAmount=otherPage.facts.find(item=>item.id===pageTx.factIds[0])!,pageDirection=otherPage.facts.find(item=>item.id===pageTx.factIds[2])!;
  pageAmount.refs[0]!.quote="2026-10-01 | 출금 | 12,500원 | synthetic memo";otherPage.pages[0]!.text+=` | ${pageAmount.refs[0]!.quote}`;
  pageDirection.refs=[{documentId:"doc",page:2,sourceHash:hash,quote:"transaction.direction out"}];
  let row=transactionSourceAnnex(otherPage,createCaseReadIndex(otherPage)).rows.find(item=>item[0]===pageTx.id)!;
  assert.equal(row[2],"[값·단위 검토 보류]");

  const retracted=fixture(),retractedTx=transaction(retracted,"delimited-retracted-direction","12500");
  const retractedAmount=retracted.facts.find(item=>item.id===retractedTx.factIds[0])!;
  retractedAmount.refs[0]!.quote="2026-10-01 | 출금 | 12,500원 | synthetic memo";retracted.pages[0]!.text+=` | ${retractedAmount.refs[0]!.quote}`;
  const direction=retracted.facts.find(item=>item.id===retractedTx.factIds[2])!;
  retracted.facts.push({...structuredClone(direction),id:"retracted-direction-current",logicalId:"retracted-direction-current",version:1,state:"retracted"});
  row=transactionSourceAnnex(retracted,createCaseReadIndex(retracted)).rows.find(item=>item[0]===retractedTx.id)!;
  assert.equal(row[2],"[값·단위 검토 보류]");
});

test("malformed source field keys are held safely at the export boundary",()=>{
  const data=fixture();fact(data,"malformed-guarantee-key","malformed-row","debt.guarantee_limit(","100",{numeric:true});
  const annex=buildCourtPackage(data,DRAFT_RULESET).documents.find(document=>document.kind==="creditors")!.tables.find(table=>table.title.includes("보증·연대 원문 관측"))!;
  assert.equal(annex.rows[0]![2],"[값·근거 보류]");assert.match(annex.rows[0]![5]!,/검증 필요/);
});

test("guarantee source annex preserves same-subject context and neutral text alongside a reviewed include decision",()=>{
  const data=fixture();
  const limit=fact(data,"reviewed-guarantee-limit","reviewed-guarantee-row","debt.guarantee_limit","500000",{numeric:true});
  fact(data,"reviewed-underlying","reviewed-guarantee-row","debt.underlying_debt_id","underlying-contract");
  fact(data,"reviewed-creditor","reviewed-guarantee-row","debt.creditor","Synthetic creditor");
  fact(data,"reviewed-debtor","reviewed-guarantee-row","debt.debtor","Synthetic debtor");
  fact(data,"reviewed-contract","reviewed-guarantee-row","debt.contract_id","synthetic-guarantee-contract");
  fact(data,"unrelated-person-name","person-row","person.name","Unrelated synthetic name");
  data.debts=[{id:"reviewed-guarantee-debt",creditor:"Synthetic creditor",contractId:"synthetic-guarantee-contract",principal:normalizeMoney("100"),interest:normalizeMoney("0"),secured:"no",classification:"ordinary",priority:"ordinary",legalReview:"accepted",asOf:"2026-10-27",factIds:[limit.id],guaranteeDetails:{liabilityRole:"guarantor",claimNature:"fixed",underlyingDebtId:"underlying-contract",recourseStatus:"unpaid",capTreatment:"include",capTreatmentReviewed:true,reviewReason:"Synthetic reviewed decision",sourceGuaranteeLimit:normalizeMoney("500000"),sourceGuaranteeAmount:null}}];
  const pack=buildCourtPackage(data,DRAFT_RULESET);
  const creditors=pack.documents.find(document=>document.kind==="creditors")!;
  const annex=creditors.tables.find(table=>table.title.includes("보증·연대 원문 관측"))!;
  assert.deepEqual(new Set(annex.rows.map(row=>row[1])),new Set(["debt.guarantee_limit","debt.underlying_debt_id","debt.creditor","debt.debtor","debt.contract_id"]));
  assert.ok(annex.rows.every(row=>row[0]==="reviewed-guarantee-row"));
  assert.ok(annex.rows.every(row=>row[3]!.includes("산입 판단은 채권별 명세·검토기록")));
  assert.ok(!JSON.stringify(annex.rows).includes("Unrelated synthetic name"));
  const typedWorkbook=pack.workbook.find(sheet=>sheet.name==="보증연대 검토")!;
  assert.ok(typedWorkbook.rows.some(row=>row.some(cell=>cell.value==="include")));
});

test("office package writes both new source annexes into their assigned DOCX files and workbook",async()=>{
  const data=fixture();transaction(data,"office-tx","100");
  fact(data,"office-limit","office-guarantee-row","debt.guarantee_limit","500000",{numeric:true});
  const files=await writeOfficePackage({data,rules:DRAFT_RULESET,mode:"draft"});
  const evidence=files.find(file=>file.kind==="evidence_index")!,creditors=files.find(file=>file.kind==="creditors")!;
  assert.ok(strFromU8(unzipSync(evidence.bytes)["word/document.xml"]!).includes("거래 관측·검토 요약"));
  assert.ok(strFromU8(unzipSync(creditors.bytes)["word/document.xml"]!).includes("보증·연대 원문 관측"));
  const workbookFile=files.find(file=>file.kind==="review_workbook")!;
  const workbook=XLSX.read(workbookFile.bytes,{type:"array",cellFormula:true});
  assert.ok(workbook.Sheets["거래원문검토"]);assert.ok(workbook.Sheets["보증원문검토"]);
  const evidenceXml=strFromU8(unzipSync(evidence.bytes)["word/document.xml"]!);
  const creditorXml=strFromU8(unzipSync(creditors.bytes)["word/document.xml"]!);
  assert.ok(evidenceXml.includes("Synthetic transaction memo"));assert.ok(evidenceXml.includes("원문 관측·인정 전"));
  assert.ok(evidenceXml.includes("T001"));assert.ok(evidenceXml.includes("source ID: office-tx"));assert.ok(evidenceXml.includes("거래 원문 인용·행 연결"));
  assert.ok(creditorXml.includes("office-guarantee-row"));assert.ok(creditorXml.includes("500000 원"));
  const transactions=workbook.Sheets["거래원문검토"]!,guarantees=workbook.Sheets["보증원문검토"]!;
  assert.equal(transactions.C3.v,"100 원");assert.equal(transactions.J3.v,"원문 관측·인정 전");assert.ok(String(transactions.L3.v).includes("transaction.amount 100원"));
  assert.equal(guarantees.A3.v,"office-guarantee-row");assert.equal(guarantees.C3.v,"500000 원");assert.ok(String(guarantees.D3.v).includes("산입 판단은 채권별 명세·검토기록"));
});

test("a guarantee amount with an unknown unit is displayed as held rather than a usable limit",()=>{
  const data=fixture();
  const amount=fact(data,"guarantee-limit-unknown-unit","unknown-unit-guarantee","debt.guarantee_limit","500000",{numeric:true});
  amount.numeric=normalizeMoney("500000","unknown");
  const annex=buildCourtPackage(data,DRAFT_RULESET).documents.find(document=>document.kind==="creditors")!.tables.find(table=>table.title.includes("보증·연대 원문 관측"))!;
  const row=annex.rows[0]!;
  assert.equal(row[2],"[값·근거 보류]");assert.match(row[5]!,/단위·값 검증 필요/);
  assert.equal(row[4],"[이 표에서 합계·한도 미산출]");
});
