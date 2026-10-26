"""Generation-side sample run. Reads ONLY a physically split evidence PDF/manifest.

No evaluator or mixed-original paths are accepted. Actual content and audits remain
under ignored .local. Successful page cache allows bounded partial resume.
"""
from __future__ import annotations
import argparse
import asyncio
import hashlib
import json
import os
import re
import sys
from datetime import datetime,timezone
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT))
from app import ai
from app.pipeline import extract_document


async def run(args):
    if not re.fullmatch(r"[A-Za-z0-9_-]{1,80}",args.run_id) or (args.resume_from and not re.fullmatch(r"[A-Za-z0-9_-]{1,80}",args.resume_from)):
        raise SystemExit("run-id는 영문·숫자·밑줄·대시 1~80자입니다.")
    manifest_path=Path(args.manifest).resolve()
    manifest=json.loads(manifest_path.read_text(encoding="utf-8"))
    if manifest.get("role")!="evidence" or not manifest.get("pages") or any(page.get("role")!="evidence" for page in manifest["pages"]):
        raise SystemExit("증빙 전용 페이지 명세만 허용합니다.")
    path=Path(args.evidence).resolve()
    if path.name!="evidence.pdf":
        raise SystemExit("물리적으로 분리된 evidence.pdf만 허용합니다.")
    source_hash=hashlib.sha256(path.read_bytes()).hexdigest()
    if source_hash!=manifest.get("sha256"):
        raise SystemExit("증빙 PDF 지문이 분리 명세와 다릅니다.")
    run_dir=ROOT/".local"/"evaluation"/"runs"/args.run_id
    run_dir.mkdir(parents=True,exist_ok=True)
    previous=None
    previous_manifest=None
    successful=[]
    attempted=[page["page"] for page in manifest["pages"]]
    if args.resume_from:
        previous_dir=run_dir.parent/args.resume_from
        previous=json.loads((previous_dir/"extraction.json").read_text(encoding="utf-8"))
        previous_manifest=json.loads((previous_dir/"generation-manifest.json").read_text(encoding="utf-8"))
        if previous.get("input_sha256")!=source_hash or previous_manifest.get("input_sha256")!=source_hash:
            raise SystemExit("기존 실행과 증빙 입력 지문이 다릅니다.")
        successful=[item for item in previous["logical_documents"] if item["status"] in ("extracted","excluded","mapping_review","unreadable")]
        succeeded={int(item["physical_page"]) for item in successful}
        attempted=[page["page"] for page in manifest["pages"] if page["page"] not in succeeded]
    plan={"run_id":args.run_id,"resume_from":args.resume_from,"input_sha256":source_hash,"total_pages":len(manifest["pages"]),"reused_pages":len(successful),"attempted_pages":attempted,"attempted_page_count":len(attempted),"api_configured":ai.status()["configured"],"new_calls_allowed":not args.plan_only and not args.merge_only and ai.status()["configured"]}
    (run_dir/"resume-plan.json").write_text(json.dumps(plan,ensure_ascii=False,indent=2),encoding="utf-8")
    if args.plan_only:
        print(json.dumps({key:value for key,value in plan.items() if key!="attempted_pages"}),flush=True)
        return
    if attempted and not args.merge_only and not ai.status()["configured"]:
        raise SystemExit("API 키 미설정: 호출 전에 중단했습니다. .env를 복구한 뒤 같은 resume 명령을 실행하세요. 기존 결과는 보존했습니다.")
    code_files=[ROOT/"app"/"ai.py",ROOT/"app"/"pipeline.py",ROOT/"workflows"/"calculators.js"]
    frozen={"run_id":args.run_id,"started_at":datetime.now(timezone.utc).isoformat(),"input_role":"evidence-only","input_sha256":source_hash,
            "source_bundle_sha256":manifest.get("source_sha256"),"page_count":len(manifest["pages"]),"page_mapping":manifest["pages"],
            "model":ai.status()["model"],"code":{str(p.relative_to(ROOT)):hashlib.sha256(p.read_bytes()).hexdigest() for p in code_files},
            "prompts":{name:ai.read_prompt(name)["sha256"] for name in ai.AGENTS},"evaluation_answers_available_to_generator":False,
            "resume_from":args.resume_from,"reused_pages":len(successful),"attempted_pages":attempted,
            "reused_page_manifest":previous_manifest if previous else None,
            "runtime":{"extract_output_tokens":ai.settings()["extract_output_tokens"],"timeout":ai.settings()["timeout"],"retries":ai.settings()["retries"]}}
    frozen_file=run_dir/"generation-manifest.json"
    if frozen_file.exists():
        stored_generation=json.loads(frozen_file.read_text(encoding="utf-8"))
        if any(stored_generation.get(key)!=frozen.get(key) for key in ("input_sha256","code","prompts","model")):
            raise SystemExit("이 실행의 동결 코드·프롬프트가 달라졌습니다. 새 run-id로 실행하세요.")
        stored_generation.setdefault("recovery_attempts",[]).append({"started_at":frozen["started_at"],"runtime":frozen["runtime"],"runner_sha256":hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),"reason":"local merge only, no API calls" if args.merge_only else "reuse successful page cache; retry failed pages only"})
        frozen_file.write_text(json.dumps(stored_generation,ensure_ascii=False,indent=2),encoding="utf-8")
    else:
        frozen_file.write_text(json.dumps(frozen,ensure_ascii=False,indent=2),encoding="utf-8")
    document={"id":args.document_id,"filename":"evidence.pdf","role":"evidence","document_type":"unknown","pages":manifest["pages"],"sha256":source_hash,"only_pages":attempted}
    os.environ.setdefault("FIRMENGINE_PAGE_CONCURRENCY","3")
    def progress(values):
        values={**values,"completed_pages":len(successful)+values["completed_pages"],"total_pages":len(manifest["pages"]),"reused_pages":len(successful)}
        (run_dir/"extraction-progress.json").write_text(json.dumps(values),encoding="utf-8")
        print(json.dumps(values),flush=True)
    raw_path=run_dir/"new-extraction.raw.json"
    if args.merge_only:
        if not raw_path.is_file():
            raise SystemExit("병합할 저장된 raw 추출 결과가 없습니다. API를 호출하지 않았습니다.")
        result=json.loads(raw_path.read_text(encoding="utf-8"))
    else:
        result=await extract_document(path,document,{"id":args.case_id,"is_demo":False},progress_callback=progress)
    # Persist before platform-dependent merge/annotation: completed calls survive
    # any later reporting failure and can be recovered without resending pages.
    (run_dir/"new-extraction.raw.json").write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding="utf-8")
    def pipeline_hash(generation_manifest):
        return next(value for key,value in generation_manifest["code"].items() if key.replace("\\","/")=="app/pipeline.py")
    for item in result["logical_documents"]:
        item["provenance"]={"run_id":args.run_id,"code":frozen["code"],"prompts":frozen["prompts"],"model":frozen["model"],"reused":bool(item.get("cache_hit"))}
    for fact in result["facts"]:
        fact["extraction_run_id"]=args.run_id
        fact["extraction_code_sha256"]=pipeline_hash(frozen)
    for call in result["calls"]:
        call["run_id"]=args.run_id
    if previous:
        reused_physical={int(item["physical_page"]) for item in successful}
        old_facts=[fact for fact in previous["facts"] if int(fact.get("physical_page",0)) in reused_physical]
        for item in successful:
            item.setdefault("provenance",{"run_id":args.resume_from,"code":previous_manifest["code"],"prompts":previous_manifest["prompts"],"model":previous_manifest["model"]})
            item["provenance"]["reused"]=True
        for fact in old_facts:
            fact.setdefault("extraction_run_id",args.resume_from)
            fact.setdefault("extraction_code_sha256",pipeline_hash(previous_manifest))
        result["facts"]=old_facts+result["facts"]
        result["logical_documents"]=sorted(successful+result["logical_documents"],key=lambda item:item["physical_page"])
        for collection in result["entities"]:
            merged={item["id"]:dict(item) for item in previous["entities"][collection]}
            for item in merged.values():
                item.setdefault("extraction_run_id",args.resume_from)
            merged.update({item["id"]:{**item,"extraction_run_id":args.run_id} for item in result["entities"][collection]})
            result["entities"][collection]=list(merged.values())
        for call in previous["calls"]:
            call.setdefault("run_id",args.resume_from)
        result["calls"]=previous["calls"]+result["calls"]
        result["previous_warnings"]=previous["warnings"]
        reused_original={str(item["original_page"]) for item in successful}
        result["warnings"]=[warning for warning in previous["warnings"] if warning.split("쪽",1)[0] in reused_original]+result["warnings"]
        result["resumed_from"]=args.resume_from
        result["reused_pages"]=len(successful)
    result["input_sha256"]=source_hash
    result["source_bundle_sha256"]=manifest.get("source_sha256")
    result["document_id"]=args.document_id
    result["completed_at"]=datetime.now(timezone.utc).isoformat()
    (run_dir/"extraction.json").write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding="utf-8")
    (run_dir/"calls.json").write_text(json.dumps(result["calls"],ensure_ascii=False,indent=2),encoding="utf-8")
    statuses={}
    for item in result["logical_documents"]:
        statuses[item["status"]]=statuses.get(item["status"],0)+1
    summary={"run_id":args.run_id,"facts":len(result["facts"]),"calls":len(result["calls"]),"logical_statuses":statuses,"warnings":len(result["warnings"]),"input_sha256":source_hash,"case_id":args.case_id,"document_id":args.document_id,"reused_pages":len(successful),"attempted_pages":len(attempted),"technical_status":"PARTIAL_FAILURE" if statuses.get("failed") else "COMPLETED_WITH_REVIEW"}
    (run_dir/"extraction-summary.json").write_text(json.dumps(summary,ensure_ascii=False,indent=2),encoding="utf-8")
    print(json.dumps(summary),flush=True)

if __name__=="__main__":
    parser=argparse.ArgumentParser()
    parser.add_argument("--evidence",default=str(ROOT/".local"/"sample"/"split"/"evidence.pdf"))
    parser.add_argument("--manifest",default=str(ROOT/".local"/"sample"/"split"/"evidence-manifest.json"))
    parser.add_argument("--run-id",default="retry-001")
    parser.add_argument("--resume-from",default=None)
    parser.add_argument("--plan-only",action="store_true")
    parser.add_argument("--merge-only",action="store_true")
    parser.add_argument("--case-id",default="sample-evidence-only-retry-001")
    parser.add_argument("--document-id",default="d9142579-df2c-5dc1-82e5-e6b861680b11")
    asyncio.run(run(parser.parse_args()))
