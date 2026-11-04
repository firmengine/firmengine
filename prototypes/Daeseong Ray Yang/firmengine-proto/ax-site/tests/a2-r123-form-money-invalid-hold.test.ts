// Synthetic-only regression for A2 r123; no court approval or legal amount inferred.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../lib/form-mapping.ts", import.meta.url), "utf8");
const helper = source.match(/^const parseExactWon = [^\n]+/m)?.[0];
assert.ok(helper, "strict source money guard must exist");
const executableHelper = helper.replace("(value: unknown): bigint | null", "(value)");
const feeStart = source.indexOf("const incomeForForm =");
const feeEnd = source.indexOf("const fee =",feeStart);
assert.ok(feeStart >= 0 && feeEnd > feeStart, "actual pre-fee projection found");
const feeBlock = source.slice(feeStart,feeEnd);
const preFee = new Function("calculation", executableHelper+"\n"+feeBlock+"\nreturn beforeFee;");
const businessStart = source.indexOf("const observedBusinessTotal =");
const businessEnd = source.indexOf("for (const prefix of",businessStart);
assert.ok(businessStart >= 0 && businessEnd > businessStart, "actual business projection found");
const businessBlock = source.slice(businessStart,businessEnd).replace("reduce<bigint | null>","reduce");
const businessAmount = new Function("data","calculation","business","amount","MISSING_FORM_VALUE",
  executableHelper+"\nconst scalars={};\n"+businessBlock+"\nreturn scalars.monthly_business_income;");
const missing="[확인 필요]";
const format = (v) => typeof v==="string"&&/^-?\d+$/.test(v)?BigInt(v).toLocaleString("ko-KR"):missing;

const preFeeCases=[
  ["observed zeros","0","0","0"],["3m minus 1m","3000000","1000000","2000000"],
  ["null is unobserved",null,"1000000",null],
  ["malformed comma","1,20","1000000",null],["bad cost","2000000","BAD",null],
  ["raw suffix","0원","0",null],["negative valid integer","-500","1000","-1500"],
  ["exact BigInt beyond safe number","9007199254740993","9007199254740992","1"],
  ["numeric zero is not serialized won",0,"0",null],
];
for(const [label,income,cost,expected] of preFeeCases)
  test("D5110 before-fee: "+label,()=>{
    const actual=preFee({monthlyIncomeWon:income,recognizedLivingCostWon:cost});
    assert.equal(actual===null?null:String(actual),expected);
  });

const businessCases=[
  ["salary only",["wage"],[],"2000000",missing],
  ["observed business zero",["business"],["0"],"2000000","0"],
  ["malformed commas",["business"],["1,20"],"2000000",missing],
  ["non-numeric business amount",["business"],["BAD"],"2000000",missing],
  ["non-numeric case total",["business"],["0"],"BAD",missing],
  ["two business groups",["business","business"],["1000000","2000000"],"4000000","3,000,000"],
  ["null business observation",["business"],[null],"3000000",missing],
  ["no income groups",[],[],"0",missing],
  ["numeric business zero is not typed won",["business"],[0],"2000000",missing],
];
for(const [label,kinds,amounts,total,expected] of businessCases)
  test("D5103 business: "+label,()=>{
    const actual=businessAmount({incomes:kinds.map(kind=>({kind})),context:{inventoryComplete:{income:"yes"}}},
      {monthlyIncomeWon:total},amounts.map(monthlyObservedAverageWon=>({monthlyObservedAverageWon})),format,missing);
    assert.equal(actual,expected);
  });
