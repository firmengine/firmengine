import { env } from "cloudflare:workers";
import { AI_MODEL, CONSULTATION_AI_MODEL, type EvidenceModel } from "./domain";
import { HttpError } from "./server-store";
export interface Usage {inputTokens:number;outputTokens:number;durationMs:number;model:EvidenceModel;}
export interface LunaCallArgs {agent:string;instructions:string;input:unknown[];schema:Record<string,unknown>;maxOutput?:number;reasoningEffort?:"low"|"medium";webSearch?:{allowedDomains:string[]};signal?:AbortSignal;}
export interface LunaCallResult<T> {value:T;usage:Usage;sourceUrls?:string[];}
// Leave room to persist a recovery checkpoint before the hosting request closes.
// A production canceled request at ~96 s never reached the former 110 s timeout.
export const LUNA_REQUEST_TIMEOUT_MS=65_000;
export async function callLuna<T>(args:LunaCallArgs):Promise<LunaCallResult<T>>{
  if(!env.OPENAI_API_KEY)throw new HttpError(503,"OpenAI 키가 사이트에 아직 연결되지 않았습니다. 사이트의 비밀 환경변수 OPENAI_API_KEY를 연결한 뒤 재개하세요.");
  args.signal?.throwIfAborted();
  const domains=args.webSearch?[...new Set(args.webSearch.allowedDomains.map(domain=>domain.trim().toLowerCase()))]:undefined;
  if(domains&&(!domains.length||domains.length>100||domains.some(domain=>!/^([a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$/i.test(domain))))throw new HttpError(400,"웹 검색 공식 도메인 설정을 확인하세요.");
  const model=args.agent==="consultation_classifier"||args.agent.startsWith("legal_monitor_")?CONSULTATION_AI_MODEL:AI_MODEL;
  const started=Date.now();
  const timeoutSignal=AbortSignal.timeout(LUNA_REQUEST_TIMEOUT_MS),signal=args.signal?AbortSignal.any([args.signal,timeoutSignal]):timeoutSignal;
  const response=await fetch("https://api.openai.com/v1/responses",{method:"POST",headers:{"Authorization":`Bearer ${env.OPENAI_API_KEY}`,"Content-Type":"application/json"},signal,body:JSON.stringify({model,store:false,instructions:args.instructions,input:args.input,reasoning:{effort:args.reasoningEffort??"low"},max_output_tokens:args.maxOutput??12000,text:{format:{type:"json_schema",name:args.agent.replace(/[^a-zA-Z0-9_-]/g,"_"),strict:true,schema:args.schema}},...(domains?{tools:[{type:"web_search",filters:{allowed_domains:domains}}],include:["web_search_call.action.sources"]}:{})})});
  if(!response.ok){
    // Upstream bodies may contain submitted document text. Return only bounded, actionable codes.
    const status=response.status;
    if(status===401)throw new HttpError(401,"API 키 인증에 실패했습니다. 사이트 비밀 설정을 확인하세요.");
    if(status===429)throw new HttpError(429,"API 사용 한도 또는 속도 제한에 도달했습니다. 자동 반복을 멈췄습니다.");
    if(status===403||status===404)throw new HttpError(status,`이 API 프로젝트에서 ${model}를 사용할 수 없습니다. 모델을 바꾸지 않고 중단했습니다.`);
    throw new HttpError(502,`모델 요청 실패 (${status}). 완료된 페이지는 보존됩니다.`);
  }
  const body=await response.json() as {status:string;output?:{type?:string;action?:{sources?:{url?:string}[]};content?:{type:string;text?:string;refusal?:string;annotations?:{type?:string;url?:string}[]}[]}[];usage?:{input_tokens?:number;output_tokens?:number}};
  // Treat a missing status exactly like an unfinished response; never infer completion
  // merely because a partial output_text happens to parse as JSON.
  if(body.status!=="completed")throw new HttpError(502,"응답이 완성되지 않았습니다. 해당 페이지만 다시 판독해야 합니다.");
  const contents=(body.output??[]).flatMap(o=>o.content??[]);
  if(contents.some(c=>c.type==="refusal"))throw new HttpError(422,"모델이 이 페이지 처리를 완료하지 못했습니다. 원본을 확인하세요.");
  const text=contents.filter(c=>c.type==="output_text").map(c=>c.text??"").join("");
  let value:T;try{value=JSON.parse(text);}catch{throw new HttpError(502,"모델의 구조화 응답을 읽지 못했습니다.");}
  const sourceUrls=domains?[...new Set((body.output??[]).flatMap(item=>[
    ...(item.type==="web_search_call"?item.action?.sources??[]:[]).map(source=>source.url),
    ...(item.content??[]).filter(content=>content.type==="output_text").flatMap(content=>(content.annotations??[]).filter(annotation=>annotation.type==="url_citation").map(annotation=>annotation.url)),
  ]).filter((url):url is string=>typeof url==="string"&&/^https?:\/\//i.test(url)))]:undefined;
  return {value,usage:{inputTokens:body.usage?.input_tokens??0,outputTokens:body.usage?.output_tokens??0,durationMs:Date.now()-started,model},...(sourceUrls?{sourceUrls}:{})};
}
export function imageContent(bytes:ArrayBuffer,mime="image/jpeg"){
  let binary="";const array=new Uint8Array(bytes);for(let i=0;i<array.length;i+=8192)binary+=String.fromCharCode(...array.subarray(i,i+8192));
  return {type:"input_image",image_url:`data:${mime};base64,${btoa(binary)}`,detail:"high"};
}
