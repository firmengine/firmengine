/** A4 r73: source-bound replay-order contract and SQLite synthetic artifact proof.
 * No Next route, live D1/R2, Word byte generation or court action is exercised.
 */
import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync,mkdtempSync,rmSync} from "node:fs";
import {DatabaseSync} from "node:sqlite";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {createHash} from "node:crypto";
const source=readFileSync(new URL("../lib/automatic-draft-handoff.ts",import.meta.url),"utf8");
const idx=s=>source.indexOf(s);
const sha=bytes=>createHash("sha256").update(bytes).digest("hex");
const good=Buffer.from("synthetic review package, no customer data");
const proof={id:"artifact-SYN",caseId:"case-SYN",kind:"package_zip",name:"draft.zip",hash:sha(good),mime:"application/zip",objectKey:"cases/case-SYN/artifacts/artifact-SYN",revision:3};
function fixture(){
 const folder=mkdtempSync(join(tmpdir(),"a4-r73-")),path=join(folder,"fixture.sqlite");
 const a=new DatabaseSync(path),b=new DatabaseSync(path);
 for(const d of [a,b])d.exec("PRAGMA journal_mode=WAL;PRAGMA busy_timeout=1000");
 a.exec("CREATE TABLE artifacts(id TEXT PRIMARY KEY,case_id TEXT,kind TEXT,name TEXT,hash TEXT,mime TEXT,object_key TEXT,revision INTEGER)");
 a.prepare("INSERT INTO artifacts VALUES(?,?,?,?,?,?,?,?)").run(proof.id,proof.caseId,proof.kind,proof.name,proof.hash,proof.mime,proof.objectKey,proof.revision);
 let r2=good;
 return {a,b,setR2:x=>{r2=x},getR2:()=>r2,close:()=>{a.close();b.close();rmSync(folder,{recursive:true,force:true})}};
}
function simulateProof(f,missingNetwork=false){
 const row=f.a.prepare("SELECT id,kind,name,hash,mime,object_key AS objectKey,revision FROM artifacts WHERE id=? AND case_id=?").get(proof.id,proof.caseId);
 if(!row||row.kind!==proof.kind||row.name!==proof.name||row.hash!==proof.hash||row.mime!==proof.mime||row.objectKey!==proof.objectKey||row.revision!==proof.revision)return "CONFLICT_SQL";
 if(missingNetwork)return "UNOBSERVED_R2";
 const bytes=f.getR2();
 if(bytes===null)return "MISSING_R2";
 if(sha(bytes)!==proof.hash)return "CONFLICT_BYTES";
 return "VERIFIED";
}
test("already_linked response occurs after SQL, R2 SHA and writer receipt checks",()=>{
 const p=idx("if(decision.alreadyLinked){");
 assert.ok(p>idx("mustMatchReceipt(original,prepared.receipt);"));
 assert.ok(p>idx("if(await sha256(bytes)!==artifact.hash)"));
 assert.ok(p>idx("SELECT id,kind,name,hash,mime,object_key AS objectKey,revision FROM artifacts"));
 assert.ok(p>0);
 assert.ok(!source.includes('if(decision.alreadyLinked)return {status:"already_linked"'));
});
test("unobserved R2 transport error is a 503, distinct from missing object",()=>{
 assert.match(source,/AUTODRAFT_OBJECT_UNOBSERVED/);
 assert.match(source,/\.catch\(\(\)=>reject\("AUTODRAFT_OBJECT_UNOBSERVED",503\)\)/);
 assert.match(source,/if\(!object\)reject\("AUTODRAFT_OBJECT_MISSING"\)/);
});
test("replay rechecks current case state and legal-run source after asynchronous reads",()=>{
 const p=idx("if(decision.alreadyLinked){");
 assert.ok(source.indexOf("const latest=await completeRun(database,input.caseId",p)>p);
 assert.ok(source.indexOf("const reloaded=await getCase(input.caseId)",p)>p);
 assert.ok(source.indexOf("await caseStateFingerprint(reloaded)",p)>p);
 assert.ok(source.indexOf("if(!replayed.alreadyLinked)",p)>p);
});
function scenario(label,mutate,expected,network=false){test(label,()=>{
 const f=fixture();try{mutate?.(f);assert.equal(simulateProof(f,network),expected)}finally{f.close()}
});}
scenario("positive D1 and R2 evidence",null,"VERIFIED");
scenario("D1 artifact deleted",f=>f.b.exec("DELETE FROM artifacts"),"CONFLICT_SQL");
scenario("cross-case artifact owner",f=>f.b.exec("UPDATE artifacts SET case_id='case-OTHER'"),"CONFLICT_SQL");
scenario("SQL object key drift",f=>f.b.exec("UPDATE artifacts SET object_key='cases/case-OTHER/artifacts/artifact-SYN'"),"CONFLICT_SQL");
scenario("SQL hash disagreement",f=>f.b.exec("UPDATE artifacts SET hash='"+("b".repeat(64))+"'"),"CONFLICT_SQL");
scenario("SQL revision stale",f=>f.b.exec("UPDATE artifacts SET revision=2"),"CONFLICT_SQL");
scenario("R2 object missing",f=>f.setR2(null),"MISSING_R2");
scenario("R2 byte mutation",f=>f.setR2(Buffer.from("replaced byte content")),"CONFLICT_BYTES");
scenario("R2 timeout / 503 unobserved, not false missing",null,"UNOBSERVED_R2",true);
