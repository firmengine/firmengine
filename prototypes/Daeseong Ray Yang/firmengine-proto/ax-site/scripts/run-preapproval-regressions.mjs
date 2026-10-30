/** Run the P0-09 pre-approval regression suite from ax-site (Node >=22.13).
 * Run npm ci first. Does not access production D1/R2 or read any private source PDF.
 */
import {spawnSync} from "node:child_process";
import {readdirSync} from "node:fs";
import {fileURLToPath} from "node:url";
import {join} from "node:path";

const root=fileURLToPath(new URL("../",import.meta.url));
const full=process.argv.includes("--full");
const examples=[
 "tests/approval-readiness.test.ts",
 "tests/approval-issue-graph.test.ts",
 "tests/preapproval-stage-audit.test.ts",
 "tests/preapproval-simulation.test.ts",
 "tests/preapproval-correction-audit.test.ts",
 "tests/preapproval-ocr-storage-audit.test.ts",
 "tests/preapproval-calculation-replay.test.ts",
 "tests/preapproval-legal-coverage-audit.test.ts",
 "tests/preapproval-uncovered-legal-cases.test.ts",
 "tests/preapproval-correction-item-store.test.ts",
 "tests/preapproval-official-registry.test.ts",
 "tests/preapproval-judicial-precedents.test.ts",
 "tests/preapproval-full-contract-coverage.test.ts",
 "tests/preapproval-real-engine-integration.test.ts",
 "tests/calculation-18-output-golden.test.ts",
 "tests/ocr-calculator-input-integration.test.ts",
 "tests/legal-evidence-criteria.test.ts",
 "tests/feature-lineage-audit.test.ts",
 "tests/case-legal-automation-flow.test.ts",
 "tests/case-legal-automation-policy.test.ts",
];
const run=(label,command,args)=>{
 console.log("\n========== PREAPPROVAL REGRESSION: "+label+" ==========");
 const result=spawnSync(command,args,{cwd:root,stdio:"inherit",env:process.env});
 if(result.error)throw result.error;
 if(result.status!==0){
  console.error("FAIL: "+label+" (exit "+String(result.status)+")");
  process.exit(result.status??1);
 }
 console.log("PASS: "+label);
};
run("merge-marker/source integrity",process.execPath,["scripts/verify-source-tree.mjs"]);
const all=full?readdirSync(join(root,"tests")).filter(x=>x.endsWith(".test.ts")).sort().map(x=>"tests/"+x):examples;
run(full?"all registered node:test modules":"approval-stage + core OCR/LAWGRAPH/calculation suites",
 process.execPath,["--experimental-strip-types","--test",...all]);
if(full){
 run("ESLint","npm",["run","lint"]);
 run("production bundle","npm",["run","build"]);
}
console.log("\nAll requested regression commands PASS. This is NOT verification of deployed D1/R2, model/OCR API, filing legality, or court approval.");
