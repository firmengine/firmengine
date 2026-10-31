import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// A2 r36: source-expression isolation, not project integration or official DOCX certification.
// Read the actual form binding predicate to prevent a disconnected mock from passing.
const source = readFileSync(new URL("../lib/form-mapping.ts", import.meta.url), "utf8");
const marker = "approved_monthly_income: ";
const start = source.indexOf(marker);
assert.notEqual(start, -1, "approved_monthly_income binding exists");
const from = start + marker.length;
const end = source.indexOf(" : MISSING_FORM_VALUE,", from);
assert.ok(end > from, "binding ternary still explicitly preserves unresolved");
const expression = source.slice(from, end) + " : MISSING_FORM_VALUE";
const bind = new Function("data","calculation","factSourceLineageIssues","index","amount","MISSING_FORM_VALUE", "return (" + expression + ")");

function trial({ treatment="independent_source", reviewed=true, reason="payer verified", amount="2400000", hasPeriod=true, recognition="accepted" }={}) {
  const source = { id:"wage", recognition, factIds:["synthetic-fact"], aggregationTreatment:treatment, aggregationReviewed:reviewed, aggregationReviewReason:reason };
  const data = { context:{ inventoryComplete:{income:"yes"}, incomePeriodReviewed:true, filingPeriod:hasPeriod?{start:"2026-01-01",end:"2026-12-31"}:null }, incomes:[source] };
  const calculation = { monthlyIncomeWon:amount, incomeRows:[{id:"wage",monthlyWon:amount}] };
  return bind(data,calculation,()=>[],{},value=>value,"[확인 필요]");
}
const fixtures = [
  ["reviewed income", {}, "2400000"],
  ["classification unreviewed", {reviewed:false,reason:""}, "[확인 필요]"],
  ["review reason missing", {reviewed:true,reason:""}, "[확인 필요]"],
  ["unknown classification", {treatment:"unknown",reviewed:false,reason:""}, "[확인 필요]"],
  ["classification missing", {treatment:undefined,reviewed:false,reason:undefined}, "[확인 필요]"],
  ["reviewed explicit zero", {amount:"0"}, "0"],
  ["unreviewed explicit zero", {amount:"0",treatment:"unknown",reviewed:false,reason:""}, "[확인 필요]"],
  ["unobserved null", {amount:null}, "[확인 필요]"],
  ["no selected filing period", {hasPeriod:false}, "[확인 필요]"],
  ["legal recognition unreviewed", {recognition:"unreviewed"}, "[확인 필요]"],
];
for (const [name, input, expected] of fixtures) {
  test("A2-LAW-r36 source-expression: " + name, () => assert.equal(trial(input), expected));
}
// Does not validate 18 calculation modules, Fact lineage, SQL, complete calendar-month
// coverage, D5103 preflight, actual DOCX, or lawyer approval.
