"""Export allowlisted working-tree reference sources without running either app."""
from __future__ import annotations

import hashlib
import json
import re
import subprocess
from pathlib import Path

BUNDLE = Path(__file__).resolve().parent
AX = BUNDLE.parent
PROTO = AX.parent
RETRY = PROTO.with_name("firmengine-proto-retry")
REPO = PROTO.parents[2]


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def write(path: Path, text: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding="utf-8", newline="\n")


def export(bundle: Path, copies: list[tuple[Path, Path]]) -> dict:
    entries = []
    for source, destination in copies:
        # The merge may add source files before they are staged. Trust only the
        # explicit source list below, never a directory-wide export or Git status.
        resolved = source.resolve(strict=True)
        relative = resolved.relative_to(REPO.resolve()).as_posix()
        if not resolved.is_file() or source.is_symlink():
            raise ValueError(f"Source must be a regular repository file: {relative}")
        if any(part.startswith(".env") or part in {".git", ".runtime", ".local", "private", "node_modules"}
               for part in resolved.relative_to(REPO.resolve()).parts):
            raise ValueError(f"Runtime/private source is not exportable: {relative}")
        target = (bundle / destination).resolve()
        target.relative_to(bundle.resolve())
        data = source.read_bytes()
        if source.suffix == ".json":
            json.loads(data)
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(data)
        entries.append({"source": relative, "copy": destination.as_posix(), "sha256": sha256(data)})
    return {"source_commit": subprocess.check_output(
        ["git", "rev-parse", "HEAD"], cwd=REPO, text=True).strip(),
        "scope": "allowlisted working-tree source snapshot; source_commit is the base HEAD, not a claim that copied bytes are committed; not a live n8n export",
        "files": entries, "excerpts": []}


def prompt_files(root: Path, names: tuple[str, ...], target: str) -> list[tuple[Path, Path]]:
    allowed = {"system.md", "body.md", "config.json", "input.schema.json", "output.schema.json",
               "input.example.json", "output.example.json", "example.json", "IO.md", "RUNTIME.md"}
    return [(p, Path(target) / name / p.name) for name in names
            for p in sorted((root / "promptbook" / name).iterdir()) if p.name in allowed]


def source(relative: str) -> str:
    return (AX / "lib" / relative).read_text(encoding="utf-8")


def policies() -> dict[str, dict]:
    rows = json.loads(source("reference-prompt-policies.json"))["policies"]
    result = {row["id"]: row for row in rows}
    if len(rows) != len(result):
        raise ValueError("Duplicate prompt policy ID")
    return result


def render_policy(name: str, **params: str) -> str:
    """Render compiled seed text once, with the same named-token contract as TS.

    This never reads a live D1 override, interprets inserted tokens again or
    evaluates registry text as Python/JavaScript code.
    """
    row = policies()[name]
    expected = set(row["placeholders"])
    template = row["template"]
    tokens = set(re.findall(r"\{\{([A-Za-z][A-Za-z0-9_]*)\}\}", template))
    if set(params) != expected or tokens != expected:
        raise ValueError(f"Prompt placeholder mismatch: {name}")
    return re.sub(r"\{\{([A-Za-z][A-Za-z0-9_]*)\}\}", lambda match: params[match[1]], template)


def quoted_constant(relative: str, name: str) -> str:
    text = source(relative)
    match = re.search(r"\bconst " + re.escape(name) + r'\s*=\s*("(?:[^"\\]|\\.)*")', text)
    if not match:
        raise ValueError(f"Cannot find literal: {relative}:{name}")
    return json.loads(match[1])


def excerpt(manifest: dict, relative: str, start: str, end: str | None) -> str:
    text = source(relative)
    begin = text.index(start)
    finish = text.index(end, begin) if end is not None else len(text)
    snippet = text[begin:finish].rstrip()
    line = text.count("\n", 0, begin) + 1
    manifest["excerpts"].append({"source": (AX / "lib" / relative).relative_to(REPO).as_posix(),
                                 "start_line": line, "line_count": len(snippet.splitlines()),
                                 "sha256_utf8": sha256(snippet.encode("utf-8"))})
    return f"원본: `lib/{relative}:{line}`\n\n```ts\n{snippet}\n```\n"


def export_ax_prompts(manifest: dict) -> None:
    target = BUNDLE / "ax-site-prompts"
    contract = json.loads(source("document-agent-field-contracts.json"))
    nature = render_policy("prompt.classification_recovery.source_nature_instructions")
    signatures = render_policy("prompt.classification_recovery.family_signature_guidance")
    classifiers = []
    for name, policy_id in (("CLASSIFICATION_INSTRUCTIONS", "prompt.classification_recovery.classification_instructions"),
                            ("CLASSIFICATION_RECOVERY_INSTRUCTIONS", "prompt.classification_recovery.classification_recovery_instructions")):
        text = nature + "\n" + signatures + "\n" + render_policy(policy_id, value1=contract["catalog_release"])
        classifiers.append(f"## {name}\n\n{text}\n")
    write(target / "01-classifier.md", "# 분류·분류 복구 프롬프트\n\n"
          "현재 코드의 seed 정책으로 정적 instructions를 펼쳤습니다. 사용자 입력에는 family catalog, 페이지 번호와 원본 이미지가 추가됩니다. "
          "원문은 `reference-prompt-policies.json`이며 조합 코드는 `classification-recovery.ts`입니다.\n\n"
          + "\n".join(classifiers) + "\n## 호출 조합\n\n"
          + excerpt(manifest, "pipeline.ts", "      const {value,usage}=await callLuna<ClassificationRead", "      await logUsage"))

    bbox = render_policy("prompt.field_observation.source_bbox_instructions")
    observation = render_policy("prompt.field_observation.field_observation_instructions", value1=bbox)
    handoff = render_policy("prompt.source_nature_context.source_nature_handoff_instructions")
    extract = observation + "\n" + handoff + render_policy("prompt.extraction.extract_instructions")
    write(target / "02-extractor.md", "# 원문 추출 프롬프트\n\n## 공통 instructions\n\n" + extract
          + "\n\n## 문서별 instructions와 사용자 입력 조합\n\n"
          "아래 코드는 family 계약·페이지별 목표·원문 성격 진단·누락 후보·영역 복구 조건을 추가합니다. "
          "변수는 실제 요청마다 달라지며, 이 문서에는 사건 데이터를 넣지 않았습니다.\n\n"
          + excerpt(manifest, "pipeline.ts", "      const extractInstructions=", "      const extractionPasses="))

    write(target / "03-verifier-and-repair.md", "# 원문 대조·표적 재판독 프롬프트\n\n"
          "`source_verifier`와 `targeted_rereader`는 같은 조합 코드에서 stage별 지시를 선택합니다. "
          "`repair`는 지정 좌표만, `region_verify`는 현재 영역의 좌표만 검증합니다. "
          "포함되는 공통 지시문은 [shared-instructions.md](shared-instructions.md)에 있습니다.\n\n"
          + excerpt(manifest, "pipeline.ts", "    const verifiedRead=saved.read!;", "    if(saved.reverification){")
          + "\n## 호출\n\n"
          + excerpt(manifest, "pipeline.ts", "    const {value:reviewResult,usage}=", "    const originalChecks="))

    write(target / "04-legal-reviewer.md", "# 법적 체크 검토 보조 프롬프트\n\n## instructions\n\n"
          + render_policy("prompt.pipeline.legal_reviewer.instructions") + "\n\n"
          "위 내용은 seed 정책입니다. 실제 `legalReviewInstructions()`는 현재 요청의 검토된 기준정보 변경값을 읽고 "
          "`기준정보 판본: <현재 referenceIdentity JSON>`을 덧붙입니다. 실행 중인 D1 판본은 이 문서에서 조회하지 않았습니다. "
          "조합 함수는 [reference-prompts.ts](source/reference-prompts.ts.txt)를 확인하세요.\n\n## 입력 패킷과 출력 스키마\n\n"
          "이 단계는 n8n 노드가 아닌 `reviewLegal`의 직접 호출입니다. "
          "`legal-review-packet.ts`가 사건별 입력을 제한된 패킷으로 구성합니다.\n\n"
          + excerpt(manifest, "pipeline.ts", "const obj=(properties:", "  const validRuleIds="))

    shared = [("field-observation.ts", "SOURCE_BBOX_INSTRUCTIONS", bbox),
              ("field-observation.ts", "FIELD_OBSERVATION_INSTRUCTIONS", observation),
              ("source-nature-context.ts", "SOURCE_NATURE_HANDOFF_INSTRUCTIONS", handoff),
              ("extraction.ts", "PAGE_COMPLETENESS_INSTRUCTIONS", render_policy("prompt.extraction.page_completeness_instructions")),
              ("extraction.ts", "STATEMENT_SCOPE_RELATION_VERIFY_INSTRUCTIONS", render_policy("prompt.extraction.statement_scope_relation_verify_instructions")),
              ("coverage-review.ts", "MISSING_FIELD_REVIEW_INSTRUCTIONS", render_policy("prompt.coverage_review.missing_field_review_instructions"))]
    body = "# 공통 지시문\n\n" + "\n".join(
        f"## {name}\n\n조합 원본: `lib/{relative}` · 문구 원본: `lib/reference-prompt-policies.json`\n\n{value}\n" for relative, name, value in shared)
    body += "\n## category 정책과 조합\n\n" + excerpt(manifest, "category-contract.ts", "export const RECORD_CATEGORIES", "/** Only well-formed")
    body += "\n## 문서별 목표와 sourceInstructions\n\n" + excerpt(manifest, "extraction.ts", "const APPLICANT_ROLE_EVIDENCE_RULE", "export type ")
    write(target / "shared-instructions.md", body)

    negative_block = re.search(r"INTAKE_NEGATIVE_SUBJECT_LABELS[^=]*=\s*\{(.*?)\};", source("intake-engine.ts"), re.S)
    if not negative_block:
        raise ValueError("Cannot find intake subject labels")
    labels = {key: json.loads(value) for key, value in re.findall(
        r'(\w+)\s*:\s*("(?:[^"\\]|\\.)*")', negative_block[1])}
    if len(labels) != 8:
        raise ValueError("Unexpected intake subject label contract")
    intake = render_policy("prompt.intake.classifier.instructions", negativeSubjectLabels=json.dumps(labels, ensure_ascii=False, separators=(",", ":")))
    intake_version = quoted_constant("intake-types.ts", "INTAKE_PROMPT_VERSION")
    write(target / "05-consultation-classifier.md", "# 상담 분류 프롬프트\n\n"
          f"agent는 `consultation_classifier`, 현재 버전은 `{intake_version}`입니다. "
          "상담 원문은 client_report 후보 분류용이며 OCR 사실·법적 인정으로 자동 반영하지 않습니다. "
          "요청은 `reasoningEffort: medium`, 출력 한도는 14,000 토큰입니다. 아래는 seed 정책에 코드의 부재 대상 라벨만 넣은 instructions입니다. 실제 상담 데이터는 포함하지 않습니다.\n\n"
          + intake + "\n\n## 사용자 입력·출력 계약 조합\n\n"
          "활성 상담은 [intake-source-spans.ts](source/intake-source-spans.ts.txt)의 결정론적 원문 구간으로 나뉩니다. "
          "본문에는 note 메타데이터와 각 구간의 ID·시작·끝·정확한 원문이 들어갑니다. "
          "출력은 `reviewedSourceSpanIds`와 `subjects[].claims[]`이며, subject scope별로 허용 feature ID가 제한됩니다. "
          "모델은 인용문을 새로 쓰는 대신 `sourceSpanId`로 원문 위치를 참조합니다.\n\n"
          + excerpt(manifest, "intake-classifier.ts", "export function intakeClassifierInstructions", "export const INTAKE_CLASSIFIER_INSTRUCTIONS")
          + excerpt(manifest, "intake-classifier.ts", "export function buildIntakeClassifierRequest", None)
          + "\n## 응답 적응·원문 연결\n\n"
          "[intake-classifier-response.ts](source/intake-classifier-response.ts.txt)의 `adaptIntakeClassifierResponse()`는 "
          "전체 구간의 검토 ID가 누락·중복되지 않았는지, 대상 ID·scope·feature·참조 구간이 허용됐는지 검사합니다. "
          "서버가 원문 구간을 정확한 인용으로 해석한 뒤 기존 claim 검증과 서류 매칭을 실행합니다. "
          "`classifierReceipt`의 대상 목록·구간별 feature 연결·참조 없는 대상 목록은 구조 검증 이력이며 "
          "모델이 원문 의미를 정확히 이해했다는 독립 정확도 증명은 아닙니다.\n\n"
          "실제 호출·저장·재사용·실패 조건은 [intake-store.ts](source/intake-store.ts.txt), "
          "원문 구간 경계·크기·연결 검증은 [intake-source-spans.ts](source/intake-source-spans.ts.txt)를 확인하세요.\n")

    monitor = json.loads(source("reference-monitor-policies.json"))
    write(target / "06-legal-monitor.md", "# 법령·법원 문서 감시 프롬프트\n\n"
          "현재 AX의 직접 모델 호출입니다. 기존 n8n law-watch와 별도 경로이며, 일정 연결 상태를 저장하는 것만으로 예약 작업이 생기지 않습니다. "
          "검색 발견은 공식 도메인 제한과 검색 도구의 URL 근거를 사용하고, 변경 분석은 수집한 원문 비교를 입력으로 받습니다. "
          "아래는 seed 정책이며 실제 요청은 검토된 reference override를 읽을 수 있습니다.\n\n"
          + "\n".join(f"## {row['id']}\n\n{row['template']}\n" for row in monitor["policies"])
          + "\n## 요청 예산\n\n```json\n" + json.dumps(monitor["limits"], ensure_ascii=False, indent=2)
          + "\n```\n\n호출·스키마·입력 조합 원본: [legal-monitor-provider.ts](source/legal-monitor-provider.ts.txt). "
          "실제 서버·예약 작업을 호출해 확인한 자료는 아닙니다.\n")

    catalog = "# AX 프롬프트 seed 정책 전체\n\n현재 `reference-prompt-policies.json`의 정책 원문입니다. "
    catalog += "`{{name}}`은 이름 치환 자리표시자이며 실제 사건값을 채우지 않았습니다. "
    catalog += "원본의 sourceBindings는 정책 이관 당시의 출처입니다. 현재 소비 코드는 source/ 사본과 manifest의 해시를 확인하세요. "
    catalog += "이 문서에서는 표시용 행말 공백만 생략하며, 정확한 원본 바이트는 source/reference-prompt-policies.json에 보관합니다.\n\n"
    for row in policies().values():
        catalog += f"## {row['id']}\n\n{row['title']}\n\n"
        catalog += f"자리표시자: `{', '.join(row['placeholders']) or '(없음)'}` · lockedSafetyInvariant: `{str(row['lockedSafetyInvariant']).lower()}`\n\n"
        catalog += row["template"] + "\n\n"
        if "value" in row:
            catalog += f"설정값: `{row['value']}`\n\n"
    write(target / "07-policy-catalog.md", "\n".join(line.rstrip() for line in catalog.splitlines()).rstrip() + "\n")

    write(target / "08-calculator-and-document-writer.md", "# 계산·문서작성 경로\n\n"
          "현재 `case-agent.ts`의 `runCaseCalculatorNode()`와 `document-writer.ts`의 `prepareDocumentWrite()`에는 "
          "모델 호출이나 별도 AI 프롬프트가 없습니다. 공통 계산 dispatcher와 저장된 계산·문서 기재값 검증을 사용합니다. "
          "이름에 agent 또는 writer가 있어도 AI가 금액을 계산하거나 서류 본문을 자유 생성하는 단계로 표시하지 않습니다.\n\n"
          "- [case-agent.ts](source/case-agent.ts.txt): snapshot·revision·해시를 확인하는 계산 호출과 영수증.\n"
          "- [case-execution.ts](source/case-execution.ts.txt): 실행 노드와 계산·문서 입력 연결.\n"
          "- [calculator-tools.ts](source/calculator-tools.ts.txt): 읽기 전용 공통 계산 dispatcher.\n"
          "- [document-writer.ts](source/document-writer.ts.txt): 저장된 evaluation·출력 모드·기준 판본 검증.\n"
          "- [reactive-evaluation.ts](source/reactive-evaluation.ts.txt): 사건 변경과 계산 결과 갱신.\n\n"
          "v43의 문서작성은 저장된 계산·바인딩을 분리된 스냅샷으로 읽고, 실제 출력의 산식·제출 준비 상태를 "
          "[document-filing-readiness.ts](source/document-filing-readiness.ts.txt)로 검사합니다. "
          "계산 일치와 공식 전자양식 일치는 별도이며 제출 준비 상태를 자동 승인하지 않습니다. "
          "[export-artifact-transaction.ts](source/export-artifact-transaction.ts.txt)는 manifest 저장 전 실패 시 "
          "해당 출력 요청이 만든 객체·행만 정리하고, 저장 완료 후 로그 실패로 정상 생성물을 삭제하지 않습니다.\n\n"
          "법적 체크 AI에 전달하는 executionContext는 [법적 검토 프롬프트](04-legal-reviewer.md)와 "
          "[legal-review-packet.ts](source/legal-review-packet.ts.txt)를 함께 확인하세요.\n")
    manifest["model"] = quoted_constant("domain.ts", "AI_MODEL")
    manifest["prompt_version"] = quoted_constant("category-contract.ts", "RECORD_CATEGORY_STATUS_PROMPT_VERSION")
    manifest["prompt_policy_count"] = len(policies())
    manifest["intake_prompt_version"] = intake_version
    manifest["rendered_constants"] = {name: sha256(value.encode("utf-8")) for _file, name, value in shared}
    manifest["rendered_constants"]["EXTRACT_INSTRUCTIONS"] = sha256(extract.encode("utf-8"))
    for item in classifiers:
        name, text = item.split("\n\n", 1)
        manifest["rendered_constants"][name.removeprefix("## ")] = sha256(text.rstrip("\n").encode("utf-8"))
    manifest["rendered_constants"]["INTAKE_CLASSIFIER_INSTRUCTIONS"] = sha256(intake.encode("utf-8"))


def main() -> None:
    ax_sources = ("pipeline.ts", "extraction.ts", "classification-recovery.ts", "field-observation.ts",
                  "category-contract.ts", "source-nature-context.ts", "coverage-review.ts",
                  "document-agent-registry.ts", "document-routing.ts", "document-agent-field-contracts.json",
                  "field-applicability-contracts.json", "workflow-rules.ts", "legal-review-packet.ts", "luna.ts", "domain.ts",
                  "reference-prompt-policies.json", "reference-prompts.ts", "reference-runtime.ts", "reference-context.ts",
                  "reference-release.json", "reference-monitor-policies.json", "legal-monitor-provider.ts", "legal-monitor-sources.ts",
                  "intake-classifier.ts", "intake-classifier-response.ts", "intake-source-spans.ts", "intake-types.ts", "intake-engine.ts", "intake-store.ts",
                  "case-agent.ts", "case-agent-contracts.ts", "case-execution.ts", "execution-catalog.ts", "calculator-tools.ts",
                  "document-writer.ts", "reactive-evaluation.ts", "document-filing-readiness.ts", "export-artifact-transaction.ts")
    copies = [(PROTO / "workflows" / name, Path("workflows") / name)
              for name in ("firmengine-p0.json", "law-watch.json")]
    copies += prompt_files(PROTO, ("classify", "extract", "judge", "law-watch"), "legacy-prompts")
    copies += [(AX / "lib" / name, Path("ax-site-prompts/source") / (name if name.endswith(".json") else name + ".txt"))
               for name in ax_sources]
    manifest = export(BUNDLE, copies)
    export_ax_prompts(manifest)
    write(BUNDLE / "manifest.json", json.dumps(manifest, ensure_ascii=False, indent=2) + "\n")

    retry_bundle = RETRY / "n8n-reference"
    copies = [(RETRY / "workflows" / name, Path("workflows") / name)
              for name in ("calculations.json", "law-watch.json")]
    copies += [(RETRY / "workflows" / name, Path("workflows") / (name + ".txt"))
               for name in ("build_workflows.py", "calculators.js", "README.md")]
    copies += prompt_files(RETRY, ("classify", "extract", "validate", "judge", "draft", "law_update", "evaluate"), "prompts")
    copies += [(RETRY / name, Path("settings") / (name + ".txt"))
               for name in ("scripts/run_local.py", "scripts/run_n8n.py", "package.json", "requirements.txt")]
    retry_manifest = export(retry_bundle, copies)
    write(retry_bundle / "manifest.json", json.dumps(retry_manifest, ensure_ascii=False, indent=2) + "\n")
    print(f"AX: {len(manifest['files'])} source copies; retry: {len(retry_manifest['files'])} source copies")


if __name__ == "__main__":
    main()
