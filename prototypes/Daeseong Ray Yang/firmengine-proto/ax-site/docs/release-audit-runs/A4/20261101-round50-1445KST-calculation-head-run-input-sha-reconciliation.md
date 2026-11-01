# FirmEngine A4 제50차 — 계산 Poll head↔run 입력 SHA 불일치 읽기전용 진단

- 날짜: 2026-11-01 KST. **허용 경로:** `prototypes/Daeseong Ray Yang/firmengine-proto/ax-site/` 내부만. 시작 시 관찰한 main: `14438ae4552dfdf6f53a832df585a570e4ef0b79` (다른 에이전트와 병렬 변경되므로 이 SHA는 작업시점 스냅샷).
- 단일 인수 문서: `docs/PRODUCT_RELEASE_INTEGRATION_BOARD.md`. 49차 `docs/release-audit-runs/A4/20261101-round49-1345KST-ghost-running-poll-recovery.md`를 이어서 검사. 최종 승인 0건.
- 역할 순환 **IT → 서류 → 계산사무장 → 변호사 → 데이터 → AX** (49차 AX→IT→서류→계산→변호사→데이터와 시작·책임 순서 변경). 직접 검증: **A4-IT-005, A4-CALC-004, A4-DATA-023, X-046**; 직접 완료 0/4. 관련 서류 `A4-DOC-013`, 변호사 `A4-LAW-006`, AX `A4-AX-001`은 source-only 인계/설계 경계만 검토, 체크 승격 없음.

## 1. 실제 읽은 원본과 DB 계약
- GitHub main: `lib/case-data-recompute.ts` blob `7e8053ffebe892a6065d6e40f9fec5c19b2d701f` (Cron 후보 SELECT·poll lease·cleanup DELETE·health); `lib/case-calculation-feature-store.ts` blob `bb5f88b26e68f5ae2234741063ac9301a927e27a` (run/head 영속 저장); `lib/case-legal-automation.ts` blob `4af7a76d0935d532a3f5c0ca5fef4656be7eaf92` (현재 법률 작업 조회의 입력 SHA 결합); `drizzle/0011_case_calculation_features.sql` blob `0caa359d250dce45765d269d271ad63170ec3efa` (runs/heads 양쪽 `input_sha256 TEXT NOT NULL`). `docs/ax-n8n-refactor-blueprint-20261030.md`는 설계안이며 운영 n8n의 실제 실행 영수증 아님.
- Draft PR #126 원본 helper blob `47d864d2f43c1f36b427cb4c5400f59231604ba6`, 원본 테스트 blob `409dc06f36ca596be70517b314ee67958a2e6f5d` 및 49차 영수증을 읽고 추가 검증. PR #16/#120/#123 및 #110/#114는 관련 실행경쟁/감사 ACK 변경이지만 별개 미병합·미인증.
- 현행 `caseCalculationPollHealth`는 poll row status를 중심으로 읽으며 head/run 입력 SHA를 상호 검증하지 않는다. PR #126의 읽기전용 진단은 main API/Cron에 연결되지 않음.

## 2. 원본 함수 부정대조와 독립 기대값
**합성 입력:** `caseId=synthetic-case`, 사건 revision=4, 원본 dataVersion=7, head/run ID=`run-7`, poll=`running`/만료 lease, active reference SHA=`a×64`. 정상 input SHA=`a×64`, 의도적 불일치 input SHA=`b×64`. 타 사건·고객 자료 없음.

| 주입 사건 | 독립 기대 | 수정 전 실제 GitHub helper V8 관찰 | 수정 후보 V8 관찰 |
|---|---|---|---|
| run/head 동일 유효 SHA | 현행 head 확인하되 Poll 완료 확정 금지 | `poll_running_with_current_head`, `true` | 동일 |
| head SHA=`b×64`, run=`a×64` | 입력결합 **상충**, head current 아님 | **`poll_running_with_current_head`, `true` 오판** | `head_input_conflict`, `false` |
| head SHA=`null` | **미관찰**, 0이나 확정 부재 아님 | **`poll_running_with_current_head`, `true` 오판** | `head_input_unobserved`, `null` |
| run SHA=`"0"` | 비정상·미관찰; 문자열 숫자 0과 구분 | **`poll_running_with_current_head`, `true` 오판** | `head_input_unobserved`, `null` |
| Poll 없음 + 입력 SHA 상충 | Poll cleanup 완료 영수증으로 승격 금지 | `poll_absent_head_current`, `true` 가능 | `head_input_conflict`, `false` |
| sourceVersion 8/다른 ref/head 부재 | stale/미관찰, 별도 구분 | 기존 부정확한 SHA 결합 이외 현행 동작 | 기존 동작 보존 |

원본 GitHub 함수는 TypeScript type annotation만 걷어낸 V8 isolate에서 실행(기존 3개 거짓 current 반례 관찰). 실제 후보 commit의 GitHub 함수 본문 재조회 V8 **10/10 독립 기대 일치**. Node v22.16.0 `node --experimental-strip-types --test`로 독립 파일 SQLite WAL 2연결 **신규 7/7**(SHA 일치/상충/null/비정상/sourceVersion 변경/양측 재조회). 기존 41·42·43·44·46·48차 독립 회귀를 로컬 **58/58** 재실행하여 총 **65/65 관찰 일치**. **65건에는 결함을 의도적으로 재현하는 부정대조가 있으므로 안전성 인수 65건이 아님.** 독립 SQLite는 실제 D1·전체 프로젝트 Node/CI 테스트가 아니다.

> SQL 0011의 input SHA는 NOT NULL임을 확인했다. null/비정상 해시 테스트는 정상 D1 저장값 출현 주장이나 공식 DB 제약 위반을 운영에서 재현했다는 의미가 아닌, 합성 손상/응답결손 주입에 대한 보수적 읽기 계약 시험이다.

## 3. 코드 후보와 반영 범위
- 기존 **Draft PR #126만 수정**. 소스 `lib/case-calculation-poll-reconciliation.ts`에 head/run input SHA를 SELECT, 두 SHA가 유효해야 headCurrent 가능; 미관찰(`head_input_unobserved`)과 유효한 상충(`head_input_conflict`)을 분리. **읽기전용**, D1 쓰기·삭제·자동 재시도·법률 판단·승인 없음.
- 테스트 `tests/case-calculation-poll-reconciliation-r49.test.mjs`의 합성 스키마에 SHA 컬럼 추가 및 신규 4개 test 작성. 테스트 선언 합계 **18건**이나 **저장소 Node-native 테스트 실행 미실행**, 18/18 PASS 주장하지 않음.
- PR #126 현재 HEAD `c043ae6faafacb62a6765003f3adfa9001ebf8a5`, source blob `2ffd97ce32f2974836da3cdf211744311c6cc5ba`, test blob `20d4187d3c4e474d7238983e2b56b646945e787a`. PR은 Open/Draft/미병합; 변경 파일 2개 모두 허용 `ax-site/` 내부. PR 대화에 합성재현 및 제한 사항 코멘트 등록.
- 중앙 보드 직접 체크 ID **4개**의 부분 증빙만 기재하고 `[ ]` 그대로 유지. 별도 법률 인정/계산 산식 변경 없음.

## 4. 실행 안 했거나 승인하지 않은 경계
- 전체 Node-native/TypeScript/Next/CI, Cloudflare **staging D1/R2/Cron**, 두 실제 HTTP 워커, 운영 n8n workflow **전부 미실행**. 설계 문서만 읽었으며 운영 n8n과 동일하다고 하지 않음.
- 상담→서류→OCR→10분 quiet→계산→95개 법률→Word 초안→직원·변호사 승인→실제 보정 이벤트 **종단 미실행**. R2 성공 뒤 D1 실패/응답유실, 실제 중복 webhook, timeout/429/503, 원문 변경, 갈음 철회, 관할판본 변경, 보정기한 미확정, Word 재생성 및 종전 승인 무효화 E2E는 **미실행**.
- status=미관찰/null/0/비해당/상충/source-only/승인전은 서로 다른 상태이며, `headCurrent=true`도 워커 cleanup 성공·서류 승인·법률 인정·법원 인가가 아님. 실제 고객 개인정보·원본 OCR·키/env·비공개 정답을 Git에 쓰지 않음. 운영 배포/운영 마이그레이션/전자제출/인가 확정도 하지 않음.

## 5. 다음 A4 확인·복구
1. **A4-IT-005 / A4-DATA-023**: staging 읽기전용 D1에서 head/run input·ref·source·lease/receipt 동시관찰과 health UI 동등성. 부분 COMMIT·ACK 응답소실을 자동재시도에 연결하지 말고 먼저 영속 영수증 재조회.
2. **A4-CALC-004 / X-046**: PR #16/#120/#123/#126 조합으로 두 워커 v7/v8, head 저장 뒤 lease cleanup 0/null/503, 다음 Cron 후보 0건 상태의 명시적 복구 설계 및 실무자 승인. 조회 진단을 승인/완료로 승격 금지.
3. **A4-DOC-013 / A4-LAW-006 / A4-AX-001**: 원문·갈음·기준정보 변경 → 재계산 → 법률 95 → Word 재생성 → 기존 사람 검수 무효화 → 실제 보정 stage 승인 인계. n8n 설계와 운영 실적 분리.

**이번 회차 최종 인수 0건, A4 전체 최종 인수 0건.**
