import test from "node:test";
import assert from "node:assert/strict";
import { LAWGRAPH } from "../lib/lawgraph.ts";

test("all 46 scenarios have unique stable graph identities and every edge endpoint resolves",()=>{
  assert.equal(LAWGRAPH.count,46);
  assert.equal(new Set(LAWGRAPH.scenarios.map(s=>s.id)).size,46);
  assert.equal(new Set(LAWGRAPH.nodes.map(n=>n.id)).size,LAWGRAPH.nodes.length);
  const nodeIds=new Set(LAWGRAPH.nodes.map(n=>n.id));
  for(const edge of LAWGRAPH.edges){ assert.ok(nodeIds.has(edge.from),`missing edge source ${edge.from}`); assert.ok(nodeIds.has(edge.to),`missing edge target ${edge.to}`); }
  for(const s of LAWGRAPH.scenarios){
    assert.ok(LAWGRAPH.nodes.some(n=>n.id===`scenario:${s.id}`));
    assert.ok(s.nodeIds.every(id=>nodeIds.has(id)));
    const edgeIds=new Set(LAWGRAPH.edges.map(e=>e.id)); assert.ok(s.edgeIds.every(id=>edgeIds.has(id)));
  }
});

test("workflow docs compile into document → feature → target paths with field metadata",()=>{
  const doc=LAWGRAPH.nodes.find(n=>n.type==="workflow_document"&&n.metadata?.documentType==="resident_registration");
  assert.ok(doc);
  const toFeature=LAWGRAPH.edges.find(e=>e.from===doc.id&&e.type==="extracts_feature"); assert.ok(toFeature);
  const feature=LAWGRAPH.nodes.find(n=>n.id===toFeature.to); assert.equal(feature?.type,"workflow_feature");
  assert.ok("crossChecks" in (toFeature.metadata??{}));
  assert.ok(LAWGRAPH.edges.some(e=>e.from===feature?.id&&e.type==="maps_to_output"));
  assert.ok(LAWGRAPH.nodes.some(n=>n.type==="output_target"&&n.metadata?.field));
});

test("feature mapping is explicit, and shared rule linkage alone never counts as execution",()=>{
  const mapped=LAWGRAPH.scenarios.flatMap(s=>s.featureMappings).find(f=>f.status==="curated_alias");
  const unmapped=LAWGRAPH.scenarios.flatMap(s=>s.featureMappings).find(f=>f.status==="unmapped");
  assert.ok(mapped?.canonicalFeatureId);
  assert.equal(mapped?.key,"applicationDate");
  assert.equal(unmapped?.canonicalFeatureId,null);
  for(const s of LAWGRAPH.scenarios){
    const workflowMappedFeature=s.featureMappings.some(f=>f.status!=="unmapped");
    assert.equal(s.executionCategories.includes("document_route_evaluator"),workflowMappedFeature);
    const curated=s.ruleRefs.some(id=>id in LAWGRAPH.curatedExecutionRegistry.legalRules);
    assert.equal(s.executionCategories.includes("deterministic_calculation_source_gate"),curated);
    assert.ok(s.executionCategories.includes("static_only")||workflowMappedFeature||curated);
  }
  const sharedOnly=LAWGRAPH.scenarios.find(s=>!s.featureMappings.some(f=>f.status!=="unmapped")&&!s.ruleRefs.some(id=>id in LAWGRAPH.curatedExecutionRegistry.legalRules)&&s.matchedWorkflowRules.some(w=>w.linkTypes.includes("shared_rule_catalog_reference")));
  if(sharedOnly) assert.deepEqual(sharedOnly.executionCategories,["static_only"]);
});

test("source IDs are catalog-backed and court applicability remains unknown",()=>{
  assert.equal(LAWGRAPH.sourceAudit.catalogSourceCount,22);
  assert.equal(LAWGRAPH.sourceAudit.uniqueRuleReferencedSourceIds,22);
  assert.deepEqual(LAWGRAPH.sourceAudit.danglingSourceIds,[]);
  assert.equal(LAWGRAPH.sourceAudit.sourceIdsAreExplicit,true);
  for(const s of LAWGRAPH.scenarios) for(const src of s.sources){
    assert.match(src.url,/^https:\/\//); assert.ok(src.effective);
    assert.equal(src.courtApplicability,"unknown_pending_case_court_and_date");
  }
  assert.match(LAWGRAPH.scope,/Court applicability/);
  assert.match(LAWGRAPH.sourceScopeNote,/not a case-specific applicability decision/);
});
