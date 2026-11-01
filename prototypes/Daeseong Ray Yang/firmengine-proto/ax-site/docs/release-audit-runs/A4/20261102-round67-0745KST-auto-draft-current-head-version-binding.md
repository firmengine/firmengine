# FirmEngine A4 67차 — 자동 Word 초안 current Head·Run·Job 판본 결속 누락

작성 기준: 2026-11-02 07:45 KST / repository: `firmengine/firmengine` / 대상: `prototypes/Daeseong Ray Yang/firmengine-proto/ax-site/` **하위만**. 실제 사례/개인정보/키는 사용하지 않음.

## 회차 시작 원문·판본
- 실행 시작 main HEAD: `d299ba60d2a3fa99d9708e52cf3da4463082df09`; 시작 시 최근 A1/A2/A3 커밋, 주요 Draft PR #17/#24/#142/#146/#150, 66차 A4 영수증을 재조회. PR #17·#24는 `lib/automatic-review-draft.ts` 동일 파일 수정, 둘 다 main 미병합.
- 중앙 인수 보드: `docs/PRODUCT_RELEASE_INTEGRATION_BOARD.md` 읽은 blob `ba70b4b0b1d549eb0482c6d3152c598c029cd364` (수정 시 최신 blob 별도 CAS).
- 실제 main 소스 `lib/automatic-review-draft.ts` blob `5ee8860250303ac9ca513b0be22e886f98c8e904`: `assertCurrent` SQL은 case/source 판본과 input Run IDs를 비교하지만 calc/legal Head의 data_version/case_revision, immutable Run의 사건 소유권·input_sha256, job linkage는 결속하지 않음. `complete` 재생 경로의 기존 document run도 저장 data_version/case_revision을 조회하지 않음.
- 스키마 blob: `drizzle/0011_case_calculation_features.sql` `0caa359d250dce45765d269d271ad63170ec3efa`, `drizzle/0012_case_lawgraph_reviews.sql` `313375977527c76be5c87668b91bbbb24a0fef8a`, `drizzle/0017_legal_reanalysis_orchestration.sql` `27083bd2b6c7b2c69b1d74d7e3755d39f7de965d`. `case-legal-automation.ts` blob `4af7a76d0935d532a3f5c0ca5fef4656be7eaf92`: `processDraft`가 먼저 Head 상태를 조회 후 draft generation 호출, 생성 후 별도 transition. 이는 하나의 DB 직렬화 트랜잭션이 아님.
- 테스트/기준: 64·65·66차 영수증과 현행 `tests/automatic-draft-review-handoff.test.ts` (blob `8f608562f6430ad793e205cc286a09b60d7e72a4`) 검토. 그 테스트는 사람 인계 검증 함수의 합성 검증으로 이번 `assertCurrent` 조회 계약 전체 인수 증거는 아님.

## 신규 독립 합성시험 (실제 실행)
**원본 SQL은 GitHub main의 `assertCurrent()` SELECT를 전사**. Node v22.16.0 `node:sqlite` 파일 WAL 두 연결, FK 활성. 합성 사건 `synthetic-A/synthetic-B`, 사건 revision 3, source dataVersion 7, calc-A/legal-A/job-A, input SHA-A, ref-A, lease-A, 완료 draft-A. 이 fixture는 0011/0012/0017의 해당 열/외래키를 최소 동일형으로 구성했지 운영 D1에서 가져온 데이터가 아님.

- 정상: 모든 판본/소유권/lease 일치 → main read/current=true → `complete` 단축반환, 독립 기대는 '재사용 **후보**'이며 변호사 승인 아님.
- **계산 Head data_version 7→6, case revision 3→2**, **법률 Head data_version 7→6, revision 3→2** 각각 별도 실행: 독립 기대는 구판본 차단; main은 `assertCurrent=true`, 완료 draft 재반환(위험 부정대조).
- 법률 Head가 다른 사건 `calc-B` 참조, 법률 Run이 다른 calc-B/사건 B 참조, job이 다른 calc-B/legal-B 또는 이전 sourceVersion 참조, Run 입력 SHA가 Head와 상충: 독립 기대는 출처 상충 차단; main은 동일하게 완료 draft 후보 반환(위험 부정대조). **실제 고객 사건 교차 노출은 관찰하지 않음**.
- 완료 draft의 자체 data_version만 7→6 또는 case_revision만 3→2: main 기존 `SELECT`가 이 필드를 읽지 않아 구 완료 초안을 재반환(위험 부정대조).
- 원본 source dataVersion 7→8, lease-A→B: main 기존 `assertCurrent`에서 차단(안전 대조).
- 두 WAL 연결: A가 `assertCurrent` 확인 후 B가 calc Head의 data_version을 6으로 COMMIT, A의 완료 경로는 기존 artifact ID를 반환하는 interleaving 재현. **실 D1 분산 HTTP 두 워커 경합은 아님**.
- 원본 main SQL + shortcut 순수 경로 합성 `round67_draft_assertcurrent_head_version_sqlite.test.mjs`: **16/16 기대 관찰** (위험 재현 다수 포함). 제안 guarded SQL과 완료 run 판본조건의 별도 `automatic-draft-current-head-binding.compact.test.mjs`: **17/17 기대 관찰**. 이전 r64·65·66 합성 테스트 재실행 **33/33 기대 관찰**. 합계 66개 관찰은 제품 안전성 합격 66건이 아님.

## 분리 개선안 / 회귀
[Draft PR #161](https://github.com/firmengine/firmengine/pull/161) — 새 브랜치 `audit/a4-r67-draft-head-provenance-20261102`, base `d299ba60d2a3fa99d9708e52cf3da4463082df09`, 후보 HEAD `62071dbc2f5ebaa65041d52ab80d42cd4d6f0ebd`. `ax-site/` 내부 변경 3개 파일 확인: `lib/automatic-draft-current-head.ts` 신규, `lib/automatic-review-draft.ts` guard 교체, `tests/automatic-draft-current-head-binding.test.mjs` 신규. 저장소용 17케이스 테스트 작성·커밋, **저장소 실행기로 직접 실행 미실행**; 동일 guarded SQL의 로컬 합성 17/17 실행. PR은 Draft/미병합; main 기능 코드는 건드리지 않음.

이 후보는 **조회 시점 stale 판별**만 추가. 읽기-렌더-업로드-Manifest CAS 사이 TOCTOU·A→B→A 승인세대·기존 receipt PK 교착·R2 GET byte hash/503/ACK 유실·기존 직원/변호사 승인 무효화는 해결하지 않음. PR #17/#24와 동일 파일 충돌, #142/#146/#150 선행 gate의 결속 계약, 실제 전문실무자 검토 및 CI/staging 통과 전 병합 금지.

## 6역할 순환 및 ID별 부분 검수
순서 **AX → IT → 사용자·서류 → 계산사무장 → 변호사 → 데이터**. 직접 기록 대상 5개 ID (모두 `[ ]` 유지):
- `A4-IT-012`: old Head/Run 버전의 재생 판정 오류 합성 16개에서 확인. 원자 commit CAS/실 워커 미인증.
- `A4-CALC-004`: current 원본 vs old calculation Head version 불일치가 조회 단계에서 누락되는 반례. 실제 계산 산식 재실행은 하지 않음.
- `A4-LAW-013`: 미검증 구 완료 Word draft ID 재반환. Word 바이트·직원/변호사 확인은 수행하지 않음.
- `A4-DATA-004`: 원본/Head/job/legal Run 불일치 SQL 외래키만으로 차단되지 않는 합성 반례. 운영 D1 제약/사건 격리 위반 미확정.
- `X-046`: 두 WAL 연결 A 조회→B stale Head 변경 COMMIT→A 기존 draft 재생. 실제 HTTP 두 워커 미실행.
간접 인계: `A4-DOC-011` 문안 편집/재생성 경쟁, `A4-AX-013` 새 draft→직원·변호사 검수. 각각 독립 검수/완료로 기록하지 않음.

## 단계별 상태, 미실행 및 다음 ID
`source-only` OCR 자료는 법적 확정치 아님; `null`/미관찰/명시적 `0`/비해당/출처상충/승인전 상태를 구분. 시험의 SQL `0행`은 명시적 금액 `0원`이 아니며, 비해당·관할판본·보정기한 `null`을 합성 시험에서 검증했다는 의미 아님. `complete`는 생성기 상태일 뿐 변호사 승인/법원 인가가 아님.

**미실행**: 저장소 전체 Node/TS/Next/CI, 실제 Word 생성·R2 GET byte proof, staging D1/R2/Cron, 실 2 HTTP 워커, 운영 n8n(참조 설계만 구분), 상담→서류→OCR→10분 quiet→95법률→Word→직원/변호사 검수→실제 보정 이벤트 E2E, 중복 웹훅·429/503/timeout·갈음 철회·관할판본·기한 미확정·고객 서류. 금지: 운영 배포/운영 D1 migration/실전자제출/법원 인가/고객 자료 변경/키 공개 모두 미수행.

**다음 체크**: `A4-IT-012`, `A4-DOC-011`, `A4-LAW-013`, `A4-DATA-013`, `X-046`. 우선 PR #17/#24/#161 결합 충돌과 DB 원자 완료 CAS→R2/receipt 성공·ACK 유실/503→재시도→정식 Word 바이트·승인 무효화 순 검증. **67차 신규 인수 완료 0/5, 제품 최종 인수 0건**.
