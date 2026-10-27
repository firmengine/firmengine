import test from "node:test";
import assert from "node:assert/strict";
import { createCase, normalizeMoney, type Debt } from "../lib/domain.ts";
import { resolveDebtRows } from "../lib/debt-resolution.ts";

function fixture(issuers: (string | null)[], contract = "LOAN-1001") {
  const data = createCase();
  data.documents = [{id:"doc",name:"synthetic",sha256:"a".repeat(64),status:"active",pages:[1,2]}];
  data.pages = [1,2].map(page=>({documentId:"doc",page,role:"evidence" as const}));
  data.debts = issuers.map((issuer,index) => {
    const id="loan-"+index, ids:string[]=[];
    for (const [key,value] of [["debt.contract_id",contract],...(issuer?[["debt.creditor_identity_id",issuer]]:[])]) {
      const fid=id+":"+key; ids.push(fid);
      data.facts.push({id:fid,logicalId:fid,version:1,subjectId:id,key,value,state:"extracted",recognition:"unreviewed",refs:[{documentId:"doc",page:index+1,quote:key+" "+value,sourceHash:"a".repeat(64)}],validation:[]});
    }
    return {id,creditor:"동명 금융기관",contractId:contract,principal:normalizeMoney("1000000"),interest:normalizeMoney("0"),asOf:"2026-10-27",secured:"no",classification:"ordinary",factIds:ids} as Debt;
  });
  return data;
}

test("같은 계약번호와 같은 채권자명만으로 서로 다른 원문 채무를 합치지 않는다",()=>{
  const result=resolveDebtRows(fixture([null,null]));
  assert.equal(result.rows.length,2);assert.deepEqual(result.duplicates,[]);
  assert.ok(result.issues.some(x=>x.startsWith("DEBT_IDENTITY_AMBIGUOUS")));
});
test("서로 다른 발행기관의 같은 계약번호는 두 채무로 보존한다",()=>{
  const result=resolveDebtRows(fixture(["ISSUER-1001","ISSUER-2002"]));
  assert.equal(result.rows.length,2);assert.deepEqual(result.duplicates,[]);assert.deepEqual(result.issues,[]);
});
test("발행기관·완전계약번호·값·시점이 같은 반복 관측은 한 번 합산하고 모든 사실 근거를 잇는다",()=>{
  const data=fixture(["ISSUER-1001","ISSUER-1001"]),result=resolveDebtRows(data);
  assert.equal(result.rows.length,1);assert.deepEqual(result.duplicates,["loan-1"]);
  assert.deepEqual(new Set(result.rows[0].factIds),new Set(data.debts.flatMap(d=>d.factIds)));
});
test("계약번호 중간의 XX 마스킹을 동일 계약의 증거로 쓰지 않는다",()=>{
  const result=resolveDebtRows(fixture(["ISSUER-1001","ISSUER-1001"],"123XX456"));
  assert.equal(result.rows.length,2);assert.equal(result.duplicates.length,0);assert.ok(result.issues.length);
});
test("현재 원문 지문 또는 식별자 인용이 맞지 않으면 발행기관 식별이 성립하지 않는다",()=>{
  const data=fixture(["ISSUER-1001","ISSUER-1001"]);data.facts[3].refs[0].sourceHash="b".repeat(64);
  assert.equal(resolveDebtRows(data).duplicates.length,0);
  data.facts[3].refs[0].sourceHash="a".repeat(64);data.facts[3].refs[0].quote="기관명이 생략된 다른 문장";
  assert.equal(resolveDebtRows(data).duplicates.length,0);
});
test("같은 채권의 보증책임·우선순위·기준일 차이는 중복으로 지워지지 않는다",()=>{
  for(const change of [{priority:"priority"},{asOf:"2026-10-26"},{excludedByReview:true,legalReview:"accepted",exclusionReason:"별도 판단"}] as Partial<Debt>[]){
    const data=fixture(["ISSUER-1001","ISSUER-1001"]);Object.assign(data.debts[1],change);
    const result=resolveDebtRows(data);assert.equal(result.rows.length,2);assert.equal(result.duplicates.length,0);
    assert.ok(result.issues.some(x=>x.startsWith("DEBT_CONTRACT_CONFLICT")));
  }
});
test("정확히 같은 사실 버전의 복제 객체는 반복 집계하지 않지만 별도 계약은 남긴다",()=>{
  const data=fixture([null]);data.debts.push({...structuredClone(data.debts[0]),id:"copy"});
  assert.equal(resolveDebtRows(data).rows.length,1);
  data.debts[1].contractId="LOAN-2002";assert.equal(resolveDebtRows(data).rows.length,2);
});
