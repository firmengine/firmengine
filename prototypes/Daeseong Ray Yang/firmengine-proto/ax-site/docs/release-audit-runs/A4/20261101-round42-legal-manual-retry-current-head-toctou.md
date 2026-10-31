# FirmEngine A4 42차 — 법률 수동 재시도 TOCTOU 및 계산 head 현재성 경합

- 기록일: 2026-11-01 KST. 시작 main SHA: `add24969d23c5d5a4fe8d87055be58b4ed4f5ede`; 본 회차 수정 직전 관찰 main: `f08fcb4afdc457cad77ce685221079a5eeaeb3ec`. 모든 코드는 `prototypes/Daeseong Ray Yang/firmengine-proto/ax-site/` 아래에서만 확인/변경.
- 단일 보드: `docs/PRODUCT_RELEASE_INTEGRATION_BOARD.md`. 직접 검증 **A4-IT-003, A4-CALC-004, A4-DATA-014, X-046**, 모두 **[ ] 미완료** 유지. 연관 경계만 확인: **A4-DOC-017, A4-LAW-006, A4-AX-005**. 제품 인수·법률 인정·사람 승인 **0**.
- 6역할 순환: **데이터담당자 → AX담당자 → IT담당자 → 사용자·서류담당자 → 계산사무장 → 변호사**(41차 시작 역할 변호사와 다름).
- 선행 조회: 최신 main/ref·8개 커밋·PR #110 Open/Draft, `drizzle/0017_legal_reanalysis_orchestration.sql`, `drizzle/0020_calculation_poll_fairness.sql`, main/PR #110 `lib/case-legal-automation.ts`, `tests/case-legal-manual-retry-batch-r41.test.mjs`, 41차 영수증·중앙 보드. 보조 게이트 정적 조회 `case-agent-scheduler.ts`, `case-data-recompute.ts`, `automatic-draft-handoff.ts`, `preapproval-correction-item-store.ts`, `case-substitution-watch.ts`.
- main 법률 워커 blob SHA `4af7a76d0935d532a3f5c0ca5fef4656be7eaf92`. PR #110 수정 전 blob `20daac71df4bd5ca2a2023684c24e8b1b34cc511`, 수정 후 `9eed2f68ceb71e01bacbc581077a60296b40c416`.

## P1 반례 — 사전 read와 UPDATE 사이의 판본 역전

기존 main 및 PR #110의 `retryFailedCaseLegalAutomation()`은 `latest()`에서 현재 `case_revision, data_version, calculation_run_id, input_sha256, reference_sha256`를 읽고 failed job을 조회하지만, **실제 UPDATE CAS**는 `id/status/case_revision/data_version`만 확인한다.

따라서 읽은 직후 **동일 사건·동일 revision=1/dataVersion=1**에서 계산 head를 `calc-A,input-A,ref-A` → `calc-B,input-B,ref-B`로 승격해도 구 `job-A`의 재시도가 `retry_wait`으로 기록된다. 41차 D1 batch로 상태+감사는 원자화되더라도 **잘못된 이전 계산 run에 대한 재시도·감사 이벤트**가 동시 저장된다.

### 실제 실행한 독립 합성시험

환경: 컨테이너 **Node v22.16.0**, `node:sqlite DatabaseSync`, 파일 기반 WAL 독립 연결 A/B, 가상 `case-A/job-A/calc-A/calc-B`만 사용. 실행명령:
`node --test /mnt/data/firmengine-a4/round41_manual_retry_batch_sqlite.test.mjs`
→ **9/9 PASS** (기존 부분성공 부정대조 포함).
`node --test /mnt/data/firmengine-a4/round42_legal_retry_head_cas_sqlite.test.mjs`
→ **10/10 PASS** (기존 P1 반례 1 + 후보 조건 검증 9, 즉 '안전성 10건 PASS'가 아님).

| 가상 입력/순서 | 독립 기대 | 실제 관찰 | 판정 |
|---|---|---|---|
| A가 calc-A 현재 head를 읽음 → B가 calc-B로 교체 → A가 **PR #110 기존 UPDATE** 실행 | 구 head 재시도 금지 | UPDATE **1**, event INSERT **1**, 구 job `retry_wait` | **P1 기존 반례 재현** |
| 동일 순서에서 **후보 current-head CAS** | 저장/감사 0, 구 job failed 유지 | UPDATE **0**, event **0**, failed 유지 | 로컬 후보 합성 통과 |
| 현재 head 변동 없음 | 상태1/감사1 | **1/1** | 후보 합성 통과 |
| 사전 조회 후 사건 revision 또는 원본 dataVersion 변경 | 구 job 실행 금지 | 각각 **0/0** | 후보 합성 통과 |
| head input SHA만 변경 | 잘못된 판본 거부 | **0/0** | 후보 합성 통과 |
| 계산 run reference SHA가 직전 기록과 달라짐 | 과거 기준정보 혼합 차단 | **0/0** | 후보 합성 통과 |
| audit INSERT 실패 → rollback | 상태 변경도 취소 | 다른 연결에서 failed/audit 0 | 후보 합성 통과 |
| 같은 job A/B 두 WAL 연결에서 재시도 | 중복 상태전이/감사 없음 | A **1/1**, B **0/0**, 총 1 event | 후보 합성 통과 (실 동시 HTTP 아님) |
| COMMIT 후 응답 유실 가정 | 호출자 불확정; 다른 연결 재조회 가능 | retry_wait/event 1 조회 | 영속 상태 판별 가능, **멱등 원장 없음** |

### 수정 후보 (병합 금지)

- 기존 [Draft PR #110](https://github.com/firmengine/firmengine/pull/110)의 UPDATE에 **동일 SQL 내부 correlated EXISTS**를 추가하여 `cases.revision`, `case_data_change_state.data_version`, `case_calculation_heads.run_id/input_sha256/data_version/case_revision` 및 `case_calculation_runs.input_sha256/reference_sha256/data_version/case_revision`가 현재 job 원천과 같은지 재확인.
- PR 브랜치 변경: 코드 `6ed214e6d86e0dcf940529d89da98ad7411033f4`, source-derived 신규 회귀 테스트 `2a87816d2672cf2bf140ab3563ee4758c2d74b73`, 기존 r41 SQLite fixture 테이블 보강 `3b4acf8423cc4e5496e8c304e53f5a799516618f`.
- PR #110은 **Open·Draft·미병합**, main 실행 코드/스키마/계산·법률 인정 의미 변경 **없음**. PR 대화에 신규 반례·검증·병합 보류 설명 [댓글](https://github.com/firmengine/firmengine/pull/110#issuecomment-6549502512).
- 새 저장소 테스트 파일 `tests/case-legal-manual-retry-current-head-r42.test.mjs`(총 **9개 등록 Node test case**, 5개 매개변수 반복 포함)와 수정한 r41 테스트는 **GitHub 코드/문법 확인만**. **저장소 원본 Node-native 실행/전체 CI/TypeScript/Next 빌드 미실행**. 독립 로컬 9/9·10/10과 구분한다.

## 순차 stage·복구 게이트의 이번 회차 범위

- **상담/갈음 철회→OCR→10분 quiet 계산**: `case-agent-scheduler.ts`와 `case-data-recompute.ts`의 600,000ms 게이트·원본 버전/계산 head 조회, `case-substitution-watch.ts`의 원본 CAS 코드를 정적으로 확인. 실제 상담·OCR·갈음 철회·Cron 실행은 **미실행**.
- **95 법률→Word review draft→직원·변호사 승인**: `case-legal-automation.ts`의 `latest()`와 수동 retry CAS 간 TOCTOU를 위 합성으로 재현. `automatic-draft-handoff.ts`는 head 판본/직원 handoff 정적 확인. 실제 95항목·Word 바이트·법률 승인/기존 승인 무효화·재생성 종단은 **미실행**.
- **실제 보정 이벤트/마감기한**: `preapproval-correction-item-store.ts`의 사건/원문/기한 검증을 정적 확인했으나 법원 실측·행동·승인 **미실행**.
- **n8n**: 설계/유지 소스와 실제 운영 워크플로 구별. 운영 n8n 이벤트·웹훅·중복 429/503/timeout·실 R2→D1 실패·요청 UUID/영속 DLQ·staging D1/R2/Cron·실제 HTTP 두 워커 **모두 미실행**.
- **승인/상태 의미**: `미관찰` ≠ SQL `NULL` ≠ 숫자 `0` ≠ `비해당` ≠ `상충` ≠ `source-only` ≠ `승인 전`. 합성 checkpoint를 실제 법원 인정/출시/사이트 배포로 승격하지 않음.

## 잔여 위험 및 다음 체크

1. **A4-IT-003 / X-046**: D1 staging 2개의 실제 HTTP worker에서 pre-read→head swap→retry UPDATE의 원자적 판정; PR #16 계산 poll lease/current-reference 병행.
2. **A4-CALC-004 / A4-DATA-014**: same source/revision 다른 reference SHA 계산 head 승격·법률 job retry·audit 이벤트의 일관성을 영속 재조회. SQL batch ACK 유실 후 idempotency UUID/복구원장 부재와 실제 Cron 실행 차단 여부 별도 점검.
3. **A4-LAW-006 / A4-AX-005 / A4-DOC-017**: 기존 직원/변호사 서명·Word draft 판본 무효화 및 성공 생성물 보존, 원문·갈음·관할 법률판본 변경 후 실제 보정 기한 검수.
4. **A4-DATA-013 / X-047, X-048**: R2 바이트 SHA와 D1 receipt 동등성, 원자 감사·부분 성공 503/timeout·중복 webhook, 잘못된 JSON/빈 LLM 답변의 stage gate 검증.

**모든 체크 ID [ ] 미완료, 최종 인수 완료 0건**. 운영 배포, 운영 D1 마이그레이션, 법원 전자제출, 법원 인가 확정, 실제 고객자료/개인정보·비공개 OCR·키 공개 Git 저장 **없음**.
