# FirmEngine A4 41차 — 법률 수동 재시도 상태·감사 원자성 후보 검토

- 작성: **2026-11-01 KST**, 시작 main SHA: `c4af7d809e546283e864c4a15b77c755795e3c68` (작업 직전 조회). 이 회차 이전 main의 A4 40차 최종 SHA `cae832cc65110fefea4b03c90c7e2b4a2efb640d`와 신규 타축 커밋을 구분.
- 허용 경로: `prototypes/Daeseong Ray Yang/firmengine-proto/ax-site/` 전부. 외부 파일 작업 없음.
- 단일 인수 보드: `docs/PRODUCT_RELEASE_INTEGRATION_BOARD.md`. 직접 검증 대상 **A4-IT-022 / A4-LAW-006 / A4-DATA-014 / X-048** 네 ID. 연관 읽기만 **A4-DOC-017 / A4-CALC-004 / A4-AX-005**. 전부 **[ ] 미완료**, 제품/공식승인 인수 0.
- 역할 순환: **변호사 → 데이터담당자 → AX담당자 → IT담당자 → 사용자·서류담당자 → 계산사무장**. 반복 선행 역할 아님.
- 선행 읽기: main 최근 커밋, PR #16(Open·미병합), PR #61(Open·Draft·미병합), `drizzle/0017_legal_reanalysis_orchestration.sql`, `lib/case-legal-automation.ts`(main 원본 blob `4af7a76d0935d532a3f5c0ca5fef4656be7eaf92`), `lib/case-agent-scheduler.ts`, `tests/case-legal-automation-flow.test.ts`, 37/39/40차 회귀 및 40차 감사 영수증. 현재 n8n 설계는 운영 워크플로 실행 증빙 아님.

## 재현 / 입력 / 독립 기대 / 관찰

| 합성 입력·장애 | 독립 기대 | 실제 관찰 | 결과 수준 |
|---|---|---|---|
| 기존 main에서 `failed→retry_wait` UPDATE 1행 COMMIT 후 audit INSERT 실패 | 완료 영수증 금지, 상태와 감사 부분성공 표시 | 별도 SQLite WAL 연결에서 `retry_wait`·attempts 0·audit 이벤트 0건 | **P1 기존 구조 반례** |
| 새 후보 SQL `UPDATE+INSERT SELECT ... WHERE changes()=1` 정상 | state 1 + audit 1이 동일 transaction으로 보임 | 로컬 Node22.16 SQLite WAL 두 연결에서 `1/1`, 두 번째 연결에서 event 조회 | 합성 통과 |
| 새 후보 동일 batch에서 audit INSERT SQL 제약 오류 주입 | 앞선 UPDATE까지 rollback | 상태 `failed`·attempts 3·감사 0건 | 합성 통과 (Cloudflare 장애주입 아님) |
| 이전 status / case revision / dataVersion 후보 | UPDATE 0이면 audit 기록 없음 | 각각 `0/0`, source/status 불변 | 합성 통과 |
| 같은 job에 WAL 두 연결 순차 경쟁 | 선행 worker만 기록 | A `1/1`, B `0/0`, 총 이벤트 1개 | 합성 통과 (실 HTTP 동시 경쟁 아님) |
| batch COMMIT 이후 **응답만 유실** 가정 | caller는 미확정, 읽기전용 증빙 존재 가능 | 다른 SQLite 연결은 state·audit 쌍 조회 | 합성 통과 / replay 보증 미완 |
| branch 실제 TS 함수의 UPDATE/audit ACK {0,1,null,missing,2}, batch throw/사람 projection/stale version | 불확정과 명시 0을 구분, 원문 503 노출 금지 | 브랜치 실제 함수 본문 V8 분리 실행 **13/13 기대 일치** | 합성 단위 |
| 기존 분리 SQL vs 후보 batch의 독립 로컬 테스트 전체 | 오류를 성공으로 승격 금지 | 독립 `/mnt/data/firmengine-a4/round41_manual_retry_batch_sqlite.test.mjs` **Node-native 9/9 PASS** | 독립 로컬 SQL 합성; 저장소 Node-native 아님 |

모든 입력은 `case-synthetic`/`job-synthetic` 등 공개 가능한 가상값이다. 노출되면 안 되는 실제 고객 자료, OCR 원문 사실값, 열람 키, 원본 PDF, 비공개 정답은 사용하거나 공개 Git에 적재하지 않았다.

## 코드 후보 / Git 변경

- 위험도가 있는 실행 의미 변경이므로 **main 코드 변경 없음**. 새 [Draft PR #110](https://github.com/firmengine/firmengine/pull/110) 분리, **Open·Draft·미병합**.
- 브랜치 `audit/a4-r41-legal-manual-retry-batch-20261101`, 출발 SHA `c4af7d809e546283e864c4a15b77c755795e3c68`; 코드 후보 마지막 commit `827f20b5c726a3bba390543bc29830f5e03b88b7`.
- 변경 대상 4파일: `lib/case-legal-automation.ts`, `tests/case-legal-automation-ack-r37.test.mjs`, `tests/case-legal-automation-manual-retry-audit-r40.test.mjs`, `tests/case-legal-manual-retry-batch-r41.test.mjs`. `compare_commits`로 허용 경로 외 변경 **0** 확인.
- 새 8개 Native SQLite 회귀는 **브랜치에 작성했으나 저장소 컨텍스트에서 실행 미실행**. 기존 r37/r40 source-extracted 단위 테스트는 branch 코드 변경에 맞춰 수정했으나 **Node-native 미실행**. V8 분리 13/13을 전체 CI로 표시하지 않음.

## 미해결 위험 / 필수 실증

1. **Cloudflare D1 staging** batch의 동일 connection `changes()` 계약, audit SQL 503/timeout 실패 시 전체 rollback, COMMIT 성공 후 HTTP ACK 소실, source/result 재조회 영수증, 중복 webhook/요청 UUID를 검증해야 한다. 오직 로컬 SQLite 거래 결과를 staging 통과로 격상할 수 없다.
2. 현재 사건별 retry 요청에는 독립적인 **요청 UUID/영속 idempotency key**가 없다. batch가 성공 후 응답 유실되면 API caller는 미확정이고 Cron은 retry_wait을 사용할 수 있다. exactly-once, 자동 복구, 법률 승인 보증 아님.
3. `transition()`의 다른 상태 UPDATE→audit INSERT 역시 별개 호출이며 이 PR로 해소되지 않는다. 계산 워커 구본 v7→v8 lease 탈취(PR #16), 기준정보 A/B 계산 head 경쟁, Export D1/R2 영수증(PR #61 Draft)도 미해결.
4. 10분 quiet calculation, 95 법률, Word 초안, 직원·변호사 승인 무효화, 실제 보정 이벤트의 전체 stage/version/CAS/HITL 종단 시험은 **미실행**. 실제 n8n 운영 워크플로, Cloudflare staging D1/R2/Cron, 두 HTTP 워커, Node 전체 TS/Next/CI, 공식 서식·실무자 승인, 사이트 배포도 **미실행**.
5. 구분 원칙: **미관찰 ≠ NULL ≠ 0 ≠ 비해당 ≠ source-only ≠ 상충 ≠ 승인전**. 사람 승인 없는 합성 출력을 법률 인정값·인가값으로 승격하지 않는다. 운영 배포/운영 DB migration/전자제출/법원 확정 조치 없음.

## 다음 회차

- **A4-DATA-014 / A4-LAW-006 / X-048**: D1 staging 원자 배치·ACK 유실에 대한 read-only 재조회, request UUID 멱등성 및 partial commit 법률 승인 보류.
- **A4-IT-003 / X-046**: 현재/구 reference SHA 혼재 두 계산 worker CAS; PR #16 재검토.
- **A4-DATA-013 / X-047**: R2 GET byte SHA와 D1 영속 원장 receipt 검증. 제품 인수 완료 **0건**.
