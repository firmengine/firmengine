import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";

type StatementLike={run:()=>Promise<{meta:{changes:number}}>};
function harness(){
 const env={FIRMENGINE_OWNER_ID:"verified-site-owner"},grants=new Map<string,{actorId:string;role:string;scopeId:string;status:string;effectiveFrom:string;effectiveTo:null;policyRevision:number}>(),audit:unknown[]=[];let currentActor="verified-site-owner";
 class HttpError extends Error{status:number;constructor(status:number,message:string){super(message);this.status=status;}}
 const database={
  prepare(sql:string){
   let args:unknown[]=[];
   const statement={
    bind(...values:unknown[]){args=values;return statement;},
    async first(){
     if(sql.includes("SELECT policy_revision")){const value=grants.get(`${args[0]}:${args[1]}:${args[2]}`);return value?{revision:value.policyRevision}:null;}
     return null;
    },
    async all(){return sql.includes("FROM app_role_grants")?{results:[...grants.values()].filter(row=>row.actorId===args[0])}:{results:[]};},
    async run(){
     if(sql.startsWith("INSERT OR IGNORE INTO app_role_grants")){
      const key=`${args[0]}:case_editor:*`;if(grants.has(key))return{meta:{changes:0}};
      grants.set(key,{actorId:String(args[0]),role:"case_editor",scopeId:"*",status:"active",effectiveFrom:String(args[1]),effectiveTo:null,policyRevision:1});return{meta:{changes:1}};
     }
     if(sql.startsWith("INSERT INTO app_role_grants")){
      const key=`${args[0]}:${args[1]}:${args[2]}`;grants.set(key,{actorId:String(args[0]),role:String(args[1]),scopeId:String(args[2]),status:String(args[3]),effectiveFrom:String(args[4]),effectiveTo:null,policyRevision:Number(args[8])});return{meta:{changes:1}};
     }
     if(sql.startsWith("INSERT INTO events")){audit.push(JSON.parse(String(args[4])));return{meta:{changes:1}};}
     return{meta:{changes:1}};
    },
   };
   return statement;
  },
  async batch(statements:StatementLike[]){const out=[];for(const statement of statements)out.push(await statement.run());return out;},
 };
 const path=new URL("../lib/app-roles.ts",import.meta.url),output=ts.transpileModule(readFileSync(path,"utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const commonJsModule={exports:{} as Record<string,unknown>},dependencies:Record<string,unknown>={"cloudflare:workers":{env},"./server-store":{db:()=>database,requireHumanActor:async()=>currentActor,HttpError,now:()=>"2026-10-29T00:00:00.000Z"}};
 new Function("require","module","exports",output)((name:string)=>{if(name in dependencies)return dependencies[name];throw new Error(`Unexpected import ${name}`);},commonJsModule,commonJsModule.exports);
 return{roles:commonJsModule.exports as {rolesForActor(id:string):Promise<string[]>;updateRoleGrant(body:Record<string,unknown>):Promise<unknown>},setActor:(id:string)=>{currentActor=id;},grants,audit};
}

test("verified owner bootstrap and audited grants do not let ordinary staff self-assign roles",async()=>{
 const h=harness(),ownerRoles=await h.roles.rolesForActor("verified-site-owner");assert.ok(ownerRoles.includes("role_admin"));assert.ok(ownerRoles.includes("case_editor"));assert.equal(ownerRoles.includes("reference_approve"),false);
 await h.roles.updateRoleGrant({actorId:"review-staff",role:"reference_approve",scopeId:"*",operation:"grant",reason:"Approved for synthetic reference review duties",expectedPolicyRevision:0});
 assert.equal(h.audit.length,1);assert.equal((h.audit[0] as {actorId:string}).actorId,"review-staff");assert.equal((await h.roles.rolesForActor("review-staff")).includes("reference_approve"),true);
 h.setActor("review-staff");await assert.rejects(h.roles.updateRoleGrant({actorId:"review-staff",role:"caseworker_review",operation:"grant",reason:"Self grant attempt",expectedPolicyRevision:0}),(error:unknown)=>error instanceof Error&&"status" in error&&(error as {status:number}).status===403);
 await assert.rejects(h.roles.updateRoleGrant({actorId:"other-staff",role:"role_admin",operation:"grant",reason:"No delegated admin role",expectedPolicyRevision:0}),(error:unknown)=>error instanceof Error&&"status" in error&&(error as {status:number}).status===403);
});
