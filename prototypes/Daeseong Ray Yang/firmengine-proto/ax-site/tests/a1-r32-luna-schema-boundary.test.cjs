const test=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const ts=require('typescript');
const source=fs.readFileSync(require('node:path').join(__dirname,'../lib/luna.ts'),'utf8');
const output=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const guardSource=fs.readFileSync(require('node:path').join(__dirname,'../lib/structured-model-json.ts'),'utf8');
const guardOutput=ts.transpileModule(guardSource,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const guardModule={exports:{}};new Function('module','exports',guardOutput)(guardModule,guardModule.exports);
const expectedSchema={type:'object',required:['ok'],additionalProperties:false,properties:{ok:{type:'boolean'}}};
function api(status,bodyText,refusal=false){let requested=0;const mods={'cloudflare:workers':{env:{OPENAI_API_KEY:'synthetic-key-not-real'}},'./domain':{AI_MODEL:'gpt-6.1-terra',CONSULTATION_AI_MODEL:'gpt-6-luna'},'./server-store':{HttpError:class extends Error{constructor(status,message){super(message);this.status=status}}},'./structured-model-json.ts':guardModule.exports};const mod={exports:{}};
 const fetch=async(_url,_init)=>{requested++;return{ok:true,json:async()=>({status,output:[{content:refusal?[{type:'refusal',refusal:'synthetic refusal'}]:[{type:'output_text',text:bodyText}]}],usage:{input_tokens:3,output_tokens:2}})}};
 new Function('require','module','exports','fetch',output)(name=>{if(name in mods)return mods[name];throw Error('unexpected import '+name)},mod,mod.exports,fetch);
 return {call:()=>mod.exports.callLuna({agent:'synthetic_ocr',instructions:'only synthetic',input:[],schema:expectedSchema}),get requested(){return requested}};
}
test('valid schema-compliant model JSON accepted by patched source function',async()=>{
 const a=api('completed','{"ok":true}');assert.deepEqual((await a.call()).value,{ok:true});assert.equal(a.requested,1);
});
test('missing required fields are rejected with HTTP 502 by patched source',async()=>{
 const a=api('completed','{"wrong":"value"}');await assert.rejects(a.call(),e=>e.status===502);assert.equal(a.requested,1);
});
test('array instead of required object is rejected with HTTP 502 by patched source',async()=>{
 const a=api('completed','[]');await assert.rejects(a.call(),e=>e.status===502);assert.equal(a.requested,1);
});
test('incomplete, malformed and refused model answers fail closed',async()=>{
 for(const a of [api('incomplete','{"ok":true}'),api('completed','not JSON'),api('completed','{"ok":true}',true)])
   await assert.rejects(a.call());
});
