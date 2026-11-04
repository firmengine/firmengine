import { test } from "node:test";
import assert from "node:assert/strict";
import { canRegisterCaseEvidence } from "../lib/evidence-registration-boundary.ts";

test("ordinary case may register evidence, including explicit absence of fixture flags", () => {
  assert.equal(canRegisterCaseEvidence({}), true);
  assert.equal(canRegisterCaseEvidence({structuredTest:undefined,referenceTest:undefined,evaluationClone:undefined}), true);
});

test("structured test, reference test, or evaluation clone individually prohibits evidence registration", () => {
  const structuredTest={mode:"assumed_extracted_synthetic",sourceRecords:[]};
  const referenceTest={mode:"synthetic_reference_only"};
  const evaluationClone={sourceCaseId:"synthetic",sourceInputSha256:"a".repeat(64),createdAt:"2026-10-31T00:00:00Z",finalSubmissionProhibited:true};
  // This intentionally tests each flag in isolation, not only the common structured-test clone.
  assert.equal(canRegisterCaseEvidence({structuredTest} as never),false);
  assert.equal(canRegisterCaseEvidence({referenceTest} as never),false);
  assert.equal(canRegisterCaseEvidence({evaluationClone}),false);
  assert.equal(canRegisterCaseEvidence({referenceTest,evaluationClone} as never),false);
  assert.equal(canRegisterCaseEvidence({structuredTest,evaluationClone} as never),false);
});
