"""Scoped Responses API calls and editable, versioned prompt files.

Only the caller persists the returned audit in the private case store. Secrets and
raw HTTP error messages are deliberately excluded from audit/error strings.
"""
from __future__ import annotations

import asyncio
import hashlib
import json
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
PROMPTBOOK = ROOT / "promptbook"
AGENTS = ("classify", "extract", "validate", "judge", "draft", "law_update", "evaluate")


def settings() -> dict[str, Any]:
    values: dict[str, str] = {}
    # More specific files override ancestors, and actual environment wins.
    for directory in reversed([ROOT, *ROOT.parents]):
        env_file = directory / ".env"
        if env_file.is_file():
            for line in env_file.read_text(encoding="utf-8-sig").splitlines():
                line = line.strip()
                if not line or line.startswith("#") or "=" not in line:
                    continue
                key, value = line.split("=", 1)
                key, value = key.strip(), value.strip()
                if key.startswith("export "):
                    key = key[7:].strip()
                if value[:1] in ("'", '"') and value[-1:] == value[:1]:
                    value = value[1:-1]
                values[key] = value
    values.update(os.environ)
    return {
        "api_key": values.get("OPENAI_API_KEY") or values.get("OPEN_AI_API_KEY", ""),
        "model": values.get("OPENAI_MODEL") or values.get("OPEN_AI_MODEL") or "gpt-6-luna",
        "base_url": values.get("OPENAI_BASE_URL", "https://api.openai.com/v1"),
        "timeout": float(values.get("FIRMENGINE_AI_TIMEOUT", "90")),
        "retries": min(3, max(0, int(values.get("FIRMENGINE_AI_RETRIES", "1")))),
        "concurrency": max(1, min(8, int(values.get("FIRMENGINE_AI_CONCURRENCY", "3")))),
        "extract_output_tokens": max(1000,min(24000,int(values.get("FIRMENGINE_EXTRACT_OUTPUT_TOKENS", "12000")))),
    }


def status() -> dict[str, Any]:
    config = settings()
    return {"configured": bool(config["api_key"]), "model": config["model"],
            "provider": "OpenAI Responses API", "external_retention_verified": False}


def read_prompt(name: str) -> dict[str, Any]:
    if name not in AGENTS:
        raise ValueError("알 수 없는 에이전트입니다.")
    directory = PROMPTBOOK / name
    result = {"name": name,
              "system": (directory / "system.md").read_text(encoding="utf-8"),
              "body": (directory / "body.md").read_text(encoding="utf-8"),
              "config": json.loads((directory / "config.json").read_text(encoding="utf-8"))}
    for schema_name in ("input", "output"):
        schema_path=directory/f"{schema_name}.schema.json"
        if schema_path.is_file():
            result[f"{schema_name}_schema"]=json.loads(schema_path.read_text(encoding="utf-8"))
    result["sha256"] = hashlib.sha256(json.dumps(result, ensure_ascii=False, sort_keys=True).encode()).hexdigest()
    result["connected"] = name in ("classify", "extract")
    return result


def list_prompts() -> dict[str, Any]:
    return {"agents": [read_prompt(name) for name in AGENTS]}


def update_prompt(name: str, fields: dict[str, Any]) -> dict[str, Any]:
    read_prompt(name)
    for field in ("system", "body"):
        if field in fields:
            value = str(fields[field])
            if not value.strip() or len(value) > 30000:
                raise ValueError("프롬프트는 1~30,000자로 입력하세요.")
            (PROMPTBOOK / name / f"{field}.md").write_text(value, encoding="utf-8")
    return read_prompt(name)


_semaphore: asyncio.Semaphore | None = None
_semaphore_loop: Any = None


async def call_agent(name: str, payload: dict[str, Any], schema: dict[str, Any],
                     image_data_url: str | None = None) -> tuple[dict[str, Any], dict[str, Any]]:
    """Return parsed structured output and a caller-owned private audit record."""
    global _semaphore, _semaphore_loop
    config = settings()
    if not config["api_key"]:
        raise RuntimeError("OpenAI API 키가 설정되지 않았습니다.")
    prompt = read_prompt(name)  # Reload at every call: edits apply to the next job.
    if prompt.get("output_schema", {}).get("properties"):
        schema=prompt["output_schema"]
    input_text = prompt["body"] + "\n\n입력 자료:\n" + json.dumps(payload, ensure_ascii=False)
    if len(input_text) > 70000:
        raise ValueError("페이지 입력 예산을 초과했습니다. 문서 범위를 나눠주세요.")
    content: list[dict[str, Any]] = [{"type": "input_text", "text": input_text}]
    if image_data_url:
        content.append({"type": "input_image", "image_url": image_data_url, "detail": "high"})
    audit: dict[str, Any] = {
        "agent": name, "model": config["model"], "prompt_version": prompt["config"]["version"],
        "prompt_sha256": prompt["sha256"], "system": prompt["system"], "body": prompt["body"],
        "input": payload, "image_sha256": hashlib.sha256(image_data_url.encode()).hexdigest() if image_data_url else None,
        "created_at": datetime.now(timezone.utc).isoformat(), "attempts": 0,
    }
    from openai import AsyncOpenAI
    if _semaphore is None or _semaphore_loop is not asyncio.get_running_loop():
        _semaphore = asyncio.Semaphore(config["concurrency"])
        _semaphore_loop=asyncio.get_running_loop()
    async with _semaphore:
        async with AsyncOpenAI(api_key=config["api_key"], base_url=config["base_url"],
                               timeout=config["timeout"], max_retries=0) as client:
            for attempt in range(config["retries"] + 1):
                audit["attempts"] = attempt + 1
                try:
                    response = await client.responses.create(
                        model=config["model"], instructions=prompt["system"],
                        input=[{"role": "user", "content": content}],
                        text={"format": {"type": "json_schema", "name": f"{name}_result", "strict": True, "schema": schema}},
                        max_output_tokens=config["extract_output_tokens"] if name=="extract" else int(prompt["config"].get("max_output_tokens", 5000)),
                        store=False,
                    )
                    audit.update({"response_id":response.id,"response_status":response.status,
                                  "usage":response.usage.model_dump() if response.usage else {}})
                    if response.status != "completed":
                        incomplete=getattr(response,"incomplete_details",None)
                        audit["incomplete_details"]=incomplete.model_dump() if incomplete else None
                        raise ValueError("모델 출력이 완료되지 않았습니다.")
                    # Read only output_text messages. Reasoning blocks are not persisted.
                    outputs = [part.text for item in response.output if getattr(item, "type", "") == "message"
                               for part in item.content if getattr(part, "type", "") == "output_text"]
                    parsed = None
                    for output in outputs:
                        try:
                            value = json.loads(output)
                            if isinstance(value, dict):
                                parsed = value
                                break
                        except json.JSONDecodeError:
                            continue
                    if parsed is None:
                        raise ValueError("구조화된 JSON 응답을 읽지 못했습니다.")
                    audit.update({"status": "completed", "output": parsed, "response_id": response.id,
                                  "usage": response.usage.model_dump() if response.usage else {}})
                    return parsed, audit
                except Exception as exc:
                    http_status = getattr(exc, "status_code", None)
                    retryable = http_status in (408, 409, 429, 500, 502, 503, 504) or type(exc).__name__ in ("APITimeoutError", "APIConnectionError")
                    audit.update({"status": "failed", "error_type": type(exc).__name__, "http_status": http_status})
                    if not retryable or attempt >= config["retries"]:
                        error = RuntimeError(f"{name} 호출 실패 ({type(exc).__name__}, HTTP {http_status or '-'})")
                        error.audit = audit
                        raise error from None
                    await asyncio.sleep(min(8, 2 ** attempt))
    raise RuntimeError("에이전트 호출이 완료되지 않았습니다.")
