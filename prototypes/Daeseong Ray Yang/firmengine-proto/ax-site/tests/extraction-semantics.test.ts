import test from "node:test";
import assert from "node:assert/strict";
import { DOC_FIELDS,EXTRACT_INSTRUCTIONS,projectPage,type PageRead,type ReadField } from "../lib/extraction.ts";
import { createSourceVerificationReceipts,sourceVerificationFieldLocation } from "../lib/source-verification.ts";

const sha="e".repeat(64);
const f=(key:string,value:string,quote:string,unit:string|null=null):ReadField=>({key,label:key,value,quote,unit,confidence:"clear",bbox:null});
function asset(fields:ReadField[],documentType="insurance"):PageRead{
  return {documentType,complete:true,warnings:[],records:[{category:"asset",label:"synthetic record",fields:[f("kind","insurance","보험"),f("label","합성보험","합성보험"),...fields]}]};
}

for(const title of ["채권자변동정보 조회서","미보유채권 현황","매각채권 현황(매각 당시 정보)","creditor_change_report"]){
  test(`${title}: 이력의 원금 열은 현재 잔액으로 승격하지 않는다`,()=>{
    const read:PageRead={documentType:title,complete:true,warnings:[],records:[{category:"debt",label:"과거 청구",fields:[f("creditor","합성은행","합성은행"),f("principal","234567","매각 당시 원금 234567원","원")]}]};
    const projected=projectPage(read,"synthetic-history",1,sha);
    assert.equal(projected.debts?.length,0);
    assert.equal(projected.facts?.length,2);
    assert.ok(projected.facts?.some(row=>row.value==="234567"));
  });
}

for(const quote of ["가입금액 40000000원","보장금액 40000000원","납입보험료 40000000원"]){
  test(`보험 ${quote.split(" ")[0]}는 해약환급금이 아니다`,()=>{
    const projected=projectPage(asset([f("gross_value","40000000",quote,"원")]),"synthetic-insurance",1,sha);
    assert.equal(projected.assets?.[0].grossValue,null);
    assert.equal(projected.facts?.find(row=>row.key==="asset.gross_value")?.numeric?.amountWon,"40000000");
    assert.ok(projected.warnings?.some(w=>w.includes("환급가치")));
  });
}

test("보험 해약환급금은 명시적 0과 원문 단위를 보존한다",()=>{
  const zero=projectPage(asset([f("refund_value","0","예상 해약환급금 0원","원")]),"synthetic-insurance",1,sha);
  assert.equal(zero.assets?.[0].grossValue?.amountWon,"0");
  const scaled=projectPage(asset([f("refund_value","245","해약환급금 245천원","천원")]),"synthetic-insurance",2,sha);
  assert.equal(scaled.assets?.[0].grossValue?.amountWon,"245000");
  const absentUnit=projectPage(asset([f("refund_value","245","해약환급금 245")]),"synthetic-insurance",3,sha);
  assert.equal(absentUnit.assets?.[0].grossValue?.amountWon,null);
});

test("실효·해지·만기는 미기재 환급금을 0으로 바꾸지 않는다",()=>{
  for(const status of ["실효","해지","만기"]){
    const p=projectPage(asset([f("contract_status",status,`계약상태 ${status}`)]),"synthetic-insurance",1,sha);
    assert.equal(p.assets?.[0].grossValue,null);
  }
});

test("채권최고액·저당설정액은 실제 상환잔액 공제로 사용하지 않는다",()=>{
  for(const title of ["채권최고액","저당설정액","근저당 설정"]){
    const p=projectPage(asset([f("secured_payoff","9000000",`${title} 9000000원`,"원")],"vehicle_registry"),"synthetic-collateral",1,sha);
    assert.equal(p.assets?.[0].securedPayoff,null);
    assert.ok(p.facts?.some(row=>row.key==="asset.secured_payoff"&&row.numeric?.amountWon==="9000000"));
  }
});

test("현재 채무증명서에서만 의미가 같은 원금·합계·채권자·잔액기준일 키를 typed projection에 연결한다",()=>{
  const read:PageRead={documentType:"채무잔액증명서",complete:true,warnings:[],records:[{category:"debt",label:"힌트",fields:[
    f("debt.creditor_name","합성은행","채권자 합성은행"),
    f("debt.principal_balance","120","현재 원금잔액 120만원","만원"),
    f("debt.total_claim","135","총 청구액 135만원","만원"),
    f("debt.as_of_date","2026-01-31","잔액기준일 2026-01-31"),f("debt.issue_date","2026-02-02","증명서 발급일 2026-02-02"),
    f("debt.original_principal","500","최초 대출원금 500만원","만원"),
    f("debt.overdue_interest","15","연체이자 15만원","만원"),
  ]}]};
  const p=projectPage(read,"synthetic-debt",1,sha),debt=p.debts?.[0];
  assert.equal(debt?.creditor,"합성은행");assert.equal(debt?.principal?.amountWon,"1200000");
  assert.equal(debt?.interest,null);assert.equal(debt?.asOf,"2026-01-31");
  assert.ok(p.facts?.some(x=>x.key==="debt.issue_date"&&x.value==="2026-02-02"));
  assert.equal(p.facts?.find(x=>x.key==="debt.principal_balance")?.numeric?.unit,"만원");
  assert.equal(p.facts?.find(x=>x.key==="debt.total_claim")?.numeric?.amountWon,"1350000");
  assert.equal(p.facts?.find(x=>x.key==="debt.original_principal")?.numeric?.amountWon,"5000000");
  assert.equal(p.facts?.find(x=>x.key==="debt.overdue_interest")?.numeric?.amountWon,"150000");
});

test("문서 라우팅은 국문·영문 증명서명을 canonical family로 안내하고 실제 제목을 별도 보존한다",()=>{
  assert.equal(DOC_FIELDS["채무잔액증명서"],DOC_FIELDS.debt_certificate);
  assert.equal(DOC_FIELDS.debt_balance_certificate,DOC_FIELDS.debt_certificate);
  assert.match(EXTRACT_INSTRUCTIONS,/document_title/);assert.match(EXTRACT_INSTRUCTIONS,/canonical family/);
});

test("현재 잔액 alias와 표준 필드가 충돌하면 원문 facts만 남기고 typed principal을 보류한다",()=>{
  const read:PageRead={documentType:"debt_balance_certificate",complete:true,warnings:[],records:[{category:"debt",label:"힌트",fields:[
    f("creditor_name","합성은행","채권자 합성은행"),f("principal","100","원금 100원","원"),f("principal_balance","90","원금잔액 90원","원"),
  ]}]};
  const p=projectPage(read,"synthetic-conflict",1,sha);
  assert.equal(p.debts?.length,0);assert.ok(p.facts?.some(x=>x.key==="debt.principal_balance"));
  assert.ok(p.warnings?.some(x=>x.includes("상충값")));
});

test("신용조회·채권이력의 원금 키는 현재 채무로 승격되지 않으며 실제 문서 제목은 별도 fact다",()=>{
  for(const type of ["credit_report","신용정보조회서","채권자변동정보 조회서","미보유채권 현황","매각 당시 정보"]){
    const read:PageRead={documentType:type,complete:true,warnings:[],records:[{category:"debt",label:"역사적 행",fields:[f("document_title",type,`문서 제목 ${type}`),f("creditor_name","합성은행","채권자 합성은행"),f("principal_balance","999","등록 원금 999만원","만원")]}]};
    const p=projectPage(read,"synthetic-history-alias",1,sha);
    assert.equal(p.debts?.length,0,type);assert.ok(p.facts?.some(x=>x.key==="credit_report.principal_balance"||x.key==="debt.principal_balance"),type);
  }
});

test("lease facts without explicit applicant role do not become rent income or owned assets",()=>{
  const incomeRead:PageRead={documentType:"lease_contract",complete:true,warnings:[],records:[{category:"income",label:"힌트",fields:[f("kind","rent","월세 수입"),f("label","임대료","임대료"),f("net","80","월 임대료 80만원","만원")] }]};
  const assetRead:PageRead={documentType:"lease",complete:true,warnings:[],records:[{category:"asset",label:"힌트",fields:[f("kind","lease_deposit","보증금"),f("label","보증금","보증금"),f("gross_value","1000","보증금 1000만원","만원")] }]};
  assert.equal(projectPage(incomeRead,"synthetic-lease",1,sha).incomes?.length,0);
  assert.equal(projectPage(assetRead,"synthetic-lease",2,sha).assets?.length,0);
  assert.ok(projectPage(assetRead,"synthetic-lease",2,sha).facts?.some(x=>x.key==="asset.gross_value"));
  incomeRead.records[0].fields.push(f("applicant_is_landlord","yes","신청인은 임대인"));
  assert.equal(projectPage(incomeRead,"synthetic-lease",3,sha).incomes?.length,1);
});

test("alias source receipts attach by exact original field location after canonical projection",()=>{
  const field=f("debt.principal_balance","120","현재 원금잔액 120만원","만원");
  const read:PageRead={documentType:"debt_certificate",complete:true,warnings:[],records:[{category:"debt",label:"힌트",fields:[f("debt.creditor_name","합성은행","채권자 합성은행"),field]}]};
  const check={recordIndex:0,fieldIndex:1,status:"agrees" as const,value:field.value,unit:field.unit,quote:"원문에 현재 원금잔액 120만원",reason:"명시됨"};
  const receipts=createSourceVerificationReceipts({documentId:"synthetic",page:1,sourceHash:sha,promptVersion:"test",verifiedAt:"2026-01-01T00:00:00.000Z",originalRead:read,read,passes:[{kind:"verify",checks:[{...check,recordIndex:0,fieldIndex:0,status:"agrees",value:"합성은행",unit:null,quote:"채권자 합성은행"},check],model:"gpt-6-luna",promptVersion:"test",promptHash:sha,verifiedAt:"2026-01-01T00:00:00.000Z"}]});
  const receipt=receipts.find(r=>r.field.key==="debt.principal_balance");assert.ok(receipt);
  assert.deepEqual(sourceVerificationFieldLocation(receipt!,read),{recordIndex:0,fieldIndex:1});
  const projected=projectPage(read,"synthetic",1,sha),raw=projected.facts?.find(x=>x.id==="synthetic:p1:debt:0:f1");
  assert.equal(raw?.key,"debt.principal_balance");assert.equal(raw?.rawValue,"120");
});
