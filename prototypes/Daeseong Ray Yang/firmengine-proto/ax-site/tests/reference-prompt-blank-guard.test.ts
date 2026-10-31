import test from "node:test";
import assert from "node:assert/strict";
import { runWithReferenceSnapshot } from "../lib/reference-context.ts";
import { renderPromptPolicy } from "../lib/reference-prompts.ts";

const legal="prompt.pipeline.legal_reviewer.instructions";
test("blank or whitespace-only live legal reviewer prompts cannot erase human-reviewed instructions",()=>{
  for(const candidate of ["", "  ", "\n\t"]){
    runWithReferenceSnapshot({
      id:"synthetic-reviewed-release",revision:2,sha256:"c".repeat(64),
      values:{[legal]:candidate}
    },()=>assert.throws(()=>renderPromptPolicy(legal),/REFERENCE_PROMPT_TEMPLATE_BLANK/));
  }
});
test("non-empty reviewed legal reviewer prompt remains editable",()=>{
  runWithReferenceSnapshot({
    id:"synthetic-reviewed-release",revision:2,sha256:"d".repeat(64),
    values:{[legal]:"독립 합성 법률 검토 지침"}
  },()=>assert.equal(renderPromptPolicy(legal),"독립 합성 법률 검토 지침"));
});
