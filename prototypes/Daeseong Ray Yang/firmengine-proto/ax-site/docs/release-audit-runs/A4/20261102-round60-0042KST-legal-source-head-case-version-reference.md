# FirmEngine A4 60차 — 법률 Source Readiness의 사건·원본·기준판본 결합 누락 (2026-11-02 KST)

## 범위, 선행 점검, 역할
- 작업 허용 범위: `prototypes/Daeseong Ray Yang/firmengine-proto/ax-site/`만. 인수 원장: `docs/PRODUCT_RELEASE_INTEGRATION_BOARD.md`. 시작/검토 main HEAD `6f4bff071be4269e3c25822caf4e9d729baf5ab0`; 영수증 작성 직전 HEAD `6f4bff071be4269e3c25822caf4e9d729baf5ab0`. 이 문서는 실제 운영 추적/인가 증빙이 아니다.
- 선정한 5개 인수 ID **모두 [ ] 미완료**: `A4-IT-012`(snapshot/CAS), `A4-DOC-013`(새 증빙 후 재인계), `A4-LAW-006`(새 자료/법령 승인 무효화), `A4-DATA-023`(DB/직원 화면 상태 일치), `X-046`(교차 사건/두 워커). `A4-CALC-004`, `A4-AX-006`은 이번 회차 교차 참조만 하고 통과 주장 없음.
- 6역할 순환: **데이터담당자 → AX담당자 → IT담당자 → 서류담당자 → 계산사무장 → 변호사**. 사람 승인·실서비스 활동 없음.
- 실제 검토 원본 파일/blob SHA: `lib/case-legal-source-preflight.ts` `0a4bf038a97de015652d4957a56ecddd5c049bd8`; `lib/case-legal-calculation-preflight.ts` `c17892e63bf00d2981f292b0ef28e032d66a8dc7`; `lib/case-legal-automation.ts` `4af7a76d0935d532a3f5c0ca5fef4656be7eaf92`; `lib/case-agent-scheduler.ts` `0bb91c69dbc06495873cff1e4d5911679baaa335`; `lib/reference-runtime.ts` `9993469a164740e8a9128874b299a967b420e230`; `db/schema.ts` `933f8686845ac14669312dd21bf85e02c62ed5e6`; `drizzle/0011_case_calculation_features.sql` `0caa359d250dce45765d269d271ad63170ec3efa`; 기존 `tests/case-legal-source-preflight.test.ts` `756c3195586d0449a3b4a37294e847b878bab56e`; 59차 영수증 `1623efc4dbb7c9d9cca56f50deb2e75938264d71`.
- 확인한 연관 미병합/고위험 PR #16, #120, #123, #126, #139, #142. r59의 Head 조회→feature 조회 TOCTOU를 계속 미해결로 유지.

## 원본에서 발견한 경계
`inspectLegalAutomationSourceReadiness()`는 `case_calculation_heads h JOIN case_calculation_runs r ON r.id=h.run_id WHERE h.case_id=?`에서 `source_heads_json`을 선택한다. **Run의 case_id, data_version, case_revision, input_sha256, reference_sha256를 해당 사건의 활성 source/head/reference와 결합 검증하지 않는다.** 스키마의 Head.run_id FK는 Run의 존재만 보증하며 동일 사건 소유권을 강제하지 않는다. 정규화 페이지 목록과 active documents의 식별자가 우연히 같으면 `legacySnapshotFallback=false`로 source gate가 `ready=true`일 수 있다. 이는 계산/법률 결과 확정이 아닌 **독립 source preflight의 잘못된 준비 상태**이다.

## 실제 독립 실행 — Node v22.16.0 / 파일형 SQLite WAL 2 연결
- 파일: `/mnt/data/firmengine-a4/round60_source_head_binding_sqlite.test.mjs`. 원본 GitHub SQL과 후보 SQL을 글자 그대로 삽입한 **독립 SQL 계약 시험**이며, 프로젝트 실제 Node 모듈/HTTP/D1 실행이 아님. 가상 `synthetic-main`/`synthetic-other` case, v7/rev3, ref A/B, input C/D, 정상화 페이지 `doc-main:1`. 실제 고객·원문 OCR·개인정보 없음.
- 실행 명령: `node --test /mnt/data/firmengine-a4/round60_source_head_binding_sqlite.test.mjs`. **10/10 기대 관찰 일치**. 부정대조는 의도된 결함을 확인하는 것으로 제품 10건 안전 통과 아님.
- 기존 56·57·58·59차 SQLite 합성 스크립트와 함께 `node --test` 재실행: **35/35 기대 관찰 일치**(기존 실패 경로의 부정대조 포함). 프로젝트 CI와는 별개.

| 가상 입력/순서 | 독립 기대 | 원본 SQL+기존 상태판정 관찰 | 제한적 후보 SELECT 관찰 |
|---|---|---|---|
| 같은 사건, v7/rev3, ref A, Head/Run 입력 C, 정규화 페이지 일치 | source-only 준비 | ready | ready |
| Main Head가 타 사건 Run 참조, 페이지 문자열 동일 | 차단 | **ready 거짓 양성** | hold |
| Head 입력 SHA D / Run 입력 C | 차단 | **ready 거짓 양성** | hold |
| 사건 source v7→8, 구 Head/Run 유지 | 차단 | **ready 거짓 양성** | hold |
| 사건 revision 3→4, 구 Head/Run 유지 | 차단 | **ready 거짓 양성** | hold |
| Head 메타 revision 불일치 | 차단 | **ready 거짓 양성** | hold |
| ref 활성 A / 저장 Run ref B, 동일 페이지 | 차단 | **ready 거짓 양성** | hold |
| normalized 페이지 없음 | 차단 | hold | hold |
| Main 사건 원본 변경, 타 사건 독립 Head | 타 사건 불변 | 불변 | 불변 |
| **후보 SELECT ready 직후 별도 워커 source COMMIT** | 유료 작업 진입 보류 | 1회 조회로 보장 불가 | **여전히 TOCTOU**, 재조회 시 stale 판정 |

## 실제 수정과 미실행 구분
- 고위험 출처 격리 판단이므로 `main` 실행 코드는 바꾸지 않고 **[Draft PR #146](https://github.com/firmengine/firmengine/pull/146)** (branch `audit/a4-r60-source-snapshot-binding-20261102`)에만 수정 후보와 7개 저장소 회귀 테스트를 작성·커밋. PR head `311fe102f7517ab3162146dc32aa80bb42d785df`, 코드 blob `429b84f5e4d726d986d8342294d3cddfe1aabcf1`. 두 변경 파일 모두 허용 범위 안.
- 수정 SQL: 해당 case의 Run 소유권/현재 revision/dataVersion/Head–Run input SHA/현재 reference SHA를 한 SELECT 안에서 결합. 증거 없으면 기존 source normalize fallback이 source gate `review_required`로 보류하도록 함. 법률 인정/계산 산식/DB schema/자동 승인·재시도·R2 삭제 등 미변경.
- **저장소 7개 Node 테스트는 작성했지만 실행하지 않았다**. 전체 Node-native/TypeScript/Next/CI, Cloudflare staging D1/R2/Cron, 실제 HTTP 두 워커, 실제 n8n, OCR·95법률·Word·직원/변호사 승인·법원 보정 이벤트는 **미실행**. 공식 서식 인수/사이트 배포도 미인증.
- 상담→서류→OCR→10분 quiet calculation→법률 95→Word→직원/변호사 검수→실제 보정의 모든 stage/version/CAS/E2E를 승인한 것이 아니다. 미관찰/null/0/비해당/상충/source-only/승인전 상태를 구분하며 사람 승인으로 승격하지 않는다.

## 복구/다음 체크
1. `A4-IT-012` / `A4-LAW-006`: 직전 r59 Head·source 교체→sourceReadiness 통과→모델 시작 간 **원자 CAS/lease/세대 계약**이 필요. 단순 SELECT 보호만으로 다음 COMMIT 경합을 막을 수 없다. 활성 기준 A→B→A의 새 승인세대는 내용 SHA로 식별 불가.
2. `A4-DOC-013` / `A4-DATA-023`: 새 문서/OCR 원본 변경, 갈음 철회, old Word 재생성 및 이전 직원/변호사 승인 무효화는 실제 E2E와 직원 화면 대조 전 [ ] 유지.
3. `X-046` / `A4-AX-006`: Head 저장 성공→Poll cleanup 실패/ACK 유실→두 워커 재선점, R2 성공·D1 실패/응답유실, 중복 webhook, timeout/429/503, 관할 판본 변경과 미확정 보정기한을 staging D1/R2/Cron에서 재현 필요. 이번 회차 해당 항목 **미실행**.
4. Draft #146은 #142 preflight와 함께 통합 검증, TypeScript/CI 및 IT·서류·사무장·변호사·데이터·AX 담당자 실제 검토 후에만 병합 여부 판단. 운영 배포·D1 운영 마이그레이션·전자제출·법원 인가 확정 금지.

**이번 회차 신규 최종 인수 0/5, 제품 전체 최종 인수 0.** 새 수정은 병합 전의 방어 후보이며, 출처 검증과 결괏값의 법률적 승인은 별개이다.
