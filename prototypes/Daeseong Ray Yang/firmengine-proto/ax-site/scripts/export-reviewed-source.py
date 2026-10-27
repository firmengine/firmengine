#!/usr/bin/env python3
"""Publishable source snapshot for the user's exact prototype directory.

No credentials, borrower files, private benchmark answers/results, dependency
trees, or generated filing packages are copied. Existing original code is kept.
"""
import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import stat
import tempfile
from urllib.parse import urlparse

DESTINATION = Path("prototypes/Daeseong Ray Yang/firmengine-proto/ax-site")
DIRECTORIES = {"app", "components", "hooks", "lib", "db", "drizzle", "public", "scripts", "vendor", "docs", "tests"}
ROOT_FILES = {"package.json", "package-lock.json", "tsconfig.json", "next.config.ts", "vite.config.ts", "drizzle.config.ts", "eslint.config.mjs", "postcss.config.mjs", "components.json", "cloudflare-env.d.ts"}
EXCLUDED = {"scripts/run-sample-evaluation.py", "public/pdf.worker.min.mjs", "lib/sample-manifest.ts", "docs/workflow-benchmark.json"}
EXCLUDED_SOURCE_PREFIXES = ("public/templates/originals/",)
PRIVATE_COMPONENTS = {"sample", "samples", "sample-data", "upload", "uploads", "result", "results", "evaluation", "evaluations", "evaluation-private", "actual-run", "actual-runs", "actual_runs"}
# These are executable source routes/configuration, not borrower artifacts.
# The real sample config remains excluded during collection and is replaced below.
APPROVED_SOURCE_EXCEPTIONS = {"app/evaluation/page.tsx", "lib/sample-manifest.ts"}
DOCUMENT_SUFFIXES = {".pdf", ".docx", ".docm", ".xlsx", ".xls", ".hwp", ".zip", ".odt", ".rtf"}
OFFICIAL_HOSTS = {"file.scourt.go.kr", "www.scourt.go.kr", "slb.scourt.go.kr"}
SECRET = re.compile(rb"(?:sk-(?:proj-|svcacct-)?[A-Za-z0-9_-]{24,}|gh[pousr]_[A-Za-z0-9]{24,}|github_pat_[A-Za-z0-9_]{24,}|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----)")

PUBLIC_SAMPLE_CONFIG = '''/** Generic source distribution: private evaluation fixtures are intentionally absent. */
export const SAMPLE_SHA256 = "";
export function samplePageRole(_hash: string, page: number): {page:number;role:"unknown"|"evidence"|"filed_form"|"administrative";documentType?:string} {
  return {page,role:"unknown"};
}
export const BENCHMARK = {
  status:"unmeasured",target:99,goldTotal:null,scorable:null,excluded:null,matched:null,score:null,
  hash:null,sourceHash:null,sourceConflicts:null,completedEvidencePages:null,attemptedEvidencePages:null,totalEvidencePages:null,
  runId:null,sourceCommit:null,packageSha256:null,
  note:"공개 소스에는 실제 의뢰인 자료·추출값·정답·평가 산출물을 포함하지 않습니다. 99%는 목표이며 이 배포판의 달성 수치가 아닙니다.",
};
'''

PUBLIC_README = '''# Firm Engine AX — 개인회생 사건 워크스페이스

기존 Python 프로토타입의 문서·피처·이상거래 점검 사전을 이어받은 Sites/Vinext 실행 코드입니다. 이 디렉토리 안에서 독립적으로 실행하며 상위 Python 애플리케이션의 파일은 덮어쓰지 않습니다.

## 실행

Node 22.13 이상과 잠금 파일의 의존성을 사용합니다. `npm ci`로 설치하면 PDF.js worker를 잠긴 의존성에서 복사합니다. `npm run dev`는 개발 서버, `npm run build`는 배포 빌드입니다. D1 `DB`, R2 `BUCKET` 바인딩과 `drizzle/`의 마이그레이션이 필요합니다. OpenAI 키는 배포 서비스의 비밀 설정으로 별도 주입합니다. 저장소에는 환경변수 파일이나 키 값을 넣지 않습니다.

모델은 `gpt-6-luna`로 고정되어 있습니다. 연결·할당량 오류를 고비용 모델로 우회하지 않습니다. 호스팅 구성에는 로컬 바인딩 이름만 들어 있으며 실제 서비스 ID와 환경 설정은 포함하지 않습니다.

## OCR 방식

OCR은 Luna가 페이지 이미지를 직접 읽는 AI OCR입니다. 일반 OCR 엔진의 텍스트를 후처리하는 경로가 아니며, PDF 텍스트 레이어를 결합하는 경로도 아직 사용하지 않습니다. 분류·추출·원문 대조·재판독은 같은 모델의 별도 호출이고, 코드는 렌더링·영역 확대·실행 순서·재시도 한도·저장·수치 검증을 담당합니다.

대조 호출은 원문 이미지와 앞선 추출값을 함께 봅니다. 별도 호출은 독립 정답 평가나 정확도 보장을 뜻하지 않습니다. OCR 필드 일치율, 페이지 완독률, 제출 서류 일치율을 따로 측정합니다.

프롬프트 3.11.0부터 같은 대조 호출에서 항목의 의미도 확인합니다. 값·단위가 맞아도 원문의 열·문맥이 해당 항목을 지지하지 않으면 검증 승격을 보류합니다. 새 의미 확인 기록과 과거 값·단위 대조 이력을 구분하며, 과거 기록을 소급해 의미 검증으로 표시하지 않습니다. 입출금 문서가 채무로 잘못 분류된 경우에는 원문 사실과 오류를 남기고 계산용 채무 생성은 차단합니다.

프롬프트 3.12.0은 미분류 문서에 대한 최대 한 차례의 추가 분류, 두 개의 원본 기반 후보 보기, 급여명세 유형 정규화와 명시적인 진술 작성자 연결을 추가합니다. 재산 평가일의 누락·오류·사건 기준일 불일치도 별도로 차단합니다. 구현 근거와 남은 제한은 `docs/audit-p0-recovery.md`에 정리했습니다.

프롬프트 3.13.0은 검증 필드의 좌표를 명시하고 잘못된 대응을 보류하며, 추출 이력이 있는 저장 판독만 선택적으로 재검증합니다. 3.14.0은 작성선언·끝맺음·서명·문단 목록을 연결한 구조화된 관계를 기존 독립 검증에서 확인합니다. 원문 근거 없이 같은 페이지의 문단을 연결하지 않습니다. 미분류 복구에는 버전이 있는 결정적 명암 보정 보기를 사용하고, 읽기 전용 분류 진단으로 추출 전 보류와 OCR 실패를 구분합니다. 원시 분류의 신뢰도가 높아도 필수 원문 관측이 부족하면 기존 2회 한도 안에서 복구하며, 잘못된 저장 호출 수는 추가 호출 없이 보류합니다. 평가 중단 복구는 같은 입력·사건·배포·누적 예산에 결합됩니다. 자동 법적 승인은 만들지 않습니다.

3.15.0은 관계 metadata를 작성선언의 원문 인용과 위치에 연결하고, 명시적인 신청 의사 인용을 포함한 v2 관계가 독립 검증된 경우에만 서로 다른 parser record의 근거를 연결합니다. 모든 문단·작성자·현재 원본 연결이 필요하며, 불명확한 서명이나 수동 철회를 우회하지 않습니다.

## 구현 범위

- 문서 역할 분류, 페이지별 AI OCR, 별도 원문 대조, 값·단위·인용·출처 연결과 불일치 보존
- 현재 채권과 과거 채권 이력 구분, 보험 가입금액과 해약환급금 구분, 담보설정액과 현재잔액 구분
- 소득·채무·재산·거래의 별도 관리 및 강한 식별자에 근거한 중복 점검
- BigInt 금액 계산, 소득기간 대조, 청산가치·변제액·채권 배분 및 일정 검증
- 서울 생계비 기초 제안, 제424호 후보 경로, 이의 사건 제614조 추가 최소변제 비교
- 기존 95개 위험 점검 사전, 46개 상황별 서류 경로, 입출금 이상거래 점검
- 중요한 데이터 CRUD, 계산·법적 판단 기준, 단계별 변제일정은 별도 페이지 유지
- 공적 빈 양식에 따른 DOCX, XLSX, 검토 HTML 및 ZIP 생성

## 품질과 적용 범위

99.0%는 실물 제출서류와 대조해 확인해야 하는 목표입니다. 합성 테스트 통과율이나 모델의 자기확신으로 정확도를 주장하지 않습니다. 추출값·출처 검증·법적 인정·법원 결정을 구분하며, 누락을 0이나 법률요건 충족으로 바꾸지 않습니다. 법원 전자접수는 수행하지 않습니다.

실제 의뢰인 샘플, 추출 원장, 정답, 실행 평가 산출물은 이 소스 배포에 없습니다. 공개된 법원 **빈 양식**과 합성 테스트만 포함합니다. 분리된 평가 자료는 사전에 고정한 입력/정답 경계에서 별도로 관리해야 합니다.

법원 원본 PDF·HWP의 복제 파일은 이 소스 배포에 포함하지 않습니다. `public/templates/catalog.json`의 공식 다운로드 URL과 SHA-256으로 출처를 확인할 수 있습니다. 실행에 사용하는 빈 DOCX 템플릿과 매핑 코드는 포함됩니다.

현재 인증 경계는 소유자에게만 허용된 비공개 Sites 작업공간입니다. 회사 내 다중 사용자 운영에는 사건별 권한·감사·보존 정책을 추가 검증해야 합니다. 상세 실행/미지원 범위와 현행 공식 출처는 `docs/exception-coverage-matrix.md`를 참조하세요.

## 검증

```sh
npm ci
npm run build
npx tsc --noEmit --pretty false
node --test --test-isolation=none tests/*.test.ts
```

합성 성능 비교는 `scripts/benchmark-workflow.ts`로 수행합니다. 동일 입력의 전체 결과가 같은지 비교하며, 지표는 코드 점검 단계의 지연시간입니다. 전체 OCR 실행시간이나 실제 사건 정확도를 대신하지 않습니다.
'''

EXTRA_IGNORE = '''
# Borrower sources, extraction ledgers, answers, output and credentials stay private.
/samples/
/sample-data/
/uploads/
/upload/
/results/
/evaluations/
/evaluation-private/
/actual-runs/
*.pdf
*.docx
*.xlsx
*.hwp
*.zip
!public/templates/*.docx
/public/pdf.worker.min.mjs
'''

def sha(data): return hashlib.sha256(data).hexdigest()

def safe_export_name(name):
    if not isinstance(name, str) or not name or "\\" in name or "\x00" in name:
        return False
    path = Path(name)
    parts = name.split("/")
    if path.is_absolute() or any(part in {"", ".", ".."} for part in parts):
        return False
    if name == "SOURCE_MANIFEST.json":
        return False
    if parts[0] not in DIRECTORIES and name not in ROOT_FILES | {"README.md", ".gitignore", "lib/sample-manifest.ts", ".openai/hosting.json"}:
        return False
    lower_parts = {part.casefold() for part in parts}
    if lower_parts & PRIVATE_COMPONENTS and name not in APPROVED_SOURCE_EXCEPTIONS:
        return False
    if name in EXCLUDED and name != "lib/sample-manifest.ts" or (parts[0] == "scripts" and re.search(r"sample.*eval|eval.*sample", parts[-1], re.I)):
        return False
    return True

def contained_target(destination, name, *, allow_missing=True):
    if not safe_export_name(name):
        raise SystemExit(f"Unsafe export path: {name!r}")
    root = destination.resolve(strict=False)
    target = destination.joinpath(*name.split("/"))
    current = destination
    for part in name.split("/")[:-1]:
        current = current / part
        if current.is_symlink():
            raise SystemExit(f"Refusing destination symlink: {name}")
    if target.is_symlink():
        raise SystemExit(f"Refusing destination symlink: {name}")
    try:
        resolved = target.resolve(strict=not allow_missing)
    except FileNotFoundError:
        raise SystemExit(f"Missing destination path: {name}")
    if not resolved.is_relative_to(root):
        raise SystemExit(f"Destination path escapes export root: {name}")
    return target

def validate_manifest(path, destination):
    if path.is_symlink():
        raise SystemExit("Refusing symlink SOURCE_MANIFEST.json")
    if not path.exists():
        return {"files": []}
    if not path.is_file():
        raise SystemExit("SOURCE_MANIFEST.json must be a regular file")
    try:
        manifest = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, UnicodeError, json.JSONDecodeError) as error:
        raise SystemExit(f"Invalid SOURCE_MANIFEST.json: {error}")
    if not isinstance(manifest, dict) or manifest.get("schema") != 1 or manifest.get("destination") != DESTINATION.as_posix() or manifest.get("private_data_included") is not False or not isinstance(manifest.get("files"), list):
        raise SystemExit("Unsupported SOURCE_MANIFEST.json schema or destination")
    seen = set()
    for item in manifest["files"]:
        if not isinstance(item, dict) or set(item) != {"path", "sha256", "bytes", "mode"}:
            raise SystemExit("Invalid manifest file entry")
        name, digest, byte_count, mode = item.get("path"), item.get("sha256"), item.get("bytes"), item.get("mode")
        if not safe_export_name(name) or name in seen:
            raise SystemExit(f"Invalid or duplicate manifest path: {name!r}")
        if not isinstance(digest, str) or not re.fullmatch(r"[a-f0-9]{64}", digest):
            raise SystemExit(f"Invalid manifest hash: {name}")
        if isinstance(byte_count, bool) or not isinstance(byte_count, int) or byte_count < 0 or mode not in {"100644", "100755"}:
            raise SystemExit(f"Invalid manifest metadata: {name}")
        contained_target(destination, name)
        seen.add(name)
    expected_digest = sha(json.dumps(sorted(manifest["files"], key=lambda item: item["path"]), ensure_ascii=False, sort_keys=True).encode())
    if manifest.get("source_digest") != expected_digest:
        raise SystemExit("SOURCE_MANIFEST.json source digest does not match its file ledger")
    return manifest

def template_hashes(source):
    """Return the exact file hashes documented as official blank-form sources."""
    templates = source / "public/templates"
    catalog = json.loads((templates / "catalog.json").read_text(encoding="utf-8"))
    additional = json.loads((templates / "additional_sources.json").read_text(encoding="utf-8"))
    allowed = {}
    def add(path, digest, url=None):
        if not isinstance(path, str) or not path.startswith("public/templates/"):
            raise SystemExit(f"Invalid public form path in metadata: {path!r}")
        if not re.fullmatch(r"[a-f0-9]{64}", str(digest)):
            raise SystemExit(f"Invalid public form hash in metadata: {path}")
        if url and urlparse(url).hostname not in OFFICIAL_HOSTS:
            raise SystemExit(f"Non-official public form source: {path}")
        allowed[path] = digest
    for form in catalog.get("forms", []):
        template = form.get("template", {})
        if template.get("path") and template.get("sha256"):
            add("public/templates/" + template["path"], template["sha256"])
        for original in form.get("originals", []):
            add("public/templates/" + original["path"], original.get("sha256"), original.get("url"))
    for item in additional.get("sources", []):
        add("public/templates/" + item["path"], item.get("sha256"), item.get("url"))
    return allowed

def validate_package_pair(source):
    package_path, lock_path = source / "package.json", source / "package-lock.json"
    if not package_path.is_file() or not lock_path.is_file():
        raise SystemExit("package.json and package-lock.json are required for a reproducible export")
    try:
        package = json.loads(package_path.read_text(encoding="utf-8"))
        lock = json.loads(lock_path.read_text(encoding="utf-8"))
    except (OSError, UnicodeError, json.JSONDecodeError) as error:
        raise SystemExit(f"Invalid package metadata: {error}")
    root = lock.get("packages", {}).get("") if isinstance(lock, dict) else None
    if not isinstance(root, dict) or lock.get("lockfileVersion") not in {2, 3}:
        raise SystemExit("package-lock.json must use npm lockfile v2 or v3")
    for key in ("name", "version"):
        if package.get(key) != lock.get(key) or package.get(key) != root.get(key):
            raise SystemExit(f"package.json and package-lock.json disagree on {key}")
    for key in ("dependencies", "devDependencies", "optionalDependencies"):
        if package.get(key, {}) != root.get(key, {}):
            raise SystemExit(f"package.json and package-lock.json disagree on {key}")

def write_transaction(destination, files, manifest, owned):
    destination.mkdir(parents=True, exist_ok=True)
    if destination.is_symlink():
        raise SystemExit("Refusing destination symlink")
    stage = Path(tempfile.mkdtemp(prefix=".export-stage-", dir=destination))
    backups = stage / ".backups"
    changed = []
    created_dirs = []
    try:
        for name, data in files.items():
            staged = stage / "new" / name
            staged.parent.mkdir(parents=True, exist_ok=True)
            staged.write_bytes(data)
            staged.chmod(0o755 if manifest["mode_by_path"].get(name) == "100755" else 0o644)
        manifest_data = json.dumps({key: value for key, value in manifest.items() if key != "mode_by_path"}, ensure_ascii=False, indent=2).encode() + b"\n"
        staged_manifest = stage / "new" / "SOURCE_MANIFEST.json"
        staged_manifest.write_bytes(manifest_data)
        operations = [(name, stage / "new" / name, False) for name in files]
        operations.extend((name, None, True) for name in sorted(set(owned) - set(files)))
        for name, staged, deleting in operations:
            target = contained_target(destination, name)
            if not target.parent.exists():
                missing = []
                parent = target.parent
                while not parent.exists():
                    missing.append(parent); parent = parent.parent
                target.parent.mkdir(parents=True, exist_ok=True)
                created_dirs.extend(reversed(missing))
            backup = backups / name
            if target.exists():
                if not target.is_file() or target.is_symlink():
                    raise SystemExit(f"Export target must be a regular file: {name}")
                backup.parent.mkdir(parents=True, exist_ok=True)
                shutil.copy2(target, backup)
            changed.append((target, backup if backup.exists() else None))
            if deleting:
                if target.exists(): target.unlink()
            else:
                os.replace(staged, target)
        manifest_path = destination / "SOURCE_MANIFEST.json"
        if manifest_path.exists():
            if manifest_path.is_symlink() or not manifest_path.is_file():
                raise SystemExit("SOURCE_MANIFEST.json must be a regular file")
            backup = backups / "SOURCE_MANIFEST.json"
            backup.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(manifest_path, backup)
        else:
            backup = None
        changed.append((manifest_path, backup))
        os.replace(staged_manifest, manifest_path)
    except BaseException:
        for target, backup in reversed(changed):
            try:
                if backup and backup.exists():
                    target.parent.mkdir(parents=True, exist_ok=True)
                    os.replace(backup, target)
                elif target.exists() and target.is_file():
                    target.unlink()
            except OSError:
                pass
        for directory in reversed(created_dirs):
            try: directory.rmdir()
            except OSError: pass
        raise
    finally:
        shutil.rmtree(stage, ignore_errors=True)

def main():
    parser=argparse.ArgumentParser()
    parser.add_argument("--source",default=str(Path(__file__).resolve().parents[1]))
    parser.add_argument("--repository",required=True)
    parser.add_argument("--write",action="store_true")
    args=parser.parse_args()
    source=Path(args.source).resolve(); repository=Path(args.repository).resolve(); destination=repository/DESTINATION
    if not (repository/".git").exists(): raise SystemExit("An existing Git checkout is required.")
    if destination.resolve()!=destination or not destination.is_relative_to(repository): raise SystemExit("Refusing a symlink or out-of-scope destination.")
    if not (repository/DESTINATION.parent/"app").is_dir(): raise SystemExit("The user's existing prototype directory is missing.")
    validate_package_pair(source)
    public_templates=template_hashes(source)
    private_metadata=(source/"lib/sample-manifest.ts").read_text()
    private_hashes={value.encode() for value in re.findall(r'"([a-f0-9]{64})"',private_metadata)}
    files={};modes={}
    candidates=[source/name for name in ROOT_FILES if (source/name).is_file()]
    for directory in DIRECTORIES:
        if (source/directory).is_dir(): candidates.extend((source/directory).rglob("*"))
    for path in sorted(candidates):
        relative=path.relative_to(source); name=relative.as_posix()
        if relative.parts[0] not in DIRECTORIES and name not in ROOT_FILES: continue
        if not safe_export_name(name): continue
        if name.startswith(EXCLUDED_SOURCE_PREFIXES): continue
        if any(part in {"node_modules","dist","__pycache__",".wrangler","outputs","work"} for part in relative.parts): continue
        if not path.is_file() or name in EXCLUDED or path.suffix in {".pyc",".tsbuildinfo"}: continue
        if path.is_symlink(): raise SystemExit(f"Refusing source symlink: {name}")
        if any(part.startswith((".env",".dev.vars")) for part in relative.parts): raise SystemExit(f"Environment file in source allowlist: {name}")
        if path.suffix.lower() in DOCUMENT_SUFFIXES:
            if name not in public_templates or not name.startswith("public/templates/"):
                raise SystemExit(f"Unapproved document artifact: {name}")
        data=path.read_bytes()
        if name in public_templates and sha(data) != public_templates[name]: raise SystemExit(f"Public form hash does not match its provenance metadata: {name}")
        if name=="components/workspace.tsx": data=data.replace("제출 완료본 24쪽".encode(),"평가용 제출 완료본".encode())
        if name=="docs/audit-transport-reliability.md": data=data.replace(b"saved run-001 baseline",b"saved independent evaluation checkpoint")
        if name=="public/templates/README.md":
            data += "\n## 공개 소스 배포 범위\n\n이 배포에는 실행용 빈 DOCX와 매핑 메타데이터를 포함합니다. 법원 원본 PDF/HWP의 복제본은 제외하며, catalog.json과 additional_sources.json의 공식 다운로드 URL·해시를 참조하세요.\n".encode()
        if SECRET.search(data) or any(value in data for value in private_hashes): raise SystemExit(f"Sensitive content rejected: {name}")
        files[name]=data;modes[name]="100755" if path.stat().st_mode&stat.S_IXUSR else "100644"
    files["lib/sample-manifest.ts"]=PUBLIC_SAMPLE_CONFIG.encode();files["README.md"]=PUBLIC_README.encode()
    files[".gitignore"]=((source/".gitignore").read_text()+EXTRA_IGNORE).encode()
    files[".openai/hosting.json"]=(json.dumps({"d1":"DB","r2":"BUCKET"},indent=2)+"\n").encode()
    manifest_path=destination/"SOURCE_MANIFEST.json"
    if destination.exists() and destination.is_symlink(): raise SystemExit("Refusing destination symlink")
    previous=validate_manifest(manifest_path,destination)
    owned={item["path"]:item["sha256"] for item in previous["files"]}
    for name in set(files)|set(owned):
        target=contained_target(destination,name)
        if target.exists() and name in owned and sha(target.read_bytes())!=owned[name]: raise SystemExit(f"A previously exported file was changed independently: {name}")
        if target.exists() and name not in owned and target.read_bytes()!=files.get(name): raise SystemExit(f"Unowned destination file already exists: {name}")
    items=[{"path":name,"sha256":sha(data),"bytes":len(data),"mode":modes.get(name,"100644")} for name,data in sorted(files.items())]
    digest=sha(json.dumps(items,ensure_ascii=False,sort_keys=True).encode())
    manifest={"schema":1,"destination":DESTINATION.as_posix(),"scope":"source, public blank forms and synthetic tests only","private_data_included":False,"source_digest":digest,"files":items,"mode_by_path":modes}
    if args.write:
        write_transaction(destination,files,manifest,owned)
    print(json.dumps({"written":args.write,"destination":str(destination),"files":len(files)+1,"bytes":sum(map(len,files.values())),"sourceDigest":digest,"privateDataIncluded":False},ensure_ascii=False))

if __name__=="__main__": main()
