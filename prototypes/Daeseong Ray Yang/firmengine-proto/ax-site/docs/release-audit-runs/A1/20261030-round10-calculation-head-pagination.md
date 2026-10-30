# FirmEngine AX A1 10차 — 계산 피처 페이지 run 판본 혼합·버전 고정

**감사일:** 2026-10-30 KST
**시작 main SHA:** `4998ede88e3dd936ef0f1addab8d30273ca9530a`
**변경 허용:** `prototypes/Daeseong Ray Yang/firmengine-proto/ax-site/` 내부. 공개 Git에 실제 사건 원문·PII·비밀키·추출값·정답 없음.
**역할 순환:** 9차 서류담당자/변호사/데이터담당자 → **10차 IT담당자(A1-IT-013), AX담당자(A1-AX-010), 계산사무장(A1-CALC-010)**.
**인수 판정:** 세 항목 **부분검증**. 운영 D1/R2/Cron, Node 전체검사/법원 문서/실무자 검토 미인증. 체크박스 [ ] 유지, 제품 전체 인수 0건.

## 사전 확인한 GitHub 소스·기존 작업

- **main 최신 SHA**, ax-site 최근 커밋(직전 A4 9차 `4998ede88e3d`, A3 `2a8dce88d68f`, A2 `307e58402768`, A1 9차 `019e2ad02a6e`), 열려 있는 PR #12~#48을 조회. A1 9차 영수증과 단일 인수 보드 확인.
- 관련 코드: `lib/extraction-row-store.ts`, `lib/case-calculation-feature-store.ts`, `lib/case-schema-services.ts`, `app/api/cases/[id]/data/route.ts`, `lib/case-feature-snapshot.ts`, `lib/case-data-recompute.ts`, `lib/reference-context.ts`, `lib/pipeline.ts`, `lib/case-legal-calculation-preflight.ts`; `tests/extraction-row-store.test.ts`, `tests/case-calculation-feature-store.test.ts`, `tests/case-legal-calculation-preflight.test.ts`.
- DB 스키마 `drizzle/0010_case_data_watch.sql`의 `case_extraction_heads` 변경→`case_data_change_state.data_version` 갱신 트리거 및 계산 조회 `drizzle/0011_case_calculation_features.sql` 계약을 대조.
- 이전 A1 4차에 보고된 **구버전 계산 run의 DB head 재승격 문제(쓰기 CAS)** 는 별도 미해결. 이번 문제는 **이미 조회 중인 계산 피처의 원장 판본 전환(읽기 CAS)** 으로 기존 결함과 분리한다. 열려 있는 PR #40 등 관련 작업과 직접 충돌·자동병합하지 않는다.

## A1-IT-013 — 계산 feature 페이지네이션의 같은 사건·다른 run 혼합

### 원본 재현

`listCaseCalculationFeatures`는 `case_calculation_heads`에서 `run_id`를 읽고, `case_calculation_features`를 해당 run으로 조회한다. 마지막 검사에서는 오직 `cases.revision`과 `case_data_change_state.data_version`만 다시 비교한다. 법원 기준정보 release만 바뀌는 경우 **revision, dataVersion 모두 그대로인데 계산 run head만 교체**될 수 있다.

합성 사건의 초기 `revision=3`, `dataVersion=8`, `head.run_id=calculation-A`; 조회 중 head가 `calculation-B`로 변경되는 시나리오를 구성했다. 기대값은 **stale 페이지를 명시적으로 409 버전 충돌로 거절**, 실제 main의 **GitHub 원본 함수 본문을 그대로 JS에서 격리 실행**한 결과는 `runId=A`, `headStale=false`, 피처 1건 반환이었다. 새 원장을 조회해도 기존 페이지가 유효한 것처럼 보이는 **false accept**.

**독립 SQLite Node 22.16 재현:** `cases`, `case_data_change_state`, `case_calculation_heads`, `case_calculation_features` 필수 컬럼을 사용한 합성 `:memory:` SQL에서 기존 revision/dataVersion 조건은 통과, run_id 재조회 비교는 거절. 실제 Cloudflare D1이나 앱 전체 엔드포인트를 실행한 시험이 아니다.

### 코드 변경 제안

**[Draft PR #49](https://github.com/firmengine/firmengine/pull/49)**, branch `audit/a1-r10-calculation-head-page-cas-20261030`, 코드 최종 커밋 `d828f20e22f3c6fb9a443b3e13f12063a9b0caca`. main에는 수정 기능을 반영하지 않았다.

1. `lib/case-calculation-feature-store.ts`: 조회 마지막의 계산 active `run_id`를 재확인하여 SELECT 도중 run이 변경되면 `CALCULATION_VERSION_MISMATCH`. 페이지 요청의 `expectedRunId` 입력도 검증한다.
2. `lib/case-schema-services.ts` 및 `app/api/cases/[id]/data/route.ts`: 기존 `expectedDataVersion`과 새로운 `expectedRunId`를 실제 `view=calculations`로 전달하고 올바르지 않은 식별자는 HTTP 400, 판본 변경은 HTTP 409로 응답하도록 연결한다.
3. `tests/case-calculation-feature-store.test.ts`: 같은 사건·같은 데이터버전에서 두 계산 run을 생성한 후, 첫 페이지를 조회하고 두 번째 페이지 조회 도중 head를 바꾸는 SQL race regression을 추가했다. 이미 다른 사람이 만든 테스트·승인·데이터를 변경하지 않았다.

### 실제 실행 결과

- main 원본 함수 본문 V8: **수정 전 1개 반례 재현** (`runId=A/headStale=false`).
- GitHub Draft 브랜치 수정 함수 본문 V8: **7/7 조건 기대일치**(안정 run, 읽기 중 run 교체, 구판본 token, 구 source version, 조회 중 source version 변경, 잘못된 run token, 아직 계산 head 없음).
- 독립 Node `node:sqlite` 합성 원장: **1/1 SQL 경계 예상 일치**, revision/dataVersion 불변인데 run만 바뀔 수 있음 확인.
- 서비스↔GET API의 expectedRunId/expectedDataVersion 전달 경계: **정적 검사**. 전체 앱 HTTP 호출은 미실행.
- 기존 `tests/extraction-row-store.test.ts`에는 2,200 OCR 셀 조회에서 `featuresTruncated=false`를 확인하는 테스트가 **존재**하지만 이 회차에서는 Node 전체로 실행하지 않았음. OCR 2,200/계산 5,001 대량 E2E, 전체 스토리지 대역폭은 **미인증**.

## A1-AX-010 — 모델/프롬프트·기준정보·원본 해시 고정

- main `pipeline.ts`의 OCR cache key는 `documentHash`, `pages`, `promptVersion:PROMPT_VERSION`, `model:OCR_MODEL`, `ruleReleaseId`를 포함하며 페이지 image SHA와 object key 교차점검 코드가 존재한다. `reference-context.ts`는 요청 범위로 승인형 reference snapshot을 고정한다.
- main `case-data-recompute.ts`는 계산 재평가 전 `snapshot.sourceDataVersion`과 reference SHA를 비교한다. 그러나 조회 중 `case_calculation_heads.run_id` 교체에 대한 검증은 빠져 있어 A1-IT-013과 교차 충돌로 재현됐다.
- 이번 수정은 **계산 피처 API의 읽기 판본/페이지 token만** 강화. AI 모델 호출·법률 판단·기준정보 release 자체를 바꾸지 않음. 모델 호출 도중 기준정보 변경 및 D1 실제 클라우드 E2E는 미인증.

## A1-CALC-010 — 0원/미관찰·음수·상충 구분

main `case-calculation-feature-store.ts::statusOf`의 실제 순수 함수 본문을 GitHub에서 읽어 V8 격리 검증:
| 합성 입력 | 기대 | 실제 | 부분 판정 |
| --- | --- | --- | --- |
| value='0', engine='calculated' | computed | computed | 일치 |
| value=null, calculated | missing | missing | 일치 |
| value='unknown', calculated | missing | missing | 일치 |
| value=null, blocked | blocked | blocked | 일치 |
| value='-12', calculated | computed(부호 유지) | computed | 일치 |
| value='0', 이유 SOURCE_CONFLICT | conflict | conflict | 일치 |
| value=null, not_applicable | not_applicable | not_applicable | 일치 |

**7/7 순수 status 판정 기대일치**. 음수 금액이 법적 계산상 인정되거나 실제 최종 서식 금액으로 승인됐다는 뜻이 아니다. 소득의 과소·입증 공백/금액형 `valueWon`·채권자 배분 E2E는 남아 있으므로 A1-CALC-010도 **[ ] 유지**.

## 인수 범위·미해결/다음 회차

- PR #49의 모든 변경 파일 4개는 `ax-site/` 하위임을 PR 변경파일 목록으로 재확인. 운영 main 변경은 **감사 영수증·보드만**, 제품 실행 코드 수정은 Draft PR에서만 제안.
- **미실행:** Draft 브랜치 전체 Node TypeScript/ESLint/빌드/원본 테스트, GitHub Actions CI, 실제 D1·R2·Cron·API HTTP/다중 워커, 85 서류 분류/갈음, LawGraph 95/18 계산 E2E, Word/PDF·법원 공식서식 및 변호사 승인.
- 기능을 출시완료로 처리하지 않으며, 다른 PR의 코드·법률 기준·실제 서류를 덮거나 실제 배포/DB migration/전자제출을 수행하지 않았다.
- **다음 A1 담당 순환:** 서류담당자 `A1-DOC-010`(서류 발급·발생 기간), 변호사 `A1-LAW-015`(직원·변호사 승인 경계, PR #28 상태 반영), 데이터담당자 `A1-DATA-013`(OCR 2,000행·계산 5,000행 잘림과 실제 조회). 먼저 최신 main/PR/소스/기존 영수증 확인.
