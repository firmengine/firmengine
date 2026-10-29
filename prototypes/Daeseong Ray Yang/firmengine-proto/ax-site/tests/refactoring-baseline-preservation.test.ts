import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

type JsonObject=Record<string,any>;
const read=(path:string)=>JSON.parse(readFileSync(new URL(`../${path}`,import.meta.url),"utf8")) as JsonObject;
const sha256=(path:string)=>createHash("sha256").update(readFileSync(new URL(`../${path}`,import.meta.url))).digest("hex");
const baseline=read("docs/refactoring-baseline.json");

test("RF-01 canonical source artifacts still match their frozen SHA-256 hashes",()=>{
 for(const [path,expected] of Object.entries(baseline.canonicalSources as Record<string,{sha256:string}>))
  assert.equal(sha256(path),expected.sha256,`${path} changed from the captured source baseline`);
});

test("RF-01 all 48 families and 524 field IDs remain present in canonical contracts",()=>{
 const contracts=read("lib/document-agent-field-contracts.json"),applicability=read("lib/field-applicability-contracts.json");
 const families=contracts.families as Record<string,{family_id:string;fields:{id:string;global_field_id?:string}[]}>;
 const expected=baseline.canonicalIds as Record<string,{id:string;familyId?:string;canonicalType?:string}[]>;
 const familyIds=Object.keys(families).sort();
 assert.equal(familyIds.length,baseline.counts.documentFamilies);
 assert.deepEqual(familyIds,[...expected.documentFamilies.map(x=>x.id)].sort());
 const actualFieldIds=familyIds.flatMap(familyId=>families[familyId]!.fields.map(field=>field.global_field_id??field.id)).sort();
 assert.equal(actualFieldIds.length,baseline.counts.extractionFields);
 assert.equal(new Set(actualFieldIds).size,actualFieldIds.length,"canonical extraction field IDs remain unique");
 assert.deepEqual(actualFieldIds,[...expected.extractionFields.map(x=>x.id)].sort());
 assert.deepEqual(Object.keys(applicability.families).sort(),familyIds,"applicability contract retains every document family");
});

test("RF-01 intake, calculation and workflow canonical ID inventories match frozen counts and IDs",()=>{
 const intake=read("lib/reference-intake-catalog.json"),decision=read("lib/reference-decision-tables.json");
 const expected=baseline.canonicalIds as Record<string,{id:string}[]>;
 for(const [key,actual,count] of [
  ["intakeFeatures",intake.features,baseline.counts.intakeFeatures],
  ["intakeDocuments",intake.documents,baseline.counts.intakeDocuments],
  ["intakeRules",intake.rules,baseline.counts.intakeRules],
  ["calculations",decision.calculations,baseline.counts.calculationGroups],
  ["workflows",decision.workflows,baseline.counts.workflowLinks],
 ] as const){
  const ids=(actual as {id:string}[]).map(row=>row.id).sort();
  assert.equal(ids.length,count,`${key} count`);assert.equal(new Set(ids).size,ids.length,`${key} IDs unique`);
  assert.deepEqual(ids,[...expected[key].map(row=>row.id)].sort(),`${key} IDs`);
 }
});
