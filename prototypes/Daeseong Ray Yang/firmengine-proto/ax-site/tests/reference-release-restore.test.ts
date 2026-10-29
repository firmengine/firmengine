import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import { REFERENCE_RELEASE, referenceRecord } from "../lib/reference-registry.ts";
import { referenceSnapshotHash } from "../lib/reference-runtime.ts";
import { loadReferenceSnapshot } from "../lib/reference-context.ts";
import { restoreReferenceRelease } from "../lib/reference-store.ts";
import { resolveReferenceApplicationForCase } from "../lib/reference-application.ts";
import { createCase } from "../lib/domain.ts";

const parameterId="param.national.term.ordinary_months";
function d1(sqlite:DatabaseSync){
 return {prepare(sql:string){let args:SQLInputValue[]=[];const statement={bind(...values:SQLInputValue[]){args=values;return statement;},async first<T>(){return sqlite.prepare(sql).get(...args) as T??null;},async all<T>(){return {results:sqlite.prepare(sql).all(...args) as T[]};},async run(){const result=sqlite.prepare(sql).run(...args);return {meta:{changes:Number(result.changes)}};}};return statement;},async batch(statements:Array<{run():Promise<{meta:{changes:number}}>}>) {sqlite.exec("BEGIN IMMEDIATE");try{const results=[];for(const statement of statements)results.push(await statement.run());sqlite.exec("COMMIT");return results;}catch(error){sqlite.exec("ROLLBACK");throw error;}}} as unknown as D1Database;
}
function metadata(sha:string){return {[parameterId]:{sourceUrls:["https://law.go.kr/synthetic"],effectiveFrom:"2024-01-01",reason:"Synthetic reviewed historic release",reviewedAt:"2026-10-01T00:00:00Z",reviewedBy:"synthetic-reviewer",recordSha256:sha,basisType:"official_source",applicationContract:{dateBasis:"applicationDate",jurisdiction:"court-a",transition:{status:"declared" as const}}}};}

test("restoring an older reference release creates a new row, preserves case artifacts, and leaves case application gated for fresh bundle review",async()=>{
 const sqlite=new DatabaseSync(":memory:");
 sqlite.exec("CREATE TABLE legal_reference_releases(id TEXT PRIMARY KEY,revision INTEGER,seed_sha256 TEXT,sha256 TEXT,status TEXT,payload TEXT,created_at TEXT,actor TEXT,reason TEXT)");
 sqlite.exec("CREATE TABLE cases(id TEXT PRIMARY KEY,export_manifest TEXT)");
 const targetValues={[parameterId]:24},activeValues={[parameterId]:36},targetMetadata=metadata("a".repeat(64)),activeMetadata=metadata("b".repeat(64));
 const targetHash=await referenceSnapshotHash(REFERENCE_RELEASE.sha256,targetValues,targetMetadata),activeHash=await referenceSnapshotHash(REFERENCE_RELEASE.sha256,activeValues,activeMetadata);
 sqlite.prepare("INSERT INTO legal_reference_releases VALUES(?,?,?,?,?,?,?,?,?)").run("target-r2",2,REFERENCE_RELEASE.sha256,targetHash,"superseded",JSON.stringify({values:targetValues,metadata:targetMetadata}),"2026-10-01","synthetic-reviewer","historic release");
 sqlite.prepare("INSERT INTO legal_reference_releases VALUES(?,?,?,?,?,?,?,?,?)").run("active-r3",3,REFERENCE_RELEASE.sha256,activeHash,"active",JSON.stringify({values:activeValues,metadata:activeMetadata}),"2026-10-02","synthetic-reviewer","current release");
 const manifest=JSON.stringify({files:[{id:"submitted-file",status:"current"}]});sqlite.prepare("INSERT INTO cases VALUES(?,?)").run("case-preserve",manifest);
 await assert.rejects(restoreReferenceRelease(d1(sqlite),{targetSha256:targetHash,expectedActiveSha256:"0".repeat(64),reason:"stale active release must not restore"},"synthetic-reference-approver"),/REFERENCE_RELEASE_CONFLICT/);
 const restored=await restoreReferenceRelease(d1(sqlite),{targetSha256:targetHash,expectedActiveSha256:activeHash,reason:"Restore after comparison against the approved historic source."},"synthetic-reference-approver");
 assert.equal(restored.revision,4);assert.deepEqual(restored.values,targetValues);assert.equal(restored.bundleReview,undefined);
 const current=await loadReferenceSnapshot(d1(sqlite));assert.equal(current.id,restored.id);assert.equal(current.bundleReview,undefined);
 const c=createCase("restore review fixture","case-restore","2024-06-01");c.context.courtId="court-a";Object.assign(c.context,{referenceApplicationRequired:true,referenceBundleId:current.id,referenceArtifactIds:[parameterId],referenceDateBasis:"applicationDate",referenceEffectiveDate:c.context.applicationDate});
 const receipt=resolveReferenceApplicationForCase(c,[],current);assert.equal(receipt.status,"unresolved");assert.equal(receipt.finalGate,"REFERENCE_APPLICATION_UNRESOLVED");assert.equal(receipt.bundleInspection.compatibility,"unknown");
 assert.equal((sqlite.prepare("SELECT export_manifest FROM cases WHERE id=?").get("case-preserve") as {export_manifest:string}).export_manifest,manifest);
 assert.equal((sqlite.prepare("SELECT COUNT(*) AS n FROM legal_reference_releases WHERE status='active'").get() as {n:number}).n,1);
 assert.equal((sqlite.prepare("SELECT status FROM legal_reference_releases WHERE id='target-r2'").get() as {status:string}).status,"superseded");
 assert.ok(referenceRecord(parameterId));sqlite.close();
});
