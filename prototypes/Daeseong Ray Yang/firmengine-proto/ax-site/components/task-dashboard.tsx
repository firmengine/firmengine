"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type TaskStatus="open"|"in_progress"|"waiting"|"resolved"|"dismissed";
interface TaskRow {id:string;caseId:string;caseName:string;type:string;title:string;ownerId:string|null;dueAt:string|null;waitingOn:string|null;blockedBy:string[]|string;status:TaskStatus;reason:string;createdAt:string;updatedAt:string}
interface PageResult {items:TaskRow[];total:number;limit:number;offset:number;hasMore:boolean}
const PAGE_SIZE=25;
const statuses:[string,string][]=[["all","전체 상태"],["open","열림"],["in_progress","진행 중"],["waiting","대기"],["resolved","완료"],["dismissed","제외"]];
export default function TaskDashboard(){
  const [owner,setOwner]=useState("all"),[ownerInput,setOwnerInput]=useState(""),[status,setStatus]=useState("all"),[offset,setOffset]=useState(0);
  const [result,setResult]=useState<PageResult>({items:[],total:0,limit:PAGE_SIZE,offset:0,hasMore:false}),[loading,setLoading]=useState(true),[error,setError]=useState("");
  const load=useCallback(async()=>{
    setLoading(true);setError("");
    const query=new URLSearchParams({ownerId:owner,status,limit:String(PAGE_SIZE),offset:String(offset)});
    try{const response=await fetch(`/api/tasks?${query}`,{cache:"no-store"});const payload=await response.json() as PageResult&{error?:string};if(!response.ok)throw new Error(payload.error??"작업을 불러오지 못했습니다.");setResult(payload);}
    catch(cause){setError(cause instanceof Error?cause.message:"작업을 불러오지 못했습니다.");}
    finally{setLoading(false);}
  },[owner,status,offset]);
  useEffect(()=>{const timer=window.setTimeout(()=>void load(),0);return()=>window.clearTimeout(timer);},[load]);
  const applyOwner=()=>{setOwner(ownerInput.trim()||"all");setOffset(0);};
  const visibleStart=result.total?result.offset+1:0,visibleEnd=result.offset+result.items.length;
  return <main className="mx-auto min-h-screen max-w-6xl px-5 py-8 text-slate-900 sm:px-8">
    <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div><p className="text-sm font-medium text-slate-500">사건 업무</p><h1 className="mt-1 text-3xl font-semibold tracking-tight">작업 대시보드</h1><p className="mt-2 text-sm text-slate-600">담당자와 상태로 작업을 찾고 사건 워크플로에서 이어서 처리합니다.</p></div>
      <Link className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium hover:bg-slate-50" href="/">사건 목록</Link>
    </div>
    <section aria-label="작업 필터" className="mb-5 flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <label className="grid gap-1 text-sm"><span className="font-medium">상태</span><select className="h-10 rounded-md border border-slate-300 bg-white px-3" value={status} onChange={event=>{setStatus(event.target.value);setOffset(0);}}>{statuses.map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
      <label className="grid gap-1 text-sm"><span className="font-medium">담당자 ID</span><input className="h-10 w-56 rounded-md border border-slate-300 px-3" value={ownerInput} onChange={event=>setOwnerInput(event.target.value)} onKeyDown={event=>{if(event.key==="Enter")applyOwner();}} placeholder="전체 담당자" /></label>
      <button type="button" onClick={applyOwner} className="h-10 rounded-md bg-slate-900 px-4 text-sm font-medium text-white hover:bg-slate-700">필터 적용</button>
      <button type="button" onClick={()=>{setOwner("unassigned");setOwnerInput("미지정");setOffset(0);}} className="h-10 rounded-md border border-slate-300 px-3 text-sm hover:bg-slate-50">미지정만</button>
      <button type="button" onClick={()=>{setOwner("all");setOwnerInput("");setStatus("all");setOffset(0);}} className="h-10 rounded-md border border-slate-300 px-3 text-sm hover:bg-slate-50">초기화</button>
    </section>
    <div className="mb-3 flex items-center justify-between text-sm text-slate-600"><span>{result.total}개 작업 · {visibleStart}–{visibleEnd} 표시</span><button type="button" onClick={()=>void load()} disabled={loading} className="rounded-md border border-slate-300 px-3 py-1.5 hover:bg-white disabled:opacity-50">새로고침</button></div>
    {error&&<p role="alert" className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>}
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm" aria-label="작업 목록">
      {loading?<p className="p-6 text-sm text-slate-500">불러오는 중…</p>:result.items.length===0?<p className="p-6 text-sm text-slate-500">조건에 맞는 작업이 없습니다.</p>:<ul className="divide-y divide-slate-200">{result.items.map(task=>{
        let blockers:string[]=[];try{blockers=Array.isArray(task.blockedBy)?task.blockedBy:JSON.parse(task.blockedBy||"[]");}catch{}
        return <li key={task.id} className="grid gap-3 p-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
          <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><span className="font-semibold">{task.title||task.type}</span><span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-700">{statuses.find(([value])=>value===task.status)?.[1]??task.status}</span></div>
            <p className="mt-1 text-sm text-slate-600">{task.caseName} · {task.ownerId??"담당자 미지정"}{task.dueAt?` · 기한 ${task.dueAt}`:""}</p>
            {task.reason&&<p className="mt-1 truncate text-xs text-slate-500">{task.reason}</p>}{task.waitingOn&&<p className="mt-1 text-xs text-amber-800">대기 사유: {task.waitingOn}</p>}{blockers.length>0&&<p className="mt-1 text-xs text-amber-800">선행 작업: {blockers.join(", ")}</p>}
          </div><Link className="whitespace-nowrap rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium hover:bg-slate-50" href={`/cases/${encodeURIComponent(task.caseId)}/workflow`}>사건 열기</Link>
        </li>;
      })}</ul>}
    </section>
    <div className="mt-4 flex items-center justify-between"><span className="text-xs text-slate-500">총 {result.total}개 중 {visibleStart}–{visibleEnd}</span><div className="flex gap-2"><button type="button" disabled={offset===0||loading} onClick={()=>setOffset(Math.max(0,offset-PAGE_SIZE))} className="rounded-md border border-slate-300 px-3 py-2 text-sm disabled:opacity-40">이전</button><button type="button" disabled={!result.hasMore||loading} onClick={()=>setOffset(offset+PAGE_SIZE)} className="rounded-md border border-slate-300 px-3 py-2 text-sm disabled:opacity-40">다음</button></div></div>
  </main>;
}
