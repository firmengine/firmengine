# 편집 가능한 에이전트 프롬프트

분류·추출 에이전트가 실제로 사용하는 프롬프트입니다. `system.md`, `body.md`, `config.json`을 UTF-8로 수정하면 **다음 AI 호출부터 서버 재시작 없이 적용**됩니다. 실행 중인 요청은 이미 읽은 버전을 사용합니다. 여러 배치가 실행 중일 때 수정하면 한 사건에 여러 버전이 사용될 수 있으므로, 비교 평가에서는 실행 전에 편집을 마치세요.

| 디렉터리 | 역할 | 호출하는 코드 |
| --- | --- | --- |
| `classify/` | 증빙·제출 완료본·행정서류·불명 페이지 분류 | `app.ai.classify` |
| `extract/` | 개인사업자 증빙에서 사실과 원문 근거 추출 | `app.ai.extract` |
| `law-watch/` | 법규 변경 내용을 검토용 후보로 정리 | `app/knowledge.py` |
| `judge/` | 관련 사실·RAG로 추가 증빙과 준비·처분 검토안 제안 | `app/guidance.py` |
| `evaluate-gold/`, `evaluate-forms/` | 제출본 기준 정의와 생성 문서 독립평가 | `evaluation/`의 별도 평가 코드 |

평가 디렉터리는 평가 코드가 읽습니다. 아래 로더·설정 설명은 `classify/`, `extract/`에 적용됩니다.

## 파일 구성

각 에이전트 디렉터리에서 다음 파일을 확인할 수 있습니다.

| 파일 | 내용·실제 사용 위치 |
| --- | --- |
| `system.md` | 에이전트 역할·지시. Responses API의 최상위 `instructions`로 전달 |
| `body.md` | 작업 본문. `input[0].role = user`의 첫 번째 `input_text`로 전달 |
| `config.json` | 버전, 모델, 추론 노력, 출력 토큰 상한, 이미지 긴 변 크기 |
| `input.schema.json` | 이미지 첨부 전에 구성하는 논리 입력의 JSON Schema |
| `output.schema.json` | 실제 API `text.format.schema`와 응답 Pydantic 검증 계약 |
| `input.example.json` | 입력 형식을 보여주는 합성 예시 |
| `output.example.json` | 출력 형식을 보여주는 합성 예시 |
| `IO.md` | 사람이 읽는 입력·출력 필드 설명과 실제 기록 위치 |

예시는 실존 의뢰인·제출본 정답에서 가져오지 않았습니다. 예시 파일은 모델 요청에 자동 삽입되지 않습니다. 실제 입력·출력·원문 이미지를 이 디렉터리에 저장하지 마세요.

## 입력에서 API 요청까지

분류 입력은 `pages: [{document_id, page}]`와 상세 문서 유형 `document_types`입니다. 추출은 `rules/document_feature_mappings.json`의 문서 목적과 feature catalog를 읽어 문서별 `allowed_key_labels`를 구성합니다. `review_only_keys`는 자동 확정할 수 없는 법률 판단값입니다. `document_type`, `extraction_pass`, 최대 3개의 짧은 `reference_context`도 전달합니다. 참고 문맥은 용어 설명이며 의뢰인 사실의 출처로 사용할 수 없습니다.

본문에 사용할 수 있는 자리표시자는 다음과 같습니다.

| 자리표시자 | 분류 | 추출 | 삽입되는 데이터 |
| --- | --- | --- | --- |
| `{{pages_json}}` | 필수 | 필수 | 문서 ID와 원본의 1부터 시작하는 페이지 번호 |
| `{{document_types_json}}` | 필수 | — | 페이지별로 선택할 상세 문서 유형 |
| `{{allowed_keys_json}}` | — | 필수 | 허용된 키와 의미의 JSON 객체 |
| `{{review_only_keys_json}}` | — | 필수 | 자동 추출하지 않는 검토 전용 키의 JSON 배열 |
| `{{document_type_json}}` | — | 필수 | 현재 추출 작업의 문서 유형 |
| `{{extraction_pass_json}}` | — | 필수 | 최초 추출 또는 누락 feature 재확인 |
| `{{reference_context_json}}` | — | 필수 | 용어 해석에만 사용하는 제한된 검색 문맥 |

`{{identifier}}`만 한 번 치환합니다. 일반 JSON의 `{}`에는 특별한 의미가 없으며 `str.format`을 사용하지 않습니다. 삽입된 문서 데이터 안의 중괄호는 다시 해석하지 않습니다. 알 수 없는 자리표시자, 필수 입력 누락, 빈 프롬프트는 API 호출 전에 파일명을 포함한 오류로 중단됩니다.

추가 에이전트는 `load_prompt(agent, input_data, output_model, input_model=CustomInput)`으로 자체 Pydantic 입력 모델을 지정할 수 있습니다. 각 입력 필드 `field`는 `{{field_json}}`이 되며 모든 필드를 본문이나 시스템에 포함해야 합니다. 기존 `allowed_key_labels`만 `{{allowed_keys_json}}` 별칭을 유지합니다. 에이전트 디렉터리명은 영문 소문자로 시작하고 영문 소문자·숫자·`_`·`-`만 허용합니다.

본문 다음에는 각 페이지의 `DOCUMENT_ID=... PAGE=...` 라벨과 `input_image`가 순서대로 붙습니다. 이미지는 런타임 메모리에서 JPEG data URL로 전달하고, 예시 JSON에는 base64 이미지·로컬 경로를 넣지 않습니다. 따라서 `input.schema.json`은 이 논리 입력의 계약이며, Responses API 전체 요청의 스키마는 아닙니다.

평가용 증빙 분리 PDF를 사용할 때는 `_page_map`으로 물리 페이지를 렌더링합니다. 본문·라벨·출처 참조에는 **원본 페이지 번호**를 그대로 사용합니다. 분리된 증빙의 물리 페이지 번호가 출처 번호로 바뀌지 않습니다.

## 모델과 실행 설정

추출 1.2.0 주요 설정 예:

```json
{
  "version": "1.2.0",
  "model": "configured",
  "reasoning_effort": "low",
  "max_output_tokens": 24000,
  "image_long_edge": 2200,
  "batch_pages": 4,
  "max_input_tokens": 24000,
  "global_concurrency": 3,
  "agent_concurrency": 2,
  "missing_feature_retries": 1
}
```

- `model: "configured"`는 앱이 읽은 `OPENAI_MODEL`을 사용합니다. 미설정 기본값은 `gpt-6-luna`입니다. `config.json`에 `"model": "gpt-6-luna"`처럼 모델을 명시하면 다음 호출부터 해당 값을 사용합니다. `.env` 자체의 변경은 앱 재시작이 필요합니다.
- `reasoning_effort`는 `low`, `medium`, `high` 중 하나입니다. 모델이 해당 옵션을 지원해야 합니다.
- `max_output_tokens` 허용 범위는 256–64000입니다. `image_long_edge`는 256–4000픽셀입니다. 기본 분류 이미지 크기는 950, 추출은 2200입니다.
- 배치·입력 예산·동시 실행·타임아웃·재시도 설정은 각 `config.json`에서 수정합니다. [실행 한도 설명](extract/RUNTIME.md)을 참고하세요. 실제 제공자 호출에 프로세스 공통 한도가 적용되며 로컬 API는 단일 worker로 실행합니다.
- API 키는 기존 `.env`에서만 읽습니다. 프롬프트 파일에 키를 쓰지 마세요. `store: false`와 API URL은 Python 코드에서 유지합니다.
- 내용을 바꿀 때 `version`도 올리면 실행 비교가 쉽습니다. 버전을 바꾸지 않아도 파일 해시는 달라집니다.

## 출력 계약과 검증

분류 출력은 `pages: [{document_id, page, role, title, document_type}]`입니다. 추출 출력은 `facts: [{key, entity, value, unit, period, document_id, page, quote, confidence}]`, `warnings: [string]`, `pages: [{document_id, page, title, kind, transcript}]`입니다. 모든 원본 페이지를 정확히 한 번씩 반환해야 합니다. `transcript`는 표와 읽을 수 있는 원문을 보존하는 전사문이며, 완전히 읽을 수 없는 페이지도 그 사유를 적은 전사문을 반환합니다. 누락·중복·다른 페이지·빈 전사문은 명시적으로 실패합니다.

런타임은 매 호출마다 입력·출력 스키마를 Python Pydantic 모델과 비교합니다. 스키마 파일만 바꿔 검증을 우회할 수 없습니다. 구조 변경이 필요하면 `app/ai.py`의 출력 모델 또는 `app/promptbook.py`의 입력 모델과 해당 JSON Schema를 함께 수정하고 테스트·서버 재시작을 수행하세요. 입력 모델은 `ClassificationInput`·`ExtractionInput`, 출력 모델은 `Classification`·`Extraction`입니다. 스키마는 각 모델의 `model_json_schema()` 결과를 UTF-8 JSON으로 저장한 것입니다.

추출 결과는 허용 키·법률 판단값 제외·요청 페이지 범위·인용문과 같은 페이지 전사문의 일치를 검사합니다. `ExtractedFacts`는 사실 목록처럼 사용할 수 있고 `.pages`, `.missing_features`, `.warnings`를 보관합니다. 발견하지 못한 feature만 제한 횟수 재시도하며 누락은 0으로 채우지 않습니다. 전사문-인용문 검사는 자동 일관성 검사이므로 최종 원본 검토를 대체하지 않습니다.

## 실제 호출의 입력·출력 확인

편집용 파일과 실제 사건 데이터는 다른 디렉터리에 있습니다. 정상 세션에서 실행한 분류·추출 호출은 다음 비공개 경로에 기록됩니다.

```text
.runtime/sessions/<32자리 세션ID>/promptbook/<classify 또는 extract>/<호출ID>/
  system.md
  body.md
  input.json
  output.json
  meta.json
  usage.jsonl
```

| 기록 파일 | 확인할 수 있는 실제 데이터 |
| --- | --- |
| `system.md` | 해당 호출이 실제로 사용한 시스템 지시문 |
| `body.md` | 입력을 치환한 후 실제 전달한 본문 |
| `input.json` | `logical_input`: 스키마에 맞는 논리 입력. `sources`: 문서 ID·원래 파일명·원본 페이지·물리 페이지·이미지 라벨 |
| `output.json` | Pydantic 검증을 통과한 전체 구조화 응답. 사실 필터링 전이므로 전사문·경고도 포함 |
| `meta.json` | 호출 ID·에이전트·상태·시각·모델·버전·해시·토큰 사용량·안전한 오류 코드 |
| `usage.jsonl` | 호출별 대기·실행·재시도·완료 상태, 대기 시간과 토큰 사용량 |

이미지 base64, API 헤더·키, 로컬 원문 파일 경로는 기록하지 않습니다. 오류 응답 원문이나 스키마를 통과하지 못한 응답도 저장하지 않습니다. 실패한 호출에는 `output.json`이 없고 `meta.json`의 `error_code`를 확인하면 됩니다. `completed`는 API 응답 완료와 구조 검증을 뜻하며, 사건 품질·법률 검토·독립평가 통과를 뜻하지 않습니다. 추출 이후 페이지 범위 등 추가 검증에서도 작업이 실패할 수 있습니다.

이 경로는 `.gitignore`로 제외됩니다. 사건 닫기와 서버 재시작은 저장된 사건을 삭제하지 않습니다. 사건을 명시적으로 삭제한 뒤 늦게 도착한 응답은 기록 폴더를 다시 만들지 않습니다. 편집용 `promptbook/`에 실제 사건 기록을 복사하지 마세요.

기록은 실제 원문이 세션 안에 있거나 `.runtime/storage/cases/{case_id}` 안에 있고 동일 사건의 기존 journal 디렉터리에 연결된 경우에만 생성됩니다. 외부 경로·다른 사건·잘못된 ID에는 기록을 만들지 않습니다. 디스크 오류로 기록을 쓸 수 없는 경우에도 원문 경로·키를 오류 로그로 노출하지 않습니다.

## 실행 이력과 재현

`session.metrics.promptbook`에는 에이전트별 `version`, 전체 `sha256`, 각 실행 파일의 `file_hashes`, 실제 `model`, `calls`만 기록합니다. `calls`는 해당 스냅샷으로 API 요청을 시작한 호출 수이며 성공 수나 HTTP 재시도 횟수가 아닙니다. 해시는 `config.json`, `system.md`, `body.md`, 두 스키마의 원본 UTF-8 바이트를 대상으로 계산합니다. 예시·README·사건 데이터는 해시에 포함되지 않습니다.

프롬프트 본문, API 키, 의뢰인 값, 문서 ID, 이미지·응답 내용은 이 메트릭에 저장하지 않습니다. 요청별 설정은 별도 스냅샷으로 유지하므로 동시 추출 배치가 서로의 프롬프트 설정을 덮어쓰지 않습니다.

프로젝트 루트에서 다음 검사를 실행할 수 있습니다. 실제 API를 호출하지 않습니다.

```powershell
python -m unittest tests.test_promptbook tests.test_ai_runtime -v
```

검사는 임시 디렉터리의 프롬프트를 수정하여 다음 실제 요청 페이로드가 바뀌는지, 스키마 불일치·잘못된 자리표시자가 중단되는지, 출처 원본 페이지가 유지되는지 확인합니다. 독립평가의 점수와 통과 여부는 별도 평가 결과를 확인해야 합니다.
