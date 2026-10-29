# Proto Retry · 노드와 프롬프트 호출 관계

Retry의 두 n8n JSON에는 각각 2개 노드가 있습니다. 문서 분류·추출 AI는 Python 앱에서 실행되며 아래 n8n 노드가 프롬프트를 호출하는 구조는 아닙니다. 경로의 기준은 상위 `firmengine-proto-retry`입니다.

## 1. 계산 워크플로

파일: [workflows/calculations.json](workflows/calculations.json). ID: `FirmEngineRetryCalc001`. JSON에 저장된 상태는 `active:false`이며, 실제 실행기는 계산 워크플로를 가져오기·게시합니다.

```text
Python assessment.assess(case)
  → pipeline.calculate(case)
  → runtime_status(): 상태·Webhook 준비 확인
  → POST /webhook/firmengine-retry/calculate
  → Calculation input
  → Reviewed deterministic KRW arithmetic
  → 계산 JSON + engine=n8n-code + code_sha256
```

| 순서 | 실제 노드 이름 | 종류·설정 | 처리 내용 | 호출 프롬프트 |
| --- | --- | --- | --- | --- |
| 1 | `Calculation input` | `n8n-nodes-base.webhook` v2 | `POST firmengine-retry/calculate`; `responseMode=lastNode`; 다음 Code 결과 응답 | 없음 |
| 2 | `Reviewed deterministic KRW arithmetic` | `n8n-nodes-base.code` v2 | `$input.first().json`의 `body` 또는 입력 자체를 `calculate()`에 전달 | 없음 |

Code 내용은 [원본 calculators.js](../workflows/calculators.js)에서 생성합니다. [build_workflows.py](../workflows/build_workflows.py):9의 `build()`가 Node CLI 어댑터 이전 계산 코드를 복사합니다. Code 마지막은 `calculate(input.body || input)`에 `engine`과 전체 JS 파일의 SHA-256을 더해 반환합니다.

앱 호출 근거: [assessment.py](../app/assessment.py):11의 `assess()` → 같은 파일 :76의 `calculate()` → [pipeline.py](../app/pipeline.py):303의 `calculate()`. 전달 필드는 `id`, `revision`, `incomes`, `creditors`, `assets`, `assets_declared`, `living_cost`, `deductions`, `repayment_months`, `period_start`, `period_end`, `rule_approved`, `rule_version`, `is_demo`입니다. 앱은 결과의 `code_sha256`을 현재 JS와 비교합니다.

Webhook 미준비 시에는 [pipeline.py](../app/pipeline.py):318 이후의 로컬 Node 경로에서 같은 JS를 실행합니다. 이 경우 결과는 `engine=local-node`이며 n8n 실행 결과와 구분됩니다. Webhook이 등록된 뒤 실제 계산 HTTP 요청이나 해시 검증이 실패하면 해당 오류를 반환합니다.

## 2. 공식 원문 조회 워크플로

파일: [workflows/law-watch.json](workflows/law-watch.json). ID: `FirmEngineRetryLaw001`. 기본 로컬 실행기는 이 JSON을 생성하지만 가져오기·게시하지 않습니다.

```text
09:00 Asia Seoul
  → Collect official source hashes
  → POST http://127.0.0.1:8091/api/knowledge/refresh
  → 공식 출처 응답 수집·SHA-256 비교·조회 결과 저장
```

| 순서 | 실제 노드 이름 | 종류·설정 | 처리 내용 | 호출 프롬프트 |
| --- | --- | --- | --- | --- |
| 1 | `09:00 Asia Seoul` | `n8n-nodes-base.scheduleTrigger` v1.2 | cron `0 9 * * *`; 워크플로 시간대 `Asia/Seoul` | 없음 |
| 2 | `Collect official source hashes` | `n8n-nodes-base.httpRequest` v4.2 | `POST http://127.0.0.1:8091/api/knowledge/refresh`; timeout `120000` ms | 없음 |

수신 구현은 [app/main.py](../app/main.py):603의 `refresh_knowledge()`입니다. 지식 출처 목록을 읽고 허용된 공식 도메인의 응답을 수집해 원문 SHA-256과 변경 여부를 저장합니다. 반환값의 `automatic_semantic_approval` 및 `scheduled_firing_verified`는 `false`입니다. `law_update` 프롬프트를 호출하거나 법적 의미·산식을 자동 승인하지 않습니다.

JSON은 `active:false`로 제공됩니다. 예약 동작을 사용하려면 별도 가져오기·게시가 필요하고, 실제 발화 여부도 확인해야 합니다. 앱 포트를 바꿀 때 HTTP 노드 URL을 함께 수정해야 합니다.

## 3. Python 앱의 실제 AI 호출

이 흐름은 두 n8n 워크플로 바깥에 있습니다. [app/main.py](../app/main.py):104의 `process_job()`가 증빙 문서에 대해 [app/pipeline.py](../app/pipeline.py):111의 `extract_document()`를 호출합니다.

```text
증빙 역할로 지정된 페이지
  → 성공 캐시가 있으면 재사용
  → 유형이 unknown이면 classify
  → 증빙 역할·판독 가능·지원되는 필드 목록 확인
  → extract
  → 조건에 맞으면 누락 키만 extract 1회 추가
  → 원문 인용 대응·후보 사실 보존·담당자 채택 대기
```

| 역할 | 프롬프트 파일 | 실제 호출 위치 | 실행 조건 |
| --- | --- | --- | --- |
| 분류 | [classify/system.md](prompts/classify/system.md), [body.md](prompts/classify/body.md), [config.json](prompts/classify/config.json), [출력 schema](prompts/classify/output.schema.json) | `app/pipeline.py:160` | 명시된 역할은 `evidence`이고 문서 유형이 `unknown`인 페이지; API 키가 설정된 경우 |
| 최초 추출 | [extract/system.md](prompts/extract/system.md), [body.md](prompts/extract/body.md), [config.json](prompts/extract/config.json), [출력 schema](prompts/extract/output.schema.json) | `app/pipeline.py:179` | 증빙 페이지이고 해당 문서 유형에 `DOCUMENT_FEATURES`가 존재하는 경우 |
| 누락 키 재추출 | 같은 `extract` 프롬프트 | `app/pipeline.py:183~186` | `missing`이 1~5개, `FIRMENGINE_REEXTRACT_MISSING=1`, 누락 키 중 현재 유형의 필드 목록과 겹치는 키가 있는 경우; 같은 페이지에서 1회 |

유형이 이미 지정된 증빙은 분류 호출을 건너뜁니다. 분류 결과가 증빙이 아니거나 읽을 수 없으면 추출을 중단합니다. `evaluation`, `administrative`, `unknown` 역할의 페이지는 이미지·텍스트 입력을 읽는 단계부터 제외됩니다. 역할 `unknown`과 문서 유형 `unknown`은 별도 조건입니다.

API 키가 없으면 모델을 호출하지 않고 수동 확인 상태를 남깁니다. 캐시 재사용, 제외 페이지, 물리 페이지 한도 초과도 새 호출을 발생시키지 않습니다. 텍스트 PDF는 문자층을 사용하고, 공백·깨진 문자를 제외한 문자 수가 80 미만이면 페이지 이미지를 추가합니다. 근거: `app/pipeline.py:65~74`, `:111~246`.

`app/ai.py:92`의 `call_agent()`가 원본 `promptbook/<역할>/`을 읽고 :124에서 Responses API를 호출합니다. 최종 요청은 다음 구성입니다.

| 요청 요소 | 원문·동적 입력 |
| --- | --- |
| `instructions` | `system.md` 원문 |
| 사용자 텍스트 | `body.md` + `입력 자료:` + `payload` JSON |
| 페이지 payload | 문서 ID, 원본 페이지, 문서 유형, 페이지 텍스트, 자료 대상기간; 추출 시 해당 유형의 `features` 추가 |
| 누락 재추출 payload | 기존 payload의 `features`를 누락 키로 제한하고 `retry_scope` 추가 |
| 이미지 | 필요한 경우 동일 페이지의 `input_image`, `detail=high` |
| 출력 형식 | `output.schema.json`에 `properties`가 있으면 해당 schema 우선; 없으면 `pipeline.py`의 호출자 schema |
| 모델·요청 예산 | `app/ai.py`의 런타임 환경 설정; 기본값은 [README.md](README.md) 참조 |

`input.schema.json`은 참조용으로 로드되지만 `call_agent()`가 payload 입력 검증에 사용하지 않습니다. `example.json`도 실제 요청에 자동 삽입되지 않습니다. 요청 재시도 예산과 누락 키의 추가 추출 1회는 서로 다른 조건입니다.

## 4. 현재 호출되지 않는 역할 정의

아래 파일은 `app/ai.py:18`의 목록과 프롬프트 조회·편집 API에 포함되지만, 현재 앱의 `call_agent()` 호출 지점이나 n8n 노드에서 사용하지 않습니다.

| 폴더 | 정의된 역할 | 현재 실행 관계 |
| --- | --- | --- |
| [prompts/validate/](prompts/validate/) | 입력·필요자료 검증 | 실제 검증은 `app/assessment.py`의 코드 경로 |
| [prompts/judge/](prompts/judge/) | 법적 검토 역할 | 현재 자동 AI 호출 없음 |
| [prompts/draft/](prompts/draft/) | 초안 작성 역할 | 실제 문서 작성은 결정론적 템플릿 경로 |
| [prompts/law_update/](prompts/law_update/) | 법령 변경 검토 역할 | law-watch 노드는 HTTP 원문 수집만 호출 |
| [prompts/evaluate/](prompts/evaluate/) | 평가 역할 | 현재 앱·n8n 자동 호출 없음 |

조회·편집 경로는 [app/main.py](../app/main.py):635의 `GET /api/promptbook`과 :641의 `PUT /api/promptbook/{name}`입니다. 참조 폴더의 프롬프트 사본은 이 API의 편집 대상이 아니며, 실제 편집 대상은 상위 `promptbook/`입니다.
