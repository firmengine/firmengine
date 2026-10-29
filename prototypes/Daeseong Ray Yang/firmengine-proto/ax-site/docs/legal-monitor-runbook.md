# 법령·법원 문서 일일 감시 운영

일일 작업은 **매일 09:00, `Asia/Seoul`**에 공식 출처를 확인하고 ChatGPT와 `/reference-data`의 변경 감시 화면에 결과를 남기는 절차다. 확인 결과는 **변경 후보**, **확인한 범위에서 새 변경을 찾지 못함**, **확인 미완료·수집 실패**로 구분한다. 일정의 저장 메타데이터만으로 외부 예약 실행이 존재한다고 판단하지 않는다.

기준정보 스키마와 사람의 변경 승인 절차는 [기준정보 설명서](reference-data.md)를 따른다. 이 운영 작업은 사건 정보·자격증명·사건 식별자를 입력받지 않는다. 기준값, 사건 사실·인정, 서식 적용을 수정하거나 후보를 승인하지 않는다.

## 1. 에이전트와 공식 출처

| 에이전트 | 확인 범위 | 결과의 구분 |
| --- | --- | --- |
| `legislation` | 법률·시행령·대법원규칙·재판예규와 법률안 진행 | 개정안, 공포, 시행 예정, 시행, 개정 여부 미확정 |
| `court_documents` | 법원 실무준칙, 생계비 공고, 필수 제출목록, 안내되는 서류 종류, 공식 서식과 첨부 | 실무 공고, 서식 공고, 새 게시물, 동일 URL 첨부 변경 |
| `all` | 위 두 범위를 함께 확인 | 일일 예약 작업의 기본 선택 |

[`legal-monitor-sources.ts`](../lib/legal-monitor-sources.ts)는 현행 법령 주소, 법원 공고·서식 목록, 기존 기준의 고정 인용문·공식 첨부, 선택적 법제처 API를 묶는다. 도입판의 기본 고정 출처는 70개다. 실행 시 현재 기준정보와 실제 상담·체크리스트 카탈로그의 공식 URL을 동적으로 합치므로 전체 감시 출처는 이 수보다 많을 수 있다. 실제 목록·활성 여부는 `get_legal_change_alerts`의 `sources`를 기준으로 확인한다. 추가 검색으로 찾은 공식 게시물과 첨부도 별도로 관측한다.

주요 출처는 국가법령정보센터의 현행 법령·행정규칙, 국민참여입법센터의 입법현황, 서울·부산·수원·대구·대전회생법원 공고와 서식, 광주회생법원 실무준칙·직무편람 및 기존 공식 서식 원본이다. 공식 도메인 경계는 `law.go.kr`, `scourt.go.kr`, `assembly.go.kr`, `lawmaking.go.kr`, `mohw.go.kr`, `moj.go.kr`, `gov.kr`와 허용된 하위 도메인으로 제한한다. 법원·문서 검색은 `scourt.go.kr`와 정부24의 `gov.kr` 범위에서 실무·서식·증빙 발급 안내를 확인한다.

검색 모델이 제시한 URL은 공식 도메인 여부와 실제 웹검색 응답의 출처 URL에 모두 연결되어야 수용한다. 그 뒤 원문을 수집해 비교한다. 출처 문구와 검색 결과는 모델의 **입력 데이터**로 전달하며 감시 지시문에 합쳐 실행하지 않는다. 모델·호출 경로는 기존 `callLuna`의 `gpt-6-luna`를 사용한다. 등록 기준의 ID 밖에 있는 영향 규칙을 모델이 새로 승인할 수 없다. 구현은 [`legal-monitor-provider.ts`](../lib/legal-monitor-provider.ts)에 있다.

기존 환경에 법제처 API 접근 설정이 없으면 해당 API 출처만 `disabled`로 기록한다. 공개 공식 페이지와 도메인 검색은 계속 확인한다. 운영 보고에는 설정 누락 사실만 적고 자격증명 값은 수집·출력하지 않는다.

## 2. 일일 실행 순서

예약된 ChatGPT 작업은 hosted `/mcp`의 도구를 사용한다. [`site-calculator-mcp.ts`](../lib/site-calculator-mcp.ts)의 입력 스키마와 [`legal-monitor-store.ts`](../lib/legal-monitor-store.ts)의 반환값이 기준이다.

1. `run_legal_monitors`를 `{"agent":"all","cursor":0}`으로 호출한다. `maxSources`는 생략하여 서버의 제한을 사용한다.
2. MCP 결과의 `ok`를 확인한 뒤 `result`를 읽는다. `newAlerts`, `sourceHealth`, `discoveryStatus`, `analysisStatus`, `pendingDiscoveryCount`, `nextCursor`, 판본과 실행 시각을 모은다.
3. `nextCursor`가 숫자이면 **같은 `agent: all`**과 그 값을 그대로 넣어 이어 호출한다. 한 번의 일일 작업은 최초 호출을 포함해 **최대 20회**까지 실행한다.
4. `nextCursor: null`이면 이번 이어가기 루프를 끝낸다. `pendingDiscoveryCount`, 실패·보류 상태가 남아 있는지 별도로 확인한다.
5. 성공·부분 완료·실패 어느 경우든 가능한 범위에서 `get_legal_change_alerts`를 `{}`로 호출하여 저장된 상태와 알림을 읽는다.
6. `intake.*` 기준에 연결된 변화가 있으면 읽기 전용 `get_intake_reference({})`로 `catalogVersion`, `catalogSha256`, `initialized`와 해당 피처·서류·규칙·출처를 확인한다. 규칙의 `enabled`, 관할·시행기간, 요구 수준·대체자료를 함께 읽는다. 이 조회는 상담 내용이나 사건 식별자가 필요하지 않다.
7. 아래 보고 양식에 따라 실제 확인 결과, 검토할 변화, 미완료 출처와 재개 필요 여부를 남긴다. 알림을 자동 acknowledge하거나 기준 후보를 등록·승인하지 않는다.

호출 예시는 다음과 같다. 두 번째 호출의 cursor는 첫 응답에서 받은 값을 그대로 사용한다.

```json
{"agent":"all","cursor":0}
```

```text
첫 run_legal_monitors 응답의 result.nextCursor가 숫자이면:
  run_legal_monitors({agent: "all", cursor: 응답에서_받은_nextCursor})
최대 20회 호출하거나 nextCursor가 null이면:
  get_legal_change_alerts({})
```

**cursor는 완료한 법원 수나 변경 수가 아니다.** 등록 출처 순회 위치이거나 이미 검색으로 확인된 잔여 원문 큐를 처리하기 위한 위치일 수 있다. 등록 출처를 모두 순회한 뒤에도 `nextCursor`가 반환될 수 있다. 잔여 큐를 처리하는 동안 동일 cursor가 다시 나오는 것도 가능하므로 “같은 숫자면 무한 반복”으로 단정하지 않는다. 호출 횟수 상한과 `pendingDiscoveryCount`·관측 결과를 함께 보고 진행을 판단한다. 20회에 도달하면 종료하고 마지막 재개 위치와 미완료 상태를 보고한다.

`nextCursor: null`은 지금 즉시 이어 처리할 구간이 없다는 뜻이다. 재시도 시각이 아직 되지 않은 검색 큐, 접근 실패, 분석 미완료가 없어졌다는 뜻은 아니다. `lastCompleteSweepAt`도 등록 출처 순회 기록이므로 모든 원문 수집 성공의 증거로 사용하지 않는다.

### 하루 한 번 공식 검색과 재개

서버는 `agent`별 한국 날짜를 기준으로 `lastSearchAttemptAt`을 저장한 뒤 공식 도메인 검색을 시작한다. 반환된 검증 검색 결과를 `pendingDiscoveries`에 즉시 저장하여 뒤의 수집 구간이 시간·요청 제한에 도달해도 재개할 수 있게 한다. 같은 agent의 같은 날 재호출은 이 큐와 저장된 cursor를 사용한다.

일일 작업은 항상 `all`을 유지한다. 같은 날 `legislation`, `court_documents`, `all`을 번갈아 새 작업으로 실행하면 agent별 검색 상태가 따로 관리되어 추가 검색이 생길 수 있다. 실패한 검색을 자동으로 반복 호출하여 일일 제한을 우회하지 않는다. `lastSearchSucceededAt`이 최근 시도를 따라오지 못하면 공식 검색이 미완료였음을 보고한다.

각 서버 호출은 출처 수, 요청 수, 응답 크기, 첨부 수, 실행 시간, 모델 분석 수를 제한한다. 실제 한도는 [`legal-monitor-core.ts`](../lib/legal-monitor-core.ts)와 [`reference-monitor-policies.json`](../lib/reference-monitor-policies.json)을 확인한다. 화면의 수동 실행은 별도의 더 작은 구간 제한을 사용하며, 예약 작업의 20회 상한과 혼동하지 않는다.

## 3. 비교본과 변경 후보

첫 수집은 이후 비교를 위한 baseline이다. 처음 확인한 기존 원문을 개정 발생으로 알리지 않는다. 이후 의미 있는 원문·관련 링크 변화, 새 공식 게시물, 동일 주소의 첨부 바이트 변화가 있으면 검토 후보를 만든다. 새로 발견한 문서가 실제로 새로 공고된 문서인지, 과거 문서를 늦게 찾은 것인지는 원문 날짜로 확인해야 한다.

후보의 핵심 필드는 `id`, `agent`, `sourceId`, `kind`, `status`, `title`, `summary`, `affectedRuleIds`, `previousHash`, `currentHash`, `sourceUrls`, `evidence`, 날짜와 선택적 `analysis`다. `requiresHumanReview`는 항상 참이다. 저장 시 현재 기준정보 판본과 상담 카탈로그의 `intakeReference: {version, sha256, initialized}`도 함께 남긴다.

| 상태·종류 | 보고할 의미 |
| --- | --- |
| `proposed` | 법률안·개정안 단계. 현행 시행 규정으로 적용하지 않음 |
| `promulgated` | 공포 확인 후보. 시행일·경과규정 별도 검토 |
| `scheduled_effective` | 시행 예정 후보 |
| `effective` | 시행 상태로 분류된 후보. 원문과 적용 대상 검토 필요 |
| `practice_notice`, `form_notice` | 실무·서식 공고 |
| `unconfirmed_change` | 해시·내용 차이는 있으나 개정의 성격은 추가 확인 필요 |
| `newly_discovered` | 새로 발견한 공식 문서. 신규 개정 여부는 미확정 |
| `source_changed`, `attachment_changed`, `new_publication` | 변경을 감지한 방식인 `kind` 값 |

출처별 비교본, 해당 알림과 관측 이력은 같은 저장 트랜잭션으로 기록한다. 실행 잠금의 토큰·만료 검사가 오래된 실행의 비교본 갱신을 막는다. 실패한 수집을 성공한 빈 원문처럼 저장하여 이전 비교본을 지우지 않는다. 관련 구현은 [`legal-monitor-core.ts`](../lib/legal-monitor-core.ts), [`legal-monitor-store.ts`](../lib/legal-monitor-store.ts)와 기준정보 migration에 있다.

## 4. 결과를 읽는 방법

`get_legal_change_alerts`는 알림 목록뿐 아니라 `sources`, `states`, `runs`, `counts`, `schedule`, `referenceRelease`, `intakeReference`를 반환한다. `runs[].payload`가 각 실행 구간의 상세 결과다. `states[].sourceHealth`는 source ID별 누적된 최근 수집 상태이고 `pendingDiscoveries`는 저장된 후속 원문 큐다. 조회 시점의 `intakeReference`와 과거 실행·알림에 저장된 카탈로그 판본은 다를 수 있으므로 과거 영향 분석에는 당시 영수증을 사용한다.

| `sourceHealth.status` | 처리 |
| --- | --- |
| `ok` | 해당 원문 확인 성공. 비교 결과와 baseline 여부를 함께 읽음 |
| `partial` | 일부 원문·링크·첨부를 확인하지 못함. 완전한 무변경으로 보고하지 않음 |
| `blocked` | 접근 차단. 출처와 이유를 보고 |
| `failed` | 수집·파싱 실패. 이전 성공 기록과 구분 |
| `disabled` | 해당 출처 사용 중지 또는 API 설정 누락. 확인 대상 밖이었음을 보고 |
| `deferred` | 한도·재시도 시각 등으로 후속 확인 필요 |

`discoveryStatus: failed`·`deferred`는 공식 검색 미완료이며, `analysisStatus: partial`은 변경 후보의 분석이 일부 끝나지 않은 상태다. 뒤 구간이 성공해도 앞 구간의 실패를 보고에서 없애지 않는다. 같은 source ID의 재시도가 실제로 더 늦은 시각에 성공한 경우에만 최신 상태로 갱신한다.

`counts.unread`는 저장된 미확인 알림의 누계이며 오늘 새로 발견한 수가 아니다. 이번 작업의 새 알림은 각 구간의 `newAlerts`를 ID로 중복 제거해 계산한다. 전체 알림·실행 기록 응답은 최근 기록으로 제한되므로 반환된 배열 길이를 전체 이력 수로 쓰지 않는다. 문서에서는 수량을 고정하지 않고 실제 응답에서 판본·시각·수량을 가져온다.

## 5. 일일 보고 형식

보고에는 다음 항목을 실제 값으로 채운다. 확인되지 않은 날짜·효력·수량은 추정하지 않는다.

```text
법령·법원 문서 확인 결과

확인 시각: 저장된 실행 시각, 한국 표준시
적용 기준정보: 응답의 release ID / revision / sha256
상담 서류 기준: intakeReference의 version / sha256 / initialized
진행: 완료 또는 부분 완료, 실행 구간 수, 잔여 큐·재개 필요 여부

변경 후보:
- 제목 / 변경 단계와 감지 종류
- 바뀐 내용과 연결된 기준 ID
- 공식 원문 주소 / 원문에 확인된 공포일·시행일
- 서식·제출목록·안내 문서에 미칠 영향과 사람이 확인할 사항

수집·분석 미완료:
- 출처 / 실패·차단·비활성·보류 이유 / 최근 확인 시각
- 공식 검색 또는 변경 분석의 미완료 여부

후속 조치:
- 사람이 검토할 후보와 원문
- 잔여 cursor 또는 재시도 대기 상태
```

새 알림이 없고 확인이 성공한 범위에는 **“확인한 공식 출처에서 새 변경 후보가 발견되지 않았습니다”**라고 쓴다. 실패·비활성·보류가 있으면 같은 보고에 그 범위를 명시하고 **“확인하지 못한 출처가 있어 전체 변경 여부는 미확정입니다”**라고 덧붙인다. 최초 실행은 **“비교 기준본을 저장했습니다”**로 설명한다. 새 알림이 0이라는 이유만으로 “법령 개정 없음”이나 “모든 법원 서류 변경 없음”을 단정하지 않는다.

법률안과 공포·시행, 전국 법령과 법원별 실무, 서식 변경과 제출 필요성의 법적 판단을 구분한다. 후보의 영향 기준 ID는 검토 범위를 좁히는 연결이며 기준을 자동 승인하는 근거가 아니다.

## 6. 실패·중단·중복 실행

- MCP `ok: false`, HTTP 실패, 모델 오류가 발생하면 해당 작업 실패를 기록하고 `get_legal_change_alerts`에서 저장된 실행 결과를 확인한다. 자동으로 성공한 것으로 처리하지 않는다.
- 이미 다른 작업이 실행 중이면 서버가 잠금 충돌을 반환한다. 겹치는 작업을 계속 만들지 말고 진행 중임을 보고한다.
- `MONITOR_LEASE_LOST`가 나오면 해당 실행은 더 이상 비교본을 갱신할 권한이 없다. 상태를 다시 읽고 재개 판단을 한다.
- 요청 시간 초과는 서버 저장 실패의 확정 증거가 아니다. 먼저 저장된 run·큐·cursor를 확인한다.
- 20회 호출에 도달하면 무한 반복하지 않는다. 마지막 `nextCursor`, `pendingDiscoveryCount`와 미완료 출처를 남긴다. 재시도 대기 중인 항목을 즉시 반복하여 제한을 우회하지 않는다.
- 기록 한도 검토 오류 등 운영 오류는 담당자에게 보고한다. 해결을 위해 기존 비교본·변경 알림·관측 이력을 임의로 삭제하지 않는다.

## 7. 일정 연결과 사람의 검토

실제 반복 실행은 ChatGPT 예약 작업이 hosted MCP를 호출하는 방식으로 연결한다. `POST /api/legal-monitor`의 `action: set_schedule`은 `automationId`, `configured`와 매일 09시 한국 시간이라는 **연결 상태**를 저장한다. 이 요청 자체가 스케줄러를 만드는 것은 아니다. 예약 작업과 도구 접근이 확인된 후 연결 상태를 기록하고, 연결이 끊기면 화면에 미구성 상태가 드러나게 유지한다.

사람은 `/reference-data`에서 출처·변경 내용을 검토하고 **확인 기록 남기기**를 실행할 수 있다. 이 동작은 `acknowledgedAt`을 남기며 현재 기준을 활성화하지 않는다. 변경할 매개변수가 확인되면 기준정보 화면의 별도 개정 후보 절차를 따른다. 예약 감시의 도구 집합에는 사건 수정, 후보 승인, 법적 인정, 제출 승인 작업을 넣지 않는다.

공식 문서 공개와 검색 색인·API 반영에는 지연이 있을 수 있다. 이 구성의 운영 약속은 매일 확인 후 발견한 변화와 미완료 범위를 알리는 것이다. 전국 모든 공고를 빠짐없이 실시간 탐지했다는 보증으로 사용하지 않는다.

## 8. 실제 상담·체크리스트 기준에 연결된 변경

상담 봇의 단일 기준은 `consultation-checklist-v1` 카탈로그다. 초기 판본은 분류 피처 49개, 증빙서류 74종, 매칭 규칙 54개, 출처 11개를 포함하며 상담 원문 분류와 서버의 조건 매칭에 사용된다. 운영 중 수량과 내용은 현재 저장된 카탈로그에서 읽는다. 구체적인 스키마·판본 저장·검토 절차는 [기준정보 설명서](reference-data.md)와 [상담 기반 필요서류 체크리스트](consultation-checklist.md)를 따른다.

감시는 실제 카탈로그의 `features`, `documents`, `rules`, `sources`를 읽기 전용 bridge로 연결한다. 규칙의 직접 출처뿐 아니라 요청 서류와 대체서류의 출처도 영향 범위에 포함한다. 활성 규칙과 연결된 공식 주소는 기본 감시 목록에 합치며, 정부24 발급 안내도 확인한다. 사무실 내부 정책은 화면의 출처로 보존하되 공식 원문 수집 대상으로 승격하지 않는다. 새로 등록된 공식 주소는 다음 실행에서 읽는다.

`get_intake_reference({})`와 `GET /api/intake-reference`는 `catalog`, `catalogVersion`, `catalogSha256`, `initialized`, `records`, `counts`, `monitoring`을 반환한다. 저장 판본이 있으면 `active`는 그 카탈로그이며, 아직 초기화되지 않았으면 `active: null`과 실제 초기 카탈로그를 함께 반환한다. 이 읽기 경로는 기준표를 초기화하거나 변경하지 않는다. 무결성 검사에 실패하면 오류로 보고하고 seed가 정상 운영 판본인 것처럼 대체하지 않는다.

알림의 영향 ID는 `intake.feature.*`, `intake.document.*`, `intake.rule.*`, `intake.source.*`다. 사람은 당시 실행·알림의 `intakeReference`와 현재 카탈로그 판본을 비교하고 규칙의 `enabled`, `all`·`any`, 관할·시행기간, `requirement`, `alternativePolicy`, 자료기간과 출처를 확인한다. 발급시점 제한, 과거 이력 확인 기간, 소득 입증 기간은 각 규칙의 문맥을 유지한다. 법원 명령에 따른 의무, 조건부 필수, 권장을 같은 요구로 표현하지 않는다.

변경이 필요하면 인증된 사람이 `/data/checklist`의 기존 편집 흐름을 통해 `PUT /api/checklist-catalog`에 `{catalog, expectedVersion}`을 제출한다. 서버는 검증된 전체 판본을 추가하고 현재 판본·해시의 일치를 확인해 head를 전환한다. 예약 감시는 이 저장 작업, 기준정보 후보 승인, 상담 분석, 사건 수정이나 알림 확인을 자동 수행하지 않는다.

상담·체크리스트 기능과 카탈로그 연결은 코드에 구현되어 있다. 실제 모델 분류 정확도, 배포와 매일 예약 실행의 연결 여부는 각각의 검증 기록을 기준으로 보고한다. 코드가 존재하거나 일정 메타데이터가 저장돼 있다는 이유만으로 운영 중이라고 보고하지 않는다.
