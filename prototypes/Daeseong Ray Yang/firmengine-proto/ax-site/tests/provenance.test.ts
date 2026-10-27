import test from "node:test";
import assert from "node:assert/strict";
import {createCase} from "../lib/domain.ts";
import {buildExportProvenance} from "../lib/export-provenance.ts";

test("업로드·대기 페이지와 정답 페이지는 실제 추출 입력으로 주장하지 않는다",()=>{
  const data=createCase("합성 입력범위");
  data.documents=[{id:"source",name:"synthetic.pdf",sha256:"a".repeat(64),status:"active",pages:[1,2,3,4]}];
  data.pages=[1,2,3,4].map(page=>({documentId:"source",page,role:page===4?"filed_form":"evidence"}));
  const rows=[
    {documentId:"source",page:1,role:"evidence",status:"completed",stage:"completed",hasStoredRead:true},
    {documentId:"source",page:2,role:"evidence",status:"review_required",stage:"completed",hasStoredRead:true},
    {documentId:"source",page:3,role:"evidence",status:"pending",stage:"extract",hasStoredRead:false},
    {documentId:"source",page:4,role:"evidence",status:"completed",stage:"completed",hasStoredRead:true},
  ];
  const result=buildExportProvenance(data,rows);
  assert.equal(result.source_sha256,"a".repeat(64));
  assert.deepEqual(result.evidence_pages_used,[1,2]);
  assert.equal(result.evidence_pages_expected,3);
  assert.equal(result.evidence_pages_read,2);
  assert.equal(result.evidence_pages_completed,1);
  assert.deepEqual(result.sources[0].heldOutPages,[4]);
  assert.deepEqual(buildExportProvenance(data).evidence_pages_used,[]);
});

test("서로 다른 원본의 같은 페이지번호를 하나의 PDF인 것처럼 합치지 않는다",()=>{
  const data=createCase("합성 여러 원본");
  data.documents=["a","b"].map(id=>({id,name:id+".pdf",sha256:id.repeat(64),status:"active",pages:[1]}));
  data.pages=["a","b"].map(documentId=>({documentId,page:1,role:"evidence"}));
  const result=buildExportProvenance(data,["a","b"].map(documentId=>({documentId,page:1,role:"evidence",status:"completed",stage:"completed",hasStoredRead:true})));
  assert.equal(result.source_sha256,null);
  assert.deepEqual(result.evidence_pages_used,[]);
  assert.equal(result.sources.length,2);
  assert.equal(result.evidence_pages_read,2);
});
