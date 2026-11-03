import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {COURT_PROCEDURE_NOTICE,procedureEventDisplayLabel} from "../lib/procedure-event-display.ts";

test("court request and amendment labels are recorded events, not court acceptance",()=>{
  assert.equal(procedureEventDisplayLabel("correction_requested","보정 요청"),"법원 보정 요청 기록(원문 검증 별도)");
  assert.equal(procedureEventDisplayLabel("amended","보정 제출"),"보정 제출 기록(접수증 검증 별도)");
});

test("other procedure states preserve the caller's existing label",()=>{
  for(const state of ["generated","human_reviewed","received","approved","unknown"])
    assert.equal(procedureEventDisplayLabel(state,"기존 표시"),"기존 표시");
});

test("UI warning explicitly separates internal candidates, court evidence, and acceptance",()=>{
  for(const phrase of ["내부 예상 보완요청은 법원 보정명령이 아닙니다","법원 사건번호·자료 ID만으로","담당자와 변호사가 별도 확인"])
    assert.ok(COURT_PROCEDURE_NOTICE.includes(phrase),phrase);
});

test("case workflow renders the warning and uses the status-specific label without changing command semantics",()=>{
  const source=readFileSync(new URL("../components/case-workflow.tsx",import.meta.url),"utf8");
  assert.ok(source.includes('import {COURT_PROCEDURE_NOTICE,procedureEventDisplayLabel} from "@/lib/procedure-event-display";'));
  assert.ok(source.includes('<p className="workflow-caution">{COURT_PROCEDURE_NOTICE}</p>'));
  assert.ok(source.includes('["correction_requested", "법원 보정 요청(담당자 기록)"]'));
  assert.ok(source.includes('procedureEventDisplayLabel(event.state,label(event.state))'));
  assert.ok(source.includes('command("procedure.record"'));
});
