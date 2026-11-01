# FirmEngine A3 r55 — OCR canonical #381–400 심층 소비처 재감사 (2026-11-01 19:31 KST)

## 실행원본·범위·검증수준
- GitHub `firmengine/firmengine` `main` 시작 SHA: `9d0a1c19288cd0ec777883206d1db4966894546d`; 작업 위치는 `prototypes/Daeseong Ray Yang/firmengine-proto/ax-site/` 내부로 한정. 직전 r54 #361–380 및 선행 r20 #381–400 영수증, 단일 `docs/PRODUCT_RELEASE_INTEGRATION_BOARD.md`, 최근 메인 커밋/열린 PR(#131, #51, #63, #54 등) 확인. 이전 영수증을 현재 인수 통과로 승격하지 않음.
- 담당자 순환: **데이터 → IT → 사용자·서류 → 계산사무장 → 변호사**. 미완료 부분 체크: `A3-DATA-002`, `A3-IT-017`, `A3-DOC-006`, `A3-CALC-008`, `A3-LAW-015` (모두 `[ ]` 보존). 다음 담당자 **AX**.
- 실행 방식: GitHub `main`의 원문 JSON·TypeScript를 읽어 **독립 JS 정적 조인** 및 원본 `hasPeriod`/`hasUnit`/`canonicalProjectionKey`/`reviewScope`의 함수 본문을 V8에 격리 실행. 합성 입력만 사용. **Node 프로젝트 테스트/전체 CI, 실제 OCR 모델, D1 Fact 읽기·쓰기, R2/Cron, 공식 법원 서식/변호사 승인, 운영 배포는 미실행·미인증.**

## 원본 파일 blob SHA
- `lib/canonical-field-id-index.json` — `27ecdddd208de82a2f5c675e7482485e3a8838c2`
- `lib/ocr-field-supplements.json` — `63b2bf853acb2e9620a6fb72377dc278ff3cd2a5`
- `lib/document-agent-field-contracts.json` — `9884b3fecf44643fefcdc4a421ed66ffc5477b3a`
- `lib/shared-document-field-contracts.json` — `9decab974e0909ae24ad927bdfe241d75b71f3a9`
- `lib/field-applicability-contracts.json` — `6076b26f782c4643a21a7b2f1a8f6261bb588b68`
- `lib/reference-decision-tables.json` — `6924e3977caf748ce8a3d617fae15aff7d2fe2ce`
- `lib/risk-catalog.json` — `e96dd0926e3ae9be5a5573d4551538ba294c4d2e`
- `lib/legal-exceptions.json` — `6e51197226bfd8320e1147d8df3f12c11e00927c`
- `lib/legal-catalog.json` — `b0898d74f1df69b19ecf6e81cdff0ed09e8d885e`
- `lib/feature-lineage-audit.ts` — `de81bc3b8c460b8a4dde3fda9e13087e619e74ff`
- `lib/canonical-field-binding.ts` — `60ee5c7762d52b72a165b4f4f8214680eb98f148`
- `lib/ocr-chain-matrix.ts` — `977de86ba698bd805cc6b95d1384e3b49d0dbb4c`
- `lib/legal-evidence-criteria.ts` — `6c0b94535700d4fa4d356f8a91d5b9440b5ac52a`
- `lib/material-calculation-source-gate.ts` — `0286b44484913b63fa8ec3f7bf0ca59b034d0dab`
- DB/요구·갈음/보정 관련 실제 코드: `db/schema.ts`(extraction_records/extracted_features/extraction_field_coverage/case_calculation_features/case_document_field_values), `lib/case-requirement-field-plan.ts`(`mappingStatus:review_required`), `lib/approve-document-substitution.ts`(담당자·근거 검토), `lib/preapproval-correction-item-store.ts`(`requiredCanonicalFieldIds`, 문서/page·기한·source 대조). 과거 기존 테스트: `tests/feature-lineage-audit.test.ts`, `tests/insurance-source-slots.test.ts`, `tests/ocr-calculation-db-contract.test.ts`, `tests/material-calculation-source-gate.test.ts` (테스트 **존재 확인**, 이번 Node 실행 영수증 아님).

## 독립 입력 → 기대 → 관찰
| 검사 입력 | 독립 기대 | 실제 관찰 | 검증 등급 |
|---|---|---|---|
| 최신 canonical + base families + 85문서 확장/보강 source 조인 | 고유 693, 문서 85, family 48, 원천 1808, 중복·고아 0 | **693 / 85 / 48 / 1808**, 인덱스 중복·고아 0 | JS 정적 구조 |
| 순번 #381–400 및 source route 전수 | 20 ID, 33 route, 3 문서 | **20 / 33 / 3**, 상속 7×1, 보험 13×2 | 정확 source 슬롯 |
| route별 locator, recordPolicy | 원본 문서+page+quote/bbox/record anchor 선언, 행간 차용 금지 | **33/33 anchor**, **33/33 noCrossRecordBorrowing** | 선언 검사, 저장 원문 아님 |
| exact field-applicability | 7 상속 확장 ID 미등록, 13 보험 원천 등록 | **13/20 등록**, **7/20 미등록(#381–387)** | 미등록 각 항목 승인 **0%** |
| exact typed binding 및 계산·서식·법률 | #388 `asset.as_of`만 직접 typed, 계산 입력 exact 0, 29 material 키 exact 0, 내부 token 0, 법률 계약 exact 0 | **typed 1/20, source-only 19/20, calc 0, material 0, token 0, exact legal 0** | 정적 후보/사용여부 구분 |
| 18 계산·91 선언 입력(78 고유), 위험95·규칙50·예외46 | 전부 유지, 위험 미정의88, 법률 seed checks=[] | **18/91/78, 95/50/46, 88 미정의**, 법률 seed 빈 값 | 승인형 runtime DB 별도 |
| 실제 원본 `hasPeriod`×33/`hasUnit`×33 | 명시적 시간 role 8 route, 수량/금전/ratio unit 7 route | **P true 8/33, U true 7/33**; 독립 role/type 기대와 일치 | 원본 함수 V8 |
| 실제 원본 `reviewScope`×3 | inheritance/insurance family는 일반 D5101/D5110 후보, spouse 합성은 SEOUL-406 | **3/3 동일**; 상속·보험 전문 법률 근거의 승인 증명 아님 | 원본 함수 V8 |
| 독립 조건 단언 | 전역·슬롯·등록·계산·법률·원본 술어의 조건 전부 일치 | **37/37** | 정적·격리 함수, 통합인증 아님 |

## ID별 원천→DB Fact/typed→산식·법률·서식 소비처 표
P/U는 원본 함수가 true인 route 수/전체 route 수. source unit과 subject/temporal은 **원천 선언**이지 현재 사건의 관찰 사실이 아님. 마지막 칸의 0은 `material` / 91입력 exact typed / `OCR_DECLARED_FORM_TARGETS` exact token / 위험95·규칙50·예외46에 정확 canonical ID 계약 수. `source-only`는 **증거 보존 대상**.
| # | canonical ID | 서류 / route 수 | datatype / 원단위 | 대상 / 기간 | P/U | 적용조건 | DB Fact → typed | material/18calc/form/exact legal |
|---|---|---|---|---|---|---|---|---|
| 381 | `inheritance_records::filing_or_order_reference` | `inheritance_records` (1) | `identifier` / not_applicable | `document_subject` / `not_applicable` | 0/1 · 0/1 | **미등록/승인 0%** | source-only | 0/0/0/0 |
| 382 | `inheritance_records::heir` | `inheritance_records` (1) | `party_role` / not_applicable | `document_subject` / `not_applicable` | 0/1 · 0/1 | **미등록/승인 0%** | source-only | 0/0/0/0 |
| 383 | `inheritance_records::heir_relationship` | `inheritance_records` (1) | `relationship_enum` / not_applicable | `document_subject` / `not_applicable` | 0/1 · 0/1 | **미등록/승인 0%** | source-only | 0/0/0/0 |
| 384 | `inheritance_records::inherited_asset_id` | `inheritance_records` (1) | `identifier` / not_applicable | `document_subject` / `not_applicable` | 0/1 · 0/1 | **미등록/승인 0%** | source-only | 0/0/0/0 |
| 385 | `inheritance_records::partition_agreement_date` | `inheritance_records` (1) | `date` / not_applicable | `document_subject` / `source_date_time_or_period` | 1/1 · 0/1 | **미등록/승인 0%** | source-only | 0/0/0/0 |
| 386 | `inheritance_records::stated_share` | `inheritance_records` (1) | `ratio` / source fraction | `document_subject` / `not_applicable` | 0/1 · 1/1 | **미등록/승인 0%** | source-only | 0/0/0/0 |
| 387 | `inheritance_records::succession_opened_at` | `inheritance_records` (1) | `date` / not_applicable | `document_subject` / `source_date_time_or_period` | 1/1 · 0/1 | **미등록/승인 0%** | source-only | 0/0/0/0 |
| 388 | `insurance_policy_asset::as_of_date` | `insurance_loan_statement`, `insurance_surrender_statement` (2) | `date` / source date format normalized to ISO without loss | `contract_holder` / `valuation_as_of_date` | 2/2 · 0/2 | 등록(원천 조건 전용) | `asset.as_of` | 0/0/0/0 |
| 389 | `insurance_policy_asset::beneficiary` | `insurance_loan_statement`, `insurance_surrender_statement` (2) | `party_role` / not_applicable | `contract_holder` / `not_applicable` | 0/2 · 0/2 | 등록(원천 조건 전용) | source-only | 0/0/0/0 |
| 390 | `insurance_policy_asset::contract_holder` | `insurance_loan_statement`, `insurance_surrender_statement` (2) | `party_role` / not_applicable | `contract_holder` / `not_applicable` | 0/2 · 0/2 | 등록(원천 조건 전용) | source-only | 0/0/0/0 |
| 391 | `insurance_policy_asset::coverage_amount` | `insurance_loan_statement`, `insurance_surrender_statement` (2) | `money` / currency and exact source unit if monetary | `contract_holder` / `not_applicable` | 0/2 · 2/2 | 등록(원천 조건 전용) | source-only | 0/0/0/0 |
| 392 | `insurance_policy_asset::end_date` | `insurance_loan_statement`, `insurance_surrender_statement` (2) | `date` / source date format normalized to ISO without loss | `contract_holder` / `effective_date` | 2/2 · 0/2 | 등록(원천 조건 전용) | source-only | 0/0/0/0 |
| 393 | `insurance_policy_asset::insured` | `insurance_loan_statement`, `insurance_surrender_statement` (2) | `party_role` / not_applicable | `contract_holder` / `not_applicable` | 0/2 · 0/2 | 등록(원천 조건 전용) | source-only | 0/0/0/0 |
| 394 | `insurance_policy_asset::insurer` | `insurance_loan_statement`, `insurance_surrender_statement` (2) | `party_role` / not_applicable | `contract_holder` / `not_applicable` | 0/2 · 0/2 | 등록(원천 조건 전용) | source-only | 0/0/0/0 |
| 395 | `insurance_policy_asset::issue_date` | `insurance_loan_statement`, `insurance_surrender_statement` (2) | `date` / source date format normalized to ISO without loss | `contract_holder` / `document_issue_date` | 2/2 · 0/2 | 등록(원천 조건 전용) | source-only | 0/0/0/0 |
| 396 | `insurance_policy_asset::pledge` | `insurance_loan_statement`, `insurance_surrender_statement` (2) | `category` / not_applicable | `contract_holder` / `not_applicable` | 0/2 · 0/2 | 등록(원천 조건 전용) | source-only | 0/0/0/0 |
| 397 | `insurance_policy_asset::policy_id` | `insurance_loan_statement`, `insurance_surrender_statement` (2) | `identifier` / not_applicable | `contract_holder` / `not_applicable` | 0/2 · 0/2 | 등록(원천 조건 전용) | source-only | 0/0/0/0 |
| 398 | `insurance_policy_asset::policy_loan_balance` | `insurance_loan_statement`, `insurance_surrender_statement` (2) | `money` / currency and exact source unit if monetary | `contract_holder` / `not_applicable` | 0/2 · 2/2 | 등록(원천 조건 전용) | source-only | 0/0/0/0 |
| 399 | `insurance_policy_asset::policy_status` | `insurance_loan_statement`, `insurance_surrender_statement` (2) | `category` / not_applicable | `contract_holder` / `not_applicable` | 0/2 · 0/2 | 등록(원천 조건 전용) | source-only | 0/0/0/0 |
| 400 | `insurance_policy_asset::premium_per_payment` | `insurance_loan_statement`, `insurance_surrender_statement` (2) | `money` / currency and exact source unit if monetary | `contract_holder` / `not_applicable` | 0/2 · 2/2 | 등록(원천 조건 전용) | source-only | 0/0/0/0 |

## 발견·검토 경계
1. **P2 계약 공백 — 상속 7개 확장 피처 #381–387.** `shared-document-field-contracts.json`에 해당 행이 source-only로 선언되어 있지만 `field-applicability-contracts.json`에는 **정확한 canonical ID가 없음**. 근거 문구가 확장 `semantic_source_rule`에 있더라도 별도 승인된 적용조건 계약과 같지 않다. 7개 모두 적용조건 검증 0%/미완료. `not_applicable`·0원으로 대체하거나 제거 금지. 대상 상속인/피상속인·자산ID·지분·상속개시/협의분할일·공식 상속증빙을 사람 검토.
2. **P2 검토 후보 — 보험 기준일·역할 결속.** #388 평가기준일 `hasPeriod=true`, #398 약관대출잔액과 #400 회당보험료 `temporal_role=not_applicable`→원본 `hasPeriod=false`; 이는 개별 필드의 *기간 필수 플래그*이지 동일 보험증권의 평가일 검산·원단위·관계자 검증이 불필요하다는 뜻은 아님. #389 수익자/#390 계약자/#393 피보험자/#394 보험자 원천 role이 모두 `contract_holder` 앵커로 등록되었지만 서로 같은 사람이란 뜻이 아님. 실제 타인 오연결/계산 잘못은 이번에 재현하지 않았으므로 정책·타입을 무단 변경하지 않음.
3. **금액 의미 분리:** #386 `source fraction`은 원화 금액이 아닌 지분. #391 보장금액, #398 약관대출잔액, #400 납부보험료는 서로 다른 경제적 의미. #403(다음 회차) 해약환급금과 중복 합산·이중 차감 금지. 환급금의 대출 차감 전/후, #401 `refund_net_basis`, #388 가치기준일, 증권 계약번호, 계약자와 대상 동일성은 후속 검산·역질문으로 유지. 이번 20 ID material exact 0은 '무가치한 피처' 판정이 아님.
4. **소비처와 법률 인정:** 원본 `reviewScope(asset_transfer_disposition/insurance_policy_asset)`의 D5101/D5110 및 KR-ACT/서울 준칙 ID는 포괄적 *검토 후보*일 뿐 법률상 인정/공식 전자서식 token/실제 계산 소비로 승격하지 않는다. 위험95 기본 `required_features` 미정의 88, 운영 기준정보 `checks`는 **이번에 조회하지 못함**. 코드 seed=[]는 운영 승인건수 0이라고 단정하는 근거가 아니다. 정확 필드 등록과 실무자 승인·관할·시행일 대조 전에는 각 미등록/미승인 요건 **0%**.
5. **DB·갈음·법원보정:** SQL에 `extraction_records`·`extracted_features`·`extraction_field_coverage` 및 법원 보정항목 version/head가 선언되어 있고, 사건별 `requiredCanonicalFieldIds`/원본 source quote/관련 서류·기한 검토 경로가 존재. **이번 33 route의 D1 실제 Fact·원문 문서/page/복수행/대상/기간·승인상태 및 대체서류/보정명령 실사건 소비는 미관찰**. 문서·금전·상속 법적 의미를 임의 확정하지 않음.

## 체크 ID 부분 영수증 / 다음 시작
- `A3-DATA-002`: 693/693 최신 인덱스, 85/48/1808 조인, #381–400의 33슬롯·3문서 정확 대조; DB 영수증 없음.
- `A3-IT-017`: 33/33 locator/no-cross-record 정책과 `db/schema.ts` source columns의 정적 증거; 원본 source SHA/실 DB 재독 미실행.
- `A3-DOC-006`: 보험증빙 2문서×13 필드=26 route의 소유·보험계약·해약·약관대출 증거/보정 후보; 문서 요청·갈음 E2E 미검증.
- `A3-CALC-008`: #388/391/398/400의 날짜·보장금액·대출잔액·보험료 분리, 18계산/91입력 direct 0; 정책 승인 및 계산 E2E 미검증.
- `A3-LAW-015`: 법률 95·50·46 정적 원본과 승인 seed 빈 값; 상속 7개 미등록·보험 전체 정확 법률 증거계약 0; 변호사·공식 근거 미승인.
- **검증 수준:** 37/37 JS 정적·원본 함수 조건 일치 + `hasPeriod` 33회·`hasUnit` 33회 + `reviewScope` 3회, V8 격리. 이는 **전체 Node·CI/D1·R2/Cron/공식 서식/변호사/사이트/실제 전자제출 통과와 다름**.
- **누적 심층 재감사 #001–400 / 693 (57.7%)**, 293개 남음. **다음 시작 #401 `insurance_policy_asset::refund_net_basis` → #420**, 다음 시작 담당자 **AX담당자**. A3 체크 총 124개 **최종 완료 0개**. 공개 Git에 개인정보·실고객 원본/OCR 사실값·키/.env·비공개 정답 미포함. 운영 배포·D1 운영 migration·전자제출·법원 인가 확정 미실행.
