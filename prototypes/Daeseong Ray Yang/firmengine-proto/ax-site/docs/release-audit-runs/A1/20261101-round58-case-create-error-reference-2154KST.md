# FirmEngine A1 58차 — 사건 생성 원자성 · 장애 안내 · 계산 기준판본 CAS

- 기준: 2026-11-01 KST, `firmengine/firmengine` `main` 시작 HEAD `0e31b3bcdffa8dc2606d80915a055791ac2aa9bb`. **작업 범위는 `prototypes/Daeseong Ray Yang/firmengine-proto/ax-site/` 내부**.
- 역할 순환: 57차 DOC/LAW/DATA → **IT/AX/CALC**. 점검 ID: `A1-IT-004`, `A1-AX-017`, `A1-CALC-015`. 모두 **[ ] 미완료**.
- 시작 전 단일 보드 `docs/PRODUCT_RELEASE_INTEGRATION_BOARD.md` blob `5ac9698b8378b7413936f3012c76e032aed33e69`, 57차 A1 영수증, 최근 main 커밋/PR, `db/schema.ts` blob `933f8686845ac14669312dd21bf85e02c62ed5e6`, 실제 소스·기존 테스트/수정 PR 검토.
- 실행 수준: **원본 함수의 Node/V8 격리 실행**, SQLite 메모리 SQL 재현, 경로 정적 확인. **Cloudflare D1 트랜잭션·브라우저·전체 CI·Typescript·빌드·R2·Cron은 미실행**. 모든 ID는 합격이 아니다.

## A1-IT-004 [ ] — 사건 CRUD·감사 이벤트·복원

- main `app/api/cases/route.ts` blob `75beaa0f74abd4e23a3c5623efa1d526f2ff3290`, `app/api/cases/[id]/route.ts` blob `a8eedd2f6109ba9a9994ee8f7fd26e08219731d5`, `lib/server-store.ts` blob `32350bd5045da89ea327f3c77fab6d2d19fbac56`. 사건 DB와 이벤트는 `cases` / `events` 별도 테이블.
- 신규 P1 **후보**: 신규 사건 POST는 `cases` INSERT를 먼저 commit하고 별도의 `event("case.created")` INSERT를 호출함. **원본 POST 함수**에서 import/Request 타입만 제거하고 합성 D1/actor/response를 연결하여 실행:
  1. 정상: 독립 기대 HTTP 201 / case 1 / event 시도 1 → 관찰 201 / 1 / 1 (**일치**).
  2. event 저장 실패: 독립 기대 **원자성 유지라면 case 0** → 기존 main 관찰 HTTP 500 / case **1** / event 미저장 (**불일치**).
  3. case INSERT 실패: 독립 기대 case 0 / event 미시도 → 관찰 500 / 0 / 0 (**일치**).
  4. event 실패 후 같은 사용자 요청 재시도: 독립 기대 동일 요청 중복 case 방지(최대 1) → 기존 main 관찰 두 번 모두 500, **case 2** (**불일치**; 멱등성도 별도 공백).
- 동일한 사건의 ID를 사용한 실무자료 사고나 실제 Cloudflare D1 장애를 관찰한 것이 **아님**.
- 수정 **[Draft PR #140](https://github.com/firmengine/firmengine/pull/140)**: 신규 사건 row + `case.created` 이벤트 INSERT를 동일 D1 `batch()`에 묶고 두 receipt `changes=1` 확인. PR HEAD `1d772c8a0ccaf5f2a38bdf676bebb41c3bda3ff1`; 수정 route blob `e37c7a48f8835f98996687dc2ee7fc5196b56e5e`; 새 테스트 `tests/case-create-event-atomic-r58.test.mjs` blob `772876156866afda3b05a0048b2ebc607d25f0db`.
- 새 원본 route 본문 함수의 V8 합성: 정상 201/1 case/1 event, event INSERT 실패 503/0/0, case INSERT 실패 503/0/0; **3개 원자성 조건 기대 일치**. 별도 `Node 22.16 --test` 로컬 소스 복사본 테스트 **3/3 통과**, GitHub 소스/테스트 blob을 다시 확인했고 로컬 `git hash-object`와 일치. 새로운 프로젝트 CI나 D1 staging 테스트를 실행한 것은 아님.
- **남은 위험**: 커밋 후 HTTP ACK 유실 또는 이후 `caseResponse` 조회 오류는 여전히 5xx + 이미 생성된 case가 될 수 있어 재시도 중복 위험이 남음. Client request ID와 server idempotency receipt 계약 및 실제 D1 2문장 atomicity·실패 실험이 필요. 기존 Draft #128이 같은 route의 미확정 관할 기본값을 변경하므로 PR #140과 충돌 조정 필수.
- 수정/삭제/복원 기능 전수 통과 아님. 현재 `[id]/route.ts`는 GET·POST(특정 역사적 proof metadata 복구 등)·PATCH를 노출하지만 일반 사건 DELETE/되돌리기 API는 이 경로에서 확인되지 않음. `restore_historical_proof_metadata`는 **사건 삭제 복원**이 아님. 타 경로 전체 탐색 및 권한·감사 추적 E2E는 미완료.

## A1-AX-017 [ ] — 실패 원인·영향·복구 안내

- main `components/case-workflow.tsx` blob `2ec797958726b99a4358ec46ef35f78f90bfd927`, `lib/workflow-health.ts` blob `4cc17f32be8e2018e99622208d876f1304e8382c`. UI의 실제 JSX boolean 조건을 추출하여 V8 합성 6개 검사.
- `failed/currentDataVersion=null` → 재시도 버튼 숨김; `failed/0` 또는 `failed/5` → 표시; projectionRepairable + version 5 → 표시; 일반 review_required와 debouncing → 숨김. 실제 boolean 값은 6/6 예상 표시 조건과 일치. **이 결과는 기능 합격을 뜻하지 않음**: 실패 + 판본 미관찰 때 사용자가 취할 검증/복구 행동이 명료하게 제공되는지는 불충족.
- `lastError`가 null이면 「실행 오류」 문구가 없어지며, `workflowHealth`는 실패 작업 수·ID는 보여주되 개별 원인·영향·권장 조치와의 연결을 제공하지 않는 구조. `[PR #32](https://github.com/firmengine/firmengine/pull/32)`도 동일 UI와 명령 실패-확정 구분을 변경하므로 중복 UI 수정하지 않음.
- 독립 기대: 실패 원인을 모르는 경우 **원인 미관찰**, 영향/최종 문서 미확정, 최신 판본 확인 및 담당자 이관 지침을 구분. 실제 브라우저, 실운영 장애 재시도는 미실행.

## A1-CALC-015 [ ] — sourceVersion·referenceSHA stale CAS

- main `lib/case-calculation-feature-store.ts` blob `bb5f88b26e68f5ae2234741063ac9301a927e27a`; `lib/case-data-recompute.ts` blob `7e8053ffebe892a6065d6e40f9fec5c19b2d701f`.
- 실제 main 계산 head UPSERT SQL 문장을 SQLite memory에서 합성 사건 `C1` revision 8/dataVersion 4, 현재 head `current-refB`로 실행. 독립 기대와 관찰:
  1. 같은 revision/dataVersion인 **오래된 reference A** 실행이 ref B head를 덮는 경우: 기대 SQL 변화 0 / head B 유지 → 관찰 **변화 1 / head A로 덮임** (**실패**).
  2. caseRevision=7 재실행: 기대 0 / B → 관찰 0 / B (통과).
  3. dataVersion=3 재실행: 기대 0 / B → 관찰 0 / B (통과).
  4. 실제 활성 ref B가 같은 revision/dataVersion으로 재계산: 기대 1 / 최신 B → 관찰 1 / B (통과).
- **3/4 독립 기대 일치**. reference SHA는 `case_calculation_runs`에는 저장되지만 head promotion SQL에는 활성 reference SHA/approval epoch 검사가 없음. 이전 4·16·18차 P0 재현과 같은 축이며 새 결함 수에 포함하지 않음.
- 최신 [Draft PR #139](https://github.com/firmengine/firmengine/pull/139)은 **조회 응답 `headStale` 표시**만 수정; 본 **쓰기 CAS 취약점을 해결하지 않음**. A4 담당자의 기준정보 승격 원자성 설계와 충돌 우려가 있어 A1에서 계산산식/법률 의미를 자체 변경하지 않음. 기존 관련 PR #17/#120 등과 합성 통합 후 별도 고위험 PR/실무 검토 필요. 실제 운영 D1 동시 트랜잭션 미실행.

## 판정 및 59차 인계

- A1 58차: ID 3건 **부분 검증/미완료**, 신규 P1 **후보 1개**(사건 생성 감사 이벤트 원자성), 기존 P0 계산 head CAS 재현 1개 축, 오류 복구 UI 공백 1개 축; 신규 Draft PR **#140**, 다른 에이전트의 코드 수정이나 main 제품 실행 소스를 덮어쓰지 않음.
- 최신 main GitHub 원본 읽기와 합성 테스트·Node 테스트·SQLite 실험만 근거로 기록. **코드 존재 ≠ 함수 격리 통과 ≠ 전체 CI ≠ staging D1/R2/Cron ≠ 공식 법원서식/실무자 승인 ≠ 운영배포**. 제품 전체 인수 완료 0건.
- 운영 배포·운영 D1 마이그레이션·실제 전자제출·법원 인가 확정 미수행. 실제 사용자 정보·고객 서류·OCR 원문 사실값·비공개 정답·키 미사용. `null`/미관찰/0/비해당/상충/source-only/승인 전은 혼동하지 않음. 실제 Extra High 모델 모드는 확인되지 않음.
- 다음 회차 역할: **DOC A1-DOC-006**(월별 급여·사업장·계좌·채권자 다중 문서 유지), **LAW A1-LAW-007**(재산 은닉·증여·명의변경·편파변제 의심의 조사 경로), **DATA A1-DATA-006**(원문 숫자·Fact numeric·typed numeric 삼중 대조). 세 ID는 중앙 보드에서 `[ ]`로 확인하였고 다음 회차에도 선행 이력 검토 후 2~5개만 검증.
