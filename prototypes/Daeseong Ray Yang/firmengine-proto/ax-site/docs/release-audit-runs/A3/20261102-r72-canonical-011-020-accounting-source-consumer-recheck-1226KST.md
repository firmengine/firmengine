# FirmEngine A3 r72 — canonical #011–020 회계 원천 증거·소비처 재감사

**작성일:** 2026-11-02 KST · **시작 GitHub main HEAD:** `9ba5864b18c60fca8a49b89ef3b96cc48f940a34` · **범위:** `prototypes/Daeseong Ray Yang/firmengine-proto/ax-site/` 내 문서만. [r71](20261102-r71-canonical-001-010-unresolved-consumers-1127KST.md)의 다음 ID #011부터 실제 조회. **역할:** 데이터 → IT → 사용자·서류 → 계산사무장 → 변호사 (다음 AX부터). **체크 ID:** `A3-DATA-008`, `A3-IT-007`, `A3-DOC-007`, `A3-CALC-015`, `A3-LAW-009`. 모두 **[ ] 미완료**.

## 1. 원천 계약 693개·85/48/1,808 실제 최신 기준 정적 결합

`lib/canonical-field-id-index.json`의 **693개 canonical ID**를 최종 절에 실제 순번으로 열거. 중복 0. `reference-intake-catalog.json`의 85 서류에서 사용된 family + 공유계약 + supplement를 실제 JS 반복으로 연결한 결과 **48 추출 패밀리, 1,808 declared source field slots, 고아 ID 0, 미등록 source ID 0**. 이번 정확 ID **#011~020 10개 / 10개 문서-family 슬롯**, 공개 서류 `financial_statement` 1종 / 추출 family `accounting_source` 1개. `financial_statement`는 `accounting_source`와 `business_costs_and_ledgers` 두 패밀리를 허용하지만 이번 10 canonical은 전자에만 속한다. `recordPolicy.sourceOnly=true`, `noCrossRecordBorrowing=true`, `summaryPolicy=separate_summary_from_detail_do_not_double_count`를 읽었으며 **실제 DB 원문·페이지·복수행 보존을 실증한 것은 아니다**.

구조 검사: ID×원천행 등록 **10/10**, 정확 sourceCondition **10/10 등록**(법적 승인 아님), 원문 locator 선언 **10/10**. 문서별 `source_document_id / source_named_subject / source_entity_or_item_id / source_period_if_applicable / source_row_or_paragraph_ordinal` 분리 계약 확인. 원문 해시·페이지·bbox·quote의 실제 내용/row read-back **0건**.

P/U/A/L/X = 원본문 `hasPeriod`/ `hasUnit` 결과, 정확 sourceCondition, 원천 locator, cross-record 차용 금지 선언. 각 필드 단일 `financial_statement/accounting_source` 슬롯이고 주체 `business_entity`.

| 순번 | 정확 canonical ID | datatype | 원문 단위 보존 계약 | 시간역할 / 대상 | 적용조건(등록, 미승인) | P/U/A/L/X | typed / material / exact form / 승인 legal |
|---:|---|---|---|---|---|:---:|---|
| 011 | `accounting_source::account_name` | `string` | `not_applicable` | `not_applicable` / `business_entity` | `ledger category` | Y/N/Y/Y/Y | 0 / 0 / 0 / 0 (source-only) |
| 012 | `accounting_source::closing_balance` | `money` | `currency and exact source unit if monetary` | `not_applicable` / `business_entity` | `period closing` | Y/Y/Y/Y/Y | 0 / 0 / 0 / 0 (source-only) |
| 013 | `accounting_source::credits` | `money` | `currency and exact source unit if monetary` | `not_applicable` / `business_entity` | `period totals` | Y/Y/Y/Y/Y | 0 / 0 / 0 / 0 (source-only) |
| 014 | `accounting_source::debits` | `money` | `currency and exact source unit if monetary` | `not_applicable` / `business_entity` | `period totals` | Y/Y/Y/Y/Y | 0 / 0 / 0 / 0 (source-only) |
| 015 | `accounting_source::entity` | `party_role` | `not_applicable` | `not_applicable` / `business_entity` | `person/business entity` | Y/N/Y/Y/Y | 0 / 0 / 0 / 0 (source-only) |
| 016 | `accounting_source::issue_date` | `date` | `source date format normalized to ISO without loss` | `document_issue_date` / `business_entity` | `issue date` | Y/N/Y/Y/Y | 0 / 0 / 0 / 0 (source-only) |
| 017 | `accounting_source::opening_balance` | `money` | `currency and exact source unit if monetary` | `not_applicable` / `business_entity` | `period opening` | Y/Y/Y/Y/Y | 0 / 0 / 0 / 0 (source-only) |
| 018 | `accounting_source::period_end` | `date` | `source date format normalized to ISO without loss` | `statement_period_end` / `business_entity` | `covered period` | Y/N/Y/Y/Y | 0 / 0 / 0 / 0 (source-only) |
| 019 | `accounting_source::period_start` | `date` | `source date format normalized to ISO without loss` | `statement_period_start` / `business_entity` | `covered period` | Y/N/Y/Y/Y | 0 / 0 / 0 / 0 (source-only) |
| 020 | `accounting_source::source_total` | `money` | `currency and exact source unit if monetary` | `not_applicable` / `business_entity` | `source aggregate, basis` | Y/Y/Y/Y/Y | 0 / 0 / 0 / 0 (source-only) |

`canonical-field-binding.ts` 원본 함수본문에서 TS 형식 표기만 제거한 **14개 V8 격리 입력**: 10개 정확 ID-로컬키 결속 **10/10**, 타 canonical-field와 로컬키 상충 차단 **1/1**, 타 family ID 거부 **1/1**, 선언된 정확 local-key-only 결속 **1/1**, 미등록 키 `unbound` **1/1** → 총 **14/14 동작 독립 기대 일치**. 잘못된 키 `account_name` + ID `accounting_source::closing_balance`는 `canonical_id_key_conflict`로 `null`; `debits` + ID `account_garnishment::seized_amount`는 `canonical_id_outside_family`로 `null`. 여기서 함수 성공은 실제 OCR 인식률/DB 저장 성공을 의미하지 않는다.

## 2. 정확 소비처와 공백 (읽은 실제 코드 및 계약)

- **물리 DB 원천:** `db/schema.ts`의 `extraction_records`, `extracted_features` 및 `drizzle/0008_normalized_extractions.sql`, `0016_source_field_coverage.sql`의 `canonical_field_id/raw_value_json/source_state/quote/bbox_json/projection_key` 저장 스키마 존재. `extraction-row-store.ts` 원본에 document/page/record ordinal, 원문 해시·키 결속과 관찰 상태를 처리하는 경로 존재. **실 D1 Fact·typed 객체 read-back 0**.
- **직접 typed:** `canonical-field-binding.ts`의 `projections` 맵에 `accounting_source`가 없음. #011~020 모두 정확 직접 **0/10**, 의미상 무용/삭제가 아님.
- **계산:** `reference-decision-tables.json`은 18계산 / 91 선언 입력(78 고유). `material-calculation-source-gate.ts`의 `MATERIAL_CALCULATION_SOURCES`에 이번 10 canonical **직접 0**. 회계 잔액·차변·대변·총액은 영업매출/순소득/채무/자산 현가로 자동 변환할 수 없다. `families.accounting_source.special_findings`의 원장 기초+흐름+기말 검산은 **검토 후보 선언**일 뿐, 정확 승인 산식/실행된 검산 영수증이 아니다. 계정별 차대변 성격·기준일·기간·회계주체·분개형식을 확인하기 전 일률적 단순 합계를 만들지 않는다.
- **법률:** `risk-catalog.json` 위험95 / `legal-catalog.json` 규칙50 / `legal-exceptions.json` 예외46 선언 검토. `legal-evidence-criteria.ts`의 seed `checks=[]`; #011~020 정확 승인 정적 법률증거계약 **0/10**. 업무용 후보 `reviewScope(accounting_source)`에서 `D5103/D5110`, `KR-ACT-579/KR-ACT-611` 등이 제안되더라도 공식 서식 토큰·증거 법률승인은 아님. 운영 관리형 승인정책·관할·시행일/법원·변호사 승인 **미조회**로 해당 게이트 합격 0%.
- **정확 서식:** `ocr-chain-matrix.ts`의 `OCR_DECLARED_FORM_TARGETS`에 #011~020 명시 토큰 **0/10**. 일반 서식 후보와 `form-mapping.ts`의 context/derived 필드를 혼동 금지, 실제 공식 Word·법원 토큰 바인딩 **미인증**.
- **서류·갈음·보정:** 원천서류 `financial_statement`는 독립 원천 증거. `document-substitution.ts` 및 `preapproval-correction-audit.ts` 정적 경로 확인; 회계증빙을 다른 장부나 거래명세로 **자동 갈음/법원보정 충족 판정한 실행 증거 0건**. 근거 없는 null/0/비해당/갈음 승격 금지.

## 3. 원본문 격리 검증 — 명확한 기대와 관찰

### 3.1 시간역할과 데이터타입 구분 술어 20회

`feature-lineage-audit.ts`의 `hasPeriod(role,family)`, `hasUnit(datatype)` **원본 JS 술어를 직접 컴파일해 각 10회 실행**. 단위판정은 업무 기대 10/10 일치. `hasPeriod`는 회계 family 이름을 일괄 검사하므로 **10/10 true**, 그중 명시 `temporal_role=not_applicable` 필드 #011/#012/#013/#014/#015/#017/#020의 **7개도 true**이다. 독립 **필드 수준 role-only** 기대와는 3/10만 일치. 이는 **문서 전체 기간 요구**가 타당할 수도 있으므로 **제품 오류나 법적 요건 결함으로 단정하지 않는다**. 필드별 기간요건과 문서별 회계기간 식별 요구를 별도 플래그로 분리할지 실무자 검토 필요. 기존 [Draft PR #51](https://github.com/firmengine/firmengine/pull/51) 미병합·영향범위 중첩 확인, 자동수정 금지.

| 유형 | 입력 | 독립 필드 역할 기대 | 원본 실제 |
|---|---|---|---|
| time role `not_applicable` | #011/012/013/014/015/017/020 | 필드 자체 period=false | family 조건 때문에 period=true (7건) |
| document/statement period | #016/#018/#019 | period=true | period=true (3건) |
| money datatype | #012/#013/#014/#017/#020 | unit=true | unit=true (5건) |
| nonmoney datatype | #011/#015/#016/#018/#019 | unit=false | unit=false (5건) |

### 3.2 `calculationSourceCellIssues` 원본 함수본문 12개 합성 입력

`ocr-calculation-input.ts`의 `validDate/validTime/calculationSourceCellIssues` **원본문을 TS 표기만 제거해 V8에서 격리 실행**. `normalizeMoney`만 **가상 KRW 정수 판별 stub**으로 대체했으므로 USD/KRW 시나리오는 진짜 domain 정상화/환율 검증이 아님. 사용한 값은 공개 가능한 가상 숫자·날짜·문구뿐이다. 결과는 현재 함수 반환 기대와 **12/12 일치**, 업무상 숫자 승인 합격률이 아니다.

| 합성 시나리오 | ID | 입력 type / value / unit / sourceState | 사전 예상 반환 | 실제 관찰 반환 |
|---|---|---|---|---|
| closing missing unit | #012 | `money` / `1000` / null / present | `SOURCE_MONETARY_UNIT_MISSING` | `SOURCE_MONETARY_UNIT_MISSING` |
| credits exact KRW | #013 | `money` / `1234` / KRW / present | `[]` | `[]` |
| debits foreign currency | #014 | `money` / `1234` / USD / present | `SOURCE_MONEY_NOT_EXACT_KRW` | `SOURCE_MONEY_NOT_EXACT_KRW` |
| opening not_seen | #017 | `money` / null / null / not_seen | `[]` | `[]` |
| source_total observed 0 | #020 | `money` / `0` / KRW / present | `[]` | `[]` |
| invalid period end | #018 | `date` / `2026-02-30` / null / present | `SOURCE_DATE_INVALID` | `SOURCE_DATE_INVALID` |
| valid period start | #019 | `date` / `2026-01-01` / null / present | `[]` | `[]` |
| invalid issue date | #016 | `date` / `not-a-date` / null / present | `SOURCE_DATE_INVALID` | `SOURCE_DATE_INVALID` |
| conflicting amount | #012 | `money` / `1000` / KRW / conflicting | `[]` | `[]` |
| quote absent | #012 | `money` / `1200` / KRW / present | `SOURCE_QUOTE_MISSING` | `SOURCE_QUOTE_MISSING` |
| present blank | #014 | `money` / blank / KRW / present | `SOURCE_PRESENT_VALUE_MISSING` | `SOURCE_PRESENT_VALUE_MISSING` |
| explicit_none | #017 | `money` / null / null / explicit_none | `[]` | `[]` |

상태 경계: `not_seen`/null은 미관찰, `explicit_none`은 원문의 '없음' 주장, `present`+0은 관찰된 영, `conflicting`은 상충 증거, `source-only`는 저장 활용도, `not_applicable`은 승인 필요 판정이다. `sourceState!='present'`의 형식 오류목록 `[]`는 '진실·법률·계산 합격'이 아닌 **형식검사 미적용**으로 분리. `source_total`과 `credits`/`debits` 합산시 총계 중복 가능성은 **검산·역질문 후보**, 합법 자동 산식 미정.

### 3.3 독립 체크 ID 5개 — 모두 미완료

| 역할 → Board ID | 실행한 근거 | 미완료 이유 |
|---|---|---|
| 데이터 `A3-DATA-008` | #011~020 정확 원천 10슬롯, `business_entity`+문서/계정/기간/원천행 분리 계약 확인; 693/85/48/1808 전체 독립 static join | 실제 D1 복수 원장행/행 ID, 동일 사업자 다계정·다기간 교차 참조 미관찰 |
| IT `A3-IT-007` | 타입·원단위 10/10, hasPeriod/hasUnit 20 실행과 기간 플래그 7건 상충 기록 | 실제 타입변환/단위화 및 PR #51 범위·법률 기간정책 승인 미검증 |
| 사용자·서류 `A3-DOC-007` | `financial_statement`/회계 `accounting_source`의 원천서류 ID, 주체·계정·기초/기말·차대변·기간 분리 정적 확인 | 사업자등록/매출·세금·거래자료 대조·갈음/보정·직원 검토 미실행 |
| 계산사무장 `A3-CALC-015` | 총액 `source_total` vs 기초/기말/차대변 분리, 18계산·91입력 직접계약 0, 12 format-cell 시나리오 | 총계·상세 이중산입 실계산, 차대변 부호정의·회계기준 검토 없음 |
| 변호사 `A3-LAW-009` | 사업 회계원천과 지속소득 인정의 증거 의미 분리, 95/50/46 정적 계약·approved seed 0 | 공식 관할/시행일·법률판단/변호사 승인·실제 인정소득 검증 없음 |

[Draft PR #39](https://github.com/firmengine/firmengine/pull/39) 문서별 사업자/행 ID 충돌, [Draft PR #99](https://github.com/firmengine/firmengine/pull/99) 미관찰·명시 없음 source-only 거짓 표시, [Draft PR #51](https://github.com/firmengine/firmengine/pull/51) 기간 과잉 경고는 **열린 미병합 후보**. 이 회차에 중복·법률 의미 수정이나 새 PR은 작성하지 않음.

**검증 등급:** 실제 GitHub 원본·정적 JSON/TS 조인 + 원본문 격리 V8 14 binding/20 predicate/12 format = 총 **46회 동작**, 정적 693/85/48/1808 조인. 일부 금액 정상화는 명시적 stub. Node 전체 프로젝트 테스트/CI, 운영·staging D1/R2/Cron, 법원 공식서식, 변호사 승인, 전자제출/운영 배포 모두 **미실행·미인증**. A3 **canonical 순차 조사 693/693 유지, 최종 인수 0/124**. 삭제·승격·무단 원화합산 없음.

**다음 시작 ID:** **#021 `applicant_narrative_statement::identity.statement.admission_or_correction`** (#021~030 재검증); 다음 역할 **AX 담당자부터**. 해당 시점 main과 보드 blob 재조회 후 계속.

## 4. 이번 조회 파일 blob SHA
| 파일 | Blob SHA |
|---|---|
| `lib/canonical-field-id-index.json` | `27ecdddd208de82a2f5c675e7482485e3a8838c2` |
| `lib/reference-intake-catalog.json` | `ae6aa4fd2ef11ee0266b5ad05b2f9a96164daa99` |
| `lib/document-agent-field-contracts.json` | `9884b3fecf44643fefcdc4a421ed66ffc5477b3a` |
| `lib/shared-document-field-contracts.json` | `9decab974e0909ae24ad927bdfe241d75b71f3a9` |
| `lib/ocr-field-supplements.json` | `63b2bf853acb2e9620a6fb72377dc278ff3cd2a5` |
| `lib/field-applicability-contracts.json` | `6076b26f782c4643a21a7b2f1a8f6261bb588b68` |
| `lib/reference-decision-tables.json` | `6924e3977caf748ce8a3d617fae15aff7d2fe2ce` |
| `lib/risk-catalog.json` | `e96dd0926e3ae9be5a5573d4551538ba294c4d2e` |
| `lib/legal-catalog.json` | `b0898d74f1df69b19ecf6e81cdff0ed09e8d885e` |
| `lib/legal-exceptions.json` | `6e51197226bfd8320e1147d8df3f12c11e00927c` |
| `lib/canonical-field-binding.ts` | `60ee5c7762d52b72a165b4f4f8214680eb98f148` |
| `lib/feature-lineage-audit.ts` | `de81bc3b8c460b8a4dde3fda9e13087e619e74ff` |
| `lib/ocr-calculation-input.ts` | `8f7f51bf41f7c944b76419d7cc894e49ac771473` |
| `lib/ocr-chain-matrix.ts` | `977de86ba698bd805cc6b95d1384e3b49d0dbb4c` |
| `lib/material-calculation-source-gate.ts` | `0286b44484913b63fa8ec3f7bf0ca59b034d0dab` |
| `lib/legal-evidence-criteria.ts` | `6c0b94535700d4fa4d356f8a91d5b9440b5ac52a` |
| `docs/PRODUCT_RELEASE_INTEGRATION_BOARD.md` | `9be496b6e005796cc0734a6b622cdff0cc7b6027` |

## 5. 인수보드 A3 6역할 124개 체크 ID — main 실제 보드에서 순서 추출
- **DATA (22)**: `A3-DATA-001`, `A3-DATA-002`, `A3-DATA-003`, `A3-DATA-004`, `A3-DATA-005`, `A3-DATA-006`, `A3-DATA-007`, `A3-DATA-008`, `A3-DATA-009`, `A3-DATA-010`, `A3-DATA-011`, `A3-DATA-012`, `A3-DATA-013`, `A3-DATA-014`, `A3-DATA-015`, `A3-DATA-016`, `A3-DATA-017`, `A3-DATA-018`, `A3-DATA-019`, `A3-DATA-020`, `A3-DATA-021`, `A3-DATA-022`
- **IT (20)**: `A3-IT-001`, `A3-IT-002`, `A3-IT-003`, `A3-IT-004`, `A3-IT-005`, `A3-IT-006`, `A3-IT-007`, `A3-IT-008`, `A3-IT-009`, `A3-IT-010`, `A3-IT-011`, `A3-IT-012`, `A3-IT-013`, `A3-IT-014`, `A3-IT-015`, `A3-IT-016`, `A3-IT-017`, `A3-IT-018`, `A3-IT-019`, `A3-IT-020`
- **DOC (20)**: `A3-DOC-001`, `A3-DOC-002`, `A3-DOC-003`, `A3-DOC-004`, `A3-DOC-005`, `A3-DOC-006`, `A3-DOC-007`, `A3-DOC-008`, `A3-DOC-009`, `A3-DOC-010`, `A3-DOC-011`, `A3-DOC-012`, `A3-DOC-013`, `A3-DOC-014`, `A3-DOC-015`, `A3-DOC-016`, `A3-DOC-017`, `A3-DOC-018`, `A3-DOC-019`, `A3-DOC-020`
- **CALC (20)**: `A3-CALC-001`, `A3-CALC-002`, `A3-CALC-003`, `A3-CALC-004`, `A3-CALC-005`, `A3-CALC-006`, `A3-CALC-007`, `A3-CALC-008`, `A3-CALC-009`, `A3-CALC-010`, `A3-CALC-011`, `A3-CALC-012`, `A3-CALC-013`, `A3-CALC-014`, `A3-CALC-015`, `A3-CALC-016`, `A3-CALC-017`, `A3-CALC-018`, `A3-CALC-019`, `A3-CALC-020`
- **LAW (22)**: `A3-LAW-001`, `A3-LAW-002`, `A3-LAW-003`, `A3-LAW-004`, `A3-LAW-005`, `A3-LAW-006`, `A3-LAW-007`, `A3-LAW-008`, `A3-LAW-009`, `A3-LAW-010`, `A3-LAW-011`, `A3-LAW-012`, `A3-LAW-013`, `A3-LAW-014`, `A3-LAW-015`, `A3-LAW-016`, `A3-LAW-017`, `A3-LAW-018`, `A3-LAW-019`, `A3-LAW-020`, `A3-LAW-021`, `A3-LAW-022`
- **AX (20)**: `A3-AX-001`, `A3-AX-002`, `A3-AX-003`, `A3-AX-004`, `A3-AX-005`, `A3-AX-006`, `A3-AX-007`, `A3-AX-008`, `A3-AX-009`, `A3-AX-010`, `A3-AX-011`, `A3-AX-012`, `A3-AX-013`, `A3-AX-014`, `A3-AX-015`, `A3-AX-016`, `A3-AX-017`, `A3-AX-018`, `A3-AX-019`, `A3-AX-020`

<details><summary>canonical OCR 693개 — main 원본 인덱스 정확한 전체 순번</summary>

001. `account_garnishment::account_holder`
002. `account_garnishment::account_id`
003. `account_garnishment::court_or_authority`
004. `account_garnishment::creditor`
005. `account_garnishment::effective_date`
006. `account_garnishment::garnishment_amount`
007. `account_garnishment::issue_date`
008. `account_garnishment::released_amount`
009. `account_garnishment::seized_amount`
010. `account_garnishment::status`
011. `accounting_source::account_name`
012. `accounting_source::closing_balance`
013. `accounting_source::credits`
014. `accounting_source::debits`
015. `accounting_source::entity`
016. `accounting_source::issue_date`
017. `accounting_source::opening_balance`
018. `accounting_source::period_end`
019. `accounting_source::period_start`
020. `accounting_source::source_total`
021. `applicant_narrative_statement::identity.statement.admission_or_correction`
022. `applicant_narrative_statement::identity.statement.author`
023. `applicant_narrative_statement::identity.statement.event_end`
024. `applicant_narrative_statement::identity.statement.event_start`
025. `applicant_narrative_statement::identity.statement.narrative_text`
026. `applicant_narrative_statement::identity.statement.signature_status`
027. `applicant_narrative_statement::identity.statement.signed_at`
028. `applicant_narrative_statement::identity.statement.source_references`
029. `applicant_narrative_statement::identity.statement.statement_version`
030. `applicant_narrative_statement::identity.statement.topic`
031. `application_identity_venue::procedure.application.accepted_at`
032. `application_identity_venue::procedure.application.address`
033. `application_identity_venue::procedure.application.applicant_name`
034. `application_identity_venue::procedure.application.case_number`
035. `application_identity_venue::procedure.application.court`
036. `application_identity_venue::procedure.application.jurisdiction_exception`
037. `application_identity_venue::procedure.application.ordinary_venue_basis`
038. `application_identity_venue::procedure.application.phone_home`
039. `application_identity_venue::procedure.application.phone_mobile`
040. `application_identity_venue::procedure.application.phone_work`
041. `application_identity_venue::procedure.application.resident_id`
042. `application_identity_venue::procedure.application.ruleset_id`
043. `application_identity_venue::procedure.application.submitted_at`
044. `application_identity_venue::procedure.application.transition_rule`
045. `application_identity_venue::procedure.application_date`
046. `application_identity_venue::procedure.venue`
047. `asset_transfer_disposition::asset_id`
048. `asset_transfer_disposition::consideration`
049. `asset_transfer_disposition::market_value`
050. `asset_transfer_disposition::proceeds_received`
051. `asset_transfer_disposition::registration_date`
052. `asset_transfer_disposition::relationship`
053. `asset_transfer_disposition::review_status`
054. `asset_transfer_disposition::transaction_date`
055. `asset_transfer_disposition::transferee`
056. `asset_transfer_disposition::transferor`
057. `asset_transfer_disposition::use_of_proceeds`
058. `bank_account_balance::account_holder`
059. `bank_account_balance::account_id`
060. `bank_account_balance::account_status`
061. `bank_account_balance::balance`
062. `bank_account_balance::balance_as_of`
063. `bank_account_balance::currency`
064. `bank_account_balance::institution`
065. `bank_account_balance::issue_date`
066. `bank_transactions::account_id`
067. `bank_transactions::amount`
068. `bank_transactions::counterparty`
069. `bank_transactions::direction`
070. `bank_transactions::issue_date`
071. `bank_transactions::memo`
072. `bank_transactions::period_end`
073. `bank_transactions::period_start`
074. `bank_transactions::post_balance`
075. `bank_transactions::transaction_datetime`
076. `bank_transactions::transaction_id`
077. `bank_transactions::transaction_nature`
078. `business_asset_inventory::acquisition_date`
079. `business_asset_inventory::book_value`
080. `business_asset_inventory::condition`
081. `business_asset_inventory::disposal_restriction`
082. `business_asset_inventory::goodwill_contract`
083. `business_asset_inventory::market_value`
084. `business_asset_inventory::quantity`
085. `business_asset_inventory::quantity_unit`
086. `business_assets_liabilities::as_of_date`
087. `business_assets_liabilities::asset_or_claim_id`
088. `business_assets_liabilities::business_entity`
089. `business_assets_liabilities::gross_value`
090. `business_assets_liabilities::item_kind`
091. `business_assets_liabilities::ownership_interest`
092. `business_assets_liabilities::payable_amount`
093. `business_assets_liabilities::period_end`
094. `business_assets_liabilities::period_start`
095. `business_assets_liabilities::receivable_amount`
096. `business_assets_liabilities::secured_payoff`
097. `business_costs_and_ledgers::income.business_cost.accounting_basis`
098. `business_costs_and_ledgers::income.business_cost.business_continuity_flag`
099. `business_costs_and_ledgers::income.business_cost.business_entity`
100. `business_costs_and_ledgers::income.business_cost.expense_category`
101. `business_costs_and_ledgers::income.business_cost.gross_amount`
102. `business_costs_and_ledgers::income.business_cost.payment_date`
103. `business_costs_and_ledgers::income.business_cost.payment_status`
104. `business_costs_and_ledgers::income.business_cost.period_end`
105. `business_costs_and_ledgers::income.business_cost.period_start`
106. `business_costs_and_ledgers::income.business_cost.supplier`
107. `business_costs_and_ledgers::income.business_cost.tax_component`
108. `business_current_income_summary::income.self_employment.business_costs`
109. `business_current_income_summary::income.self_employment.contract_end`
110. `business_current_income_summary::income.self_employment.contract_id`
111. `business_current_income_summary::income.self_employment.gross_receivable`
112. `business_current_income_summary::income.self_employment.invoice_date`
113. `business_current_income_summary::income.self_employment.net_receipt`
114. `business_current_income_summary::income.self_employment.operator`
115. `business_current_income_summary::income.self_employment.payer_customer`
116. `business_current_income_summary::income.self_employment.service_period_end`
117. `business_current_income_summary::income.self_employment.service_period_start`
118. `business_current_income_summary::income.self_employment.withheld_tax`
119. `business_registration::business_entity`
120. `business_registration::business_id`
121. `business_registration::business_items`
122. `business_registration::business_type`
123. `business_registration::issue_date`
124. `business_registration::joint_operators`
125. `business_registration::opening_date`
126. `business_registration::registration_date`
127. `business_registration::representative`
128. `business_registration::status`
129. `business_sales_vat::income.sales.business_entity`
130. `business_sales_vat::income.sales.exempt_sales`
131. `business_sales_vat::income.sales.filing_date`
132. `business_sales_vat::income.sales.gross_sales`
133. `business_sales_vat::income.sales.issue_date`
134. `business_sales_vat::income.sales.reporting_period_end`
135. `business_sales_vat::income.sales.reporting_period_start`
136. `business_sales_vat::income.sales.returns_refunds`
137. `business_sales_vat::income.sales.sales_count`
138. `business_sales_vat::income.sales.taxable_sales`
139. `business_sales_vat::income.sales.vat_collected`
140. `card_statement::billed_amount`
141. `card_statement::billing_period`
142. `card_statement::card_product_kind`
143. `card_statement::installment_count`
144. `card_statement::merchant`
145. `card_statement::purchase_amount`
146. `card_statement::remaining_installments`
147. `cash_deposit_asset::actual_payoff`
148. `cash_deposit_asset::as_of_date`
149. `cash_deposit_asset::asset_id`
150. `cash_deposit_asset::asset_kind`
151. `cash_deposit_asset::encumbrance`
152. `cash_deposit_asset::gross_value`
153. `cash_deposit_asset::owner`
154. `cash_deposit_asset::ownership_share`
155. `cash_deposit_asset::protected_or_excluded_claim`
156. `cash_deposit_asset::valuation_basis`
157. `cash_holding_statement::acquisition_source`
158. `cash_holding_statement::cash_currency`
159. `cash_holding_statement::declaration_author`
160. `cash_holding_statement::declaration_date`
161. `cash_holding_statement::storage_location`
162. `conditional_case_specific_request::conditional.court_request.case_number`
163. `conditional_case_specific_request::conditional.court_request.court`
164. `conditional_case_specific_request::conditional.court_request.item_due`
165. `conditional_case_specific_request::conditional.court_request.legal_citation`
166. `conditional_case_specific_request::conditional.court_request.operative_text`
167. `conditional_case_specific_request::conditional.court_request.request_type`
168. `conditional_case_specific_request::conditional.court_request.response_deadline`
169. `conditional_case_specific_request::conditional.court_request.response_filed_at`
170. `conditional_case_specific_request::conditional.court_request.service_date`
171. `conditional_case_specific_request::conditional.court_request.status_change`
172. `conditional_education_childcare::conditional.education.billed_amount`
173. `conditional_education_childcare::conditional.education.enrollment_end`
174. `conditional_education_childcare::conditional.education.enrollment_start`
175. `conditional_education_childcare::conditional.education.fee_type`
176. `conditional_education_childcare::conditional.education.frequency`
177. `conditional_education_childcare::conditional.education.paid_amount`
178. `conditional_education_childcare::conditional.education.payer`
179. `conditional_education_childcare::conditional.education.provider`
180. `conditional_education_childcare::conditional.education.recipient`
181. `conditional_education_childcare::conditional.education.relation`
182. `conditional_education_childcare::conditional.education.subsidy`
183. `conditional_medical_expense::conditional.medical.applicant_relation`
184. `conditional_medical_expense::conditional.medical.billed_cost`
185. `conditional_medical_expense::conditional.medical.care_period_end`
186. `conditional_medical_expense::conditional.medical.care_period_start`
187. `conditional_medical_expense::conditional.medical.expected_recurring_cost`
188. `conditional_medical_expense::conditional.medical.medical_opinion_period`
189. `conditional_medical_expense::conditional.medical.paid_cost`
190. `conditional_medical_expense::conditional.medical.patient`
191. `conditional_medical_expense::conditional.medical.provider`
192. `conditional_medical_expense::conditional.medical.reimbursement`
193. `conditional_medical_expense::conditional.medical.service_date`
194. `conditional_medical_expense::conditional.medical.service_kind`
195. `conditional_nonstandard_income_or_household_event::conditional.change.affected_person`
196. `conditional_nonstandard_income_or_household_event::conditional.change.duration_end`
197. `conditional_nonstandard_income_or_household_event::conditional.change.effective_date`
198. `conditional_nonstandard_income_or_household_event::conditional.change.event_date`
199. `conditional_nonstandard_income_or_household_event::conditional.change.event_kind`
200. `conditional_nonstandard_income_or_household_event::conditional.change.expense_delta`
201. `conditional_nonstandard_income_or_household_event::conditional.change.income_delta`
202. `conditional_nonstandard_income_or_household_event::conditional.change.issuer`
203. `conditional_nonstandard_income_or_household_event::conditional.change.new_status`
204. `conditional_nonstandard_income_or_household_event::conditional.change.old_status`
205. `conditional_plan_funding_source::applicability.form.current_official_version`
206. `conditional_plan_funding_source::applicability.form.disposition_asset_ids`
207. `conditional_plan_funding_source::applicability.form.disposition_date`
208. `conditional_plan_funding_source::applicability.form.disposition_proceeds`
209. `conditional_plan_funding_source::applicability.form.income_source_evidence_ids`
210. `conditional_plan_funding_source::applicability.form.plan_source`
211. `conditional_plan_funding_source::applicability.form.proceeds_to_plan`
212. `conditional_plan_funding_source::applicability.form.review_status`
213. `conditional_plan_funding_source::applicability.form.selected_form_code`
214. `credit_information_report::assignment_event_date`
215. `credit_information_report::current_reported_creditor`
216. `credit_information_report::event_record_id`
217. `credit_information_report::issue_date`
218. `credit_information_report::previous_creditor`
219. `credit_information_report::report_as_of`
220. `credit_information_report::report_subject`
221. `credit_report::currency_unit`
222. `credit_report::event_date`
223. `credit_report::event_kind`
224. `credit_report::institution`
225. `credit_report::product_code`
226. `credit_report::reported_amount`
227. `credit_report::status`
228. `creditor_assignment_dispute::assignment_date`
229. `creditor_assignment_dispute::claim_id`
230. `creditor_assignment_dispute::claim_status`
231. `creditor_assignment_dispute::current_claimant`
232. `creditor_assignment_dispute::dispute_basis`
233. `creditor_assignment_dispute::disputed_amount`
234. `creditor_assignment_dispute::notice_date`
235. `creditor_assignment_dispute::prior_creditor`
236. `creditor_assignment_dispute::supporting_record`
237. `crypto_balance::account_owner`
238. `crypto_balance::asset_symbol`
239. `crypto_balance::available_quantity`
240. `crypto_balance::average_acquisition_price`
241. `crypto_balance::displayed_valuation`
242. `crypto_balance::exchange_or_wallet`
243. `crypto_balance::locked_quantity`
244. `crypto_balance::network`
245. `crypto_balance::total_quantity`
246. `crypto_balance::valuation_currency`
247. `crypto_balance::valuation_datetime`
248. `crypto_balance::valuation_unit_price`
249. `crypto_balance::wallet_address`
250. `crypto_transactions::asset_symbol`
251. `crypto_transactions::completed_at`
252. `crypto_transactions::counterparty_account_identity`
253. `crypto_transactions::crypto_event_kind`
254. `crypto_transactions::destination_address`
255. `crypto_transactions::fee_asset`
256. `crypto_transactions::fee_quantity`
257. `crypto_transactions::gross_trade_amount`
258. `crypto_transactions::network`
259. `crypto_transactions::quantity`
260. `crypto_transactions::quote_currency`
261. `crypto_transactions::requested_at`
262. `crypto_transactions::source_address`
263. `crypto_transactions::transfer_status`
264. `crypto_transactions::txid`
265. `crypto_transactions::unit_price`
266. `current_nonwage_income::income.other.contract_end`
267. `current_nonwage_income::income.other.deductions`
268. `current_nonwage_income::income.other.earning_period_end`
269. `current_nonwage_income::income.other.earning_period_start`
270. `current_nonwage_income::income.other.frequency`
271. `current_nonwage_income::income.other.gross_amount`
272. `current_nonwage_income::income.other.income_kind`
273. `current_nonwage_income::income.other.net_received`
274. `current_nonwage_income::income.other.payer`
275. `current_nonwage_income::income.other.payment_date`
276. `current_nonwage_income::income.other.recipient`
277. `debt_certificate::as_of_date`
278. `debt_certificate::claim_cause`
279. `debt_certificate::contract_id`
280. `debt_certificate::contract_interest_rate`
281. `debt_certificate::creditor`
282. `debt_certificate::creditor_address`
283. `debt_certificate::debtor`
284. `debt_certificate::fees`
285. `debt_certificate::interest_balance`
286. `debt_certificate::issue_date`
287. `debt_certificate::issuer`
288. `debt_certificate::original_principal`
289. `debt_certificate::origination_date`
290. `debt_certificate::overdue_interest`
291. `debt_certificate::principal_balance`
292. `debt_certificate::total_claim`
293. `divorce_records::actual_support_paid`
294. `divorce_records::agreement_or_order_date`
295. `divorce_records::divorce_date`
296. `divorce_records::former_spouse`
297. `divorce_records::marriage_date`
298. `divorce_records::partition_amount`
299. `divorce_records::partition_asset`
300. `divorce_records::support_child`
301. `divorce_records::support_payer`
302. `divorce_records::support_period`
303. `divorce_records::support_periodic_amount`
304. `divorce_records::support_recipient`
305. `employment_contract::employer_signature_date`
306. `employment_contract::employer_signature_status`
307. `employment_history::insurance_scheme`
308. `employment_history::qualification_acquired`
309. `employment_history::qualification_lost`
310. `employment_history::qualification_record_scope`
311. `employment_history::qualification_type`
312. `employment_history::qualification_workplace`
313. `employment_relationship::income.employment.allowance_terms`
314. `employment_relationship::income.employment.base_wage`
315. `employment_relationship::income.employment.contract_term`
316. `employment_relationship::income.employment.employee`
317. `employment_relationship::income.employment.employer`
318. `employment_relationship::income.employment.employment_type`
319. `employment_relationship::income.employment.end_date`
320. `employment_relationship::income.employment.hours`
321. `employment_relationship::income.employment.issue_date`
322. `employment_relationship::income.employment.start_date`
323. `guarantee_joint_claim::applicant_role`
324. `guarantee_joint_claim::creditor`
325. `guarantee_joint_claim::dispute_status`
326. `guarantee_joint_claim::guarantee_claimed`
327. `guarantee_joint_claim::guarantee_limit`
328. `guarantee_joint_claim::principal_debtor`
329. `guarantee_joint_claim::recourse_status`
330. `guarantee_joint_claim::underlying_claim_id`
331. `health_insurance_arrears::as_of_date`
332. `health_insurance_arrears::authority`
333. `health_insurance_arrears::disposal_cost`
334. `health_insurance_arrears::issue_date`
335. `health_insurance_arrears::late_charge`
336. `health_insurance_arrears::period_end`
337. `health_insurance_arrears::period_start`
338. `health_insurance_arrears::subscriber`
339. `health_insurance_arrears::total_arrear`
340. `health_insurance_arrears::unpaid_contribution`
341. `household_composition_support::household.support.member`
342. `household_composition_support::household.support.other_income`
343. `household_composition_support::household.support.relationship`
344. `household_composition_support::household.support.residence_end`
345. `household_composition_support::household.support.residence_start`
346. `household_composition_support::household.support.support_amount`
347. `household_composition_support::household.support.support_frequency`
348. `household_composition_support::household.support.support_period_end`
349. `household_composition_support::household.support.support_period_start`
350. `household_composition_support::household.support.support_provider`
351. `household_composition_support::household.support.support_recipient`
352. `household_living_expense::household.expense.arrears`
353. `household_living_expense::household.expense.beneficiary`
354. `household_living_expense::household.expense.billed_amount`
355. `household_living_expense::household.expense.billing_period_end`
356. `household_living_expense::household.expense.billing_period_start`
357. `household_living_expense::household.expense.expense_kind`
358. `household_living_expense::household.expense.issue_date`
359. `household_living_expense::household.expense.paid_amount`
360. `household_living_expense::household.expense.payer`
361. `household_living_expense::household.expense.provider`
362. `household_living_expense::household.expense.shared_allocation`
363. `identity_residence_record::identity.address`
364. `identity_residence_record::identity.household_members`
365. `identity_residence_record::identity.issue_date`
366. `identity_residence_record::identity.marital_status`
367. `identity_residence_record::identity.name`
368. `identity_residence_record::identity.record_number`
369. `identity_residence_record::identity.registration_id`
370. `identity_residence_record::identity.relationship`
371. `income_source_inventory::amount_basis`
372. `income_source_inventory::income_source_id`
373. `income_source_inventory::reported_expenses`
374. `income_source_inventory::reported_gross`
375. `income_source_inventory::reported_net`
376. `income_source_inventory::source_document_reference`
377. `income_source_inventory::source_kind`
378. `inheritance_records::attributed_amount`
379. `inheritance_records::decedent`
380. `inheritance_records::disclaimer_or_limited_acceptance`
381. `inheritance_records::filing_or_order_reference`
382. `inheritance_records::heir`
383. `inheritance_records::heir_relationship`
384. `inheritance_records::inherited_asset_id`
385. `inheritance_records::partition_agreement_date`
386. `inheritance_records::stated_share`
387. `inheritance_records::succession_opened_at`
388. `insurance_policy_asset::as_of_date`
389. `insurance_policy_asset::beneficiary`
390. `insurance_policy_asset::contract_holder`
391. `insurance_policy_asset::coverage_amount`
392. `insurance_policy_asset::end_date`
393. `insurance_policy_asset::insured`
394. `insurance_policy_asset::insurer`
395. `insurance_policy_asset::issue_date`
396. `insurance_policy_asset::pledge`
397. `insurance_policy_asset::policy_id`
398. `insurance_policy_asset::policy_loan_balance`
399. `insurance_policy_asset::policy_status`
400. `insurance_policy_asset::premium_per_payment`
401. `insurance_policy_asset::refund_net_basis`
402. `insurance_policy_asset::start_date`
403. `insurance_policy_asset::surrender_value`
404. `insurance_policy_asset::total_premium`
405. `lease_contract::fixed_date`
406. `lease_housing::applicant_relation`
407. `lease_housing::arrears_deduction`
408. `lease_housing::deposit`
409. `lease_housing::issue_date`
410. `lease_housing::landlord`
411. `lease_housing::monthly_rent`
412. `lease_housing::period_end`
413. `lease_housing::period_start`
414. `lease_housing::property_id`
415. `lease_housing::renewal_status`
416. `lease_housing::secured_balance`
417. `lease_housing::security_assignment`
418. `lease_housing::tenant`
419. `lease_housing::use`
420. `litigation_enforcement::case_id`
421. `litigation_enforcement::claim_type`
422. `litigation_enforcement::claimed_amount`
423. `litigation_enforcement::court_or_authority`
424. `litigation_enforcement::enforced_amount`
425. `litigation_enforcement::event_date`
426. `litigation_enforcement::issue_date`
427. `litigation_enforcement::judgment_amount`
428. `litigation_enforcement::parties`
429. `litigation_enforcement::security_or_attachment`
430. `litigation_enforcement::status`
431. `loan_contract::contract_interest_rate`
432. `loan_contract::maturity_date`
433. `loan_contract::repayment_installments`
434. `loan_contract::repayment_method`
435. `loan_contract::scheduled_payment`
436. `local_tax::arrears`
437. `local_tax::as_of_date`
438. `local_tax::assessed_amount`
439. `local_tax::authority`
440. `local_tax::collection_cost`
441. `local_tax::issue_date`
442. `local_tax::paid_amount`
443. `local_tax::surcharge`
444. `local_tax::tax_base`
445. `local_tax::tax_period`
446. `local_tax::tax_type`
447. `local_tax::taxpayer`
448. `local_tax_assessment::jurisdiction_scope`
449. `local_tax_assessment::no_assessment_text`
450. `local_tax_assessment::row_or_subtotal_kind`
451. `local_tax_assessment::tax_assessment_year`
452. `local_tax_assessment::tax_notice_status`
453. `local_tax_assessment::tax_object`
454. `payroll_payslip::income.payroll.allowances`
455. `payroll_payslip::income.payroll.bonus`
456. `payroll_payslip::income.payroll.employee`
457. `payroll_payslip::income.payroll.employer`
458. `payroll_payslip::income.payroll.gross_base`
459. `payroll_payslip::income.payroll.hours_days`
460. `payroll_payslip::income.payroll.issue_date`
461. `payroll_payslip::income.payroll.net_pay`
462. `payroll_payslip::income.payroll.other_deductions`
463. `payroll_payslip::income.payroll.overtime`
464. `payroll_payslip::income.payroll.pay_date`
465. `payroll_payslip::income.payroll.pay_period_end`
466. `payroll_payslip::income.payroll.pay_period_start`
467. `payroll_payslip::income.payroll.social_contributions`
468. `payroll_payslip::income.payroll.tax_withheld`
469. `pension_benefit_income::income.benefit.beneficiary`
470. `pension_benefit_income::income.benefit.benefit_type`
471. `pension_benefit_income::income.benefit.decision_date`
472. `pension_benefit_income::income.benefit.deductions`
473. `pension_benefit_income::income.benefit.monthly_gross`
474. `pension_benefit_income::income.benefit.net_payment`
475. `pension_benefit_income::income.benefit.payment_date`
476. `pension_benefit_income::income.benefit.payment_end`
477. `pension_benefit_income::income.benefit.payment_start`
478. `pension_benefit_income::income.benefit.provider`
479. `pension_benefit_income::income.benefit.review_status`
480. `pension_contribution_benefit::as_of_date`
481. `pension_contribution_benefit::benefit_amount`
482. `pension_contribution_benefit::benefit_type`
483. `pension_contribution_benefit::contribution`
484. `pension_contribution_benefit::encumbrance`
485. `pension_contribution_benefit::issue_date`
486. `pension_contribution_benefit::member`
487. `pension_contribution_benefit::payment_start`
488. `pension_contribution_benefit::period_end`
489. `pension_contribution_benefit::period_start`
490. `pension_contribution_benefit::plan_id`
491. `pension_contribution_benefit::provider`
492. `pension_contribution_benefit::vested_balance`
493. `pension_contribution_benefit::withdrawal_value`
494. `pension_contribution_statement::contribution_record_kind`
495. `pension_contribution_statement::paid_amount`
496. `pension_contribution_statement::paid_months`
497. `pension_contribution_statement::payable_amount`
498. `pension_contribution_statement::payable_months`
499. `pension_contribution_statement::standard_monthly_income`
500. `pension_contribution_statement::subscriber_type`
501. `pension_contribution_statement::unpaid_amount`
502. `pension_contribution_statement::unpaid_months`
503. `pension_contribution_statement::unpayable_amount`
504. `pension_contribution_statement::unpayable_months`
505. `procedure_court_orders::procedure.order.case_number`
506. `procedure_court_orders::procedure.order.court`
507. `procedure_court_orders::procedure.order.deadline`
508. `procedure_court_orders::procedure.order.debtor`
509. `procedure_court_orders::procedure.order.effective_date`
510. `procedure_court_orders::procedure.order.finality`
511. `procedure_court_orders::procedure.order.operative_text`
512. `procedure_court_orders::procedure.order.order_date`
513. `procedure_court_orders::procedure.order.order_type`
514. `procedure_court_orders::procedure.order.scope`
515. `procedure_court_orders::procedure.order.service_date`
516. `procedure_court_orders::procedure.order.status_change`
517. `procedure_enforcement_garnishment::procedure.enforcement.asset_or_income`
518. `procedure_enforcement_garnishment::procedure.enforcement.attached_amount`
519. `procedure_enforcement_garnishment::procedure.enforcement.authority`
520. `procedure_enforcement_garnishment::procedure.enforcement.case_number`
521. `procedure_enforcement_garnishment::procedure.enforcement.claimed_amount`
522. `procedure_enforcement_garnishment::procedure.enforcement.creditor`
523. `procedure_enforcement_garnishment::procedure.enforcement.debtor`
524. `procedure_enforcement_garnishment::procedure.enforcement.effective_date`
525. `procedure_enforcement_garnishment::procedure.enforcement.order_date`
526. `procedure_enforcement_garnishment::procedure.enforcement.order_type`
527. `procedure_enforcement_garnishment::procedure.enforcement.released_amount`
528. `procedure_enforcement_garnishment::procedure.enforcement.service_date`
529. `procedure_enforcement_garnishment::procedure.enforcement.status`
530. `procedure_prior_insolvency::procedure.history.case_number`
531. `procedure_prior_insolvency::procedure.history.case_type`
532. `procedure_prior_insolvency::procedure.history.court_authority`
533. `procedure_prior_insolvency::procedure.history.debtor`
534. `procedure_prior_insolvency::procedure.history.discharge_date`
535. `procedure_prior_insolvency::procedure.history.filing_date`
536. `procedure_prior_insolvency::procedure.history.finality_date`
537. `procedure_prior_insolvency::procedure.history.order_date`
538. `procedure_prior_insolvency::procedure.history.order_kind`
539. `procedure_prior_insolvency::procedure.history.private_adjustment_attempt`
540. `procedure_prior_insolvency::procedure.history.record_issue_date`
541. `procedure_private_creditor_request::procedure.creditor_info.as_of_date`
542. `procedure_private_creditor_request::procedure.creditor_info.claim_id`
543. `procedure_private_creditor_request::procedure.creditor_info.claim_origin_date`
544. `procedure_private_creditor_request::procedure.creditor_info.creditor`
545. `procedure_private_creditor_request::procedure.creditor_info.debtor`
546. `procedure_private_creditor_request::procedure.creditor_info.interest_balance`
547. `procedure_private_creditor_request::procedure.creditor_info.interest_rate`
548. `procedure_private_creditor_request::procedure.creditor_info.principal_balance`
549. `procedure_private_creditor_request::procedure.creditor_info.principal_original`
550. `procedure_private_creditor_request::procedure.creditor_info.request_copy`
551. `procedure_private_creditor_request::procedure.creditor_info.request_date`
552. `procedure_private_creditor_request::procedure.creditor_info.response_date`
553. `property_search::issue_date`
554. `property_search::jurisdiction_scope`
555. `property_search::ownership_share`
556. `property_search::property_found`
557. `property_search::property_id`
558. `property_search::registered_owner`
559. `property_search::search_as_of`
560. `property_search::searched_subject`
561. `real_estate_register::ownership_change_text`
562. `real_estate_register::property_address`
563. `real_property_register::acquisition_date`
564. `real_property_register::issue_date`
565. `real_property_register::maximum_claim`
566. `real_property_register::mortgage_holder`
567. `real_property_register::ownership_share`
568. `real_property_register::property_id`
569. `real_property_register::property_type`
570. `real_property_register::registered_owner`
571. `real_property_register::registered_value`
572. `real_property_register::registration_date`
573. `real_property_register::release_date`
574. `real_property_valuation::actual_payoff`
575. `real_property_valuation::disposal_cost`
576. `real_property_valuation::market_value`
577. `real_property_valuation::owner`
578. `real_property_valuation::ownership_share`
579. `real_property_valuation::property_id`
580. `real_property_valuation::valuation_date`
581. `real_property_valuation::valuation_method`
582. `receivable_collectability::collected_amount`
583. `receivable_collectability::collection_status`
584. `receivable_collectability::counterparty_status`
585. `receivable_collectability::demand_date`
586. `receivable_collectability::receivable_id`
587. `receivable_collectability::security_reference`
588. `receivable_collectability::uncollected_reason`
589. `resident_registration::address_change_date`
590. `resident_registration::historical_address`
591. `resident_registration::residence_history_period`
592. `retirement_estimate::estimated_retirement_date`
593. `retirement_estimate::payout_condition`
594. `retirement_estimate::retirement_scheme`
595. `retirement_estimate::service_period`
596. `retirement_estimate::transfer_history`
597. `salary_statement::employer_confirmation_status`
598. `salary_statement::employer_signature_date`
599. `salary_statement::gross_total`
600. `salary_statement::total_deductions`
601. `secured_claim_security::actual_payoff`
602. `secured_claim_security::collateral_id`
603. `secured_claim_security::discharge_date`
604. `secured_claim_security::grantor`
605. `secured_claim_security::priority`
606. `secured_claim_security::registered_maximum`
607. `secured_claim_security::registration_date`
608. `secured_claim_security::secured_party`
609. `secured_claim_security::security_type`
610. `securities_balance::account_coverage`
611. `securities_balance::asset_class`
612. `securities_balance::cash_balance`
613. `securities_balance::quantity`
614. `securities_balance::quantity_unit`
615. `securities_balance::security_id`
616. `securities_balance::security_name`
617. `securities_balance::settlement_basis`
618. `securities_balance::unsettled_liability`
619. `securities_balance::valuation_currency`
620. `securities_balance::valuation_datetime`
621. `securities_balance::valuation_method`
622. `securities_balance::valuation_unit_price`
623. `securities_transactions::counter_account`
624. `securities_transactions::fee`
625. `securities_transactions::quantity`
626. `securities_transactions::quantity_unit`
627. `securities_transactions::security_event_kind`
628. `securities_transactions::security_id`
629. `securities_transactions::security_name`
630. `securities_transactions::settled_amount`
631. `securities_transactions::settlement_date`
632. `securities_transactions::tax`
633. `securities_transactions::trade_gross`
634. `securities_transactions::trade_unit_price`
635. `tax_income::arrears`
636. `tax_income::gross_receipts`
637. `tax_income::income_after_expenses`
638. `tax_income::income_kind`
639. `tax_income::issue_date`
640. `tax_income::necessary_expenses`
641. `tax_income::period_end`
642. `tax_income::period_start`
643. `tax_income::tax_assessed`
644. `tax_income::tax_paid`
645. `tax_income::tax_year`
646. `tax_income::taxpayer`
647. `tax_public_arrear::as_of_date`
648. `tax_public_arrear::assessment_date`
649. `tax_public_arrear::authority`
650. `tax_public_arrear::costs`
651. `tax_public_arrear::debtor`
652. `tax_public_arrear::due_date`
653. `tax_public_arrear::issue_date`
654. `tax_public_arrear::principal_arrear`
655. `tax_public_arrear::surcharge_interest`
656. `tax_public_arrear::tax_period`
657. `tax_public_arrear::tax_type`
658. `tax_public_arrear::total_due`
659. `vehicle_registration::model_year`
660. `vehicle_registration::plate_number`
661. `vehicle_registration::record_issue_date`
662. `vehicle_registration::vin`
663. `vehicle_registry::acquisition_date`
664. `vehicle_registry::co_owners`
665. `vehicle_registry::lien_date`
666. `vehicle_registry::lien_holder`
667. `vehicle_registry::ownership_share`
668. `vehicle_registry::registered_lien_amount`
669. `vehicle_registry::registered_owner`
670. `vehicle_registry::registration_status`
671. `vehicle_registry::release_date`
672. `vehicle_registry::transfer_date`
673. `vehicle_registry::vehicle_id`
674. `vehicle_valuation::actual_payoff`
675. `vehicle_valuation::market_value`
676. `vehicle_valuation::mileage`
677. `vehicle_valuation::model_year`
678. `vehicle_valuation::owner`
679. `vehicle_valuation::registered_lien_amount`
680. `vehicle_valuation::valuation_date`
681. `vehicle_valuation::valuation_method`
682. `vehicle_valuation::vehicle_id`
683. `wage_withholding_tax::income.tax.employment_start_end`
684. `wage_withholding_tax::income.tax.gross_wages`
685. `wage_withholding_tax::income.tax.issue_date`
686. `wage_withholding_tax::income.tax.resident_tax`
687. `wage_withholding_tax::income.tax.tax_exempt_allowances`
688. `wage_withholding_tax::income.tax.tax_year`
689. `wage_withholding_tax::income.tax.taxable_allowances`
690. `wage_withholding_tax::income.tax.taxpayer`
691. `wage_withholding_tax::income.tax.withheld_income_tax`
692. `wage_withholding_tax::income.tax.withholding_agent`
693. `wage_withholding_tax::income.tax.year_end_adjustment`

</details>
