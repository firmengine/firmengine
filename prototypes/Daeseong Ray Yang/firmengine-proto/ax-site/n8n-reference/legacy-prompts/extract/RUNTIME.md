# 문서별 추출과 실행 한도

`app.ai.extract(items, metrics, required_features=None, rag_context=None)`는 원본 페이지 번호별 `document_type`을 이용합니다. 문서 매핑은 `rules/document_feature_mappings.json`의 목적 feature에서 읽고, 해당 문서에 필요한 인적·계약·계좌 세부 필드만 보완합니다. 전체 feature 목록을 한 번에 보내지 않습니다. `required_features`를 지정하면 그 범위로 좁힙니다.

종류가 `unknown`인 페이지는 매핑 공백을 기록하고 인적사항·소득·채무·재산의 제한된 사실 목록을 적용합니다. 각 페이지의 전체 전사문은 항상 남깁니다. 법률적 인정액·생계비·변제계획·조사완료 상태는 추출로 확정하지 않습니다.

`config.json`을 저장하면 다음 호출부터 적용됩니다.

| 설정 | 의미 |
| --- | --- |
| `batch_pages` | 한 호출의 최대 페이지 수. 예상 입력 한도에 맞춰 더 작아질 수 있음 |
| `max_features_per_task` | 한 호출의 최대 feature 수 |
| `max_input_tokens` | UTF-8 텍스트와 이미지별 예상치를 합친 입력 예산. 실제 과금 토큰의 보장은 아님 |
| `image_token_estimate` | 이미지 한 장의 계획용 토큰 예상치 |
| `max_output_tokens` | 제공자에 보내는 실제 출력 한도 |
| `global_concurrency` / `agent_concurrency` | 같은 프로세스에서 실제 모델 호출에 적용되는 전체/에이전트 한도 |
| `http_retries` | 일시적인 네트워크·429·5xx 오류 재시도 횟수 |
| `missing_feature_retries` | 출처 검증을 통과한 값이 없는 feature만 다시 찾는 횟수 |
| `request_timeout_seconds` / `connect_timeout_seconds` | 요청/연결 제한 시간 |
| `queue_timeout_seconds` | 모델 호출 슬롯 대기 제한 시간 |
| `retry_backoff_seconds` | HTTP 재시도의 초기 대기 시간 |
| `rag_top_k` / `rag_chars_per_hit` | 전달된 참고 문맥의 최대 개수(3)와 본문 길이 |

동시 실행 중인 요청의 설정은 고정됩니다. 대기·실행 중 요청이 서로 다른 한도를 갖는 경우 더 작은 한도를 적용합니다. 여러 API 서버 프로세스 사이의 분산 한도는 구현하지 않았으므로 로컬 실행은 단일 worker를 사용합니다.

실제 고객 입력·출력은 추적 파일 안에만 저장합니다: `.runtime/sessions/{case_id}/promptbook/extract/{call_id}/`. `system.md`, 렌더링된 `body.md`, `input.json`, 검증된 `output.json`, `meta.json`, `usage.jsonl`을 확인할 수 있습니다. 이미지 base64, API 헤더·키, 원본 저장 경로는 기록하지 않습니다. `usage.jsonl`은 대기·실행·재시도·토큰 사용량을 기록합니다. 사건 삭제 후 늦게 끝난 요청이 폴더를 재생성하지 않습니다.

성공한 반환값은 기존과 같은 fact 목록이며 `.pages`, `.missing_features`, `.warnings`를 함께 제공합니다. `missing_features`는 이번 문서 범위에서 발견되지 않은 key 목록이며 사건 전체의 서류 충족 판정이 아닙니다. 출처 검증은 원본 페이지 ID와 전사문-인용문 일치를 확인하는 자동 일관성 검사입니다. 원본 영상과 값의 진실성·현재 적용 여부는 검토 화면에서 확인해야 합니다.
