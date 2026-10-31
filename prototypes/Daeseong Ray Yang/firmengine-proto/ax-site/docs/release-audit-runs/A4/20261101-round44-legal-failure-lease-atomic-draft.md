# FirmEngine A4 44차 — 법률 실패상태/감사 원자성·만료 lease 안전성 (Draft)

- 일시: 2026-11-01 KST. 첫 확인 main HEAD `40825fe3394c080f9c3a227e8c943b44bdc8d0f5`; 영수증 작성 직전 main `40825fe3394c080f9c3a227e8c943b44bdc8d0f5`.
- 유일 작업 경로: `prototypes/Daeseong Ray Yang/firmengine-proto/ax-site/`. 원본 상담/고객 데이터·비밀키·.env·개인정보·원본 OCR 정답 사용 없음.
- 단일 보드: `docs/PRODUCT_RELEASE_INTEGRATION_BOARD.md`. 직접 점검 ID는 `A4-IT-022`, `A4-LAW-006`, `A4-DATA-014`, `X-048` (4개, **[ ] 미완료**). 연결 조건을 읽은 `A4-DOC-017`, `A4-CALC-004`, `A4-AX-005`는 통과·완료 처리하지 않음.
- 역할 순환: **IT → 사용자·서류 → 계산사무장 → 변호사 → 데이터 → AX**. 직전 43차는 AX부터 시작.
- 사전 조회: 최근 main commit 및 [Draft PR #110](https://github.com/firmengine/firmengine/pull/110)·[계산 PR #16](https://github.com/firmengine/firmengine/pull/16), `drizzle/0017_legal_reanalysis_orchestration.sql`, main `lib/case-legal-automation.ts` blob `4af7a76d0935d532a3f5c0ca5fef4656be7eaf92`, `lib/case-agent-scheduler.ts` blob `0bb91c69dbc06495873cff1e4d5911679baaa335`, 기존 r35/r37/r38/r39/r40 소스·테스트 및 [43차 A4 영수증](20261101-round43-legal-transition-atomic-batch-cas.md). 운영 n8n 워크플로는 조회/기동하지 않았으며 설계와 운영을 동일하다고 단정하지 않음.

## 발견: main 실패 처리에는 별도 P1 부분성공 경로와 만료 lease 경쟁

현행 main `processJob`의 `catch` (대략 281–299행)는 `case_legal_automation_jobs` 상태 UPDATE를 **별도 COMMIT**하고 뒤이어 `note()`로 감사 INSERT. 두 SQL의 원자성 없음. UPDATE WHERE는 `id + lease_token + status='running'`만 검사하며 **`lease_until>now` 조건이 없음**.

| 합성 입력/주입 | 독립 기대 | 로컬 Node SQLite WAL 관찰 | 판정 |
|---|---|---|---|
| main split UPDATE 1행 후 감사 INSERT 503 | 잘못된 부분성공을 정확히 재현 | 다른 DB 연결에서 `retry_wait`, event 0 | **현재 main P1 부정대조** |
| main의 만료된 lease (토큰은 동일), 실패 UPDATE | 기한 만료 워커의 쓰기 차단 필요 | UPDATE 1행 및 감사 1건 생성 | **현재 main P1 부정대조** |
| Draft batch 정상 | 상태1 + 감사1 | 1/1, 두 연결 일치 | 로컬 후보 일치 |
| Draft batch 감사 503 | 둘 모두 rollback | 원래 `running`, event0, lease 보존 | 로컬 후보 일치 |
| 다른 워커가 lease 선점 | 구 worker는 0/0 | 0/0, running 보존 | 로컬 후보 일치 |
| 명시적으로 lease 만료 | 만료 워커 0/0 | 0/0 | 로컬 후보 일치 |
| 동일 요청 중복 | 감사 이벤트 최대 1 | 첫 1/1, 둘째 0/0 | 로컬 후보 일치 |
| 두 워커 경합 | 승자 1, 패자 0 | 1/1 및 0/0 | 로컬 후보 일치 |
| COMMIT 후 HTTP 응답 유실 가정 | 응답=미관찰, DB=재조회로만 확인 | DB 1/1, 호출자는 영수증 미관찰 | **자동 확정 금지** |

가상 식별자 `case-A/job-A/lease-A`, dataVersion=1, failure `LEGAL_STAGE_FAILED`, 2026-11-01 고정 UTC 시각을 사용. 실제 고객/95개 모델 호출/승인 자료는 없음. SQLite의 오류·lease 경합은 합성 주입이며 실제 D1 네트워크 실험이 아님.

## 수정 후보: [Draft PR #114](https://github.com/firmengine/firmengine/pull/114)

- 별도 브랜치 `a4/r44-legal-failure-atomic-cas-20261101`. `main` 실행 코드는 **변경하지 않음**. 해당 PR은 Draft/Open/미병합, 파일 3개 모두 허용 경로 내부.
- 법률 실패 UPDATE와 `INSERT ... SELECT ... WHERE changes()=1` 감사 기록을 같은 `D1Database.batch()`에 결합, UPDATE에 `lease_until>? ` 조건을 추가.
- CAS 0행은 `superseded`/감사0, 1+1 정확 영수증만 정상 처리. NULL/누락/2행/배치 예외는 `LEGAL_AUTOMATION_FAILURE_BATCH_ACK_UNOBSERVED` 또는 `LEGAL_AUTOMATION_FAILURE_AUDIT_ACK_UNOBSERVED`로 분리. 결과 미관찰을 0/실패/성공으로 승격하지 않음.
- 기존 r35 source-extracted 회귀를 batch 계약으로 조정하고, 신규 r44 **실제 SQL 문자열 추출형 Node SQLite 테스트 8건을 작성**. 두 저장소 테스트는 **작성/커밋, 해당 저장소에서 Node-native 실행 미실행**.
- `#110` 역시 동일 소스 파일을 변경하므로 병합/리베이스 충돌이 예상됨. 다른 에이전트 변경을 덮어쓰지 않고 별도 PR로 격리. D1 batch atomic/changes() semantics, 법률 처리와 감사 의미, 실패 복구 정책에 대한 IT·변호사 검토 필수.

## 실행 영수증

- 컨테이너 Node **v22.16.0**, `node:sqlite`, 파일 기반 WAL **독립 연결 2개**, 합성 단위 실행.
- **실행 명령**: `node --test /mnt/data/firmengine-a4/round41_manual_retry_batch_sqlite.test.mjs /mnt/data/firmengine-a4/round42_legal_retry_head_cas_sqlite.test.mjs /mnt/data/firmengine-a4/round43_transition_audit_atomic_sqlite.test.mjs /mnt/data/firmengine-a4/round44_failure_ack_batch_sqlite.test.mjs`
- **관찰**: `40/40 tests pass` (기존 r41–43 31 + 신규 r44 9). 여기에는 현행 main의 결함을 재현하는 **부정대조가 포함**되며 제품 안전성 합격 40건이 아님. r44 로컬 스크립트 SHA-256 `f2c6f03c85ec63ca5e8b8679f73f6c33b4f14c5c2357966aa667e303b259c89a`. 신규 r44 로컬 테스트 9건은 **후보 SQL 복제/독립계약 검증**, GitHub 수정된 생산 TS 파일을 직접 실행한 테스트가 아님.
- **미실행**: PR 브랜치 Node-native source-extracted 테스트, TypeScript/Next 빌드, 전체 CI, Cloudflare staging D1/R2/Cron 및 HTTP 두 워커, 실제 n8n 운영 흐름, Word 파일 생성·기한·직원/변호사 검수·실제 보정 이벤트.
- stage 연결은 main `case-agent-scheduler.ts` / `case-legal-automation.ts` 및 43차 영수증을 재확인한 **source-only**이며 상담→서류→OCR→10분 quiet calculation→95법률→Word→직원/변호사→보정의 종단통과로 기록하지 않음.

## 다음 회차 / 검토 게이트

1. `A4-DATA-014 / A4-IT-022 / X-048`: PR #114 + #110을 조합한 실제 staging D1 batch 503·timeout·영수증 유실·2워커 경합, `changes()` 동일 연결 semantics 및 HTTP 재조회, 영속 멱등성/DLQ 누락 진단.
2. `A4-IT-003 / A4-CALC-004 / X-046`: PR #16 source/reference SHA 및 계산 head의 CAS와 법률 작업 전이 CAS 통합 경합.
3. `A4-DOC-017 / A4-LAW-006 / A4-AX-005`: 원문·갈음 철회·관할 기준판본 변경 시 95법률→Word 재생성→기존 사람 승인 무효화, R2/D1 미확정 재사용/보류 및 보정기한 null의 실사 검토.

**직접 체크 4개 전부 [ ] 미완료. 제품 최종 인수 완료 0건.** 고객정보·키/원본 OCR 비공개 값 공개 Git 반영 없음. 운영 배포, 운영 DB 마이그레이션, 실제 전자제출 및 법원 인가 확정 미실행.
