# FirmEngine A3 제36차 — canonical #001–020 재감사와 source-only 상태 거짓 완료 검토

> 관측: **2026-11-01 KST**. `firmengine/firmengine` **main 독립 정적 스냅샷** `e84fe19cd7a80aa1c8819e1b57e1325655743b1e`. 작업경로 `prototypes/Daeseong Ray Yang/firmengine-proto/ax-site/` 내부 한정. 본 문서는 **제품 승인·법률 인정·시스템 E2E 실행 영수증이 아니다.**

## 감사 범위·6역할 순환·인수 체크
- 35차 #681–693 정적 순차 조사를 끝낸 뒤 **#001–020부터 공백 재감사** 시작. 정적 인덱스 693/693 고유, 85문서/48 family/1,808 원천 라우트 재조인. **이번에 실제 세부 개별 조회한 ID는 20개(#001–020), 20 declared source slots/2문서**. 새로운 피처가 생겼다는 의미가 아님.
- **이번 순환:** AX담당자 → IT담당자 → 데이터담당자 → 변호사 → 사용자·서류담당자; 다음은 계산사무장부터 시작. 부분 체크 `A3-AX-002`, `A3-IT-014`, `A3-DATA-003`, `A3-LAW-017`, `A3-DOC-005`. **모두 [ ] 미완료**.
- `lib/document-agent-field-contracts.json`, `lib/shared-document-field-contracts.json`, `lib/canonical-field-id-index.json`, `lib/field-applicability-contracts.json`, `lib/ocr-field-supplements.json`, `lib/extraction-row-store.ts`, `lib/field-observation.ts`, `lib/feature-lineage-audit.ts`, `lib/canonical-field-binding.ts`, `lib/ocr-chain-matrix.ts`, `lib/material-calculation-source-gate.ts`, `lib/risk-catalog.json`, `lib/legal-catalog.json`, `lib/legal-exceptions.json`, `lib/reference-decision-tables.json`, SQL writer/tests와 [1차 영수증](20261030-1331-canonical-001-020.md)·[35차 영수증](20261031-r35-canonical-681-693-2327KST.md)을 읽음.
- 본 회차 원본 `hasPeriod`/`hasUnit` **20개×2 술어=40회 V8 격리 실행**. 관찰 결과 기간검사 true 12/20, 단위검사 true 8/20. `temporal_role=not_applicable`임에도 기간검사 true인 accounting_source #011/#012/#013/#014/#015/#017/#020 **7개**는 의미 불일치 후보. 원본 문서 기간은 `period_start`/`period_end` 별도로 존재하므로 개별 행의 날짜 요구 여부는 사람 검토 필요. 기존 [Draft PR #51](https://github.com/firmengine/firmengine/pull/51) 미병합; 중복 수정 없음.

## 재조회한 canonical ID별 문서/원문/단위/기간/대상 및 소비처

`P/U/A` = 원본 술어 기간검사/단위검사/family 적용조건 exact 등록. `Y`는 **계약·술어 확인**이지 실제 원문 판독 합격이 아니다. 출처 슬롯은 각 ID 1개. 두 문서의 `recordPolicy.noCrossRecordBorrowing=true`·`splitOn` 항목/주체/계좌/기간/상세행·요약/상세 중복합산 금지를 읽었으며 `required_source_anchor` 선언은 20/20 존재. 실제 페이지번호·bbox·복수행·증빙 인용·서명·당사자 일치 및 D1 재독은 **미관찰**.

| # | canonical field ID | 서류 / OCR family | 원본 datatype / canonical unit | temporal role / subject role | P/U/A | 정적 직접 소비처 |
|---:|---|---|---|---|:---:|---|
| 1 | `account_garnishment::account_holder` | `litigation_record/account_garnishment` | party_role / not_applicable | not_applicable / account_holder | N/N/Y | source-only; typed/calc/form/exact-legal 0 |
| 2 | `account_garnishment::account_id` | `litigation_record/account_garnishment` | identifier / not_applicable | not_applicable / account_holder | N/N/Y | source-only; typed/calc/form/exact-legal 0 |
| 3 | `account_garnishment::court_or_authority` | `litigation_record/account_garnishment` | party_role / not_applicable | not_applicable / account_holder | N/N/Y | source-only; typed/calc/form/exact-legal 0 |
| 4 | `account_garnishment::creditor` | `litigation_record/account_garnishment` | party_role / not_applicable | not_applicable / account_holder | N/N/Y | source-only; typed/calc/form/exact-legal 0 |
| 5 | `account_garnishment::effective_date` | `litigation_record/account_garnishment` | date / source date format normalized to ISO without loss | effective_date / account_holder | Y/N/Y | source-only; typed/calc/form/exact-legal 0 |
| 6 | `account_garnishment::garnishment_amount` | `litigation_record/account_garnishment` | money / currency and exact source unit if monetary | not_applicable / account_holder | N/Y/Y | source-only; typed/calc/form/exact-legal 0 |
| 7 | `account_garnishment::issue_date` | `litigation_record/account_garnishment` | date / source date format normalized to ISO without loss | document_issue_date / account_holder | Y/N/Y | source-only; typed/calc/form/exact-legal 0 |
| 8 | `account_garnishment::released_amount` | `litigation_record/account_garnishment` | money / currency and exact source unit if monetary | not_applicable / account_holder | N/Y/Y | source-only; typed/calc/form/exact-legal 0 |
| 9 | `account_garnishment::seized_amount` | `litigation_record/account_garnishment` | money / currency and exact source unit if monetary | not_applicable / account_holder | N/Y/Y | source-only; typed/calc/form/exact-legal 0 |
| 10 | `account_garnishment::status` | `litigation_record/account_garnishment` | category / not_applicable | not_applicable / account_holder | N/N/Y | source-only; typed/calc/form/exact-legal 0 |
| 11 | `accounting_source::account_name` | `financial_statement/accounting_source` | string / not_applicable | not_applicable / business_entity | Y/N/Y | source-only; typed/calc/form/exact-legal 0 |
| 12 | `accounting_source::closing_balance` | `financial_statement/accounting_source` | money / currency and exact source unit if monetary | not_applicable / business_entity | Y/Y/Y | source-only; typed/calc/form/exact-legal 0 |
| 13 | `accounting_source::credits` | `financial_statement/accounting_source` | money / currency and exact source unit if monetary | not_applicable / business_entity | Y/Y/Y | source-only; typed/calc/form/exact-legal 0 |
| 14 | `accounting_source::debits` | `financial_statement/accounting_source` | money / currency and exact source unit if monetary | not_applicable / business_entity | Y/Y/Y | source-only; typed/calc/form/exact-legal 0 |
| 15 | `accounting_source::entity` | `financial_statement/accounting_source` | party_role / not_applicable | not_applicable / business_entity | Y/N/Y | source-only; typed/calc/form/exact-legal 0 |
| 16 | `accounting_source::issue_date` | `financial_statement/accounting_source` | date / source date format normalized to ISO without loss | document_issue_date / business_entity | Y/N/Y | source-only; typed/calc/form/exact-legal 0 |
| 17 | `accounting_source::opening_balance` | `financial_statement/accounting_source` | money / currency and exact source unit if monetary | not_applicable / business_entity | Y/Y/Y | source-only; typed/calc/form/exact-legal 0 |
| 18 | `accounting_source::period_end` | `financial_statement/accounting_source` | date / source date format normalized to ISO without loss | statement_period_end / business_entity | Y/N/Y | source-only; typed/calc/form/exact-legal 0 |
| 19 | `accounting_source::period_start` | `financial_statement/accounting_source` | date / source date format normalized to ISO without loss | statement_period_start / business_entity | Y/N/Y | source-only; typed/calc/form/exact-legal 0 |
| 20 | `accounting_source::source_total` | `financial_statement/accounting_source` | money / currency and exact source unit if monetary | not_applicable / business_entity | Y/Y/Y | source-only; typed/calc/form/exact-legal 0 |

- 정확 typed 변환 선언 **0/20**; `MATERIAL_CALCULATION_SOURCES` 정확 canonical 계약 **0/20**; `OCR_DECLARED_FORM_TARGETS` 정확 서식 토큰 **0/20**; 95 법률위험/50규칙/46예외의 정확 canonical 정적 증거계약 **0/20**. 이는 **원천증거 무용·불필요 서류·법률상 미적용을 뜻하지 않음**. 법률위험 기본 카탈로그 95개 중 `required_features` 미기재 88개; 승인형 기준 seed `checks=[]`이며 **실 운영 편집 기준정보는 미조회**. 등록/승인되지 않은 법률 요건은 합격 처리하지 않음(0%).
- 계산 기준 `reference-decision-tables.json` **18계산/91 선언 입력/78 고유 경로**, 이번 20 canonical의 직접 typed 입력 및 서식 토큰 0. 단, `accounting_source::opening_balance/debits/credits/closing_balance/source_total`은 원장 대조 및 재무 검산에 필요할 수 있고, 서로 다른 기간·계정과목·회계주체 총계를 자동 영업소득으로 합산 금지.
- `account_garnishment::garnishment_amount/seized_amount/released_amount`는 압류 청구액/집행액/해제액의 각기 다른 법적 상태·시점의 원천 증거이다. 채무원금·상환액에 자동 더하거나 차감 금지. 발급일·효력일·기관·계좌 명의·채권자를 구별하고 법원 보정·자료갈음·제출수리 여부는 사건/원문 기준 별도 검토해야 함. 정확 갈음·보정 자동 승인 소비처 **이번 정적 조회에서 입증되지 않음**. `source-only` 보존.
- D1 스키마 `extraction_records`/ `extracted_features`/`extraction_field_coverage`를 `lib/extraction-row-store.ts`에서 확인. 필드 `raw_value_json`, `source_state`, 문서·페이지·복수행 인덱스·원본 해시는 저장 계약으로 존재하지만 실제 환경에 대해 read-back **0건 관찰**. `not_seen/null/0/explicit_none/conflicting/not_applicable`를 서로 다른 상태로 계속 유지.

## P1 결함 후보 — 원본 source-state 수용 로직 실제 격리 재현
- `lib/extraction-row-store.ts`의 원본 `bindField()`는 sourceState가 **undefined인 null**에서 `SOURCE_STATE_REQUIRES_REVIEW`를 부여하지 않으며, `explicit_none`은 인용/좌표가 없어도 예외 처리. `lib/ocr-calculation-input.ts`의 원본 `calculationSourceCellIssues()`는 비-present 상태에서 경고를 반환하지 않으므로 **`validation_status=source_only` 및 `observed_source_only`로 잘못 표시될 후보**이다. 실제 고객/법원 판정 오작동은 미재현.
- 원본 GitHub 함수 본문을 실제 분리해 **V8 격리 실행**한 합성 입력/독립 기대/관찰:
  
  | 합성 입력 | 독립 기대 | 원본 관찰 | Draft 수정 격리 관찰 |
  |---|---|---|---|
  | `value:null, sourceState:undefined, quote:null` | source_review_required | **source_only (불일치)** | source_review_required |
  | `value:null, sourceState:unknown` | source_review_required | source_review_required | source_review_required |
  | `value:null, sourceState:explicit_none, quote:null, bbox:null` | source_review_required | **source_only (불일치)** | source_review_required |
  | `value:null, sourceState:explicit_none, quote:없음, valid bbox` | source_only (원천만) | source_only | source_only |
  | `value:0, sourceState:present, quote:0` | source_only (원천만) | source_only | source_only |
  | `value:수익, sourceState:undefined, quote:수익` | source_only (원천만) | source_only | source_only |

- **수정안 6/6 독립 기대 일치(격리 함수 수준)**. 합성 SQL 회귀 테스트를 코드로 추가했으나 **실제 Node/SQLite 실행 결과는 없음**. Draft [PR #99](https://github.com/firmengine/firmengine/pull/99), 브랜치 `audit/a3-r36-source-state-evidence-20261101`, 검토용 HEAD `85e505ed09fe828c9349218cf0430b161d71ef15`. 정확히 `lib/extraction-row-store.ts`(+9/-1)와 `tests/extraction-row-store.test.ts`(+35/-0)만 변경. `main` 제품 코드 미수정. 법률·계산 규칙 변경 안 함. DB/AX 담당자 영향 및 Node 회귀 후 병합 여부 판단.

## 개별 체크 ID / 소비처 공백 누적 / 검증 수준
| 체크 ID | 담당 | 실제 증거와 공백 | 상태 |
|---|---|---|---|
| A3-AX-002 | AX | 20/20 원천 필드 선언·source-only 보존 경로, null/none 거짓 완료 2 반례; 전체 OCR 모델 E2E 미실행 | **부분 [ ]** |
| A3-IT-014 | IT | `bindField` 6개 합성격리, null/none 계약 불일치; PR #99에 SQLite 회귀 **추가만**, 실행/CI 미인증 | **부분 [ ]** |
| A3-DATA-003 | 데이터 | 20원천 슬롯·anchor, raw 상태/DB Fact 계약, typed0/calc0/form0/legal0; 실제 SQL readback 미관찰 | **부분 [ ]** |
| A3-LAW-017 | 변호사 | 95/50/46 정적 계약과 #001–020 exact evidence 0; 실 운영 승인 계약·관할/시행일·공식 법률 해석 미인증 | **부분 [ ]** |
| A3-DOC-005 | 서류 | 압류 서류·명의·기간·원본·채권자 분리 및 갈음/보정 위험, 실제 상담/서류·법원 요구/승인 미관찰 | **부분 [ ]** |

**검증 수준:** 원문 계약 정적 전수 조인(693/693 ID, 1,808 라우트), 개별 20 ID 실조회, hasPeriod/hasUnit 원본 함수 **40회**, bindField/계산 단위 원본 조각 합성 **6케이스 V8**, PR **코드 작성 및 blob SHA 재독/2파일 diff 확인**. `node --test`/전체 CI, 운영 또는 staging D1/R2/Cron, 법원 공식 서식·변호사 승인, 사이트 배포/전자제출 **수행하지 않음**. [x] 승격 0건.

**다음 시작:** #021 `applicant_narrative_statement::identity.statement.admission_or_correction` ~ #040, **계산사무장 시작**. #001–020 문제는 재검증/수정안 리뷰 대상으로 계속 유지. 새 서류/피처 자동 폐기·원화합산·법률 확정 금지.
