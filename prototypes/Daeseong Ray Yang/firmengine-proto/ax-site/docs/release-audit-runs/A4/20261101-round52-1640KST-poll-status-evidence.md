# FirmEngine A4 52차 — Poll 상태 미관찰·상충·대기 분리 (2026-11-01 KST)

- 범위: `prototypes/Daeseong Ray Yang/firmengine-proto/ax-site/`만. **main 시작 SHA: `5e403d9c908775f0f1448fbf5b3b6dd295ae9199`**. 유일한 승인 기준: `docs/PRODUCT_RELEASE_INTEGRATION_BOARD.md`. 51차 `20261101-round51-calculation-run-status-lease-evidence.md` 후속.
- 역할 순환: **계산사무장 → 변호사 → 데이터담당자 → AX담당자 → IT담당자 → 사용자·서류담당자** (51차의 서류 시작과 교체).
- 직접 부분검증 `A4-IT-005`, `A4-CALC-004`, `A4-DATA-023`, `X-046` (4개 전부 `[ ]` 유지). 인계조건만 본 `A4-DOC-013`, `A4-LAW-006`, `A4-AX-001`은 해당 회차 종단 통과가 아니다.

## 읽은 실제 계약과 판본

- `main` `lib/case-data-recompute.ts` blob `7e8053ffebe892a6065d6e40f9fec5c19b2d701f`: 10분 quiet 대상 후보, 작업권 claim/CAS, head 계산, Poll 정리, 운영 Health 읽기 경로 확인. Poll cleanup ACK 및 유령 running의 원천 위험은 기존 48~51차 이어받음.
- `main` `lib/case-calculation-feature-store.ts` blob `bb5f88b26e68f5ae2234741063ac9301a927e27a`; `drizzle/0011_case_calculation_features.sql` blob `0caa359d250dce45765d269d271ad63170ec3efa`; `db/schema.ts` blob `933f8686845ac14669312dd21bf85e02c62ed5e6`. 실제 Poll `status TEXT NOT NULL`이지만 허용값 CHECK는 없음; null 시나리오는 **저장 DB 사실이 아니라 결손 D1 응답을 주입한 시험**.
- Draft [PR #126](https://github.com/firmengine/firmengine/pull/126) 기존 helper blob `3f3f6ac62552ed97c8c31784c8e623c748f9888e`, 회귀 test blob `8409f704677f1938c775d604a029f42e614bc251`; PR #16/#120/#123과 실행 종단 미통합.
- 최근 main 커밋의 다른 축(A3) 변경도 확인. A4 범위 외 수정 금지.

## 실제 재현: PR #126의 증거 상태 합치기

시험 입력: `caseId=synthetic-case`, revision=4, source dataVersion=7, Run/Head=`run-7`, 기준·입력 SHA=`a×64`, Run 상태=`computed`, 관측 시각 `2026-11-01T04:45:00Z`. D1 요청/응답은 V8 내 가상 read-only 어댑터; 실제 고객 값 없음.

| 주입 Poll status | 독립 기대 finding | 수정 전 실제 | 수정 후 실제 |
|---|---|---|---|
| `null` (응답 결손) | `poll_state_unobserved` | `poll_state_observed` | `poll_state_unobserved` |
| `''` | `poll_state_unobserved` | `poll_state_observed` | `poll_state_unobserved` |
| 공백 `' '` | `poll_state_unobserved` | `poll_state_observed` | `poll_state_unobserved` |
| `retry_wait` | `poll_retry_wait_with_current_head` | `poll_state_observed` | `poll_retry_wait_with_current_head` |
| `bogus` | `poll_state_conflict` | `poll_state_observed` | `poll_state_conflict` |
| `done` | `poll_state_conflict` | `poll_state_observed` | `poll_state_conflict` |
| `failed` | `poll_failed_with_current_head` | 동일 | 유지 |
| `running` | `poll_running_with_current_head` | 동일 | 유지 |

실제 PR 함수 본문에서 타입 주석만 제거해 V8 실행: **8/8 독립 기대 일치**, `approved=false`, `writePerformed=false` 확인. 이전 함수에서 결함 6개 상태를 부정대조로 확인. **검증은 source-extracted V8 단위 계약이며 DB 두 워커/운영 Cron/승인 종단 증거가 아니다.**

## 변경·회귀 범위

- Draft PR #126에서 `lib/case-calculation-poll-reconciliation.ts`의 finding을 3개로 분화. 코드 커밋 `fe8194f2952ea341fb9e87f7fa767f65fd6a06a9`.
- `tests/case-calculation-poll-reconciliation-r49.test.mjs`에 회귀 선언 **5개 추가**(기존 24 → 총 29개 선언). 실제 프로젝트 **Node-native 테스트는 미실행**. 추가 회귀 test/NULL 주입 정정 최종 커밋 `037b4a2ae3c826f43bccaa8ef61f3878ea421fae`.
- 처음 작성한 `UPDATE status=NULL`은 fixture의 NOT NULL에 위배됨을 즉시 정정하여, 동일 사건 원문 조회 결과의 `pollStatus:null`을 반환하는 테스트 어댑터 주입으로 변경. null 영속 저장을 주장하지 않음.
- 수정된 PR helper blob `5c58f077fb8c4842c611926cab99439ca6ad8ce1`, 회귀 blob `15766ff94885fc7cad0f5cdbb32b7601a285a069` 재조회. PR은 Open·Draft·미병합; changed paths 2개 모두 허용 범위 내부.
- `headCurrent=true`는 입력·판본 동일성의 정적 판정이지 Run 계산 성공·승인·Poll cleanup 완료가 아니다. `storedRunStatus`와 Poll 상태는 별개 증거이다.

## 종단/미실행 경계 및 후속 ID

- **미실행:** 프로젝트 Node-native 29개, 전체 TS/Next/CI, staging Cloudflare D1·R2·Cron, 실제 HTTP 두 워커, 운영 n8n, R2 PUT 후 D1 실패/응답유실, 중복 webhook, timeout/429/503, 새 증빙·갈음 철회·관할 판본 변경·법원 기한 null·Word 재생성/검수 무효화.
- 상담 → 서류 → OCR → 10분 quiet 계산 → 95 법률 AI → Word 초안 → 독립 직원/변호사 검수 → 실제 보정 이벤트의 stage/CAS/승인 인계는 이번 회차 E2E **미관찰**. 설계 n8n은 운영 실행 증거가 아님.
- 다음 직접 `A4-IT-005/A4-DATA-023`: read-only finding과 Health/UI 동일성·상충/미관찰 표시 대조 및 staging D1 snapshot 확인. `A4-CALC-004/X-046`: PR #16/#120/#123/#126 결합 후 head COMMIT→lease DELETE 0/503/ACK loss→Cron 후보 0→영속 재조회→사람 검토 후 안전 CAS 복구, 소스변경 뒤 법률/Word 이전 승인 무효화. 법률 판정은 담당 변호사만.
- 운영 배포·D1 운영 migration·실전자제출·법원 인가 확정·실제 고객 자료 접근 **실행하지 않음**. `[ ]` 최종 인수 0/4.
