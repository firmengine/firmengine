import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import baseline from "./reference-prompt-baseline.json" with { type: "json" };
import { runWithReferenceSnapshot } from "../lib/reference-context.ts";
import { REFERENCE_PROMPT_POLICIES, legalReviewInstructions, readPromptPolicyInteger, renderPromptPolicy } from "../lib/reference-prompts.ts";
import { DOC_FIELDS, EXTRACT_INSTRUCTIONS, PAGE_COMPLETENESS_INSTRUCTIONS, STATEMENT_SCOPE_RELATION_VERIFY_INSTRUCTIONS, PROMPT_VERSION } from "../lib/extraction.ts";
import { SOURCE_NATURE_INSTRUCTIONS, CLASSIFICATION_INSTRUCTIONS, CLASSIFICATION_RECOVERY_INSTRUCTIONS } from "../lib/classification-recovery.ts";
import { SOURCE_BBOX_INSTRUCTIONS, FIELD_OBSERVATION_INSTRUCTIONS } from "../lib/field-observation.ts";
import { MISSING_FIELD_REVIEW_INSTRUCTIONS } from "../lib/coverage-review.ts";
import { SOURCE_NATURE_HANDOFF_INSTRUCTIONS } from "../lib/source-nature-context.ts";
import { RECORD_CATEGORY_POLICY, RECORD_CATEGORY_POLICY_INSTRUCTIONS } from "../lib/category-contract.ts";

const sha = (value: unknown) => createHash("sha256").update(typeof value === "string" ? value : JSON.stringify(value)).digest("hex");
// Source provenance for the consultation prompt imported from 683981f9449a7b6f427ea1e2d7672b4f8516927d.
const sourceBaselines: Record<string, string> = { ...baseline.sourceFiles, "lib/intake-classifier.ts": "d642a88cbffd666a314742db4263b2cfa8b40f10e3955e513683718764889df0" };

test("the v31 rendered OCR instructions retain their exact bytes and historical version", () => {
  const values = { DOC_FIELDS, EXTRACT_INSTRUCTIONS, PAGE_COMPLETENESS_INSTRUCTIONS, STATEMENT_SCOPE_RELATION_VERIFY_INSTRUCTIONS, SOURCE_NATURE_INSTRUCTIONS, CLASSIFICATION_INSTRUCTIONS, CLASSIFICATION_RECOVERY_INSTRUCTIONS, SOURCE_BBOX_INSTRUCTIONS, FIELD_OBSERVATION_INSTRUCTIONS, MISSING_FIELD_REVIEW_INSTRUCTIONS, SOURCE_NATURE_HANDOFF_INSTRUCTIONS, RECORD_CATEGORY_POLICY, RECORD_CATEGORY_POLICY_INSTRUCTIONS };
  for (const [key, value] of Object.entries(values)) assert.equal(sha(value), baseline.renderedConstants[key as keyof typeof baseline.renderedConstants], key);
  assert.equal(PROMPT_VERSION, "luna-evidence-3.21.0");
});

test("every migrated policy has provenance and unique, explicit substitution parameters", () => {
  assert.equal(new Set(REFERENCE_PROMPT_POLICIES.map(policy => policy.id)).size, REFERENCE_PROMPT_POLICIES.length);
  for (const policy of REFERENCE_PROMPT_POLICIES) {
    assert.match(policy.id, /^prompt\./);
    assert.equal(policy.authority, "application_policy");
    assert.equal(policy.changePolicy, "human_review_required");
    assert.ok(policy.sourceBindings.length);
    for (const source of policy.sourceBindings) {
      assert.match(source.sourceSha256, /^[a-f0-9]{64}$/);
      assert.equal(source.sourceSha256, sourceBaselines[source.path]);
      assert.ok(source.line > 0);
    }
    assert.deepEqual([...new Set([...policy.template.matchAll(/\{\{([A-Za-z][A-Za-z0-9_]*)\}\}/g)].map(match => match[1]))].sort(), [...policy.placeholders].sort());
  }
});

test("substitution preserves literal source text without recursively interpreting inserted tokens", () => {
  const value = "{{value2}} $& ${globalThis.untrusted = true}";
  assert.equal(renderPromptPolicy("prompt.extraction.source_instructions", { value1: value, value2: "CATEGORY" }), value + "\nCATEGORY");
  assert.throws(() => renderPromptPolicy("prompt.extraction.source_instructions", { value1: "missing" }), /PARAMETERS_INVALID/);
  assert.throws(() => renderPromptPolicy("prompt.extraction.source_instructions", { value1: "a", value2: "b", additional: "c" }), /PARAMETERS_INVALID/);
  assert.throws(() => renderPromptPolicy("prompt.does_not_exist"), /UNKNOWN_REFERENCE_PROMPT_POLICY/);
});

test("approved request reference changes legal-review text and records its release identity", () => {
  const identity = { id: "reference-release-test", revision: 2, sha256: "a".repeat(64) };
  runWithReferenceSnapshot({ ...identity, values: { "prompt.pipeline.legal_reviewer.instructions": "검토 승인된 새로운 법률 검토 지침" } }, () => {
    assert.equal(legalReviewInstructions(), "검토 승인된 새로운 법률 검토 지침\n기준정보 판본: " + JSON.stringify(identity));
  });
});

test("a reference override cannot silently change frozen OCR contracts or operating budgets", () => {
  runWithReferenceSnapshot({ id: "test", revision: 2, sha256: "b".repeat(64), values: {
    "prompt.extraction.doc_fields.payroll": "임의 대체 문구",
    "prompt.legal_review_packet.legal_review_batch_size": 7,
  } }, () => {
    assert.throws(() => renderPromptPolicy("prompt.extraction.doc_fields.payroll"), /SAFETY_INVARIANT_LOCKED/);
    assert.throws(() => readPromptPolicyInteger("prompt.legal_review_packet.legal_review_batch_size"), /SAFETY_INVARIANT_LOCKED/);
  });
  assert.equal(readPromptPolicyInteger("prompt.legal_review_packet.legal_review_batch_size"), 6);
  assert.equal(readPromptPolicyInteger("prompt.legal_review_packet.legal_review_packet_char_budget"), 80000);
});

test("all dynamic OCR instruction branches render byte-identically to the pre-refactor production source", () => {
  // Only checked-in application expressions are executed in this isolated test.
  // Registry text and source-document contents are never evaluated as code.
  const source = readFileSync(new URL("../lib/pipeline.ts", import.meta.url), "utf8");
  const ast = ts.createSourceFile("pipeline.ts", source, ts.ScriptTarget.Latest, true);
  const expressions = new Map<string, string>();
  const names = ["extractInstructions", "extractInputText", "verifierInstructions", "verifierPromptText"];
  const visit = (node: ts.Node) => {
    if (ts.isVariableDeclaration(node) && names.includes(node.name.getText(ast)) && node.initializer) {
      expressions.set(node.name.getText(ast), ts.transpileModule("(" + node.initializer.getText(ast) + ")", { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText);
    }
    ts.forEachChild(node, visit);
  };
  visit(ast);
  assert.equal(expressions.size, names.length);
  for (const fixture of baseline.dynamicBranches) {
    const fieldContract = { family_id: "debt_certificate", canonical_type: "debt_certificate", special_findings: { flags: ["fixture"] } };
    const context = {
      renderPromptPolicy,
      EXTRACT_INSTRUCTIONS: "EXTRACT", RECORD_CATEGORY_POLICY_INSTRUCTIONS: "CATEGORY", SOURCE_BBOX_INSTRUCTIONS: "BBOX", STATEMENT_SCOPE_RELATION_VERIFY_INSTRUCTIONS: "RELATION", PAGE_COMPLETENESS_INSTRUCTIONS: "COMPLETE", MISSING_FIELD_REVIEW_INSTRUCTIONS: "MISSING", SOURCE_NATURE_HANDOFF_INSTRUCTIONS: "SOURCE_NATURE",
      fieldContract, verifierContract: fixture.family ? fieldContract : null,
      compactFamilyFieldContract: (contract: typeof fieldContract) => ({ familyId: contract.family_id, fields: ["principal"] }),
      sourceInstructions: (type: string) => "SOURCE(" + type + ")", documentGuide: (type: string) => "GUIDE(" + type + ")",
      j: { document_id: "document-fixture", page: 7, document_type: "debt_certificate", stage: fixture.stage },
      rescueImages: fixture.rescue ? [{ bbox: "0,0,1,1" }] : [], isRegionExtract: fixture.region, regionIndex: 2,
      saved: { review: { omittedRows: fixture.omitted }, regionBbox: [0, 0.5, 1, 1] },
      omissionCues: fixture.omitted ? [{ canonicalFieldId: "debt_certificate::principal", bbox: [0, 0, 1, 1] }] : [],
      sourceNatureDiagnostics: { observations: [] }, verifierInputText: '{"read":"fixture"}',
    };
    for (const name of names) {
      const rendered = vm.runInNewContext(expressions.get(name)!, context, { timeout: 1000 });
      assert.equal(sha(rendered), fixture.hashes[name as keyof typeof fixture.hashes], `${fixture.stage}/${fixture.rescue}/${fixture.region}/${fixture.omitted}/${fixture.family}: ${name}`);
    }
  }
});
