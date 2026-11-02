import test from "node:test";
import assert from "node:assert/strict";
import { listCaseLawgraphReview } from "../lib/case-lawgraph-store.ts";

const reviewId = (letter: string) => "legal-review-" + letter.repeat(64);

/** Synthetic in-memory D1 response adapter. No customer records, D1 connection or model request. */
function fixture(options: {count?: number; shift?: "head" | "revision" | "dataVersion"; noHead?: boolean} = {}) {
  let active = reviewId("a"), revision = 1, dataVersion = 3, reads = 0;
  const source = Array.from({length: options.count ?? 1203}, (_,i) => ({
    id: "field-" + String(i).padStart(6, "0"), ordinal:i, form_code:"D5106",
    artifact_kind:"creditors", token:"creditor.principal", subject_id:"debt-" + i, row_ordinal:i,
    value_json: i===0 ? JSON.stringify("0") : i===1 ? "null" : JSON.stringify(String(i)),
    value_kind:"source", source_fact_ids_json:"[]", calculation_feature_refs_json:"[]", citation_json:"null",
  }));
  const state = () => ({revision, data_version:dataVersion, calculation_run_id:"calc-a",
    calculation_data_version:dataVersion, calculation_case_revision:revision});
  const database = {
    prepare(sql: string) {
      let params: unknown[] = [];
      const statement = {
        bind(...args: unknown[]) {params=args;return statement;},
        async first<T>() {
          if (sql.startsWith("SELECT c.revision")) return state() as T;
          if (sql.startsWith("SELECT h.*,r.model")) return (options.noHead ? null : {
            review_run_id:active, data_version:dataVersion, case_revision:revision,
            calculation_run_id:"calc-a", input_sha256:"synthetic", model:"synthetic",
            status:"partial", complete:0, expected_check_ids_json:"[]", summary:"synthetic", created_at:"at",
          }) as T;
          if (sql.startsWith("SELECT COUNT(*)")) return {n:source.length} as T;
          if (sql.startsWith("SELECT review_run_id")) return (options.noHead ? null : {review_run_id:active}) as T;
          throw new Error("Unexpected first query: " + sql);
        },
        async all<T>() {
          if (sql.includes("FROM case_legal_conditions")) return {results:[] as T[]};
          if (sql.includes("FROM case_document_field_values")) {
            const limit = Number(params[1]), offset=Number(params[2]), results=source.slice(offset,offset+limit) as T[];
            reads++;
            if (reads===1 && options.shift==="head") active=reviewId("b");
            if (reads===1 && options.shift==="revision") revision++;
            if (reads===1 && options.shift==="dataVersion") dataVersion++;
            return {results};
          }
          throw new Error("Unexpected all query: " + sql);
        },
      };
      return statement;
    },
  };
  return {db:database as unknown as D1Database, setRun:(run:string)=>{active=run;}};
}

test("large legal document-field pages retain exact 0/null and all 1,203 distinct rows", async () => {
  const h=fixture(), records:string[]=[];
  let offset:number|null=0, token:string|undefined;
  while(offset!==null){
    const page=await listCaseLawgraphReview(h.db,{caseId:"synthetic",limit:500,offset,expectedReviewRunId:token});
    token=page.runId ?? undefined;
    records.push(...page.documentFields.map(row=>row.fieldValueId));
    assert.equal(page.courtApprovalInferred,false);
    assert.equal(page.canFinalize,false);
    if(offset===0) {
      assert.equal(page.documentFields[0].value,"0");
      assert.equal(page.documentFields[1].value,null);
    }
    offset=page.nextOffset as number|null;
  }
  assert.equal(records.length,1203);
  assert.equal(new Set(records).size,1203);
});

test("legal head promotion during one page rejects stale run even when revision stays unchanged", async () => {
  const h=fixture({shift:"head"});
  await assert.rejects(listCaseLawgraphReview(h.db,{caseId:"synthetic",limit:2}),/LEGAL_REVIEW_VERSION_MISMATCH/);
});

test("client-bound run token prevents cross-page legal review mixing", async () => {
  const h=fixture({count:901}), first=await listCaseLawgraphReview(h.db,{caseId:"synthetic",limit:500});
  assert.equal(first.nextOffset,500);
  h.setRun(reviewId("b"));
  await assert.rejects(listCaseLawgraphReview(h.db,{
    caseId:"synthetic",limit:500,offset:500,expectedReviewRunId:first.runId!,
  }),/LEGAL_REVIEW_VERSION_MISMATCH/);
});

test("revisions/dataVersion changes remain blocked and invalid query remains invalid", async () => {
  for(const shift of ["revision","dataVersion"] as const) {
    await assert.rejects(listCaseLawgraphReview(fixture({shift}).db,{caseId:"synthetic",limit:2}),/LEGAL_REVIEW_VERSION_MISMATCH/);
  }
  await assert.rejects(listCaseLawgraphReview(fixture().db,{caseId:"synthetic",limit:501}),/INVALID_CASE_LEGAL_REVIEW_QUERY/);
  await assert.rejects(listCaseLawgraphReview(fixture().db,{caseId:"synthetic",expectedDataVersion:4}),/LEGAL_REVIEW_VERSION_MISMATCH/);
});
