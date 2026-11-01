# FirmEngine A4 58차 — 법률 계산 preflight의 Run·원본·활성 기준 동일성 누락 (2026-11-01 KST)

## 범위 / 역할 / 원장
- **작업 허용 범위**: `prototypes/Daeseong Ray Yang/firmengine-proto/ax-site/` 하위만. 시작 main `734e78a7a3aad6b733abdd02ae128dbfc8004d4c`; 이 영수증 작성 직전 조회 main `734e78a7a3aad6b733abdd02ae128dbfc8004d4c`. 다른 축의 실제 코드·자료·스키마는 변경하지 않음.
- **중앙 기준**: `docs/PRODUCT_RELEASE_INTEGRATION_BOARD.md`; 선정한 5개 미완료 ID `A4-IT-012`, `A4-CALC-004`, `A4-LAW-006`, `A4-DATA-023`, `X-046`. **전부 [ ] 유지**. `A4-DOC-013`과 `A4-AX-016`은 인계 경계 간접 소스검토만 하며 합격 처리하지 않음.
- **6역할 순환**: 계산사무장 → 변호사 → 데이터담당자 → AX담당자 → IT담당자 → 사용자·서류담당자. 계산/법률 결과의 실제 실무 승인, 서류 UI·Word/신규 보정 이벤트 종단은 미실행.
- 읽은 main 원문(blob SHA): `lib/case-legal-calculation-preflight.ts` `c17892e63bf00d2981f292b0ef28e032d66a8dc7`, `lib/case-agent-scheduler.ts` `0bb91c69dbc06495873cff1e4d5911679baaa335`, `lib/case-legal-automation.ts` `4af7a76d0935d532a3f5c0ca5fef4656be7eaf92`, `lib/case-calculation-feature-store.ts` `bb5f88b26e68f5ae2234741063ac9301a927e27a`, `drizzle/0011_case_calculation_features.sql` `0caa359d250dce45765d269d271ad63170ec3efa`, `drizzle/0020_calculation_poll_fairness.sql` `f4906ad0dcefa4bdce67f00b104540d2266f890d`, `tests/case-legal-calculation-preflight.test.ts` `46c7243e5e7ed44a7349a042f229d77535a8f28d`, A4 56~57차 영수증. PR #16/#120/#123/#126/#139 미병합·검증 범위 구분 유지.
- **변경 전의 실행 SQL**: `inspectLegalAutomationCalculationReadiness()`는 Head의 `data_version`/case `revision`만 비교하고 결합된 `run.case_id`, `run.data_version`, `run.case_revision`, `run.input_sha256` 및 **활성 기준정보 SHA**를 비교하지 않았다. 법률 preflight가 자료 준비상태를 `ready`로 반환할 수 있는 독립 가드 공백. 자동 Cron 법률 스케줄러의 다른 활성 기준 SHA 검사까지 우회했다고 주장하지 않음.

## 합성 입력 / 독립 기대 / 실제 영속 SQL 관찰
Node v22.16.0 `node:sqlite`, 파일형 SQLite WAL **독립 DB 연결 2개**. 사건은 오직 가상 `case-1` 및 `case-2`, revision=3, sourceVersion=7, ref SHA=A(`a`×64) 또는 B(`b`×64), input SHA=C/D. DB는 가상 최소 스키마를 사용했으며 제품 전체 migration·D1 엔진은 사용하지 않았다.

| 순서 | 조건 | 독립 기대 | main 원문 SELECT | Draft SQL 후보 | 판정 |
|---|---|---|---|---|---|
| 1 | 현재 ref A, head/run A, source v7/rev3 | 최신 Run 존재 | `run-A` | `run-A` | 정상 대조 |
| 2 | 현재 ref **B**, head/run 과거 **A**, source 동일 | 계산 재준비 대기 | **`run-A` 선택** | `null` | **결함 부정대조** |
| 3 | ref B, head/run 모두 B | Run 존재 | `run-B` | `run-B` | 정상 대조 |
| 4 | ref B, Head input SHA=C vs Run input SHA=D | 일치 증거 없어 보류 | **`run-B` 선택** | `null` | **결함 부정대조** |
| 5 | case-1 Head가 case-2 `run-foreign`을 참조 | 타 사건 Run 절대 사용 금지 | **`run-foreign` 선택** | `null` | **결함 부정대조** |
| 6 | source v8로 증가, Head v7 | 보류 | `null` | `null` | 기존 차단 |
| 7 | revision 4로 증가, Head rev3 | 보류 | `null` | `null` | 기존 차단 |
| 8 | 기준 A→B→A, 원래 Head A | **승인세대 재사용 여부 정책 미확정** | `run-A` | `run-A` | **승인세대 위험 미해결** |

로컬 독립 시험 `round58_legal_preflight_integrity_sqlite.test.mjs`은 각 위 8조건 assert 포함 **1/1 Node test PASS**이며, 8조건 모두 독립 예상 관찰과 일치. 여기에는 구 구현의 **안전성 실패 부정대조**가 포함되어 제품 안전성 합격이 아니다. 기존 56차 SQLite **10/10**, 57차 SQLite **8/8** 회귀 재실행하여 모두 각 *예상 관찰* 일치(이 역시 기존 결함 부정대조 포함). **실제 GitHub 저장소 신규 Node-native 테스트 실행 미실행**.

## 수정 후보 및 검증 한계
- **[Draft PR #142](https://github.com/firmengine/firmengine/pull/142)**, branch `audit/a4-r58-legal-calculation-preflight-identity-20261101`, 최종 HEAD `2cd4d1650f01ab5ba9c7dcaa7a41abe424e81df3`, **Open/Draft/미병합**.
- 변경은 `lib/case-legal-calculation-preflight.ts`와 신규 `tests/case-legal-calculation-preflight-identity.test.ts` **2파일만**. GitHub compare: +7/-2, +77/-0, 범위 밖 0. SQL에 `r.case_id=c.id`, `r.data_version=s.data_version`, `r.case_revision=c.revision`, `r.input_sha256=h.input_sha256`, `r.reference_sha256=?` 추가. 후자의 바인딩은 `referenceIdentity()?.sha256 ?? referenceRelease.sha256`를 사용. 새 저장소 테스트 5개 선언·소스 커밋, **실행 미실행**.
- **P1/P2 위험후보이며 실제 운영 사례 아님.** request-scoped 기준 SHA 조회와 SQL 조회의 TOCTOU는 남는다. A→B→A 승인세대·Head UPSERT 역전(P1)과 calc poll cleanup ACK 유실/ghost running/NULL deadline 기아 역시 본 PR로 해결되지 않는다. 기존 자동 법률 scheduler는 별도 활성 기준 SHA 검사와 job 진입 guard가 있으므로 95개 AI 실행 우회를 관찰하지 않았다.
- **개발/검증 보류**: 전체 Node/TypeScript/Next/CI, Cloudflare staging D1/R2/Cron, 실제 HTTP 두 워커 및 응답유실·429/503/timeout, 중복 webhook, 상담→서류→OCR→10분 quiet 계산→법률 95→Word→직원/변호사→실제 보정 종단, 공식 법원 서식·실제 승인·운영 n8n과 설계 n8n 차이 모두 **미실행/미관찰**.
- **수정 금지/미수행**: 운영 배포, 운영 DB migration, 실제 고객자료/OCR 사실값·개인정보·키/.env/비공개 정답 공개 Git 기록, 실제 전자제출, 법원 인가 확정. `null`/미관찰, `0` 행, source-only, 상충, 비해당, 승인전은 혼동하지 않음.

## 다음 실행 / 미완료 ID
1. `A4-IT-012` / `A4-CALC-004`: #16/#120/#123/#126/#139/#142 통합 계약, 활성 기준 승인세대 DB 원자적 CAS와 Head 저장/재조회 일관성; HEAD A→B→A, 구 워커 A 지연 commit, ref 변경 직후 요청 판본 검증.
2. `A4-LAW-006` / `A4-DATA-023`: 독립 계산 preflight와 실제 legal scheduler·직원 UI 결과의 `ready/waiting/source-only` 대조, 새 증빙/관할 판본 변경 후 기존 법률·Word 승인 무효화, 작업자 별도 승인.
3. `X-046` 및 서류·AX 간접: R2 PUT 성공→D1 실패/ACK 유실, webhook 중복, Cron/HTTP 2워커·timeout/429/503, 복구/재생성·사람 인계 E2E 필요. 모든 실제 staging 항목 **미실행**.

**58차 신규 최종 인수 완료 0/5, 제품 전체 최종 인수 0건.**
