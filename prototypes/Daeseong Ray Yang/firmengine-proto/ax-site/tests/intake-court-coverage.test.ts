import test from "node:test";
import assert from "node:assert/strict";
import { INTAKE_CATALOG_SEED } from "../lib/intake-catalog.ts";
import { matchIntakeChecklist, validateIntakeCatalog } from "../lib/intake-engine.ts";
import { supplementIntakeCatalog } from "../lib/intake-catalog-snapshot.ts";
import type { IntakeClaim, IntakeCatalog } from "../lib/intake-types.ts";

const catalog=()=>validateIntakeCatalog(structuredClone(INTAKE_CATALOG_SEED));
const priorOrphans=[
  "bank_statement","credit_information_report","property_ownership_search",
  "cash_holding_statement","local_tax_assessment","pension_contribution_statement",
  "household_expense_ledger","applicant_statement","application_form_input",
  "case_specific_court_request","plan_funding_statement",
  "income_household_change_evidence",
];
function claim(featureId:string,subjectId:string,state:IntakeClaim["state"]="present",temporal:IntakeClaim["temporal"]="current"):IntakeClaim {
 return {id:`synthetic-${featureId}-${subjectId}-${temporal}`,featureId,subjectId,
  subjectLabel:subjectId,basis:"client_report",state,temporal,
  refs:[{noteId:"synthetic-note",quote:`[synthetic] ${featureId}`,start:0,end:15}]};
}
function match(courtId:string,claims:IntakeClaim[]=[]){
 return matchIntakeChecklist({catalog:catalog(),courtId,asOf:"2026-10-30",claims});
}
const rows=(courtId:string,claims:IntakeClaim[]=[])=>match(courtId,claims).requirements;
const by=(courtId:string,id:string,claims:IntakeClaim[]=[])=>rows(courtId,claims).filter(x=>x.documentTypeId===id);

test("all original 85 documents are reachable from at least one active rule",()=>{
 const c=catalog();
 assert.equal(c.documents.length,85);
 const links=new Set(c.rules.filter(x=>x.enabled).flatMap(x=>x.documents.flatMap(y=>[y.documentTypeId,...y.alternatives])));
 assert.equal(c.features.length,50);
 assert.equal(c.rules.length,70);
 assert.equal(c.documents.filter(x=>!links.has(x.id)).length,0);
 for(const id of priorOrphans)assert.ok(links.has(id),id);
});

test("Seoul and Busan §402 mandatory attachment is separate from recommended documents",()=>{
 for(const courtId of ["seoul","busan"]){
  for(const id of ["property_ownership_search","local_tax_assessment","pension_contribution_statement","applicant_statement"]){
   const requested=by(courtId,id);
   assert.equal(requested.length,1,`${courtId}: ${id} must not appear twice`);
   assert.equal(requested[0].requirement,"required_when_applicable");
   assert.equal(requested[0].status,"requested");
  }
 }
 for(const id of ["property_ownership_search","local_tax_assessment","pension_contribution_statement","applicant_statement"]){
  assert.equal(by("incheon",id).length,1);
  assert.equal(by("incheon",id)[0].requirement,"recommended");
 }
 assert.equal(by("incheon","credit_information_report")[0].requirement,"recommended");
});

test("court unknown is not prematurely treated as a confirmed court requirement",()=>{
 for(const id of ["property_ownership_search","local_tax_assessment","pension_contribution_statement","applicant_statement"]){
  const matches=by("unknown",id);
  assert.equal(matches.length,1);
  assert.equal(matches[0].status,"qualification_needed");
 }
});

test("bank history is triggered by present deposits or actual past disposal; absence never triggers it",()=>{
 assert.equal(by("seoul","bank_statement").length,0);
 assert.equal(by("seoul","bank_statement",[claim("asset.deposit","asset:bank1")]).length,1);
 assert.equal(by("seoul","bank_statement",[claim("event.asset_disposal","event:sale1","present","past")]).length,1);
 assert.equal(by("seoul","bank_statement",[claim("asset.deposit","asset:none","absent")]).length,0);
 const row=by("seoul","bank_statement",[claim("asset.deposit","asset:bank1")])[0];
 assert.ok(row.period.includes("필요한 기간"));
 assert.ok(!row.period.includes("직전 1년"));
});
test("cash holding and extraordinary household expenses require grounded positive claims",()=>{
 assert.equal(by("seoul","cash_holding_statement").length,0);
 assert.equal(by("seoul","household_expense_ledger").length,0);
 assert.equal(by("seoul","cash_holding_statement",[claim("asset.cash_on_hand","asset:cash1")]).length,1);
 assert.equal(by("seoul","household_expense_ledger",[claim("expense.medical","expense:treatment")]).length,1);
 assert.equal(by("seoul","household_expense_ledger",[claim("expense.housing","expense:rent")]).length,1);
 assert.equal(by("seoul","cash_holding_statement",[claim("asset.cash_on_hand","asset:none","absent")]).length,0);
});
test("additional court request and nonstandard household or income changes are conditional",()=>{
 assert.equal(by("seoul","case_specific_court_request").length,0);
 assert.equal(by("seoul","case_specific_court_request",[claim("procedure.court_order","procedure:order")])[0].status,"legal_review");
 assert.equal(by("seoul","income_household_change_evidence").length,0);
 assert.equal(by("seoul","income_household_change_evidence",[claim("income.employment_changed","income:job")]).length,1);
 assert.equal(by("seoul","income_household_change_evidence",[claim("event.divorce","event:divorce","present","past")]).length,1);
});
test("new forms remain internally generated / pre-existing forms, never mandatory client-issued certificates",()=>{
 const c=catalog();
 for(const id of ["applicant_statement","application_form_input","plan_funding_statement"]){
  const d=c.documents.find(x=>x.id===id);
  assert.equal(d?.ocr?.collectionMode,"generated_or_prior_form");
  const requested=by("seoul",id);
  assert.equal(requested.length,1);
  assert.ok(requested[0].reason.some(x=>x.includes("담당자")));
 }
});
test("old stored catalogue adopts missing IDs in a new immutable version while preserving human edits",()=>{
 const seed=catalog(),stored: IntakeCatalog=structuredClone(seed);
 stored.version=7;
 stored.rules=stored.rules.filter(x=>!x.id.startsWith("INTAKE-0")||Number(x.id.slice(-3))<=54);
 stored.features=stored.features.filter(x=>x.id!=="asset.cash_on_hand");
 stored.rules[0].title="담당자 변경을 보존해야 하는 기존 제목";
 const before=structuredClone(stored);
 const upgraded=supplementIntakeCatalog(stored,seed);
 assert.equal(upgraded.changed,true);
 assert.equal(upgraded.catalog.version,8);
 assert.equal(upgraded.addedFeatureIds.length,1);
 assert.equal(upgraded.addedRuleIds.length,16);
 assert.equal(upgraded.catalog.rules[0].title,before.rules[0].title);
 assert.deepEqual(stored,before);
 assert.equal(supplementIntakeCatalog(upgraded.catalog,seed).changed,false);
});
