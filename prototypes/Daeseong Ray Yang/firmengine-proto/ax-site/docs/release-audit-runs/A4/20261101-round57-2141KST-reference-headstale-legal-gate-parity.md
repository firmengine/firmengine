# FirmEngine A4 57차 — 계산 Head 조회의 활성 기준 SHA 미반영과 법률 사전검사 간 상태 불일치 (2026-11-01 KST)

## 실행 범위·역할·원장
- 허용 경로: `prototypes/Daeseong Ray Yang/firmengine-proto/ax-site/` 내부만. 회차 시작 GitHub main `26a55105db490f80c72468f799c26b8f77049548`; 영수증 생성 직전 재조회 `26a55105db490f80c72468f799c26b8f77049548`. 중앙 기준: `docs/PRODUCT_RELEASE_INTEGRATION_BOARD.md` (주요 5 ID `A4-IT-012`, `A4-CALC-004`, `A4-LAW-006`, `A4-DATA-023`, `X-046`), **전부 [ ] 미완료**. `A4-DOC-013` 및 `A4-AX-016`은 간접 인계 검토만.
- 역할 순환: **사용자·서류담당자 → 계산사무장 → 변호사 → 데이터담당자 → AX담당자 → IT담당자**. 서류·변호사 검수·승인/AX 운영 Cron은 직접 실행하지 않음.
- 읽은 원문 main: `lib/case-calculation-feature-store.ts` blob `bb5f88b26e68f5ae2234741063ac9301a927e27a`; `lib/case-data-recompute.ts` blob `7e8053ffebe892a6065d6e40f9fec5c19b2d701f`; `lib/case-legal-calculation-preflight.ts` blob `c17892e63bf00d2981f292b0ef28e032d66a8dc7`; `lib/case-legal-automation.ts` blob `4af7a76d0935d532a3f5c0ca5fef4656be7eaf92`; `lib/case-agent-scheduler.ts` blob `0bb91c69dbc06495873cff1e4d5911679baaa335`; `drizzle/0011_case_calculation_features.sql` blob `0caa359d250dce45765d269d271ad63170ec3efa`; `drizzle/0020_calculation_poll_fairness.sql` blob `f4906ad0dcefa4bdce67f00b104540d2266f890d`; `tests/case-calculation-feature-store.test.ts` blob `844525d8633442d571ced2c48ed5bd00ba7bb5a0`; A4 56차 영수증. 기존 PR #16/#120/#123/#126의 보류 전제 유지.
- 최근 main 커밋은 `26a55105`, `1b042c32`, `0998d1ca`, `549f12b7` 순서로 조회했고, r56 이후 다른 축의 commit이 존재하는 상태에서 해당 코드를 덮어쓰지 않음.

## 신규 경계 — SQL 저장값/읽기 최신성/법률 워커 선별
합성사건 `syn`, revision=3, source dataVersion=7, 기존 계산 `run-A`, run reference SHA = `a×64`; 승인 기준을 SHA `b×64`로 바꾼 가정이다. 원본 데이터 자체는 변경하지 않는다.

| 분기 | 독립 기대값 | 현행 main 실제 원문/Node WAL 관찰 | 분류 |
|---|---|---|---|
| ref A 활성, Head A | 계산 조회 stale=false | `headStale=false`; 법률 후보 1 | 정상 대조 |
| **ref B 활성, Head A(동일 source/revision)** | **old Head stale=true** | **`listCaseCalculationFeatures.headStale=false`** | **표시·조회 플래그 오류(P1/P2 검토 필요)** |
| 동일 B 활성·A Head, 95법률 진입 | ref B 일치 전 AI 실행 보류 | `case-legal-automation` 후보 SQL에서 reference SHA 조건으로 **0건** | **별도 방어 존재; 95 실행 우회 재현 아님** |
| 동일 B 활성·A Head, preflight 서브쿼리 단독 | 불일치 증거 구분 | 현재 `inspectLegalAutomationCalculationReadiness`의 head SELECT는 ref SHA 비교 없이 `run-A` 조회 | **단독 진단 가드 공백, 상위 경로 선별과 별개** |
| B 계산 `run-B` 저장 후 | stale=false, legal 후보 1 | 일치 | 정상 대조 |
| source 7→8 또는 revision 3→4 | stale=true, preflight 대기 | main predicate=true, preflight SQL 0행·scheduler 0건 | 정상 대조 |
| A→B→A 승인 상태 왕복·옛 Head A 유지 | 승인세대 반영의 필요성은 정책 결정 | 현재 SHA만 보면 A Head 재사용 가능 | **영속 승인세대 없음. 옛 A 재사용 금지 여부는 실무 승인 필요** |

현행 main의 `headStale`는 source dataVersion/case revision만 대조한다. 반면 `recomputeCaseDataUpdate`는 ref SHA도 대조하며 법률 scheduler는 ref SHA로 후보를 선별한다. **즉, 같은 사건에 대해 계산 API 조회 플래그와 스케줄러 선별 상태가 달라질 수 있다.** 실제 직원 UI가 그 값을 '승인 완료'로 렌더링한다는 증거는 없고, UI/HTTP는 미실행이다.

## 실제 재현·수정 후보
1. 독립 Node **22.16.0** `node:sqlite` 파일 WAL **두 연결**. `round57_reference_read_preflight_parity_sqlite.test.mjs` 합성 8조건 **8/8 기대 관찰 일치**. 그중 active B+Head A 상태에서 거짓 `headStale=false`를 확인하는 **안전성 실패 부정대조 1건**, A→B→A의 세대 관측 제한 1건을 포함한다. 이는 실제 D1/HTTP 시험이 아니다.
2. 56차 독립 WAL 스크립트를 수정 없이 재실행해 **10/10 기대 관찰 일치**. 구 Reference A 워커가 B Head를 덮는 결함, NULL lease 기아 등의 부정대조 포함. 총 18/18은 제품 안전성 PASS가 아니다.
3. main 원본/신규 Draft의 **실제 GitHub `headStale` JS predicate**를 분리해 V8 5조건 실행: 정상 A(false/false), **구 A Head·활성 B(false/true)**, source v8(true/true), revision4(true/true), 신 B(true 아님,false/false), **5/5 기대 일치**. 이는 함수 본문 전체/D1 실행이 아니라 표현식 격리 시험.
4. 읽기전용 최소 수정/회귀 테스트 1건을 **[Draft PR #139](https://github.com/firmengine/firmengine/pull/139)** (branch `audit/a4-r57-reference-headstale-20261101`)에 분리. `listCaseCalculationFeatures.headStale`에 `referenceIdentity()?.sha256 ?? referenceRelease.sha256` 대비 Head release SHA 비교만 추가. 계산값·법률 의미·문서 인가·DB migration·배포는 수정하지 않음. PR branch commit `12b8dd2498942c0a97aaecbfea573c965158de49`. **추가 저장소 테스트 파일은 작성·푸시됐지만 Node-native 실행은 미실행.**
5. PR 변경 파일은 `lib/case-calculation-feature-store.ts` (+2/-1), `tests/case-calculation-feature-store.test.ts` (+19) 총 2개. 최초 base `26a55105` 비교상 **범위 밖 0개**. 별도 전문가·IT 담당자 검토 전 **Draft/미병합**.

## 위험, 사람 승인/운영 상태 및 다음 체크
- `A4-IT-012`/`A4-CALC-004`/`X-046`: ref A→B→A·B→A 지연 워커·source v7→v8·ACK 유실을 **영속 reference approval epoch + 원자적 Head CAS**로 검증해야 한다. #139의 read-only 표시 수정은 r56 Head 롤백 P1을 **해결하지 못한다**. PR #16/#120/#123/#126 통합 D1 트랜잭션·복구 프로토콜 재검토.
- `A4-LAW-006`: preflight 독립 API의 ref SHA 조건과 상위 legal scheduler 조건 차이를 분리 검토. 법률 AI 95·변호사 승인 무효화는 이번에 실행하지 않았고, 상위 reference filter가 존재함을 확인. 법적 판단·기존 승인 확정 금지.
- `A4-DATA-023`: `caseCalculations` 조회의 `headStale`와 직원 Health/UI, Poll 상태·법률 후보의 최신성 표시 일치 여부를 실제 staging API/D1에서 확인. 아직 미관찰.
- `A4-DOC-013`/`A4-AX-016` 간접: 원문/갈음 철회 뒤 Word 재생성·직원/변호사 재검수, n8n 설계와 실제 Cron 운영 실행은 미인증.
- **미실행:** 저장소 Node-native 새 테스트·전체 CI/TypeScript/Next, Cloudflare staging D1/R2/Cron, 실제 두 HTTP 워커, 모델 429/503/timeout, 응답유실/R2 일부성공, 중복 webhook, 전체 상담→OCR→10분 계산→95법률→Word→직원/변호사→실제 보정 종단, 공식 서식·전문가/변호사 승인. 유실(null), 0행, source-only, 상충, 비해당, 승인전은 서로 별개로 유지.
- 실제 고객 자료/원본 OCR 사실값/.env/키/비공개 정답 공개 Git 기록 없음. 운영 배포·운영 D1 migration·실제 전자제출·법원 인가 확정 전부 미수행.

**이번 회차 인수 최종 완료 0/5. 제품 전체 최종 인수 완료 0건.**
