# 법적 기준정보와 실행 판본

이 문서는 코드·카탈로그·프롬프트에 있던 기준을 조회하고 관리하는 기준정보 계층을 설명한다. 관리 화면은 `/reference-data`이며 기존 사건 작업공간의 **법적 기준정보** 메뉴에서 연다. 일일 개정·공고 확인 절차는 [법령·법원 문서 감시 운영 문서](legal-monitor-runbook.md)에 있다.

등록된 기준은 법령의 내용, 법원 실무준칙, 서식·문서 선택 기준, 산술 규약, 원문 추출 계약, 앱 운영 정책을 함께 포함한다. 각 행의 `category`, `verification`, `runtimeMode`, `editable`을 함께 읽어야 한다. 기존 구현을 데이터로 이관했다는 사실만으로 해당 문언의 최신성이나 사건별 적용이 승인되지는 않는다.

## 1. 원본 데이터와 생성된 조사 목록

직접 관리하는 원본과 이를 합쳐 만드는 통합 목록의 역할은 다음과 같다.

| 파일 | 관리하는 내용 | 실행에서의 사용 |
| --- | --- | --- |
| [`lib/reference-parameters.json`](../lib/reference-parameters.json) | 금액, 기간, 연령, 비율, 시행일, 관할, 공식 출처, 산식 설명, 고정 조건의 명세 | `reference-parameters.ts`의 형식별 getter |
| [`lib/reference-prompt-policies.json`](../lib/reference-prompt-policies.json) | 원문 추출·검증·분류·복구·커버리지·법률 검토 지시와 운영 예산 | `renderPromptPolicy`, `readPromptPolicyInteger`, `legalReviewInstructions` |
| [`lib/reference-decision-tables.json`](../lib/reference-decision-tables.json) | 업무 조건, 계산 명세, 업무와 계산의 연결, 에이전트 역할, 기존 문서·필드 용어 | 업무 실행·계산 카탈로그·에이전트 문맥 |
| [`lib/reference-document-policy.json`](../lib/reference-document-policy.json) | 기본 생성 문서, 추가 문서, 조건부 문서 선택, 공식 서식 코드와 후보 라우팅 | 문서 종류 결정, 서식 연결, 문서 출력 |
| [`lib/reference-monitor-policies.json`](../lib/reference-monitor-policies.json) | 법령 검색, 법원 문서 검색, 변경 분석 프롬프트와 요청 예산 | `legal-monitor-provider.ts` |
| [`lib/legal-catalog.json`](../lib/legal-catalog.json), [`lib/risk-catalog.json`](../lib/risk-catalog.json), [`lib/legal-exceptions.json`](../lib/legal-exceptions.json) | 기존 법률·위험·예외 기준과 출처, 문서 피처 연결 | 기존 소비 경로를 유지하며 통합 목록에 내용 보존 |
| [`lib/document-agent-field-contracts.json`](../lib/document-agent-field-contracts.json), [`lib/field-applicability-contracts.json`](../lib/field-applicability-contracts.json) | 문서 종류별 추출 항목과 적용 조건 | 문서·필드 계약, 프롬프트 문맥 |
| [`public/templates/catalog.json`](../public/templates/catalog.json), [`public/templates/additional_sources.json`](../public/templates/additional_sources.json) | 공식 서식과 원본 출처 | 서식 명세, 원문 감시 |
| [`lib/legal-monitor-sources.ts`](../lib/legal-monitor-sources.ts) | 공식 출처 목록, 별칭, 감시 대상과 일정 정책 | 두 변경 감시 에이전트 |
| [`lib/reference-intake-catalog.json`](../lib/reference-intake-catalog.json) | 실제 상담 봇의 분류 피처·증빙서류·매칭 규칙·출처를 보존한 seed | `intake-catalog.ts`와 기존 카탈로그 판본 저장 경로 |
| [`lib/reference-data.json`](../lib/reference-data.json) | 위 자료를 통합한 `legal-reference-data/1` 레코드 | 조회 API·MCP·저장용 목록 |
| [`lib/reference-release.json`](../lib/reference-release.json) | seed 판본 ID, 해시, 종류별 수량, 조사 파일 수 | 실행·검토 결과의 기준정보 판본 식별 |
| [`docs/reference-inventory.json`](reference-inventory.json) | 파일별 해시·역할·조사 결과와 조사 방법 | 조사 범위 및 변경 추적 |

긴 기존 카탈로그는 원본 파일을 유지한다. 통합 목록에는 각 원소와 메타데이터의 값을 보존하고 `consumers[].jsonPointer`로 원래 위치를 연결한다. 문서 family와 그 안의 field는 별도 행으로 나누어도 원래 연결 위치를 남긴다. 통합 JSON만 직접 편집하면 다음 생성 때 원본에서 다시 만들어지므로 원본 파일 또는 승인된 변경 후보 경로를 사용한다.

[`scripts/build-reference-data.mjs`](../scripts/build-reference-data.mjs)는 추적 중인 파일과 새로 추가한 비제외 파일을 조사한다. TypeScript AST에서 `if`, 조건식, `switch` 분기, 비교식, 숫자·BigInt 상수, 정책 문구 후보를 수록한다. 코드 후보에는 원문 구간, 심벌, 행, 구간 해시, 파일 해시가 연결된다. 문서와 테스트는 조사·검증 맥락으로 기록하며 법적 근거로 승격하지 않는다. 비공개 사건 자료, oracle·gold·heldout, 자격증명, 의존성 및 생성 번들은 법적 기준 조사에서 제외한다.

`code_criterion`은 코드의 실제 조건을 색인한 행이다. 법률 규칙으로 자동 분류되었다거나 모든 조건이 원격 편집 가능한 매개변수로 바뀌었다는 뜻이 아니다. 이 행은 `runtimeMode: compiled_guard`, `editable: false`이고 변경에는 코드 검토·검증·배포가 필요하다. 레코드 수와 파일 수는 계속 생성되는 `reference-release.json` 및 API의 값으로 확인한다.

## 2. 통합 레코드 스키마

타입의 기준은 [`ReferenceRecord`](../lib/reference-registry.ts)다.

| 필드 | 형식 | 의미 |
| --- | --- | --- |
| `id` | 문자열 | 기준의 안정된 식별자. `param.*`, `prompt.*`, `workflow.*`, `document.*`, `monitor.source.*`, `code.*` 등의 이름공간 사용 |
| `kind` | 문자열 | 매개변수·법률 기준·문서 계약·코드 조건 등 레코드 종류 |
| `category` | 문자열 | 기준의 성격 또는 기존 카탈로그의 권한·관할 표현 |
| `title`, `value` | 문자열, JSON 값 | 표시 이름과 원래 형식을 보존한 현재 기준값 |
| `unit` | 문자열 또는 `null` | 원, 개월, 연령, 분수 비율, 표, 원문 등 값의 의미 |
| `sourceIds`, `sourceUrls` | 문자열 배열 | 연결된 출처 식별자와 공식 원문 주소 |
| `effectiveFrom`, `effectiveTo` | 날짜 문자열 또는 `null` | 등록된 적용 시작·종료일. `null`을 현재 유효함으로 해석하지 않음 |
| `courtIds` | 문자열 배열 | 명시된 관할. 빈 배열을 전국 적용의 법적 승인으로 해석하지 않음 |
| `verification` | 문자열 | 출처·이관·사람 검토 상태 |
| `consumers` | 객체 배열 | 소비 파일 `path`, 심벌 `symbol`, 선택적 `line`, `jsonPointer`, 해시 정보 |
| `condition`, `consequence` | JSON 값 또는 `null` | 조건과 결과·후속 조치. 고정 코드 후보는 식과 원문 구간을 기록할 수 있음 |
| `runtimeMode` | 문자열 | 실제 실행 경로 또는 검토 명세의 역할 |
| `editable` | 불리언 | 현재 변경 후보 API에서 값 변경을 허용하는지 여부 |
| `requiresHumanReview` | 불리언 | 검토 필요 여부 |
| `lockedSafetyInvariant` | 선택적 불리언 | 이 릴리스에서 변경을 차단한 추출·계산·보호 계약 |
| `sha256` | 문자열 | 정규화된 레코드의 SHA-256 |

원본을 잃지 않도록 `payload`, `placeholders`, `ruleIds`, `changePolicy` 등 종류별 확장 정보도 보존한다. 승인된 활성 변경이 있으면 `currentReferenceRecord`가 현재 값·출처·시행일·검토 상태를 투영하고 `seedRecordSha256`, `activeReleaseSha256`, `changeProvenance`를 덧붙인다.

### 종류와 성격을 함께 읽기

| `kind` 묶음 | 주요 내용 |
| --- | --- |
| `parameter`, `prompt`, `application_policy` | 실행값, 텍스트 규약, 운영 정책 |
| `legal_rule`, `source`, `risk`, `exception` | 기존 법률 기준, 출처, 검토 항목, 예외 조건 |
| `workflow`, `calculation`, `workflow_calculation`, `agent_contract` | 업무·계산·에이전트의 실행 계약 |
| `document_rule`, `document_family`, `field_contract`, `form` | 문서 선택·종류·필드·서식 |
| `monitor_source` | 감시하는 공식 출처 |
| `intake_feature`, `intake_document`, `intake_rule`, `intake_source` | 실제 상담·체크리스트 카탈로그의 피처·서류·규칙·출처 |
| `catalog_metadata`, `legacy_vocabulary` | 카탈로그 설명과 기존 용어 |
| `code_criterion` | 코드에 고정된 조건의 조사 기록 |

매개변수의 `category`는 `statute`, `court_practice`, `application_policy`, `arithmetic_policy`를 구분한다. 프롬프트에는 `prompt_policy`, `extraction_contract`, `application_policy`가 쓰이고 권한은 앱 정책으로 기록된다. 통합 목록의 `category`는 고정 enum이 아니다. 기존 출처의 `national_statute`, `presidential_decree`, `supreme_court_rule`, `supreme_court_case`, `supreme_court_directive`, 서울회생법원 기준 또는 기존 관할 문구도 유지한다.

`runtimeMode: parameter`와 `prompt`는 실행 중 기준값을 해석하는 경로다. `decision_table`은 선언된 조건표를 기존 실행기가 소비한다. `compiled_guard`, `engine_guard`는 코드의 보호 조건이며 `metadata`, `catalog` 등은 명세·카탈로그 역할을 나타낸다. `legal_review`, `deterministic_after_review`, `arithmetic_after_review`, `evidence_check`, `warning_only`는 기존 법률 카탈로그가 선언한 구현 범위다. 실행 모드와 별도로 `editable`·잠금 여부를 확인한다.

### 검증 상태

- `inherited`: 기존 구현의 값을 이관했다. 최신 법령 검증 완료 표시가 아니다.
- `inherited_intake_catalog`: 실제 상담 봇의 기존 카탈로그 내용을 이관했다. 원문을 새로 검증하거나 권장자료를 법정 의무로 승인한 상태가 아니다.
- `unverified`: 추가 원문 검증이 필요하다.
- `source_verified`: 출처 확인을 표시하기 위한 상태다. 해당 사건의 법적 인정과는 별개다.
- `human_reviewed_reference_change`: 사람의 승인 절차를 거쳐 활성화된 변경이다. 검토자·시각·이유·출처는 변경 provenance에 남는다.

공식 URL의 존재, HTTP 수집 성공, 해시 비교 성공, 법적 효력 확인, 사건별 적용 검토는 서로 다른 증거다. 출처가 빠진 행은 화면에서 **추가 검증 필요**로 표시한다.

## 3. 런타임 주입

[`reference-runtime.ts`](../lib/reference-runtime.ts)의 `readReferenceValue<T>(id, fallback)`는 현재 판본의 override가 있으면 그 값을, 없으면 원본 seed 값을 반환한다. `ReferenceSnapshot`은 `id`, `revision`, `sha256`, `values`, 선택적 `metadata`로 구성된다. `values`는 전체 카탈로그 사본이 아니라 승인된 override 모음이다.

서버는 [`worker/index.ts`](../worker/index.ts)에서 요청을 `runWithReferenceContext`로 감싼다. [`reference-context.ts`](../lib/reference-context.ts)는 `AsyncLocalStorage`에 읽기 전용 snapshot을 설치하므로 요청 간 기준값이 섞이지 않는다. 저장된 판본의 seed 해시, 내용 해시, 값의 형식, provenance를 검증한다. 승인된 변경이 들어 있는 저장 판본과 배포 코드의 seed가 맞지 않으면 `REFERENCE_RELEASE_CODE_MISMATCH`로 차단한다. 초기 seed의 fallback과 검증 실패 처리는 이 함수에 정의돼 있다.

브라우저는 `/api/workspace` 또는 사건 응답의 `referenceSnapshot`, 기준정보 응답의 `active`를 `installBrowserReferenceSnapshot`에 설치한다. 기간 입력 상한, 거래 검토 금액, 생계비 비율 표시도 같은 getter를 사용한다.

매개변수 getter는 돈을 원 단위 정수 **문자열**, 기간·연령을 안전한 정수, 비율을 `{numerator, denominator}`로 받는다. `referenceMoney`, `referencePositiveInteger`, `referenceRatio`가 형식을 검증한다. `ordinaryPlanMonths`, `maximumPlanMonths` 등은 의미별 ID를 해석한다. 금액 문자열을 부동소수점으로 자동 변환하거나 등록된 식을 `eval`하지 않는다. 산식 설명을 바꾼다고 산술 알고리즘이 바뀌는 구조가 아니다.

업무·계산 명세는 `getWorkflowRules`, `getCalculationSpecs`가 읽고, 문서 정책은 `requiredKindsForCase`, 서식 연결·출력 경로가 소비한다. 법률 검토에는 현재 규칙·계산 결과와 판본 식별자를 전달한다. 전체 코드 조사 목록을 모델 입력에 넣지 않는다.

### OCR 프롬프트 보존

`renderPromptPolicy`는 선언된 `{{name}}` 자리만 한 번 치환한다. 템플릿의 변수 집합과 제공 인수를 대조하며, 치환 결과를 다시 템플릿이나 코드로 실행하지 않는다. `readPromptPolicyInteger`의 예산은 법적 기간·금액과 구분된 앱 운영값이다.

기존 OCR 지시와 상담 사실 후보 분류 지시는 이 도입판에서 `lockedSafetyInvariant`로 잠근다. 같은 입력의 렌더링 결과를 기존 바이트와 동일하게 유지하며 기존 원문 검증 영수증의 프롬프트 버전·해시를 새 기준정보 저장 때문에 바꾸지 않는다. 법률 검토 지시는 `legalReviewInstructions()`에서 현재 판본 식별자를 별도로 추가한다.

[`tests/reference-prompts.test.ts`](../tests/reference-prompts.test.ts)와 [`tests/reference-prompt-baseline.json`](../tests/reference-prompt-baseline.json)은 기존 운영 소스에서 계산한 지시문·동적 분기 해시를 검증한다. 이 검증에는 실제 OCR 실행이나 비공개 정답 데이터가 필요하지 않다. 상담 분류의 `prompt.intake.classifier.instructions`는 `negativeSubjectLabels` 자리만 치환하고 요청마다 기준정보 renderer를 사용한다. `tests/intake-prompt.test.ts`가 합쳐진 상담 개선 원본(`683981f9449a7b6f427ea1e2d7672b4f8516927d`)과 바이트 동일성을 검증하며 해당 원본의 `intake-classifier-3` 버전을 유지한다. 잠긴 지시를 바꾸려면 별도 코드 변경, 의미 검토, 필요한 버전·영수증 호환성 검토를 거친다.

## 4. 저장, 후보 검토와 불변 판본

스키마는 [`drizzle/0006_legal_reference_monitor.sql`](../drizzle/0006_legal_reference_monitor.sql)에 있다.

| 테이블 | 역할 |
| --- | --- |
| `legal_reference_items` | seed 릴리스별 레코드와 해시 |
| `legal_reference_releases` | seed 및 승인된 실행 판본, override와 provenance |
| `legal_reference_changes` | 변경 제안, 기준 판본 해시, 검토·승인 상태 |
| `legal_monitor_observations`, `legal_monitor_observation_history` | 현재 비교본과 관측 이력 |
| `legal_monitor_runs`, `legal_monitor_alerts` | 실행 결과와 사람 검토 대상 알림 |
| `legal_monitor_state`, `legal_monitor_locks` | 재개 위치·검색 큐·일정 표시와 동시 실행 제어 |

`bootstrapReferenceData`는 seed를 제한된 묶음으로 저장하고 `nextOffset`으로 재개한다. 사건 테이블을 읽거나 변경하지 않는다. 저장 상태는 `{seeded, total, complete}`이며 `seeded`는 저장된 행 수다.

변경은 다음 순서를 따른다.

1. 현재 판본과 해당 레코드의 출처·조건·소비 코드를 확인한다.
2. 인증된 사람이 변경 값, 이유, 공식 출처, 선택적 시행일, `expectedActiveSha256`로 후보를 제출한다.
3. 서버는 편집 가능 여부, 잠금, 자료형과 구조, 금액·날짜·비율·기간, 프롬프트 자리표시자 등을 검사하고 `pending_review` 후보를 저장한다.
4. 별도 활성화 요청에서 인증된 사람을 기록하고 후보의 기준 해시와 현재 판본 해시를 대조한다. 미래 시행일, 판본 충돌, 기간 불변조건 위반을 차단한다.
5. 새 릴리스에 값을 기록하고 이전 active 릴리스를 `superseded`, 후보를 `approved`로 전환한다. 기존 릴리스의 값은 덮어쓰지 않는다.

현재 값 변경 API는 허용된 `parameter`·`prompt`에 한정한다. 고정 코드, 산식 설명, 잠긴 OCR 계약과 다른 카탈로그 행은 코드 릴리스로 관리한다. `statute`·`court_practice` 후보는 공식 출처가 필수다. 모든 제출 출처는 서버가 허용하는 공식 HTTPS 주소여야 한다. 화면은 후보 등록까지 제공하며 활성화 버튼은 제공하지 않는다. 감시 알림의 **확인 기록**도 후보 승인이나 활성화가 아니다.

## 5. 파생 계산과 문서 영수증

기준정보 판본은 계산 도구의 `referenceRelease`, 파생 평가의 `referenceSha256`, 법률 검토 응답, 문서 작성 영수증에 기록된다. 기존 법률 카탈로그의 `ruleReleaseId`와 전체 기준정보 snapshot의 식별자는 서로 다른 역할을 가진다.

- [`server-store.ts`](../lib/server-store.ts)는 사건 revision·입력 해시·저장 토큰·실행기 버전과 함께 기준정보 해시를 검사한다. 기준 해시가 달라진 파생 평가는 초기화하여 다시 계산하며, 다른 기준 판본의 법률 검토 응답을 현재 결과로 재사용하지 않는다.
- [`assessment.ts`](../lib/assessment.ts)는 변경 판본의 사건별 적용 검토가 `referenceReviewSha256`에 연결되지 않았으면 검토 필요 항목을 만든다. 기존 원문 확인이나 법적 인정이 새 기준 적용 승인으로 자동 전환되지 않는다.
- [`document-writer.ts`](../lib/document-writer.ts)는 오래된 기준으로 계산된 결과를 `DOCUMENT_REFERENCE_RELEASE_STALE`로 차단하고 영수증에 기준 판본을 남긴다.
- 문서 생성 API는 실제 파일 저장 직전에 활성 판본을 다시 읽는다. 작성 도중 판본이 바뀌면 최신 계산·검토를 요구한다. 이전 보관 파일과 영수증은 당시 판본의 이력이며 새 기준으로 자동 재작성되지 않는다.

이 검사는 계산·문서의 유효성을 위한 장치다. 기준정보 감시 실행 자체는 사건 사실, 인정 상태, 문서 승인 상태를 변경하지 않는다.

## 6. API와 MCP

| 경로·도구 | 용도 |
| --- | --- |
| `GET /api/reference-data?kind=&q=&offset=0&limit=50` | seed 릴리스, 활성 snapshot, 저장 상태, 현재 레코드 페이지 조회 |
| `POST /api/reference-data` / `action: bootstrap` | 배포·이관 작업에서 seed 저장을 제한된 묶음으로 진행 |
| 같은 경로 / `action: propose` | 인증된 사람의 변경 후보 등록 |
| 같은 경로 / `action: activate` | 인증된 사람의 별도 활성화. `proposalId`, `expectedActiveSha256` 필요 |
| `GET /api/legal-monitor` | 출처, 상태, 실행 기록, 알림, 일정, 기준 판본 조회 |
| `POST /api/legal-monitor` / `action: run` | 제한된 출처 구간 확인 |
| 같은 경로 / `action: acknowledge` | 인증된 사람이 알림 확인 기록 저장 |
| 같은 경로 / `action: set_schedule` | 실제 외부 예약 실행과 연결한 일정 메타데이터 저장 |
| hosted `/mcp`의 `get_reference_catalog` | 기준정보 페이지 조회. 사건 데이터 불필요 |
| hosted `/mcp`의 `run_legal_monitors` | 두 감시 에이전트 실행·재개 |
| hosted `/mcp`의 `get_legal_change_alerts` | 변경 알림과 수집·일일 진행 상태 조회 |
| hosted `/mcp`의 `get_intake_reference` | 실제 상담 봇 기준표의 현재 판본·해시·피처·서류·규칙·출처 조회. 입력은 `{}` |
| `GET /api/intake-reference` | 실제 상담 카탈로그를 기준정보 관리·감시용으로 읽는 조회 adapter |
| `GET /api/checklist-catalog` | 상담 봇이 사용하는 현재 카탈로그와 판본 이력 |
| `PUT /api/checklist-catalog` | 인증된 사람의 상담 기준정보 편집 경로. `{catalog, expectedVersion}`으로 새 전체 판본 저장 |

MCP 서비스 구현은 [`site-calculator-mcp.ts`](../lib/site-calculator-mcp.ts)와 [`app/mcp/route.ts`](../app/mcp/route.ts)에 있다. stdio 계산기 스크립트에 hosted 감시 기능이 있다고 가정하지 않는다. 기준정보 활성화·사건 승인 MCP는 추가하지 않았다. 쓰기 요청의 origin 검사와 사람 검토가 필요한 작업의 인증은 기존 서버 경로를 사용한다.

## 7. 실제 상담·체크리스트 봇의 기준정보 연결

상담 기능은 상담 원문을 저장하고 여러 특성을 분류한 뒤 등록된 조건 규칙으로 필요한 증빙서류를 매칭한다. 사건 상담 화면은 `/cases/{caseId}/consultation`, 기준표 편집 화면은 `/data/checklist`다. 사용자 흐름과 경계는 [상담 기반 필요서류 체크리스트](consultation-checklist.md)를 따른다. 이 문서는 해당 기능의 기준정보 통합을 설명하며 실제 모델 정확도·배포·예약 실행의 검증 결과를 대신하지 않는다.

단일 원본은 `IntakeCatalog`의 `features`, `documents`, `rules`, `sources`다. 초기 판본에는 **분류 피처 49개, 증빙서류 74종, 매칭 규칙 54개, 출처 11개**가 있다. 이는 등록한 범위이며 분류 정확도나 전체 사건 완전성 점수가 아니다. 편집 후 수량은 현재 저장 판본을 기준으로 확인한다. 기존 OCR 문서 family 목록과 이 증빙서류 목록은 목적과 세분화가 다르므로 같은 목록으로 취급하지 않는다.

[`reference-intake-catalog.json`](../lib/reference-intake-catalog.json)은 실제 기존 seed를 내용 그대로 보존한다. [`intake-catalog.ts`](../lib/intake-catalog.ts)는 이 데이터에 연결하고, 운영 중에는 기존 `intake_catalog_head`가 가리키는 판본을 사용한다. 별도의 빈 사건유형·요구서류 테이블을 두어 같은 봇의 기준을 중복 관리하지 않는다.

### 논리 스키마와 물리 저장

정식 타입은 [`intake-types.ts`](../lib/intake-types.ts)의 `IntakeCatalog`, 검증·매칭은 [`intake-engine.ts`](../lib/intake-engine.ts)에 있다. 스키마 버전은 `consultation-checklist-v1`이다.

| 카탈로그 영역 | 보존하는 필드와 역할 |
| --- | --- |
| `features` | `id`, `label`, `scope`, `question`, `essential`, `description`. 복수 소득·채무·재산·가족·사건·절차의 분류 후보와 추가 질문 |
| `documents` | `id`, `name`, `category`, `issuer`, `purpose`, `fields`, `workflowDocumentTypes`, `sourceIds`. 준비할 증빙의 종류·발급처·확인 항목·기존 workflow 연결 |
| `rules` | `id`, `title`, `enabled`, `scope`, `all`, `any`, `documents`, `questions`, `workflowIds`, `sourceIds`, `jurisdictions`, `effectiveFrom`, `effectiveTo`, `legalReviewRequired` |
| `sources` | `id`, `title`, `url`, `jurisdiction`, `checkedAt`, `locator`, `note`. 공식 문서와 사무실 정책의 출처·위치·적용 한계 |
| 공통 메타데이터 | `schemaVersion`, `version`, `title`, `note` |

규칙 조건은 `{featureId, state}`이고 `state`는 `present` 또는 `absent`다. `all`은 전부 충족, `any`는 하나 이상 충족이라는 선언적 조건이다. 서류 요청에는 `documentTypeId`, `alternatives`, `alternativePolicy`, `period`, `requirement`, `reason`이 있다. 요구 수준은 `recommended`, `required_when_applicable`, `court_ordered`, 대체자료 정책은 `any_of`, `review_required`를 구분한다. `period`는 적용 문맥이 있는 설명을 그대로 보존하며 임의의 전역 조회 개월 수로 바꾸지 않는다.

| 테이블 | 역할 |
| --- | --- |
| `intake_catalog_versions` | 카탈로그 전체 payload, 판본, 스키마, SHA-256, 저장자·시각 |
| `intake_catalog_head` | 현재 카탈로그 version과 해시 |
| `consultation_notes` | 상담 원문·해시·순번·작성자·정정 연결 |
| `consultation_heads` | 상담 revision과 현재 분석 ID |
| `consultation_runs` | 실행 fingerprint·상태·결과·영수증과 payload 해시 |

기존 배포 migration [`0004_broken_gorgon.sql`](../drizzle/0004_broken_gorgon.sql), [`0005_sudden_the_twelve.sql`](../drizzle/0005_sudden_the_twelve.sql)을 유지한다. 기준정보·감시 테이블은 후속 `0006_legal_reference_monitor.sql`에 추가한다. features/documents/rules/sources는 논리적으로 분리되지만 운영 카탈로그는 전체 JSON 판본으로 저장된다.

### 현재 판본 편집과 실행

[`intake-store.ts`](../lib/intake-store.ts)의 `getIntakeCatalog`가 현재 head와 저장 payload 해시를 확인한다. seed 초기화가 필요한 경우 기존 판본 테이블을 사용한다. `GET /api/checklist-catalog`는 `{catalog, sha256, history, model}`을 반환한다. `PUT`은 same-origin 검사와 `requireHumanActor` 인증 후 `{catalog, expectedVersion}`을 받아 스키마·참조·범위·용량을 검사하고 새 판본을 추가한다. 이전 판본·해시가 여전히 일치해야 head를 전환하며 다른 편집과 충돌하면 409를 반환한다.

카탈로그 수정은 기존 `/data/checklist`와 해당 API를 통해 수행한다. `/api/intake-reference`와 `get_intake_reference({})`는 같은 운영 카탈로그를 기준정보 관리·감시용으로 읽는 adapter다. 이 조회에 상담 내용·사건 식별자를 넘기지 않으며 별도 저장 master를 만들지 않는다. 통합 레코드를 고치는 것으로 상담 카탈로그의 현재 판본이 바뀌지는 않는다.

읽기 전용 응답에는 `schemaVersion`, `catalog`, `catalogVersion`, `catalogSha256`, `initialized`, `records`, `counts`, `monitoring`, `readOnly`, 관리 화면·API 주소가 있다. `active`는 현재 저장 카탈로그이며 아직 저장 판본이 없으면 `null`이다. 이 경우 실제 초기 카탈로그를 조회용으로 반환하되 DB에 seed를 쓰지 않는다. head와 payload의 판본·스키마·해시가 일치하지 않으면 `INTAKE_CATALOG_INTEGRITY_FAILED`로 차단한다. `records[]`는 원본 ID를 `nativeId`로 보존하고 통합 ID·종류·값·출처·관할·시행기간·활성 여부를 붙인다. `monitoring`은 공식 도메인으로 수집 가능한 출처와 제외 이유를 구분한다.

상담 분류 모델은 등록된 feature ID, 대상, 상태, 현재·과거 구분, 정확한 원문 인용만 반환한다. 서버가 인용의 실제 위치와 주체·범위를 검증하고 `client_report`로 저장한다. 문서 선택은 서버의 `matchIntakeChecklist`가 수행한다. 미언급은 부재가 아니며 신청인과 배우자·부모의 소득·소유를 분리한다. 과거 사건의 명령은 현재 제출의무가 아니다. 관할·시점이 불명확하거나 진술이 충돌하면 추가 질문 또는 검토 상태를 남긴다.

실행 영수증에는 사건 revision·저장 토큰·입력 해시, 상담이력 해시, 카탈로그 판본·해시, 엔진·프롬프트·모델 버전과 사용량을 기록한다. 분석 중 이 값이 바뀌면 이전 결과를 현재 결과로 채택하지 않고, 조회 시 오래된 결과에 재분류 사유를 표시한다. 상담 안내를 사실·법적 인정·제출 승인으로 승격하지 않는다. 기준정보 변경을 감지한 예약 작업은 상담 분석이나 사건 API를 실행하지 않는다.

### 통합 목록과 출처 감시

통합 조사 목록은 `intake.feature.*`, `intake.document.*`, `intake.rule.*`, `intake.source.*` ID로 각 카탈로그 원소와 JSON pointer를 보존한다. `kind`는 각각 `intake_feature`, `intake_document`, `intake_rule`, `intake_source`이고 실행 모드는 `separate_reference_table`, 이관 검증 상태는 `inherited_intake_catalog`다. `intake.schema`는 실제 관리 화면·API·판본 테이블을 설명한다. 처리 한도와 명시적 부재 대상 이름 규약도 앱 정책으로 기록한다.

현재 카탈로그의 출처와 규칙·문서 연결은 읽기 전용 bridge를 통해 감시 범위에 들어간다. 공식 URL은 기본 목록에 합치고 새 출처도 다음 실행에서 확인한다. 정부24 발급 안내와 법원 실무자료를 포함하며 사무실 내부 정책 URL은 공식 법령 근거로 승격하지 않는다. 알림에는 실제 카탈로그의 피처·문서·규칙·출처 ID를 연결하고 사람이 현재 판본의 관할·기간·요구 수준·대체자료를 검토한다. 저장된 감시 알림과 실행 요약에는 `intakeReference: {version, sha256, initialized}`를 함께 남겨 어떤 상담 카탈로그를 기준으로 영향 범위를 판단했는지 추적한다.

카탈로그에 저장된 발급시점·소득 자료기간·과거 신청이력 기간은 해당 문서와 규칙의 문맥을 가진다. 권장자료와 법원별 첨부자료, 법원의 구체적인 명령을 구분한 채 보존한다. 합병·이관 작업 자체가 출처의 최신성이나 새로운 법적 의무를 승인한 것으로 표시하지 않는다.

## 8. 재생성·검증과 후속 범위

로컬 소스 변경 후 다음 명령으로 통합 목록을 생성하거나 차이를 확인한다. 두 명령 모두 모델·OCR·사건 API를 실행하지 않는다.

```sh
node --experimental-strip-types scripts/build-reference-data.mjs
node --experimental-strip-types scripts/build-reference-data.mjs --check
```

기준정보·프롬프트·감시 테스트는 실제 법원 접속 대신 합성 데이터와 주입한 fetch/provider를 사용한다. 테스트 결과와 수량은 해당 실행 기록을 기준으로 남긴다. 저장·승인·영수증 변경을 검토할 때는 `reference-registry`, `reference-parameters`, `reference-prompts`, `document-writer`, `legal-monitor`, `legal-monitor-provider`, `legal-monitor-store` 관련 테스트를 확인한다.

실제 상담·체크리스트 기능과 그 운영 카탈로그를 통합 대상으로 포함한다. 카탈로그의 스키마·참조 검사, 결정적 매칭 테스트, 프롬프트 바이트 보존 검사와 모델의 의미 분류 정확도 검증을 구분한다. 배포 완료나 예약 실행 연결 여부는 별도의 운영 검증 기록으로 확인한다.
