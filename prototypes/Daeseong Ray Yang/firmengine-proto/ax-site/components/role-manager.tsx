"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
const ROLES=["case_editor","caseworker_review","lawyer_review","reference_approve","role_admin"] as const;
type Grant={actorId:string;role:string;scopeId:string;status:string;policyRevision:number};
type Data={actorId:string;roles:string[];grants:Grant[];professionalQualificationVerified:false};
async function api<T>(url:string,init?:RequestInit):Promise<T>{const r=await fetch(url,{...init,credentials:"same-origin",cache:"no-store",headers:{"Content-Type":"application/json",...init?.headers}});const d=await r.json() as Record<string,unknown>;if(!r.ok)throw new Error(typeof d.error==="string"?d.error:`HTTP ${r.status}`);return d as T;}
export default function RoleManager(){
 const [data,setData]=useState<Data|null>(null),[error,setError]=useState(""),[busy,setBusy]=useState(false);
 const [actorId,setActorId]=useState(""),[role,setRole]=useState<(typeof ROLES)[number]>("case_editor"),[scopeId,setScopeId]=useState("*"),[reason,setReason]=useState("");
 const load=async()=>{try{setError("");setData(await api<Data>("/api/roles"));}catch(e){setError(e instanceof Error?e.message:"역할 정보를 불러오지 못했습니다.");}};
 useEffect(()=>{queueMicrotask(()=>{void load();});},[]);
 const submit=async(operation:"grant"|"revoke",grant?:Grant)=>{const target=grant?.actorId??actorId,selectedRole=grant?.role??role,scope=grant?.scopeId??scopeId;const old=data?.grants.find(g=>g.actorId===target&&g.role===selectedRole&&g.scopeId===scope);if(!reason.trim()){setError("변경 사유를 입력하세요.");return;}setBusy(true);try{await api("/api/roles",{method:"POST",body:JSON.stringify({actorId:target,role:selectedRole,scopeId:scope,operation,reason,expectedPolicyRevision:old?.policyRevision??0})});setReason("");await load();}catch(e){setError(e instanceof Error?e.message:"권한 정책을 저장하지 못했습니다.");}finally{setBusy(false);}};
 return <main className="role-page"><header><Link href="/">Firm Engine</Link><h1>담당자 권한</h1><p>역할 부여는 조직 내부 권한 설정입니다. 변호사 자격이나 전문성을 확인하거나 인증하지 않습니다.</p></header>{error&&<p role="alert">{error}</p>}{data?.roles.includes("role_admin")?<>
 <section><h2>역할 지정</h2><label>담당자 ID<input value={actorId} onChange={e=>setActorId(e.target.value)} autoComplete="off" /></label><label>역할<select value={role} onChange={e=>setRole(e.target.value as typeof role)}>{ROLES.filter(r=>r!=="role_admin").map(r=><option key={r} value={r}>{r}</option>)}</select></label><label>범위<input value={scopeId} onChange={e=>setScopeId(e.target.value)} placeholder="* 또는 case ID" /></label><label>변경 사유<input value={reason} onChange={e=>setReason(e.target.value)} /></label><button disabled={busy||!actorId.trim()} onClick={()=>void submit("grant")}>역할 부여</button></section>
 <section><h2>현재 부여 기록</h2>{data.grants.length?<table><thead><tr><th>담당자</th><th>역할</th><th>범위</th><th>상태</th><th>판본</th><th></th></tr></thead><tbody>{data.grants.map(g=><tr key={`${g.actorId}:${g.role}:${g.scopeId}`}><td>{g.actorId}</td><td>{g.role}</td><td>{g.scopeId}</td><td>{g.status}</td><td>{g.policyRevision}</td><td>{g.status==="active"&&<button disabled={busy} onClick={()=>void submit("revoke",g)}>회수</button>}</td></tr>)}</tbody></table>:<p>추가로 지정된 역할이 없습니다.</p>}</section>
 </>:data?<p>현재 계정에는 역할 관리 권한이 없습니다. owner는 환경 설정의 <code>FIRMENGINE_OWNER_ID</code>와 일치할 때 역할 관리자 권한만 받습니다.</p>:!error&&<p>불러오는 중…</p>}</main>;
}
