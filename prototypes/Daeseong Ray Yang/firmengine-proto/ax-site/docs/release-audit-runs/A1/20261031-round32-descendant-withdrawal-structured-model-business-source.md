# FirmEngine A1 32차 — 하위 문서 철회·모델 구조화 응답·사업소득 원천 분리

- 일자: 2026-10-31 KST. 역할 순환: **IT담당자 / AX담당자 / 계산사무장** (31차 서류담당자 / 변호사 / 데이터담당자 이후).
- 시작 main: `8af080801402d7bd7f2ae27d69539fe6cf7ac56b`. 최근 main A4 31차 등 이웃 작업 및 미병합 A1 PR #85/#86, 중앙 인수 보드, 31차 A1 영수증, 실제 DB 스키마 및 관련 테스트를 선행 확인.
- 이번 ID `A1-IT-006`, `A1-AX-004`, `A1-CALC-002`. **모두 [ ] 제품 인수 미완료**. 정적 코드, 합성 실행, 로컬 Node, CI, staging D1/R2/Cron, 공식 서식, 변호사 승인, 배포는 별도 판정.
- 허용 경로: `prototypes/Daeseong Ray Yang/firmengine-proto/ax-site/`만. 개인·실고객 원본·OCR 사실값·키/.env·비공개 정답을 Git에 싣지 않음.

## 1. 실제 확인 코드와 SHA

| 파일 | main blob |
| --- | --- |
| `docs/PRODUCT_RELEASE_INTEGRATION_BOARD.md` | `57c17f79e5c867f341fef9efe7386fbc3dc7e3ce` (감사 시작 조회) |
| `db/schema.ts` | `933f8686845ac14669312dd21bf85e02c62ed5e6` |
| `lib/domain.ts` | `39ab41856f6d7a379aca7217d24b28f7f5f7616a` |
| `lib/case-commands.ts` | `d18c555f04f65687c509a8e8d35aba4bb3597378` |
| `lib/case-command-store.ts` | `a8693a2e31329dbca72e0c6e11e8cb4df8f12c01` |
| `lib/server-store.ts` | `32350bd5045da89ea327f3c77fab6d2d19fbac56` |
| `app/api/cases/[id]/documents/route.ts` | `274f7a6e73988ca254607422d2ff2cddd1326ac0` |
| `app/api/cases/[id]/documents/[doc]/route.ts` | `db20b9248e68d3ec412b5d3f4254254e0ffc8412` |
| `lib/document-fulfillment.ts` | `d8434f2b81fdfe79be6254714d8428dccf272214` |
| `lib/shared-document-catalog.ts` | `4cd07ebcc11d2d9d803a117ae98424292e1c5cba` |
| `lib/luna.ts` | `e8ad1246888e42087cf94ef792c8285cae2541d1` |
| `lib/extraction.ts` | `75931aad3fc7871395e62276bb5533e24b15d1a5` |
| `lib/business-source-evidence.ts` | `0b796d9c3bc608c1224c5f9a049c80b6951a8b74` |
| `lib/business-monthly-workbench.ts` | `0174f228473516e94664be445d8f46a33f833f80` |
| `lib/business-net-reconciliation.ts` | `60a4fc295943dce404a7f99efffe88f58dd2d4ff` |
| `lib/business-income-policy.ts` | `dd50ed441b5569248b64b89d3d5a683de244262a` |

기존 테스트도 열람: `tests/case-document-work-events.test.ts`(`276658d8`), `tests/luna-boundary.test.ts`(`c3e73fc8`), `tests/json-response.test.ts`(`6dc6556a`), `tests/business-net-review-lifecycle.test.ts`(`dc089bd1`), `tests/business-source-temporal-tax-semantics.test.ts`(`a6dfbbe9`). **기존 전체 테스트 실행 결과로 대체하지 않음.**

## 2. A1-IT-006 — 문서 상·하위 철회와 활성 OCR 작업 충돌, 신규 P1 후보

**코드 경로:** `domain.retractDocument`는 parentId가 가리키는 모든 하위 문서를 재귀적으로 `deleted` 전환하고 해당 Fact를 철회한다. `reduceCaseCommand`는 `impact.withdrawPageJobs`에 모든 철회 문서 ID를 넣는다. **그러나 main `executeCaseCommand` 저장 경계는 `document.retract` SQL을 `command.target.documentId`(부모 1개)에만 실행**하여, 자식 page_jobs가 `processing`으로 남을 수 있음.

- 합성 사건: 상위 P, 하위 C(그 아래 G도 존재 가능), 무관 O. 초기 page_jobs 4개 `processing`, lease 유효. **독립 기대:** P/C/G 모두 `withdrawn`, lease NULL; O는 그대로; 구버전 CAS는 무효.
- 기존 코드 관찰: domain 철회 대상에 자식이 포함되나 기존 SQL 대상은 P 한 개. 합성 SQLite에서 C의 `processing` 잔존. 상위 문서만 철회하거나 실 Cloudflare OCR worker를 가동한 결과는 아님.
- 수정: `result.impact.withdrawPageJobs`로 확정된 철회 대상 각각의 `UPDATE page_jobs`를 **동일 `saveCase` D1 CAS 배치**에 넣고 요청 부모 포함·중복·형식 오류를 확인. 다른 문서/동시사건 scope 변경 없음.
- 실제 실행: 로컬 **Node v22.16.0** `node --experimental-strip-types --test tests/document-withdrawal-targets.test.ts` **3/3 PASS**(대상 집합, malformed failclosed, SQLite parent/child/grandchild/타 문서/구 revision CAS). 변경 파일 3개의 후보 GitHub blob 확인.
- [Draft PR #88](https://github.com/firmengine/firmengine/pull/88) 미병합, HEAD `359d1ec9e6b888477952630879800aa3058d4787`, 수정한 `lib/case-command-store.ts` blob `645ff3dc1b4648da2a13aca56c80485e6be5401d`, 새 helper blob `de1b174ddd31af9195ce5fe33185d52912ce9246`, 새 테스트 blob `1f3dd8cd1daaf1cdd1107cd8bffb2f8d0c248a21`.
- **미검증:** 85개 문서유형 전수, 실제 반려/재업로드, 브라우저, R2 객체, Cloudflare D1/Cron 및 두 워커 경쟁. **[ ] 유지**.

## 3. A1-AX-004 — JSON 문법은 맞으나 Schema를 위반하는 AI 응답, 신규 P1 후보

**코드 경로:** main `callLuna<T>`는 Responses API `status=completed`, refusal, 출력 `JSON.parse` 여부는 확인하나 **실제 출력과 요청한 `args.schema`의 필수 필드·타입·enum을 비교하지 않고 `value:T`로 반환**한다.

- 합성 API 응답 `{"wrong":"value"}` / `[]`, 요청 계약 `{"type":"object","required":["ok"],"additionalProperties":false,"properties":{"ok":{"type":"boolean"}}}`. **독립 기대:** 둘 다 502 구조계약 거절. **main 관찰:** 모두 성공 반환. 정상 `{"ok":true}`는 성공, `incomplete`/비JSON/refusal은 거절.
- main 원문을 바이트 복제하여 Git blob `e8ad1246...` 일치 확인 후 Node VM의 합성 fetch에 주입한 음성 테스트이며 실제 OpenAI 호출이 아님.
- 수정: JSON 파싱 다음 별도 구조화 응답 검증기 호출. required/properties/additionalProperties/type/array/items/enum/anyOf/oneOf/allOf/$ref 등의 **구조 조건**만 검증; 법률 의미/증빙 신뢰성은 검증하지 않는다. 빈/미완성 응답 차단을 유지하고 모델 재시도/추가 요금은 유발하지 않는다.
- 실행: `node --test tests/a1-r32-luna-schema-boundary.test.cjs` **4/4 PASS** (정상1, 누락 차단1, 배열 차단1, incomplete/invalid/refusal 묶음1); `node --experimental-strip-types --test tests/structured-model-json.test.ts` **3/3 PASS** (required/type, nullable bbox/enum/nested, $ref/pattern).
- [Draft PR #89](https://github.com/firmengine/firmengine/pull/89) 미병합, HEAD `a3dac3178d92f278ef827e9d330de141cee87dfe`. 후보 `lib/luna.ts` blob `391d2a4bb358726d5dd76fb91f130448a7d5af0d`, 새 validator `86db6088697274866262ef4291d0f10c5701306f`, 테스트 `7cba416c7dced30199fe48dbb8a1043d1bf0ced8`·`c90258761b5ce007d3f955614588cff20294ca8f`. 변경 파일 네 개 전부 허용 경로.
- **미검증:** 모든 실제 agent 스키마의 수용성·실제 OpenAI 출력/timeout, JSON Schema 의미 전체, 프로젝트 전체 Node/CI/빌드. 구조적 schema 통과가 AI 사실판단 적합성을 의미하지 않음. **[ ] 유지**.

## 4. A1-CALC-002 — 사업 매출/VAT/경비/입금·순소득 분리

- main `business-source-evidence.ts`에는 매출총액/매출구성/VAT 매출세액/매입 VAT/비용 원장/매출 환입/현금 입금/원천징수를 별도 역할로 보존한다. `business-income-policy.ts`의 기본 정책은 rules=[] 비활성; 관계 법원·적용일·검증된 공식근거·독립승인 없이는 인정 비용/월 순소득을 자동 산정하지 않는다.
- 실제 `assembleBusinessMonthEvidence` **GitHub main 함수 본문**에서 TypeScript 선언부만 제거하고 fullMonth·selectedMonths·sumMoney 등 호출 helper를 합성 대체하여 V8 격리 실행. 금액은 BigInt. **합성 5/5 독립 기대 일치**:
  1. 서로 다른 사업 원천 기록에서 매출 3,000,000원+비용 1,500,000원 → 합법 순소득/단순 차액 preview 둘 다 `null` (원천 동일성 미검토).
  2. 같은 sourceRecordId의 검증된 금액 3,000,000−1,500,000 → **산술 미리보기만** 1,500,000원, `legalNetApproved=false`.
  3. 별도 VAT 300,000원 → tax source-only 배열에 남고 비용 또는 순소득으로 자동 산입되지 않음.
  4. 미승인 비용 → 금액 미확정(`null`), 0원 처리 아님.
  5. 환입 250,000원 → 산술 미리보기 보류; 원문 검토 필요.
- `business-net-reconciliation.ts`의 직원 제안 `proposeBusinessNet` / 공식 기준정보 `preflightBusinessNet` / 독립변호사 `adoptBusinessNet` / `reviewedBusinessIncomeIds`까지 실제 소스 경로는 확인. 그러나 해당 통합 함수를 이 회차 **실행하지 않았으므로 승인 시나리오 통과로 표시하지 않음**.
- 기존 신규 승인자 공백 동치 차단 [Draft PR #85](https://github.com/firmengine/firmengine/pull/85) 및 과거 자기승인 [Draft PR #55](https://github.com/firmengine/firmengine/pull/55) **아직 미병합**. 이 때문에 본 ID는 무조건 부분검증.
- **미검증:** 실제 OCR/VAT 사업자별 귀속, 매출액 중복, 월별 거래의 기장·세무 기준, 실제 공식 근거·변호사 법적 승인, 18계산과 D5103/D5110 서식 E2E. 코딩/산식 의미 변경하지 않음. **[ ] 유지**.

## 5. 조치·잔여·다음 회차

- `main`에는 이 **고유 A1 영수증과 중앙 보드의 세 ID별 부분검증 내용만** 기록한다. 제품 코드는 Draft #88, #89에만 존재. 다른 에이전트 파일 덮어쓰기/운영 배포·D1 마이그레이션/전자제출/법원 인가 확정 없음.
- 이번 회차 로컬 Node 증빙 **3/3 + 4/4 + 3/3**, main 함수 V8 합성 **5/5**. 이 숫자는 각각 개별 독립 검증이며 **제품 85종·18계산·95법률 정확도/인수율이 아님**. 실제 staging D1/R2/Cron, 전체 CI·빌드, 공식 서식·변호사 승인·사이트 배포는 완료되지 않음.
- 다음 역할 **서류담당자 / 변호사 / 데이터담당자**. 후보 ID `A1-DOC-017`(법원 보정/내부 요청 UI), `A1-LAW-017`(원본 법원 보정·기한·접수증 연결), `A1-DATA-013`(대량 2,000 OCR·5,000 계산행·페이지네이션).
- 실행 모델 실제 Extra High 수준은 확인되지 않음. 코드 존재≠합성 단위 PASS≠전체 CI≠staging≠실무 승인≠배포.
