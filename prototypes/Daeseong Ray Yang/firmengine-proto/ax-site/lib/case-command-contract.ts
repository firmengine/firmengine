/** Client commands are intent only. Identity, actor and approval roles are server-owned. */
export const COMMAND_VERSION = "case-command/1" as const;
export const COMMAND_TYPES = ["context.update","fact.correct","fact.review","object.upsert","object.remove","object.review","document.retract","document.role","intake.adopt","subject.link","requirement.override","document.match","requirement.confirm","task.update","decision.propose","decision.adopt","business.net.propose","business.net.adopt","schedule.replace","legalCheck.dispose","document.edit","document.review","document.archive","procedure.record","schema.migrate"] as const;
export type CommandType = typeof COMMAND_TYPES[number];
export interface CaseCommand { commandId:string; commandType:CommandType; payloadVersion:1; expectedRevision:number; expectedStateFingerprint:string; target:Record<string,unknown>; patch:Record<string,unknown>; reason:string; baseValueHash?:string; sourceRefs?:unknown[]; effectivePeriod?:{start:string;end:string} }
export class CommandError extends Error { code:string;status:number;details?:unknown;constructor(code:string,status:number,message:string,details?:unknown){super(message);this.code=code;this.status=status;this.details=details;this.name="CommandError";} }
const record=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==="object"&&!Array.isArray(v);
const reject=(message:string):never=>{throw new CommandError("INVALID_COMMAND",400,message);};
export function parseCaseCommand(value:unknown):CaseCommand {
  if(!record(value))return reject("명령은 JSON 객체여야 합니다.");
  const allowed=new Set(["commandId","commandType","payloadVersion","expectedRevision","expectedStateFingerprint","target","patch","reason","baseValueHash","sourceRefs","effectivePeriod"]);
  if(Object.keys(value).some(k=>!allowed.has(k)))return reject("지원하지 않는 명령 필드입니다. actor·role·caseData는 서버가 결정합니다.");
  if(typeof value.commandId!=="string"||! /^[a-zA-Z0-9_-]{8,128}$/.test(value.commandId))return reject("명령 식별자가 필요합니다.");
  if(!COMMAND_TYPES.includes(value.commandType as CommandType)||value.payloadVersion!==1)return reject("지원하지 않는 명령 또는 payload 판본입니다.");
  if(!Number.isSafeInteger(value.expectedRevision)||(value.expectedRevision as number)<1)return reject("사건 판본이 필요합니다.");
  if(typeof value.expectedStateFingerprint!=="string"||!/^case-state\/1:[a-f0-9]{64}$/.test(value.expectedStateFingerprint))return reject("불러온 사건의 상태 지문이 필요합니다.");
  if(!record(value.target)||!record(value.patch))return reject("대상과 변경값을 확인하세요.");
  if(typeof value.reason!=="string"||!value.reason.trim()||value.reason.length>4000)return reject("구체적인 변경 이유를 4,000자 이내로 입력하세요.");
  if(value.baseValueHash!==undefined&&(typeof value.baseValueHash!=="string"||! /^[a-f0-9]{64}$/.test(value.baseValueHash)))return reject("기존 값의 지문이 올바르지 않습니다.");
  return {...value,reason:value.reason.trim()} as unknown as CaseCommand;
}
export function assertKeys(value:Record<string,unknown>,keys:readonly string[],required:readonly string[]=[]){
  if(Object.keys(value).some(k=>!keys.includes(k))||required.some(k=>!Object.hasOwn(value,k)))reject("명령 대상 또는 변경 항목이 계약과 다릅니다.");
}
export function canonicalJson(value:unknown):string {
  if(value===undefined)return "null";
  if(Array.isArray(value))return `[${value.map(canonicalJson).join(",")}]`;
  if(value&&typeof value==="object")return `{${Object.entries(value).filter(([,v])=>v!==undefined).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>`${JSON.stringify(k)}:${canonicalJson(v)}`).join(",")}}`;
  return JSON.stringify(value);
}
export async function commandHash(value:unknown):Promise<string>{const bytes=new TextEncoder().encode(canonicalJson(value));return [...new Uint8Array(await crypto.subtle.digest("SHA-256",bytes))].map(v=>v.toString(16).padStart(2,"0")).join("");}
export const commandRequiredRole=(type:CommandType):string=>["fact.review","object.review","document.review","requirement.confirm","subject.link","legalCheck.dispose","business.net.adopt"].includes(type)?"caseworker_review":"case_editor";
