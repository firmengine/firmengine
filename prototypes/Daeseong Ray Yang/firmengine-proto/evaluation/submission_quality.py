"""Strict independent evaluation of six generated court-form PRIMARY BODIES.

The legacy scalar comparator is diagnostic only. This evaluator freezes all
held-out pages and verifies content in the actual DOCX bodies, excluding evidence
appendices and raw-extraction worksheets. Private reference values never appear
in public reports or generation prompts.
"""
from __future__ import annotations

import argparse
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
import hashlib
import io
import json
from pathlib import Path
import re
import sys
from typing import Any

from docx import Document
from docx.table import Table
from docx.text.paragraph import Paragraph
from docx.oxml.ns import qn

import evaluate_sample as scalar

ROOT = scalar.ROOT
PUBLIC = ROOT / ".runtime" / "evaluation"  # Runtime-only output; never public source.
PRIVATE = ROOT / ".runtime" / "evaluation"
PROMPTS = ROOT / "promptbook"
MODEL = "gpt-6-luna"
MISSING_PATTERN = re.compile(r"\[(?:확인\s*필요|계산\s*보류|기간\s*선택\s*필요|불일치[^\]]*)\]")
TOKEN_PATTERN = re.compile(r"\{\{[^{}]+\}\}")
APPENDIX_MARKERS = ("검토·출처대조표", "검토출처대조표", "작성항목과원문근거", "증빙대조부록")


def canonical_hash(value: Any) -> str:
    return hashlib.sha256(json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode()).hexdigest()


def prompt_bundle(name: str) -> dict:
    directory = PROMPTS / name
    filenames = ["config.json", "system.md", "body.md", "input.schema.json", "output.schema.json"]
    raw = {name: (directory / name).read_bytes() for name in filenames}
    config = json.loads(raw["config.json"])
    if config.get("model") != MODEL or config.get("store") is not False:
        raise RuntimeError("Evaluation requires gpt-6-luna and store:false")
    return {"config": config, "system": raw["system.md"].decode("utf8"),
            "body": raw["body.md"].decode("utf8"),
            "schema": json.loads(raw["output.schema.json"]),
            "sha256": canonical_hash({name: hashlib.sha256(value).hexdigest() for name, value in raw.items()})}


def render_body(template: str, values: dict) -> str:
    # Only the template is scanned. Tokens in document data are never expanded.
    def resolve(match):
        key = match.group(1)
        if key not in values:
            raise RuntimeError("Evaluation prompt input is incomplete")
        value = values[key]
        return value if isinstance(value, str) else json.dumps(value, ensure_ascii=False)
    return re.sub(r"\{\{([a-zA-Z0-9_]+)\}\}", resolve, template)


def request_json(bundle: dict, body: str, images: list[dict] | None = None, schema: dict | None = None) -> tuple[dict, dict]:
    import httpx
    content = [{"type": "input_text", "text": body}, *(images or [])]
    request = {"model": MODEL, "store": False, "instructions": bundle["system"],
               "input": [{"role": "user", "content": content}],
               "max_output_tokens": bundle["config"]["max_output_tokens"],
               "text": {"format": {"type": "json_schema", "name": "independent_submission_evaluation",
                                   "strict": True, "schema": schema or bundle["schema"]}}}
    with httpx.Client(timeout=600) as client:
        response = client.post("https://api.openai.com/v1/responses",
                               headers={"Authorization": "Bearer " + scalar.load_api_key()}, json=request)
    if response.status_code != 200:
        raise RuntimeError("Evaluation API HTTP " + str(response.status_code))
    data = response.json()
    if data.get("status") != "completed":
        raise RuntimeError("Evaluation API did not complete")
    result = json.loads(scalar.response_text(data))
    return result, {"model": MODEL, "store": False, "usage": data.get("usage", {}),
                    "response_id": data.get("id"), "prompt_sha256": bundle["sha256"]}


def source_path(manifest: dict) -> Path:
    candidates = [PRIVATE / "source.pdf"]
    for candidate in candidates:
        if candidate.is_file():
            if hashlib.sha256(candidate.read_bytes()).hexdigest() == manifest["source_sha256"]:
                return candidate
    raise RuntimeError("No local source matches the independently reviewed sample hash")


def freeze_submission_gold() -> dict:
    import pymupdf
    manifest = scalar.read_json(PUBLIC / "sample_manifest.json")
    rubric = scalar.read_json(PUBLIC / "submission_rubric.json")
    rubric_hash = canonical_hash(rubric)
    bundle = prompt_bundle("evaluate-gold")
    target = PRIVATE / "golden_submission.json"
    if target.is_file():
        existing = scalar.read_json(target)
        if existing["source_sha256"] != manifest["source_sha256"] or existing["rubric_sha256"] != rubric_hash:
            raise RuntimeError("Frozen submission golden does not match source/rubric; do not silently redefine targets")
        frozen_manifest = PUBLIC / "submission_target_manifest.json"
        if not frozen_manifest.is_file() or scalar.read_json(frozen_manifest).get("private_golden_sha256") != canonical_hash(existing):
            raise RuntimeError("Frozen target content changed or its public fingerprint is missing")
        if set(existing["holdout_pages_covered"]) != set(manifest["holdout_pages"]):
            raise RuntimeError("Frozen target no longer covers every held-out page")
        return existing
    source = source_path(manifest)
    expected_pages = set(manifest["holdout_pages"])
    specified_pages = [page for form in rubric["documents"] for page in form["pages"]]
    if len(specified_pages) != len(set(specified_pages)) or set(specified_pages) != expected_pages:
        raise RuntimeError("Rubric must cover each holdout page exactly once")

    def extract(form: dict) -> dict:
        private_path = PRIVATE / ("submission_gold_" + form["kind"] + ".json")
        if private_path.is_file():
            result = scalar.read_json(private_path)
            if result["source_sha256"] != manifest["source_sha256"] or result["rubric_sha256"] != rubric_hash or result["prompt_sha256"] != bundle["sha256"]:
                raise RuntimeError("Private submission cache differs from the frozen source/rubric/prompt")
            return result
        with pymupdf.open(source) as pdf:
            images = []
            for page in form["pages"]:
                images.extend([{"type": "input_text", "text": "Original PDF page " + str(page)}, scalar.image_input(pdf, page)])
        values = {"document_kind": form["kind"], "original_pages": form["pages"], "section_categories": form["sections"]}
        schema = json.loads(json.dumps(bundle["schema"]))
        schema["properties"]["checks"]["items"]["properties"]["category"]["enum"] = form["sections"] + ["other_observed"]
        result, metadata = request_json(bundle, render_body(bundle["body"], values), images, schema)
        covered = [p["page"] for p in result["page_coverage"]]
        if len(covered) != len(set(covered)) or set(covered) != set(form["pages"]):
            raise RuntimeError("Reference extraction did not cover every assigned holdout page")
        for index, check in enumerate(result["checks"], 1):
            if check["page"] not in form["pages"]:
                raise RuntimeError("Reference check cites a non-assigned page")
            if check["scorable"] and not check["expected_text"]:
                raise RuntimeError("Scorable reference check has no observed target")
            check["id"] = form["kind"] + "-" + str(index).zfill(3)
        result.update(metadata)
        result.update(kind=form["kind"], source_sha256=manifest["source_sha256"], rubric_sha256=rubric_hash,
                      frozen_at=datetime.now(timezone.utc).isoformat())
        scalar.write_json(private_path, result)
        print(json.dumps({"gold_kind": form["kind"], "pages_covered": len(covered),
                          "checks": len(result["checks"]), "scorable": sum(c["scorable"] for c in result["checks"])}), flush=True)
        return result

    results = {}
    with ThreadPoolExecutor(max_workers=2) as pool:
        futures = {pool.submit(extract, form): form["kind"] for form in rubric["documents"]}
        for future in as_completed(futures):
            results[futures[future]] = future.result()
    golden = {"version": "2.0.0", "source_sha256": manifest["source_sha256"], "rubric_sha256": rubric_hash,
              "gold_prompt_sha256": bundle["sha256"], "model": MODEL, "human_verified": False,
              "independent_of_generated_output": True, "frozen_at": datetime.now(timezone.utc).isoformat(),
              "holdout_pages_covered": sorted(expected_pages),
              "documents": [results[form["kind"]] for form in rubric["documents"]]}
    scalar.write_json(target, golden)
    scalar.write_json(PUBLIC / "submission_target_manifest.json", {
        "version": golden["version"], "source_sha256": golden["source_sha256"],
        "rubric_sha256": rubric_hash, "gold_prompt_sha256": bundle["sha256"],
        "private_golden_sha256": canonical_hash(golden), "frozen_at": golden["frozen_at"],
        "holdout_pages_covered": golden["holdout_pages_covered"],
        "documents": [{"kind": d["kind"], "pages": [p["page"] for p in d["page_coverage"]],
                       "checks": len(d["checks"]), "scorable": sum(c["scorable"] for c in d["checks"]),
                       "critical_scorable": sum(c["critical"] and c["scorable"] for c in d["checks"])} for d in golden["documents"]]
    })
    return golden


def normalized_heading(value: str) -> str:
    return re.sub(r"[\s()（）]", "", value)


def primary_body(path: Path) -> dict:
    data = path.read_bytes()
    document = Document(io.BytesIO(data))
    lines = []
    appendix_reached = False
    table_index = 0
    for block in document.element.body.iterchildren():
        if block.tag == qn("w:p"):
            paragraph = Paragraph(block, document)
            text = paragraph.text.strip()
            if any(normalized_heading(text).startswith(marker) for marker in APPENDIX_MARKERS):
                appendix_reached = True
                break
            if text:
                lines.append({"index": len(lines), "type": "paragraph", "text": text})
        elif block.tag == qn("w:tbl"):
            table = Table(block, document)
            for row_index, row in enumerate(table.rows):
                cells = [cell.text.strip() for cell in row.cells]
                text = " | ".join(cells)
                lines.append({"index": len(lines), "type": "table_row", "table": table_index,
                              "row": row_index, "cells": cells, "text": text})
            table_index += 1
    text = "\n".join(line["text"] for line in lines)
    return {"sha256": hashlib.sha256(data).hexdigest(), "lines": lines,
            "appendix_excluded": appendix_reached, "table_count": table_index,
            "unresolved_placeholder_count": len(MISSING_PATTERN.findall(text)),
            "residual_template_tokens": len(TOKEN_PATTERN.findall(text))}


def load_primary_documents(generated: dict) -> dict:
    result = {}
    directory = Path(generated.get("artifact_dir", PRIVATE / "artifacts")).resolve()
    for artifact in generated.get("artifacts", []):
        if artifact.get("format", "").lower() != "docx" and not artifact.get("name", "").lower().endswith(".docx"):
            continue
        path = Path(artifact["path"]).resolve() if artifact.get("path") else (directory / artifact.get("name", "")).resolve()
        if not path.is_relative_to(ROOT.resolve()) or not path.is_file():
            continue
        kind = artifact.get("kind")
        if not kind:
            continue
        if kind in result:
            raise RuntimeError("Multiple generated primary documents share a kind")
        result[kind] = primary_body(path)
    return result


def validate_verdict(check: dict, verdict: dict, lines: list[dict]) -> dict:
    verdict = dict(verdict)
    indices = verdict.get("line_indices", [])
    valid_indices = all(isinstance(i, int) and 0 <= i < len(lines) for i in indices)
    if not check["scorable"]:
        verdict.update(status="target_unscorable", reason_code="source_unscorable")
        return verdict
    if verdict["status"] == "target_unscorable":
        verdict.update(status="missing", reason_code="missing_field")
    if verdict["status"] != "match":
        return verdict
    if not indices or not valid_indices:
        verdict.update(status="missing", reason_code="missing_field")
        return verdict
    selected = "\n".join(lines[i]["text"] for i in indices)
    quote = verdict.get("generated_quote", "")
    if not quote or quote not in selected:
        verdict.update(status="missing", reason_code="missing_field")
        return verdict
    if MISSING_PATTERN.search(quote) or TOKEN_PATTERN.search(quote):
        verdict.update(status="missing", reason_code="unresolved_placeholder")
        return verdict
    for value in check.get("numeric_values", []):
        if not scalar.row_has_value(selected, value):
            verdict.update(status="different", reason_code="wrong_value")
            return verdict
    return verdict


def score_submission(generated_path: Path) -> dict:
    golden = freeze_submission_gold()
    generated = scalar.read_json(generated_path)
    manifest = scalar.read_json(PUBLIC / "sample_manifest.json")
    bundle = prompt_bundle("evaluate-forms")
    bodies = load_primary_documents(generated)
    snapshot_hash = canonical_hash({kind: body["sha256"] for kind, body in bodies.items()})
    scalar.write_json(PRIVATE / "primary_body_snapshot.json", {"artifact_set_sha256": snapshot_hash, "documents": bodies})
    all_reports = []

    def evaluate(form: dict) -> dict:
        kind = form["kind"]
        body = bodies.get(kind)
        if not body:
            verdicts = [{"check_id": c["id"], "status": "missing" if c["scorable"] else "target_unscorable",
                         "line_indices": [], "generated_quote": "", "reason_code": "missing_field", "reason": ""} for c in form["checks"]]
            metadata = {"model": None, "status": "missing_primary_document"}
        else:
            fingerprint = canonical_hash({"golden": canonical_hash(form), "artifact": body["sha256"], "prompt": bundle["sha256"]})
            cache = PRIVATE / "submission_judgments" / (kind + "_" + fingerprint + ".json")
            if cache.exists():
                cached = scalar.read_json(cache)
                verdicts, metadata = cached["verdicts"], cached["metadata"]
            else:
                inputs = {"document_kind": kind, "reference_checks": form["checks"], "primary_document_lines": body["lines"]}
                result, metadata = request_json(bundle, render_body(bundle["body"], inputs))
                verdicts = result["verdicts"]
                ids = [v["check_id"] for v in verdicts]
                if len(ids) != len(set(ids)) or set(ids) != {c["id"] for c in form["checks"]}:
                    raise RuntimeError("Submission judgment changed the frozen target denominator")
                scalar.write_json(cache, {"verdicts": verdicts, "metadata": metadata, "fingerprint": fingerprint})
        verdict_map = {v["check_id"]: v for v in verdicts}
        public_checks = []
        for check in form["checks"]:
            verdict = validate_verdict(check, verdict_map[check["id"]], body["lines"] if body else [])
            public_checks.append({"id": check["id"], "page": check["page"], "category": check["category"],
                                  "comparison_type": check["comparison_type"], "scorable": check["scorable"],
                                  "critical": check["critical"], "interpretation_sensitive": check["interpretation_sensitive"],
                                  "status": verdict["status"], "reason_code": verdict["reason_code"]})
        counts = dict(__import__("collections").Counter(c["status"] for c in public_checks))
        report = {"kind": kind, "source_pages": [p["page"] for p in form["page_coverage"]],
                  "document_found": bool(body), "primary_line_count": len(body["lines"]) if body else 0,
                  "artifact_sha256": body["sha256"] if body else None,
                  "appendix_excluded": body["appendix_excluded"] if body else None,
                  "unresolved_placeholder_count": body["unresolved_placeholder_count"] if body else None,
                  "residual_template_tokens": body["residual_template_tokens"] if body else None,
                  "counts": counts, "scorable": sum(c["scorable"] for c in public_checks),
                  "critical_unmet": sum(c["critical"] and c["status"] != "match" for c in public_checks),
                  "checks": public_checks}
        print(json.dumps({"evaluated_kind": kind, "counts": counts, "critical_unmet": report["critical_unmet"]}), flush=True)
        return report

    with ThreadPoolExecutor(max_workers=2) as pool:
        futures = {pool.submit(evaluate, form): form["kind"] for form in golden["documents"]}
        for future in as_completed(futures):
            all_reports.append(future.result())
    order = {d["kind"]: i for i, d in enumerate(golden["documents"])}
    all_reports.sort(key=lambda d: order[d["kind"]])
    raw_input = generated.get("evidence_pages_used")
    input_pages = [v.get("page") if isinstance(v, dict) else v for v in (raw_input or [])]
    input_pages = {p for p in input_pages if isinstance(p, int)}
    holdout_input = sorted(input_pages.intersection(manifest["holdout_pages"]))
    missing_evidence = sorted(set(manifest["evidence_pages"]) - input_pages)
    leaked_citations = sorted(scalar.cited_pages(generated).intersection(manifest["holdout_pages"]))
    all_checks = [c for document in all_reports for c in document["checks"]]
    counts = dict(__import__("collections").Counter(c["status"] for c in all_checks))
    passed = (len(bodies) == 6 and not holdout_input and not leaked_citations and isinstance(raw_input, list)
              and not missing_evidence and all(d["critical_unmet"] == 0 and d["unresolved_placeholder_count"] == 0
                                               and d["residual_template_tokens"] == 0 for d in all_reports))
    report = {"version": "2.0.0", "created_at": datetime.now(timezone.utc).isoformat(), "sample_count": 1,
              "source_sha256": manifest["source_sha256"], "rubric_sha256": golden["rubric_sha256"],
              "frozen_golden_sha256": canonical_hash(golden), "artifact_set_sha256": snapshot_hash,
              "judge_prompt_sha256": bundle["sha256"], "model": MODEL,
              "holdout_pages_covered": golden["holdout_pages_covered"],
              "scoring_scope": "actual_six_DOCX_primary_bodies_only_appendices_and_raw_records_excluded",
              "counts": counts, "scorable_checks": sum(c["scorable"] for c in all_checks),
              "critical_unmet": sum(d["critical_unmet"] for d in all_reports),
              "automated_completeness_pass": passed, "court_submission_ready": False,
              "lawyer_signoff_required": True, "human_verified_golden": False,
              "leakage": {"input_manifest_present": isinstance(raw_input, list), "heldout_pages_in_input": holdout_input,
                          "heldout_page_citations": leaked_citations, "missing_evidence_pages": missing_evidence},
              "documents": all_reports,
              "limitations": ["One case; no population or time-saving claim.",
                              "Same model family separately extracted and judged reference targets; expert validation is still required.",
                              "Missing legally recognized values can be correctly withheld by the product yet still fail submission completeness.",
                              "Source redaction prevents certifying masked required facts.",
                              "Signature, consent and legal judgment are human responsibilities."]}
    scalar.write_json(PUBLIC / "submission_report.json", report)
    write_public_report(report)
    return report


def write_public_report(report: dict) -> None:
    lines = ["# 제출서류 본문 독립 평가", "", "평가용 제출본을 생성 입력에서 분리하고, 지정된 DOCX의 실제 본문만 비교했습니다. 근거 부록·워크북 추출값·원본 인용은 본문 완성으로 계산하지 않습니다.", "",
             "- 자동 완성도 기준: " + ("충족" if report["automated_completeness_pass"] else "미충족"),
             "- 법원 제출 가능 판정: 미확정. 실제 양식·내용에 대한 변호사 최종 확인이 필요합니다.",
             f"- 동결된 비교 가능 체크: {report['scorable_checks']}개",
             "- 결과: " + json.dumps(report["counts"], ensure_ascii=False),
             f"- 충족되지 않은 중요 체크: {report['critical_unmet']}개", "",
             "| 서류 종류 | 제출본 페이지 수 | 본문 비교 결과 | 중요 미충족 | 미확인 자리표시자 |",
             "|---|---:|---|---:|---:|"]
    for document in report["documents"]:
        lines.append(f"| {document['kind']} | {len(document['source_pages'])} | {json.dumps(document['counts'],ensure_ascii=False)} | {document['critical_unmet']} | {document['unresolved_placeholder_count']} |")
    lines += ["", "## 생성 입력 분리", "",
              "- holdout 입력 혼입 페이지: " + str(report["leakage"]["heldout_pages_in_input"]),
              "- holdout 출처 인용 페이지: " + str(report["leakage"]["heldout_page_citations"]),
              "- 누락된 예정 증빙 페이지: " + str(report["leakage"]["missing_evidence_pages"]), "",
              "## 해석", "",
              "같은 모델 계열을 사용했지만 정답 추출 요청과 생성 요청은 분리했습니다. 정답은 생성기에 전달하지 않았고, 평가 기준·정답 해시를 고정하여 반복 실행에서도 분모를 유지합니다.", "",
              "법적 인정 판단 때문에 값을 안전하게 보류한 경우도 제출서류 완성도에서는 미완성으로 집계합니다. 실제 판단이 필요한 값과 단순 추출·표 반영 오류는 별도로 수정해야 합니다.", "",
              "마스킹된 원본의 필수정보는 확인할 수 없으므로 자동 평가만으로 실제 제출 가능을 판정하지 않습니다. 고객정보와 기대·생성 금액은 이 보고서에 포함하지 않았습니다.", ""]
    (PUBLIC / "SUBMISSION_REPORT.md").write_text("\n".join(lines), encoding="utf8")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--freeze-golden", action="store_true")
    parser.add_argument("--generated", type=Path, default=PRIVATE / "generated.json")
    args = parser.parse_args()
    try:
        if args.freeze_golden:
            golden = freeze_submission_gold()
            print(json.dumps({"submission_golden_frozen": True, "pages": len(golden["holdout_pages_covered"]),
                              "check_count": sum(len(d["checks"]) for d in golden["documents"])}), flush=True)
        else:
            report = score_submission(args.generated)
            print(json.dumps({"submission_report": "evaluation/submission_report.json", "counts": report["counts"],
                              "automated_completeness_pass": report["automated_completeness_pass"]}), flush=True)
        return 0
    except Exception as error:
        print(json.dumps({"submission_evaluation_failed": type(error).__name__, "message": str(error)[:140]}), file=sys.stderr, flush=True)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
