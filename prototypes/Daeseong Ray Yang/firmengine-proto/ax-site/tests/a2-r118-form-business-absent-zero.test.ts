// Synthetic source-aware display regression only; no legal or court-form acceptance.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// Deliberately execute the actual projection expression from form-mapping.ts;
// the full CaseData calculation pipeline must be tested independently.
const source = readFileSync(new URL("../lib/form-mapping.ts", import.meta.url), "utf8");
const begin = source.indexOf("scalars.monthly_business_income = ");
assert.notEqual(begin, -1, "business income binding must exist");
const end = source.indexOf(";\\n", begin);
assert.ok(end > begin, "business income projection must terminate");
const expression = source.slice(begin, end + 1).replaceAll("monthlyObservedAverageWon!", "monthlyObservedAverageWon");
const evaluate = new Function("data", "calculation", "business", "amount", "MISSING_FORM_VALUE",
  `const scalars={}; ${expression}; return scalars.monthly_business_income;`);
const missing = "[확인 필요]";
const sample = (kinds: string[], complete: string, income: string | null, amounts: (string | null)[]) =>
  evaluate({ incomes: kinds.map(kind=>({kind})), context: { inventoryComplete: { income: complete } } },
    { monthlyIncomeWon: income }, amounts.map(monthlyObservedAverageWon=>({monthlyObservedAverageWon})),
    (value: string)=>value, missing);

for (const [title,kinds,complete,income,amounts,expected] of [
  ["salary only does not invent business zero",["salary"],"yes","2000000",[],missing],
  ["empty income list is not observed business zero",[],"yes","0",[],missing],
  ["nonverified salary-only income",["salary"],"unknown","2000000",[],missing],
  ["explicit business zero remains zero",["business"],"yes","2000000",["0"],"0"],
  ["observed business 1.5m",["salary","business"],"yes","3000000",["1500000"],"1500000"],
  ["two observed business groups sum exactly",["business","business"],"yes","3000000",["1000000","2000000"],"3000000"],
  ["business fact without calculation group",["business"],"yes","3000000",[],missing],
  ["business amount unobserved",["business"],"yes","3000000",[null],missing],
  ["case monthly income unobserved",["salary"],"yes",null,[],missing],
  ["incomplete inventory blocks business",["business"],"unknown","1000000",["1000000"],missing],
] as Array<[string,string[],string,string|null,(string|null)[],string]>) {
  test(title,()=>assert.equal(sample(kinds,complete,income,amounts),expected));
}
