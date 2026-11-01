# FirmEngine A4 59차 — 법률 계산 preflight 두 SELECT 사이 Head·원본 변경 경합 (2026-11-01 KST)

## 범위·원장·검토 역할
- 오직 `prototypes/Daeseong Ray Yang/firmengine-proto/ax-site/` 내부 기록. 중앙 기준 `docs/PRODUCT_RELEASE_INTEGRATION_BOARD.md`; 검토 ID `A4-IT-012`, `A4-CALC-004`, `A4-LAW-006`, `A4-DATA-023`, `X-046` **모두 [ ] 미완료**. 서류 `A4-DOC-013`과 AX `A4-AX-006`은 간접 인계 경계로만 읽음.
- 여섯 역할 검토 순서: **변호사 → 데이터담당자 → AX담당자 → IT담당자 → 서류담당자 → 계산사무장**. 실무자 승인·서류 UI·법률 AI·Word·보정 이벤트 실사용은 미실행.
- 시작 main `be15d04ed0147104f58dcccba1e53a1df04690dc`; 이 SHA는 아래 코드/기존 테스트 최초 조회 시점. 동시 다른 축 커밋에 따라 작성 이후 현재 main은 별도 조회 필요.
- 실제 조회한 원문 blob: `lib/case-legal-calculation-preflight.ts` main `c17892e63bf00d2981f292b0ef28e032d66a8dc7`; PR #142 후보 `36f0cd79572d63ae439a2bdee94aed9798d666c0`; `lib/case-legal-automation.ts` `4af7a76d0935d532a3f5c0ca5fef4656be7eaf92`; `lib/case-agent-scheduler.ts` `0bb91c69dbc06495873cff1e4d5911679baaa335`; `db/schema.ts` `933f8686845ac14669312dd21bf85e02c62ed5e6`; `drizzle/0011_case_calculation_features.sql` `0caa359d250dce45765d269d271ad63170ec3efa`; PR #142 `tests/case-legal-calculation-preflight-identity.test.ts` `731bc7e7585ab34276c3086af257faf15553c2f2`; A4 58차 영수증 `ea4aca594f51aececf4b9d33e0b25b43a138d600`.
- 관련 미병합: [#16](https://github.com/firmengine/firmengine/pull/16), [#120](https://github.com/firmengine/firmengine/pull/120), [#123](https://github.com/firmengine/firmengine/pull/123), [#126](https://github.com/firmengine/firmengine/pull/126), [#139](https://github.com/firmengine/firmengine/pull/139), [#142](https://github.com/firmengine/firmengine/pull/142). #142는 Draft/미병합. 최근 A4 r56·r57·r58 코드를 근거로 연결 검토.

## 실제 재현: SQLite WAL 두 연결, source-derived SQL
- 실험 실행: `node --test /mnt/data/firmengine-a4/round59_legal_preflight_head_swap_sqlite.test.mjs` (Node v22.16.0, `node:sqlite`, 파일 WAL, **별도 reader/writer 연결**, 가상 case-synthetic/case-other, revision 3, dataVersion 7, reference SHA A, Head/Run A 입력 SHA C, Run B 입력 SHA D). 배포 저장소 자체를 로컬 checkout해서 테스트한 것이 아니라 GitHub PR #142의 **실제 SELECT 문자열을 전사한 독립 SQL 계약 시험**이다. **6/6 테스트 기대 관찰 일치**이며 그중 부정대조는 시스템 안전성 실패를 의도적으로 재현함.
- **정상 대조**: Head A/Run A, current source 7/3, ref A, output monthlyIncomeWon computed → preflight 샘플 SQL 선택 Run A, required output 관찰 시 ready=true; 결과는 법률 승인과 무관.
- **경합 1**: preflight 첫 SELECT로 Head A/Run A를 읽은 직후 워커 B가 `case_calculation_heads`를 Run B로 COMMIT(UPDATE changes=1). B의 필수 output은 missing. 첫 SELECT가 보존한 Run A feature를 다음 SELECT로 읽으면 샘플 preflight는 **ready=true / selectedRun=run-A**이나 최종 영속 Head는 **run-B**. 독립 기대: 현 Head의 완료 근거 없이는 유료 법률 95 작업 진입 승인 금지. 기존 PR #142의 동일성 조건은 *첫 조회 시점*에는 모두 참이므로 이를 차단하지 못한다.
- **경합 2**: 첫 SELECT 시 source dataVersion 7 뒤 다른 연결에서 8로 COMMIT(changes=1). 이어 읽은 Run A의 기존 값은 **ready=true**로 남으나 DB 원본은 v8. 독립 기대: 이전 원본 계산으로 새 법률 검토 시작 금지.
- **수정 방향의 부정대조**: 마지막 읽기전용 HEAD 재조회를 추가한다고 가정하면 그 *전에* A→B 변경은 잡히지만, 재조회 직후 모델 호출 전 바꾸면 다시 ready(A)/current(B) 상태가 생긴다. 따라서 SELECT 재조회만으로 원자성 보증 불가. 실제 CAS/lease/기준세대 정책 설계 필요.
- **사건 분리 대조**: case-synthetic A→B 변경 후 case-other의 Head/Run은 유지; 다른 사건을 바꾸거나 읽지 않음.
- 선행 합성 회귀 `node --test /mnt/data/firmengine-a4/round56_reference_epoch_head_rollback_sqlite.test.mjs /mnt/data/firmengine-a4/round57_reference_read_preflight_parity_sqlite.test.mjs /mnt/data/firmengine-a4/round58_legal_preflight_integrity_sqlite.test.mjs`: **19/19 기대 관찰 일치**, 이전 결함 부정대조 포함. 59차 독립 테스트 6/6과 합산하여 **25개 로컬 관찰**이지, 저장소 전체 CI 통과/운영 안전성 25건 보증은 아님.

## 원본 제어흐름 / 위험 경계
- main `inspectLegalAutomationCalculationReadiness`와 Draft #142는 Head SELECT와 required output SELECT를 순차 비트랜잭션 조회한다. 그 사이 source/head 변경에 대한 *최종 동일성 대조* 없음.
- main `processJob`는 `await assertCurrent(database,job)`를 source load 전에 한 번 수행하고, 이어 `await services.sourceReadiness(source)`, 그 다음 `await services.reviewLegal(job.caseId)`를 호출한 **뒤** 다시 `await assertCurrent`한다. 따라서 재검증이 필요한 경합 시점에서는 **법률 모델 과금 작업이 시작될 가능성**이 있다. 이 회차에서 실제 유료 95 모델 호출은 **미실행**이며 해당 경로에 대한 로컬 함수 종단 실행도 미실행. post-call `assertCurrent` 및 전이 CAS 존재는 사실이며, 자동 Word/사람 승인 오승격을 **재현하지 않았다**.
- 사전 계약: job/Head/Run의 sourceDataVersion·caseRevision·input SHA·reference SHA·승인세대, 현재 lease를 **유료 모델 시작 직전에** 동시성 안전하게 비교해야 한다. 마지막 일반 SELECT만으로 불충분; DB 원자적 CAS와 명시적인 승인세대 식별, 모델 입력 snapshot 고정·응답 후 재확인 및 중복 과금 정책은 별도 설계/실무자 판단 필요.
- 이번 결과는 **P1 후보의 합성 경합**이고 실제 고객·staging/운영 장애를 증명하지 않는다. 기존 PR #142의 읽기 조건 보강은 유효하지만 이 레이스를 해결했다고 병합 완료 표기하면 안 된다.

## 검증 범위·복구·추가 게이트
- 재현한 데이터는 가상 SQL/문자열뿐. 실제 상담→문서→OCR→10분 quiet 계산→95 법률→Word→직원/변호사 승인→법원 보정 이벤트의 종단/단계·버전·CAS E2E는 **미실행**. 실패 복구 자동화도 **미구현/미실행**.
- R2 성공 후 D1 실패 또는 응답유실, 중복 웹훅, 부분 성공, timeout/429/503, 원문 변경, 갈음 철회, 관할 판본 변경, 보정기한 미확정, 재생성은 이번 회차 **staging에서 재현하지 않음**; 기존 회차 부분 증거와 동일시 금지.
- 실제 GitHub 저장소 Node-native(새 #142 5개), TypeScript, Next/전체 CI, Cloudflare staging D1·R2·Cron, HTTP 두 워커, 운영 n8n 동등성, 공식 법원 서식/실무 기준/변호사 승인, 사이트 배포 **미실행/미관찰**.
- 자료상태 `null`/미관찰/0/비해당/상충/source-only/승인전 구분 유지. 합성 레코드로 실제 판정 승격 없음. 고객 문서·개인정보·키·원본 OCR 사실값·.env·비공개 정답 공개 Git 기록 없음. 운영 배포/D1 운영 migration/실전자제출/인가 확정 수행 안 함.

## 다음 ID / 인계
1. `A4-IT-012` + `A4-CALC-004`: PR #120/#123/#126과 #139/#142를 연결해 첫 preflight SELECT→Head 전환→모델 시작 전 **원자 CAS**, 기준 A→B→A 승인세대/구 워커의 지연 저장을 통합 합성으로 평가.
2. `A4-LAW-006` + `A4-DATA-023`: 모델 시작 전 고정 input·source·reference release, 실행 직전/후 동시성 시험 및 직원 Health·법률 작업 상태; 워드 재생성·기존 승인 무효화는 실제 실무자 검증 전 [ ].
3. `X-046` + 서류/AX 교차: 실제 staging 두 HTTP 워커·D1/R2/Cron·이중 webhook·ACK 유실/timeout/429/503, 신구 사건 격리 및 실패 복구 재조회 검증. **전체 최종 인수 0**, 이번 ID 인수 **0/5**.

> 이 문서 자체는 테스트 재현/부분 관찰 영수증이다. 미병합 후보·SQL 합성·CI·staging·법률 승인·운영 배포는 각각 다른 수준.
