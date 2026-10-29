# AX 기준 n8n·프롬프트 정리

`ax-site`를 수정할 때 확인할 현재 프롬프트와, 기존 Python 프로토타입의 n8n 워크플로를 모았습니다. v35의 `luna-evidence-3.21.0` 및 정책 JSON 구조를 기준으로 갱신했습니다. 원본 경로와 현재 작업 파일의 SHA-256은 `manifest.json`에 있습니다. `source_commit`은 기준 HEAD이며 아직 커밋하지 않은 병합 파일도 사본에 포함됩니다.

**현재 AX는 n8n을 호출하지 않습니다.** OCR은 `/api/cases/[id]/process` → `lib/pipeline.ts` → `lib/luna.ts`로 직접 실행합니다. 상담 분류와 법령 감시도 별도 TypeScript 경로에서 같은 모델 호출 함수를 사용합니다. 이 폴더의 n8n JSON 2개는 상위 `firmengine-proto` Python 앱의 참고본이며 AX용 실행 워크플로가 아닙니다.

| 확인할 내용 | 위치 |
| --- | --- |
| 현재 AX 단계별 프롬프트·수정 위치 | [AX_PROMPTS.md](AX_PROMPTS.md) |
| 기존 n8n 11개 노드와 프롬프트 연결표 | [NODE_MAP.md](NODE_MAP.md) |
| 기존 사건 처리 워크플로 JSON | [workflows/firmengine-p0.json](workflows/firmengine-p0.json) |
| 기존 법령 점검 워크플로 JSON | [workflows/law-watch.json](workflows/law-watch.json) |
| 기존 Python 앱의 시스템·본문·설정·스키마 | [legacy-prompts/](legacy-prompts/) |
| 현재 AX 프롬프트 원문·동적 조합·공통 규칙 | [ax-site-prompts/](ax-site-prompts/) |
| 원본 경로·SHA-256·추출 코드 줄 번호 | [manifest.json](manifest.json) |
| 별도 retry 앱의 n8n 설정 | [proto-retry 정리](../../../firmengine-proto-retry/n8n-reference/README.md) |

## 폴더 구성

```text
n8n-reference/
  README.md
  NODE_MAP.md
  AX_PROMPTS.md
  workflows/                  # 기존 Python 앱용 n8n JSON 2개
  legacy-prompts/              # classify, extract, judge, law-watch 원본 사본
  ax-site-prompts/
    01-classifier.md           # 분류 + 분류 복구
    02-extractor.md            # 원문 추출
    03-verifier-and-repair.md   # 원문 대조 + 표적 재판독
    04-legal-reviewer.md        # 법적 체크 검토 보조
    05-consultation-classifier.md # 상담 원문 후보 분류
    06-legal-monitor.md        # 공식 원문 검색·변경 분석
    07-policy-catalog.md       # 현재 seed 정책 전체와 자리표시자
    08-calculator-and-document-writer.md # AI 프롬프트 없는 계산·작성 경로
    shared-instructions.md     # 좌표·누락·category·문서별 목표 등
    source/                    # 조합 코드·계약·스키마 원본 사본
  manifest.json
  refresh.py
```

## 수정과 갱신

이 폴더는 검토용 사본입니다. 현재 AX 동작을 바꾸려면 [AX_PROMPTS.md](AX_PROMPTS.md)에 연결한 `lib/` 원본을 수정합니다. 사본을 편집해도 앱에는 반영되지 않으며 다시 내보내면 생성 파일이 덮어써집니다. 원본을 이동하거나 기존 실행 설정을 바꾸지는 않았습니다.

이 폴더에서 다음 명령을 실행하면 AX·retry 두 묶음을 함께 갱신합니다. Python 표준 라이브러리와 Git만 사용하며 서버 시작·n8n import·외부 API 호출은 하지 않습니다.

```powershell
python refresh.py
```

내보내기는 스크립트에 명시한 저장소 내부 소스만 복사하며 새로 병합해 아직 Git에 추가하지 않은 파일도 허용합니다. 실행 환경파일, API 키, n8n 자격증명·데이터베이스, 실제 사건·실행 기록은 포함하지 않습니다. `.ts`·`.js`·설정 소스는 `.txt`로 보관해 AX 빌드가 별도 실행 코드로 읽지 않도록 했습니다.

현재 문구 원본은 `lib/reference-prompt-policies.json` 및 `lib/reference-monitor-policies.json`입니다. 펼친 프롬프트는 코드에 포함된 seed 정책을 사용합니다. 실행 시 검토된 기준정보 판본이 허용하는 변경값과 판본 식별자가 적용될 수 있으므로, 이 폴더를 라이브 D1 설정이나 사건 요청 로그로 해석하지 않습니다.

두 JSON의 저장소 정의는 `active: false`입니다. 라이브 n8n의 활성·게시 상태를 조회한 자료는 아닙니다. `127.0.0.1:8010/internal/...` endpoint는 기존 Python 서버용이며 AX URL로 바꾸는 것만으로 호환되지 않습니다.
