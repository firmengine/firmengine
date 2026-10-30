import test from "node:test";
import assert from "node:assert/strict";
import {exactSourceCalendarMonth,buildFormBindings} from "../lib/form-mapping.ts";
import {stableFormRowIds} from "../lib/document-writer.ts";
import {createCase,normalizeMoney,DRAFT_RULESET} from "../lib/domain.ts";
import {calculateCase} from "../lib/assessment.ts";
import {evaluateDocumentPreflight} from "../lib/document-preflight.ts";
import {FORM_CONTRACTS} from "../lib/form-contracts.ts";
test("only one complete calendar month can become one D5103 monthly row",()=>{
 assert.equal(exactSourceCalendarMonth("2026-02-01","2026-02-28","period_total"),"2026-02");
 assert.equal(exactSourceCalendarMonth("2026-10-01","2026-10-31","monthly"),"2026-10");
 assert.equal(exactSourceCalendarMonth("2026-01-01","2026-12-31","period_total"),null);
 assert.equal(exactSourceCalendarMonth("2026-10-15","2026-10-31","period_total"),null);
 assert.equal(exactSourceCalendarMonth("2026-02-01","2026-02-30","monthly"),null);
 assert.equal(exactSourceCalendarMonth("2026-02-01","2026-02-28","unknown"),null);
});
const identity={evaluationId:"audit",evaluationResultHash:"a".repeat(64),referenceBundleHash:"b".repeat(64),
 templateHash:FORM_CONTRACTS.D5103.templateHash,documentEditsHash:"c".repeat(64)};
test("D5103 final copy cannot use a twelve-month total as a single monthly line",async()=>{
 const z=await evaluateDocumentPreflight({formCode:"D5103",mode:"final",identity,
  bindings:{scalars:{client_name:"Applicant"},rows:{month:[{entity:"Business",period:"2026-01-01 ~ 2026-12-31",net_income:"12000000"}]}}});
 assert.ok(z.blockers.some(b=>b.code==="D5103_MONTH_EVIDENCE_UNRESOLVED"));
});
test("D5103 unverified one-month income stays a warning for drafts, not fabricated as zero",async()=>{
 const z=await evaluateDocumentPreflight({formCode:"D5103",mode:"draft",identity,
  bindings:{scalars:{client_name:"Applicant"},rows:{month:[{entity:"Business",period:"[확인 필요]",net_income:"[확인 필요]"}]}}});
 assert.ok(z.warnings.some(w=>w.code==="D5103_MONTH_EVIDENCE_UNRESOLVED"));
});

test("D5103 table and stable edit row IDs follow the calculator's post-dedup incomeRows",()=>{
 const d=createCase("deduplicated source","month-row-dedupe","2026-10-27");
 d.incomes=[
  {id:"A",kind:"wage",label:"A",net:normalizeMoney("100"),amountBasis:"period_total",periodStart:"2026-09-01",periodEnd:"2026-09-30",factIds:[]},
  {id:"B",kind:"wage",label:"A duplicate",net:normalizeMoney("100"),amountBasis:"period_total",periodStart:"2026-09-01",periodEnd:"2026-09-30",factIds:[]}
 ];
 const base=calculateCase(d,DRAFT_RULESET);
 assert.equal(base.incomeRows.length,2);
 const calculation={...base,incomeRows:base.incomeRows.slice(0,1)};
 const bindings=buildFormBindings(d,calculation);
 assert.equal(bindings.rows.month.length,1);
 assert.equal(bindings.rows.month[0].period,"2026-09");
 assert.deepEqual(stableFormRowIds("month",d,{assessment:{calculation}} as any,bindings),["A"]);
});
