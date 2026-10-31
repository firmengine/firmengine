# FirmEngine A4 43차 — 법률 자동 stage transition·감사 INSERT 부분성공 및 원자성 후보

- 일자: 2026-11-01 KST. 시작 GitHub main HEAD `932426811b7003c805e19b10a3fafd26515af0ca`. 기존 A4 42차 영수증을 잇는 **실행 흐름/예외/동시성/복구**만 범위.
- 정확한 허용 경로: `prototypes/Daeseong Ray Yang/firmengine-proto/ax-site/` 아래. 다른 레포/디렉터리 변경 없음.
- 단일 체크 보드: `docs/PRODUCT_RELEASE_INTEGRATION_BOARD.md`; 직접 증빙 대상 **A4-IT-022 / A4-LAW-006 / A4-DATA-014 / X-048** (2~5개 중 4개, 전부 **[ ] 미완료**). 관련 인계 점검만: A4-DOC-017, A4-CALC-004, A4-AX-005. 기존 기록을 통과 상태로 승격하지 않음.
- 6역할 순환: **AX담당자 → IT담당자 → 사용자·서류담당자 → 계산사무장 → 변호사 → 데이터담당자**. 42차는 데이터담당자 시작이었으며 역할 시작점을 순환.
- 선행 읽기: main 최근 8개 커밋/A3·A2·A1 병렬 보드 수정, [PR #110](https://github.com/firmengine/firmengine/pull/110) Open/Draft 및 [PR #16](https://github.com/firmengine/firmengine/pull/16) 미병합, `drizzle/0017_legal_reanalysis_orchestration.sql`(jobs/events, 상태와 event 분리), `drizzle/0020_calculation_poll_fairness.sql`(lease), `lib/case-legal-automation.ts` main blob `4af7a76d0935d532a3f5c0ca5fef4656be7eaf92`, `lib/case-data-recompute.ts` blob `7e8053ffebe892a6065d6e40f9fec5c19b2d701f`, `lib/case-agent-scheduler.ts`, `lib/automatic-draft-handoff.ts`, `lib/preapproval-correction-item-store.ts`, r37/r39 기존 회귀 및 41/42차 영수증. **운영 n8n 워크플로 조회·실행 없음**; 설계와 운영 동일로 주장하지 않음.

## 현행 main P1 부정대조 — 상태는 COMMIT, 감사 이벤트는 누락

- 실제 main의 `transition()`은 `case_legal_automation_jobs` UPDATE 1행 ACK 뒤 `case_legal_automation_events`에 별도 INSERT. 39차는 ACK가 불확실함을 호출자에 드러냈으나 두 변경의 원자성은 해결하지 못함.
- 독립 합성 입력: `case-A / revision=1 / dataVersion=1 / calc-A / sha-A`, `job-A / status=running / lease-A / expires=2099 / expectedChecks=95 / completedChecks=3`; `status=pending` 전이. 첫 UPDATE COMMIT 후 두 번째 INSERT에 **가상 503** 주입.
- 독립 기대: 하나의 단계 전이가 성공 영수증으로 확정되려면 상태 및 감사가 모두 기록되거나 둘 다 취소되어야 한다. **main 분리 SQL 관찰: 두 번째 연결에서 job=pending, 이벤트=0** — P1 부분성공 반례 유지. 이 실험은 실제 D1, 모델/직원/변호사 승인 실행이 아님.

## 수정 후보 — 기존 Draft PR #110에만 반영, main에는 미병합

- 기존 [Draft PR #110](https://github.com/firmengine/firmengine/pull/110)의 법률 수동 재시도 batch·current calculation head CAS를 보존하고, 추가로 `transition()`의 상태 UPDATE + `INSERT ... SELECT ... WHERE changes()=1` 감사 INSERT를 **동일 `D1Database.batch()`**에 묶는 후보를 반영. source/revision/calculation head/lease CAS와 payload는 유지.
- `batch()` 자체의 오류·응답 유실은 `LEGAL_AUTOMATION_TRANSITION_ACK_UNOBSERVED`로 보류. **COMMIT 실패/성공, DB 0행, API 성공을 추정하거나 AI 모델 자동 재호출하지 않음.** 상태 CAS 0행만 `LEGAL_AUTOMATION_SUPERSEDED`, 정확한 1+1 영수증만 정상 전이로 분류.
- commit: production `993c4295`, r37 회귀 조정 `b6789031`, r39 회귀 조정 `7e4ffe73`, 신규 Node SQLite 회귀 `e806d66b`. 변경/신규 경로 4개 모두 `ax-site/` 내부. PR 상태 **Open·Draft·미병합**.
- PR 브랜치의 이전 r41/retry 원자화 및 r42 최신 계산 head CAS 후보는 유지. 별도 법률/계산 의미 변경이나 실운영 배포 없음.

## 실제 실행한 증빙과 독립 기대값

실행 환경: 컨테이너 **Node v22.16.0**, `node:sqlite` WAL 파일형 독립 연결 A/B; 공개 가상 식별자만 사용. 테스트 스크립트 SHA-256 `f8cc0f8540a66ff1ebcd6a039a1ce9b536678c7b95ec017cf9315e48a3d06443`. 명령:
`node --test /mnt/data/firmengine-a4/round43_transition_audit_atomic_sqlite.test.mjs /mnt/data/firmengine-a4/round41_manual_retry_batch_sqlite.test.mjs /mnt/data/firmengine-a4/round42_legal_retry_head_cas_sqlite.test.mjs`
→ **31/31 테스트 통과** (신규 r43 12 + 선행 r41/r42 19). 여기에는 main 실패를 **의도적으로 재현한 부정대조**가 포함되므로 안전성 전수 인증 31건이 아님.

| 합성 입력·장애/경합 | 독립 기대 | 실제 Node SQLite 관찰 | 판단 |
|---|---|---|---|
| 기존 분리 UPDATE COMMIT→audit 503 | 잘못된 부분성공 식별 | pending·event 0 | **main P1 부정대조 재현** |
| 후보 batch 정상 | 상태1·감사1 | 1/1, 두 연결에서 동일 | 로컬 후보 일치 |
| 후보 batch 감사 INSERT 503 | 두 기록 취소 | running·event 0·기존 attempts/lease 유지 | 로컬 후보 일치 |
| 이전 source dataVersion 1→2 | 구 결과 전이 금지 | 0/0 | 로컬 후보 일치 |
| calc-A→calc-B head 변경 | 구 결과 전이 금지 | 0/0 | 로컬 후보 일치 |
| 사건 revision 변경 | 구 판본 전이 금지 | 0/0 | 로컬 후보 일치 |
| lease 만료/다른 워커 선점 | 소유권 없는 전이 금지 | 0/0 | 로컬 후보 일치 |
| 같은 사건 중복 전이 | 감사 이벤트 최대 1 | 첫 1/1, 뒤 0/0, 합계1 | 로컬 후보 일치 |
| batch COMMIT 뒤 HTTP ACK 유실 가정 | 호출자 미확정·영속 조회 | 두 연결에서 pending/event1; 호출자 확정 불가 | 멱등 원장 미해결 |
| 합성 법률 판단 객체 | 인간 법률 확정 승격 금지 | `courtApprovalInferred=false` | 범위 제한 후보 일치 |

- PR 브랜치에 반영된 **실제 `transition()` 본문**을 TypeScript 선언만 제거하고 V8으로 실행한 batch ACK 0/1/null/2·감사 0/1/null/2/503 경계 **8/8 기대 일치**. 또한 GitHub 브랜치 **실제 소스·수정된 r37 16/16, r39 13/13 source-extracted 테스트 본문**을 V8으로 실행. 이 V8 실행은 Node-native 원본 테스트 실행이나 전체 CI가 아님.
- 신규 저장소 `tests/case-legal-transition-batch-r43.test.mjs`에는 **7개 Node 테스트를 작성·커밋**하고 운영 SQL 문자열 직접 추출을 포함. **저장소 자체 Node-native 실행은 미실행**. TypeScript 전체 검사/Next 빌드/CI/실제 Cloudflare staging D1·R2·Cron/실제 두 HTTP 워커 **미실행**.

## 종단 stage·승인 인계 및 남은 공백

- 상담·갈음 철회·OCR → 10분 quiet calculation: `case-agent-scheduler.ts`에서 원천 변경 감시 후 계산 및 법률 순차 처리하는 정적 연결, `case-data-recompute.ts`의 **600000ms** quiet 경계/원본 CAS 확인. 실제 원문 변경·OCR 재시도·Cron **미실행**.
- 95 법률 → Word 초안: `case-legal-automation.ts`의 `RISK_CATALOG` 체크수·stage 처리/재시도 확인. 이번 후보는 법률 stage 상태/감사의 원자성에 한정하며, 실제 95개 모델 응답·잘못된 JSON·timeout/429 실제 재현·Word 바이트 **미실행**.
- Word → 직원·변호사 검수: `automatic-draft-handoff.ts`는 사람이 요청한 초안을 승인/제출과 분리하고 reference/head/receipt를 정적으로 확인. 직원 검수와 변호사 승인 기록·재생성 후 무효화 **미실행**.
- 실제 보정 이벤트: `preapproval-correction-item-store.ts`는 **실제 사건 보정 요청 이벤트 및 원문 연결**, 기한 `null` 및 source-bound deadline 검사를 정적으로 확인. 실제 법원 원문/보정기한·전자접수 **미실행**.
- 정확한 상태 분류: `미관찰`은 `NULL`, 숫자 `0`, `비해당`, `상충`, `source-only`, `승인 전`과 다름. 합성 통과를 법률 인정·법원 인가·사이트 배포로 승격하지 않음.
- 미해결: main의 `failureAck` 뒤 `note()` 별도 INSERT; PR #110에도 영속 요청 UUID/중복 웹훅 DLQ 없음; PR #16 구판본 계산 lease/reference세대 CAS/계산 head 역전 미병합; R2 성공 후 D1 ACK 소실의 실제 저장물 영수증·Word 생성물/승인 무효화 E2E 미실행.

## 다음 체크 ID와 실무 검토

1. **A4-IT-022 / A4-DATA-014 / X-048**: staging D1 transaction `changes()` 및 audit INSERT 503/응답 유실/rollback, 같은 사건 실제 두 HTTP 워커, 재조회·멱등성·관찰 불능 사건 수동 보류.
2. **A4-LAW-006**: 저장된 95 법률 결과, 새 증빙·활성 reference 변경 및 Word 재생성 시 **기존 직원·변호사 승인 무효화**의 별도 인간 검수.
3. **A4-CALC-004 / A4-IT-003 / X-046**: PR #16의 구판본 lease 및 reference SHA/계산 head 역전과 PR #110 법률 stage CAS의 통합 경쟁 검증.
4. **A4-DOC-017 / A4-DATA-013 / X-047**: R2 성공·D1 실패/ACK 유실 보존, 부분 성공 생성물/영수증, 중복 요청을 실제 staging D1/R2/Cron에서 재현.

**체크 ID 모두 [ ] 미완료, 제품 최종 인수 완료 0건.** 공개 Git에 실제 고객 문서/PII·원본 OCR 사실·키/.env·비공개 정답 저장 없음. 운영 배포/D1 운영 마이그레이션/실제 전자제출/법원 인가 확정 수행 없음.
