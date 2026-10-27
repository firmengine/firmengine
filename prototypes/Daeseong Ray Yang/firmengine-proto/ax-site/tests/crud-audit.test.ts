import test from "node:test";
import assert from "node:assert/strict";
import { createCase,currentFacts } from "../lib/domain.ts";
import { upsertObject } from "../lib/object-editor.ts";

const source={documentId:"doc",page:1,quote:"합성 증빙"};
function fixture(){const data=createCase("CRUD 합성 검사");data.documents=[{id:"doc",name:"synthetic.pdf",sha256:"a".repeat(64),status:"active",pages:[1]}];data.pages=[{documentId:"doc",page:1,role:"evidence",text:"합성 증빙"}];return data;}
const debt={creditor:"합성은행",principal:"1000",interest:"0",secured:"no",classification:"ordinary",asOf:"2026-10-27"};

test("금액을 빈칸으로 정정하면 과거 원금 사실을 철회하고 명시적 0 이자는 보존한다",()=>{
  const added=upsertObject(fixture(),"debts",debt,source,"최초 입력","tester"),id=added.debts[0].id;
  const old=currentFacts(added).find(f=>f.key==="debt.principal")!;
  const edited=upsertObject(added,"debts",{...debt,id,principal:""},source,"원금 미확인으로 정정","tester");
  assert.equal(edited.debts[0].principal?.amountWon,null);
  assert.equal(currentFacts(edited).some(f=>f.key==="debt.principal"),false);
  assert.equal(edited.facts.find(f=>f.supersedes===old.id)?.state,"retracted");
  assert.equal(currentFacts(edited).find(f=>f.key==="debt.interest")?.numeric?.amountWon,"0");
  assert.equal(added.debts[0].principal?.amountWon,"1000");
});

test("잘못된 유형·달력 날짜·분모·지분을 다른 값으로 바꾸어 저장하지 않는다",()=>{
  assert.throws(()=>upsertObject(fixture(),"incomes",{kind:"bogus"},source,"입력","tester"),/목록/);
  assert.throws(()=>upsertObject(fixture(),"assets",{kind:"bogus"},source,"입력","tester"),/목록/);
  assert.throws(()=>upsertObject(fixture(),"debts",{...debt,asOf:"2026-02-30"},source,"입력","tester"),/실제 날짜/);
  assert.throws(()=>upsertObject(fixture(),"incomes",{kind:"wage",periodMonths:"0"},source,"입력","tester"),/허용 범위/);
  assert.throws(()=>upsertObject(fixture(),"assets",{kind:"cash",ownershipBps:"10001"},source,"입력","tester"),/허용 범위/);
  assert.throws(()=>upsertObject(fixture(),"incomes",{kind:"wage",periodMonths:"1e1"},source,"입력","tester"),/정수/);
  assert.throws(()=>upsertObject(fixture(),"incomes",{kind:"wage",periodStart:"2026-02-01",periodEnd:"2026-01-01"},source,"입력","tester"),/종료일/);
});

test("다른 사건이나 철회된 항목 ID는 새 항목으로 다시 생성하지 않는다",()=>{
  assert.throws(()=>upsertObject(fixture(),"debts",{...debt,id:"foreign-id"},source,"입력","tester"),/현재 사건/);
});

test("편집 화면에 없는 거래 잔액·연결 사실을 수정 시 지우지 않는다",()=>{
  const raw={date:"2026-10-27",accountId:"synthetic",counterparty:"상대방",amount:"1000",direction:"in",kind:"income"};
  const added=upsertObject(fixture(),"transactions",raw,source,"입력","tester"),id=added.transactions[0].id;
  added.transactions[0].relatedObjectId="linked-income";
  added.facts.push({id:"balance",logicalId:"balance",version:1,subjectId:id,key:"transaction.balance",value:"10000",state:"verified",recognition:"accepted",refs:[source],validation:[]});
  added.transactions[0].factIds.push("balance");
  const edited=upsertObject(added,"transactions",{...raw,id,counterparty:"수정 적요"},source,"적요 정정","tester");
  assert.equal(currentFacts(edited).find(f=>f.id==="balance")?.value,"10000");
  assert.ok(edited.transactions[0].factIds.includes("balance"));
  assert.equal(edited.transactions[0].relatedObjectId,"linked-income");
});

test("소득 지급자 ID는 원문 사실로 보존하고 중복·구성 판단은 별도 기록한다",()=>{
  const raw={kind:"wage",label:"합성 급여",employer:"합성회사",payerIdentityId:"test-business-001",net:"2000",amountBasis:"monthly",recurring:"yes",periodStart:"2026-01-01",periodEnd:"2026-01-31"};
  const data=fixture();data.context.incomePeriodReviewed=true;
  const added=upsertObject(data,"incomes",raw,source,"원문 지급자와 금액 기록","tester");
  assert.equal(added.incomes[0].payerIdentityId,"test-business-001");
  assert.equal(added.incomes[0].aggregationReviewed,false);
  assert.equal(added.context.incomePeriodReviewed,false);
  assert.equal(currentFacts(added).find(f=>f.key==="income.payer_identity_id")?.value,"test-business-001");
  const review={...raw,id:added.incomes[0].id,aggregationTreatment:"component",aggregationReviewed:"yes",aggregationReviewReason:"동일 명세서의 기본급과 별도 수당 항목임을 확인"};
  const edited=upsertObject(added,"incomes",review,source,"구성 관계 확인","tester");
  assert.equal(edited.incomes[0].aggregationReviewed,true);
  assert.equal(edited.incomes[0].aggregationTreatment,"component");
  assert.equal(currentFacts(edited).some(f=>/aggregation/i.test(f.key)),false);
  const changed=upsertObject(edited,"incomes",{...raw,id:edited.incomes[0].id,net:"2500"},source,"금액 정정","tester");
  assert.equal(changed.incomes[0].aggregationReviewed,false);
  assert.equal(changed.incomes[0].recognition,"unreviewed");
  assert.throws(()=>upsertObject(fixture(),"incomes",{...raw,aggregationTreatment:"unknown",aggregationReviewed:"yes",aggregationReviewReason:"사유"},source,"입력","tester"),/판단 근거/);
  assert.throws(()=>upsertObject(fixture(),"incomes",{...raw,aggregationTreatment:"duplicate",aggregationReviewed:"yes"},source,"입력","tester"),/판단 근거/);
});
