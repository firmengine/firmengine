import test from "node:test";
import assert from "node:assert/strict";
import { createCase } from "../lib/domain.ts";
import { inspectProcessingReadiness,type StoredPageState } from "../lib/processing-readiness.ts";
function fixture(){const data=createCase();data.documents=[{id:"doc",name:"synthetic.pdf",sha256:"a".repeat(64),status:"active",pages:[1,2,3]}];data.pages=[{documentId:"doc",page:1,role:"evidence"},{documentId:"doc",page:2,role:"filed_form"},{documentId:"doc",page:3,role:"administrative"}];data.context.inventoryComplete={income:"yes",debt:"yes",asset:"yes"};return data;}
const page:StoredPageState={documentId:"doc",page:1,role:"evidence",imageReady:1,status:"completed"};
test("목록완전성을 수동 확인해도 업로드·판독 미완료 페이지는 확정되지 않는다",()=>{
  for(const status of ["awaiting_upload","pending","processing","error","review_required"]){const result=inspectProcessingReadiness(fixture(),[{id:"doc",ready:1}],[{...page,status}]);assert.equal(result.complete,false,status);assert.equal(result.completedPages,0);}
});
test("원본이 없거나 페이지 이미지가 없으면 완료 상태만으로 통과하지 않는다",()=>{
  assert.equal(inspectProcessingReadiness(fixture(),[{id:"doc",ready:0}],[page]).complete,false);
  assert.equal(inspectProcessingReadiness(fixture(),[{id:"doc",ready:1}],[{...page,imageReady:0}]).complete,false);
});
test("평가 정답·행정 페이지를 읽지 않아도 모든 증빙이 완료되면 통과한다",()=>{
  const result=inspectProcessingReadiness(fixture(),[{id:"doc",ready:1}],[page]);assert.equal(result.complete,true);assert.equal(result.evidencePages,1);assert.equal(result.completedPages,1);
});
test("역할 미확정과 현재 역할·작업 역할 충돌은 완료로 취급하지 않는다",()=>{
  const data=fixture();data.pages[0].role="unknown";assert.equal(inspectProcessingReadiness(data,[{id:"doc",ready:1}],[page]).complete,false);
  assert.equal(inspectProcessingReadiness(fixture(),[{id:"doc",ready:1}],[{...page,role:"administrative"}]).complete,false);
});
