"""Real embedding smoke using nonpersonal synthetic text; remove its source afterwards."""
from pathlib import Path
import asyncio
import json
import sys
import uuid

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT))
from app import rag


async def main():
    group="synthetic-vector-smoke-"+str(uuid.uuid4())
    source_id=None
    try:
        result=await rag.ingest("합성 검증 자료: 사건의 생성된 문서를 담당자가 검수한 다음 변호사가 실제 파일의 최종 내용을 확인한다.",{
            "collection":"public_observation","source_id":"synthetic-only-embedding-verification","title":"합성 벡터 연결 확인용; 실제 법규·성공사례 아님",
            "jurisdiction":"서울회생법원","valid_from":"2026-01-01","valid_to":None,"reviewed":True,
            "dataset_group_id":group,"evaluation_only":False,"source_version":"synthetic-1"})
        if not result.get("available"):
            print(json.dumps(result,ensure_ascii=False))
            return
        source_id=result["source_version_id"]
        filters={"jurisdiction":"서울회생법원","filing_date":"2026-10-26","collections":["public_observation"],"excluded_dataset_group_ids":[]}
        found=await rag.search("생성된 서류를 마지막으로 확인하는 사람은 누구인가?",filters)
        excluded=await rag.search("문서 검수",filters | {"excluded_dataset_group_ids":[group]})
        historical=await rag.search("문서 검수",filters | {"filing_date":"2025-12-31"})
        report={"synthetic_only":True,"ingest_real_embedding":result.get("available"),"dimensions":result.get("dimensions"),
                "semantic_search_method":found.get("method"),"source_found":any(r["source_version_id"]==source_id for r in found.get("results",[])),
                "same_group_excluded":all(r["source_version_id"]!=source_id for r in excluded.get("results",[])),
                "future_version_excluded":all(r["source_version_id"]!=source_id for r in historical.get("results",[])),
                "provider":found.get("provider"),"model":rag.MODEL,"source_removed_after_verification":True}
        (ROOT/".local"/"vector-verification.json").write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding="utf-8")
        print(json.dumps(report,ensure_ascii=False))
        if not all(report[key] for key in ("ingest_real_embedding","source_found","same_group_excluded","future_version_excluded")):
            raise SystemExit(1)
    finally:
        if source_id:
            with rag._db() as con:
                con.execute("DELETE FROM vector_sources WHERE id=?",(source_id,))


if __name__=="__main__":
    asyncio.run(main())
