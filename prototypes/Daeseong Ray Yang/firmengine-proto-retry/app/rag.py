"""Private SQLite vectors from real OpenAI embeddings, with time/scope/leak filters.

This is a small local exact-cosine vector store, not Qdrant and not string search.
No built-in successful case examples or evaluation answers are seeded.
"""
from __future__ import annotations

from contextlib import contextmanager
from datetime import date, datetime, timezone
import hashlib
import json
import math
import os
from pathlib import Path
import sqlite3
import uuid

from . import ai

ROOT = Path(__file__).resolve().parents[1]
MODEL = "text-embedding-3-small"
COLLECTIONS = ("law", "practice", "public_observation", "success_case")
CASE_COLLECTIONS = ("public_observation", "success_case")
_last_error = None


def _now():
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def _path():
    return Path(os.environ.get("FIRMENGINE_DATA_DIR", ROOT / ".local")).resolve() / "knowledge-vectors.sqlite"


@contextmanager
def _db():
    path = _path()
    path.parent.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(path, timeout=30)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA foreign_keys=ON")
    connection.executescript("""
        CREATE TABLE IF NOT EXISTS vector_sources(
            id TEXT PRIMARY KEY,
            version_hash TEXT UNIQUE NOT NULL,
            content_hash TEXT NOT NULL,
            metadata_json TEXT NOT NULL,
            embedding_model TEXT NOT NULL,
            created_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS vector_chunks(
            id TEXT PRIMARY KEY,
            source_id TEXT NOT NULL REFERENCES vector_sources(id) ON DELETE CASCADE,
            position INTEGER NOT NULL,
            text TEXT NOT NULL,
            text_hash TEXT NOT NULL,
            vector_json TEXT NOT NULL,
            UNIQUE(source_id,position)
        );
        CREATE TABLE IF NOT EXISTS embedding_audit(
            id TEXT PRIMARY KEY,
            operation TEXT NOT NULL,
            model TEXT NOT NULL,
            input_count INTEGER NOT NULL,
            usage_json TEXT NOT NULL,
            created_at TEXT NOT NULL
        );
    """)
    try:
        yield connection
        connection.commit()
    except Exception:
        connection.rollback()
        raise
    finally:
        connection.close()


def _validate_date(value, field, required=False):
    if not value:
        if required:
            raise ValueError(f"{field} 기준일이 필요합니다.")
        return None
    try:
        return date.fromisoformat(str(value)).isoformat()
    except ValueError:
        raise ValueError(f"{field}는 YYYY-MM-DD 형식이어야 합니다.") from None


def _metadata(raw):
    if not isinstance(raw, dict):
        raise ValueError("지식 메타데이터가 필요합니다.")
    collection = raw.get("collection")
    if collection not in COLLECTIONS:
        raise ValueError("collection은 law/practice/public_observation/success_case 중 하나여야 합니다.")
    if not raw.get("source_url") and not raw.get("source_id"):
        raise ValueError("출처 URL 또는 제공 자료 식별자가 필요합니다.")
    if not str(raw.get("jurisdiction") or "").strip():
        raise ValueError("적용 관할이 필요합니다.")
    if not isinstance(raw.get("reviewed"), bool) or not isinstance(raw.get("evaluation_only"), bool):
        raise ValueError("reviewed와 evaluation_only는 명시적인 true/false 값이어야 합니다.")
    group = str(raw.get("dataset_group_id") or "").strip()
    if (collection in CASE_COLLECTIONS or raw["evaluation_only"]) and not group:
        raise ValueError("사례·관찰·평가 자료는 동일 자료 묶음을 식별할 dataset_group_id가 필요합니다.")
    valid_from = _validate_date(raw.get("valid_from"), "valid_from", required=True)
    valid_to = _validate_date(raw.get("valid_to"), "valid_to")
    if valid_to and valid_to < valid_from:
        raise ValueError("valid_to는 valid_from보다 앞설 수 없습니다.")
    # Explicit allowlist avoids storing unrelated secrets in metadata.
    return {
        "collection":collection,
        "source_url":str(raw.get("source_url") or ""),
        "source_id":str(raw.get("source_id") or ""),
        "title":str(raw.get("title") or ""),
        "source_version":str(raw.get("source_version") or ""),
        "jurisdiction":str(raw["jurisdiction"]).strip(),
        "valid_from":valid_from,"valid_to":valid_to,
        "reviewed":raw["reviewed"],"evaluation_only":raw["evaluation_only"],
        "dataset_group_id":group,
        "authority":str(raw.get("authority") or ""),
        "interpretation_status":str(raw.get("interpretation_status") or "review_required"),
    }


async def _embed(texts, operation):
    global _last_error
    config = ai.settings()
    if not config["api_key"]:
        _last_error = "OpenAI 임베딩 API 키가 설정되지 않았습니다."
        return None, {"available":False,"reason":_last_error,"model":MODEL}
    from openai import AsyncOpenAI
    try:
        async with AsyncOpenAI(api_key=config["api_key"], base_url=config["base_url"],
                               timeout=min(60, config["timeout"]), max_retries=1) as client:
            response = await client.embeddings.create(model=MODEL, input=texts, encoding_format="float")
        ordered = sorted(response.data, key=lambda item:item.index)
        if len(ordered) != len(texts):
            raise ValueError("임베딩 개수 불일치")
        vectors = [item.embedding for item in ordered]
        if len({len(vector) for vector in vectors}) != 1 or any(not vector or not all(math.isfinite(value) for value in vector) or not any(vector) for vector in vectors):
            raise ValueError("임베딩 값 또는 차원 확인 필요")
        usage = response.usage.model_dump() if response.usage else {}
        with _db() as con:
            con.execute("INSERT INTO embedding_audit VALUES(?,?,?,?,?,?)", (str(uuid.uuid4()),operation,MODEL,len(texts),json.dumps(usage),_now()))
        _last_error = None
        return vectors, {"available":True,"model":MODEL,"usage":usage,"dimensions":len(vectors[0])}
    except Exception as exc:
        # Raw provider exceptions may include user inputs or HTTP secrets.
        code = getattr(exc,"status_code",None)
        _last_error = f"실제 임베딩 호출 실패 ({type(exc).__name__}, HTTP {code or '-'})"
        return None, {"available":False,"reason":_last_error,"error_type":type(exc).__name__,"http_status":code,"model":MODEL}


async def ingest(text, metadata):
    text = str(text or "").strip()
    if not text or len(text) > 32000:
        raise ValueError("한 자료는 1~32,000자로 범위를 좁혀 입력하세요.")
    meta = _metadata(metadata)
    content_hash = hashlib.sha256(text.encode("utf-8")).hexdigest()
    version_hash = hashlib.sha256((content_hash + json.dumps(meta,ensure_ascii=False,sort_keys=True)+MODEL).encode("utf-8")).hexdigest()
    with _db() as con:
        existing = con.execute("SELECT id FROM vector_sources WHERE version_hash=?", (version_hash,)).fetchone()
        if existing:
            count = con.execute("SELECT COUNT(*) FROM vector_chunks WHERE source_id=?", (existing["id"],)).fetchone()[0]
            return {"available":True,"source_version_id":existing["id"],"version_hash":version_hash,"content_hash":content_hash,"chunks":count,"deduplicated":True,"provider":"OpenAI embeddings + SQLite exact cosine","model":MODEL}
    chunks = [text[index:index+1000] for index in range(0,len(text),1000)]
    vectors, details = await _embed(chunks,"ingest")
    if vectors is None:
        return details | {"stored":False,"chunks":0}
    identity = str(uuid.uuid4())
    with _db() as con:
        # Recheck under the write transaction if another caller embedded the same version.
        existing=con.execute("SELECT id FROM vector_sources WHERE version_hash=?",(version_hash,)).fetchone()
        if existing:
            identity=existing["id"]
        else:
            con.execute("INSERT INTO vector_sources VALUES(?,?,?,?,?,?)",(identity,version_hash,content_hash,json.dumps(meta,ensure_ascii=False),MODEL,_now()))
            for index,(chunk,vector) in enumerate(zip(chunks,vectors)):
                con.execute("INSERT INTO vector_chunks VALUES(?,?,?,?,?,?)",(str(uuid.uuid4()),identity,index,chunk,hashlib.sha256(chunk.encode()).hexdigest(),json.dumps(vector,separators=(",",":"))))
    return details | {"stored":True,"source_version_id":identity,"version_hash":version_hash,"content_hash":content_hash,"chunks":len(chunks),"provider":"OpenAI embeddings + SQLite exact cosine","metadata":meta}


def _eligible(meta, filters, filing_date, excluded, collections):
    if meta.get("evaluation_only"):
        return False
    if meta.get("dataset_group_id") and meta["dataset_group_id"] in excluded:
        return False
    if meta["collection"] not in collections:
        return False
    if meta["jurisdiction"] not in (filters["jurisdiction"],"대한민국","전국"):
        return False
    if meta["valid_from"] > filing_date or (meta.get("valid_to") and meta["valid_to"] < filing_date):
        return False
    if meta["collection"] in ("law","practice","success_case") and not meta["reviewed"]:
        return False
    if meta["collection"] in CASE_COLLECTIONS and not meta.get("dataset_group_id"):
        return False
    return True


async def search(query, filters):
    query = str(query or "").strip()
    if not query or len(query)>4000:
        raise ValueError("검색 질문은 1~4,000자로 입력하세요.")
    filters = dict(filters or {})
    if not str(filters.get("jurisdiction") or "").strip():
        raise ValueError("검색에는 사건의 jurisdiction이 필요합니다.")
    filing_date = _validate_date(filters.get("filing_date"),"filing_date",required=True)
    excluded_raw = filters.get("excluded_dataset_group_ids",[])
    if not isinstance(excluded_raw,list) or not all(isinstance(item,str) and item for item in excluded_raw):
        raise ValueError("excluded_dataset_group_ids는 자료 묶음 식별자 문자열 배열이어야 합니다.")
    excluded = set(excluded_raw)
    # Optional current group is excluded even when the caller omitted it from the list.
    if filters.get("dataset_group_id"):
        excluded.add(str(filters["dataset_group_id"]))
    collections = filters.get("collections",list(COLLECTIONS))
    if not isinstance(collections,list) or not all(item in COLLECTIONS for item in collections):
        raise ValueError("지원되는 collections 배열이 필요합니다.")
    try:
        limit = max(1,min(12,int(filters.get("limit",5))))
    except (ValueError,TypeError):
        raise ValueError("limit은 정수여야 합니다.") from None
    with _db() as con:
        rows = con.execute("SELECT c.*,s.version_hash,s.content_hash,s.metadata_json,s.embedding_model,s.created_at FROM vector_chunks c JOIN vector_sources s ON s.id=c.source_id WHERE s.embedding_model=?",(MODEL,)).fetchall()
    candidates=[]
    for row in rows:
        meta=json.loads(row["metadata_json"])
        if _eligible(meta,filters,filing_date,excluded,collections):
            candidates.append((dict(row),meta))
    if not ai.settings()["api_key"]:
        return {"available":False,"reason":"OpenAI 임베딩 API 키가 설정되지 않았습니다.","results":[],"model":MODEL}
    if not candidates:
        return {"available":True,"method":"vector_store_filtered_empty","results":[],"model":MODEL,"searched_vectors":0,
                "warning":"해당 관할·기준일·검토 상태에 맞는 벡터 자료가 없습니다. 평가 전용 및 제외 자료 묶음은 검색하지 않았습니다."}
    vectors,details=await _embed([query],"search")
    if vectors is None:
        return details | {"results":[]}
    query_vector=vectors[0]
    query_norm=math.sqrt(sum(value*value for value in query_vector))
    results=[]
    for row,meta in candidates:
        vector=json.loads(row["vector_json"])
        if len(vector)!=len(query_vector):
            continue
        norm=math.sqrt(sum(value*value for value in vector))
        if not norm:
            continue
        score=sum(a*b for a,b in zip(query_vector,vector))/(query_norm*norm)
        results.append({"id":row["id"],"source_version_id":row["source_id"],"text":row["text"],"position":row["position"],"score":round(score,6),
                        "metadata":meta,"version_hash":row["version_hash"],"content_hash":row["content_hash"],"chunk_hash":row["text_hash"],"created_at":row["created_at"]})
    results.sort(key=lambda row:(-row["score"],row["id"]))
    return details | {"method":"real_embedding_exact_cosine","provider":"OpenAI embeddings + SQLite exact cosine","results":results[:limit],"searched_vectors":len(candidates),
                      "filters":{"jurisdiction":filters["jurisdiction"],"filing_date":filing_date,"collections":collections,"excluded_dataset_group_ids":sorted(excluded),"evaluation_only_excluded":True},
                      "note":"사례 관찰과 검토된 성공사례는 법령의 일반 규칙으로 자동 승격되지 않습니다."}


def status():
    with _db() as con:
        chunks=con.execute("SELECT COUNT(*) FROM vector_chunks").fetchone()[0]
        sources=con.execute("SELECT metadata_json FROM vector_sources").fetchall()
        audit=con.execute("SELECT created_at FROM embedding_audit ORDER BY created_at DESC LIMIT 1").fetchone()
    counts={name:0 for name in COLLECTIONS}
    for row in sources:
        meta=json.loads(row["metadata_json"])
        counts[meta["collection"]]+=1
    return {"configured":bool(ai.settings()["api_key"]),"provider":"OpenAI embeddings + SQLite exact cosine","model":MODEL,
            "indexed_chunks":chunks,"source_versions":len(sources),"collections":counts,"last_successful_embedding_at":audit[0] if audit else None,
            "last_error":_last_error,"network_verified":bool(audit),"evaluation_leak_filter":True,
            "automatic_case_to_knowledge_sync":False,"qdrant":False}
