import test from "node:test";
import assert from "node:assert/strict";
import {spawnSync} from "node:child_process";
import {fileURLToPath} from "node:url";
const root=fileURLToPath(new URL("../",import.meta.url));
const audit=(...args:string[])=>{
  const result=spawnSync(process.execPath,["scripts/audit-product-contracts.mjs",...args],
    {cwd:root,encoding:"utf8",maxBuffer:8*1024*1024});
  assert.equal(result.status,0,result.stderr+"\n"+result.stdout.slice(0,4000));
  return JSON.parse(result.stdout);
};
test("source catalogs, workflow wiring and migrations do not silently regress",()=>{
  const report=audit();
  assert.deepEqual(report.findings,[]);
  assert.ok(report.counts.canonical>=693);
  assert.ok(report.counts.documents>=85);
  assert.ok(report.counts.calculations>=18);
  assert.ok(report.counts.legalRisks>=95);
  assert.equal(report.liveD1R2Verified,false);
  assert.equal(report.lawAndTaxAccuracyCertified,false);
});
test("all canonical OCR IDs have individually addressable source declarations",()=>{
  const report=audit("--fields");
  assert.equal(report.fields.length,report.counts.canonical);
  assert.equal(new Set(report.fields.map((f:{canonicalFieldId:string})=>f.canonicalFieldId)).size,report.counts.canonical);
  assert.ok(report.fields.every((f:{origins:string[]})=>f.origins.length>0));
  assert.ok(report.fields.every((f:{officialFormParityVerified:boolean})=>f.officialFormParityVerified===false));
});
