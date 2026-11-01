# FirmEngine A3 r53 — canonical OCR #341–360 소비처 심층 재감사 (2026-11-01 KST)

## 범위·기준 판본·실행 수준
- 작업 경로: `prototypes/Daeseong Ray Yang/firmengine-proto/ax-site/` 아래만. 검증한 GitHub `main` 고정 HEAD: `f5476b5559817af2320672a796d3d41871fd3743`. 직전 r52(321–340) 영수증과 과거 최초 r18(341–360) 영수증, 최근 커밋 및 Draft PR #51/#54/#131/#133, 중앙 `docs/PRODUCT_RELEASE_INTEGRATION_BOARD.md`, SQL 스키마·원본 코드·기존 회귀 테스트를 재조회했다.
- 역할 순환 **데이터담당자 → IT담당자 → 사용자·서류담당자 → 계산사무장 → 변호사**, A3 체크 **A3-DATA-010, A3-IT-017, A3-DOC-018, A3-CALC-009, A3-LAW-008**의 각 일부 증빙을 확인. **전부 [ ] 미완료** 유지. 다음 역할 시작 **AX담당자**.
- 이 회차의 실행은 **현재 main의 JSON 계약에 대한 V8 독립 정적 대조**와 **실제 TypeScript 원본문에서 추출한 기간/단위 및 검토 후보 함수의 V8 격리 실행**이다. 실제 고객 원문/OCR, D1 Fact 저장·재독, R2, Cron, 전체 Node/CI, 공식 e-form, 변호사 승인, 사이트 배포는 실행/확인하지 않았다. 이들 상태를 합격으로 표시하지 않음.
- **자료가 관찰되지 않음 / null / 0 / 해당없음 / 상충 / source-only / 사람 승인 전**을 따로 둔다. 본 회차에서 원문 금액·신원·기존 사건 DB 행은 0개 관찰하였다(원천 등록 개수 100은 실제 관측값이 아니다). 실제 고객자료·개인정보·원본 OCR 값·env/키·비공개 정답을 공개 Git에 기록하지 않음.

## 실제 독립 입력 → 기대 → 관찰
| 입력/검사 | 독립 기대 | 실제 관찰 | 검증층 |
|---|---|---|---|
| canonical index 전체 및 등록표 번호/ID | 693/693 순서 일치·고유, 고아 0 | 693/693, 중복 0, 원천 고아 0 | GitHub JSON/등록표 정적 V8 |
| 85 문서/48 base family + 확장/보강 source slots | 85/48, 1,808 슬롯 | 85/48, 1,808 | 문서 allowedFamilyIds × base + extension + supplement 재조인 |
| 현재 범위 341–360 | 20 ID, 100 선언 슬롯, 각 5개 라우트, 고유 문서 9종 | **20/100/각5/9종** | 실제 index와 9개 문서 allowedFamilyIds |
| 현재 20개 exact field applicability | 20 등록·대상/시간역할 일치 | **20/20** sourceCondition/subject/temporal 일치 | 승인된 법률 요건이 아닌 source 조건 |
| 원본 locator 및 분리 정책 | 20개 document ID/hash/page/quote locator 선언, 9문서 cross-record 차용 금지 | **20/20 locator 선언, 9/9** sourceOnly+noCrossRecordBorrowing | schema/contract 선언; 원문·R2/D1 실관측 아님 |
| 18 계산 모듈/91 선언 입력(78 unique) | 18/91/78 | **18/91/78** | reference-decision-tables JSON |
| 95 법률위험/50 규칙/46 예외 | 95/50/46; required_features 공백 88 | **95/50/46; 공백 88** | risk/legal/exception JSON |
| 보드 A3 6역할 ID | 124 고유, 완료 0 | **124, 중복 0, 완료 0** | main 중앙 보드 정적 |
| 현재 20개 정확 계산/typed/form/legal 소비처 | 직접 typed 0, direct calculation 0, exact form token 0, exact approved canonical legal evidence 0 | **각각 0/20**; #359는 material `context_only` 1개 | 원본 projection/ocr-chain/리스크·법률 JSON, seed `checks=[]` |
| 원본 `hasPeriod`에 20 metadata 입력 | 시간역할 있는 13 true, 없는 7 false | **20/20 일치**, true 13 | TypeScript 술어 본문에서 V8 함수 생성·호출 |
| 원본 `hasUnit`에 20 datatype 입력 | money/money_or_unknown 5 true, 기타 15 false | **20/20 일치**, true 5 | TypeScript 술어 본문 V8 함수 생성·호출 |
| 원본 `reviewScope` 후보 생성 | household family는 D5100/D5103/D5105 및 SEOUL-405 후보; spouse-named family에는 SEOUL-406 추가 후보 | **동일한 후보 반환**; household family는 SEOUL-406 미포함 | 원본문 V8 격리 실행; 법률 필수·양식 토큰 승인 아님 |

**정적 구조 검사의 계산 투명성:** 30개 불변식의 첫 실행에서 검사기 자체가 잘못된 속성명 `required_source_anchor`를 조회하여 29/30으로 출력했다. 실제 코드의 올바른 속성은 `source_locator_required`이고, 동일 20 ID의 document_id/document_sha256/page/quote를 재조회하여 **20/20** 확인했다. 이는 **감사 스크립트의 검사식 정정**이지 제품 코드 결함 또는 테스트 부적합이 아니다. 정정한 30개 구조조건은 30/30 충족. 이 숫자를 OCR·법률·CI 합격률로 사용 금지.

## 문서 라우트 및 원천-소비처 간격
- **S = household_composition_support (11 IDs × 5 documents = 55 선언 슬롯)**: `dependent_evidence`, `divorce_records`, `family_relation`, `free_residence_confirmation`, `spouse_asset_evidence`.
- **E = household_living_expense (9 IDs × 5 documents = 45 선언 슬롯)**: `education_expense_evidence`, `free_residence_confirmation`, `household_expense_ledger`, `housing_expense_evidence`, `medical_expense_evidence`.
- 두 그룹의 고유 문서 총 **9종**(무료거주증빙이 중복). `recordPolicy.sourceOnly=true`, `noCrossRecordBorrowing=true`, 명의/대상/원천행/기간별 record 구분 정책을 확인. 실제 문서·페이지·복수 행·대상자 동일성·OCR 추출값·원본 hash 검산은 별도 관측이 필요.
- 각 행의 **typed 직접 0, 승인 법률 근거 0, 정확 서식 token 0**은 소비처 계약의 공백이며 증거 폐기/비해당/법원 불인정 증명은 아니다. `lib/feature-lineage-audit.ts`의 D5100/D5103/D5105/SEOUL-405는 **일반 review candidate**이고, `OCR_DECLARED_FORM_TARGETS`의 exact token과 다르다.

## 현재 #341–360 ID별 자료형·출처·기간·대상·상태
- `P/U`는 현재 `lib/feature-lineage-audit.ts` 원본 `hasPeriod/hasUnit` 실행 결과 Y/N. direct typed, direct 18-calculation input, exact legal evidence, exact public form token은 모든 행 **0**. `none`은 금액 직접 계산 계약 없음이지 필요 없다는 판단이 아니다.
| # | canonical ID | 원천 서류/슬롯 | 자료형/단위 | 시간역할/대상 | 정확 sourceCondition | P/U | 물질금액 계약 |
|---:|---|---|---|---|---|:---:|---|
| 341 | `household_composition_support::household.support.member` | S(5) | `party_role` / `not_applicable` | `not_applicable` / `household_member` | Named person | N/N | none |
| 342 | `household_composition_support::household.support.other_income` | S(5) | `money_or_unknown` / `KRW` | `period_scope` / `household_member` | Only as reported in source; not inferred | Y/Y | none |
| 343 | `household_composition_support::household.support.relationship` | S(5) | `relationship_enum` / `not_applicable` | `not_applicable` / `household_member` | Relationship as stated in source | N/N | none |
| 344 | `household_composition_support::household.support.residence_end` | S(5) | `date` / `not_applicable` | `statement_period_end` / `household_member` | End of shared residence if source states | Y/N | none |
| 345 | `household_composition_support::household.support.residence_start` | S(5) | `date` / `not_applicable` | `statement_period_start` / `household_member` | Start of shared residence if source states | Y/N | none |
| 346 | `household_composition_support::household.support.support_amount` | S(5) | `money` / `KRW` | `event_date` / `applicant_debtor` | Observed payment amount; not recognized expense | Y/Y | none |
| 347 | `household_composition_support::household.support.support_frequency` | S(5) | `enum_or_text` / `not_applicable` | `period_scope` / `applicant_debtor` | Observed/claimed frequency | Y/N | none |
| 348 | `household_composition_support::household.support.support_period_end` | S(5) | `date` / `not_applicable` | `statement_period_end` / `applicant_debtor` | Period of support evidence | Y/N | none |
| 349 | `household_composition_support::household.support.support_period_start` | S(5) | `date` / `not_applicable` | `statement_period_start` / `applicant_debtor` | Period of support evidence | Y/N | none |
| 350 | `household_composition_support::household.support.support_provider` | S(5) | `party_role` / `not_applicable` | `not_applicable` / `payer` | Person paying support | N/N | none |
| 351 | `household_composition_support::household.support.support_recipient` | S(5) | `party_role` / `not_applicable` | `not_applicable` / `payee` | Person receiving support | N/N | none |
| 352 | `household_living_expense::household.expense.arrears` | E(5) | `money` / `KRW` | `source_as_of_date` / `applicant_debtor` | Outstanding bill; not assumed paid | Y/Y | none |
| 353 | `household_living_expense::household.expense.beneficiary` | E(5) | `party_role` / `not_applicable` | `not_applicable` / `household_member` | Person/household using service | N/N | none |
| 354 | `household_living_expense::household.expense.billed_amount` | E(5) | `money` / `KRW` | `period_scope` / `applicant_debtor` | Invoice amount | Y/Y | none |
| 355 | `household_living_expense::household.expense.billing_period_end` | E(5) | `date` / `not_applicable` | `statement_period_end` / `applicant_debtor` | Covered service period | Y/N | none |
| 356 | `household_living_expense::household.expense.billing_period_start` | E(5) | `date` / `not_applicable` | `statement_period_start` / `applicant_debtor` | Covered service period | Y/N | none |
| 357 | `household_living_expense::household.expense.expense_kind` | E(5) | `enum_or_text` / `not_applicable` | `not_applicable` / `applicant_debtor` | Source label; legal category separate | N/N | none |
| 358 | `household_living_expense::household.expense.issue_date` | E(5) | `date` / `not_applicable` | `document_issue_date` / `issuer` | Issue date distinct from service period | Y/N | none |
| 359 | `household_living_expense::household.expense.paid_amount` | E(5) | `money` / `KRW` | `event_date` / `applicant_debtor` | Actual payment amount | Y/Y | `context_only` |
| 360 | `household_living_expense::household.expense.payer` | E(5) | `party_role` / `not_applicable` | `not_applicable` / `payer` | Named account holder/payer | N/N | none |

## 계산·법률·양식·갈음/보정의 실제 코드 소비 분리
- **DB 저장 경계**: `db/schema.ts`에서 `document_instances`, `extraction_runs`, `extraction_records`(record ordinal), `extracted_features`(canonical ID/raw JSON/unit/sourceState/quote/bbox), `extraction_field_coverage` 선언 확인. `lib/extraction-row-store.ts`에는 document/page/source hash 바인딩·source-only 조회 코드가 있다. 실제 SQL 행·R2 이미지·원본 사실값을 읽지는 않았다.
- **계산/91입력**: `lib/canonical-field-binding.ts`의 명시적 projection map과 `lib/reference-case-projection.ts`에는 이 2개 family에 대한 직접 계산용 CaseData mapping 없음. `lib/material-calculation-source-gate.ts`는 **#359 paid_amount만 `context_only`**로 지정하며 자동 생계비 인정·월환산/원화 합산은 하지 않도록 한다. #342 가구원 소득, #346 부양금, #352 미납, #354 청구, #359 실납액은 **5개의 서로 다른 회계·증거 의미**다. 금액 기재만으로 실제 검산 성공/계산 결과 도출을 인정하지 않는다.
- **법률95/규칙50/예외46**: 현재 세 원본 카탈로그에서 이 20개의 exact canonical ID 직접 증거 계약 **0개**; 기본 위험 88개 필수 근거 미정의. `lib/legal-evidence-criteria.ts` seed `checks=[]`이고 운영별 승인기준 DB는 미조회. 따라서 미정의/미승인 항목의 **법률 요건 합격률 0%**, 원문/공식 출처·관할·시행일/변호사 승인 전 자동 확정 금지.
- **서식**: `lib/ocr-chain-matrix.ts`에 현재 20 ID exact `OCR_DECLARED_FORM_TARGETS` 0건. 일반 D5100/D5103/D5105 후보는 공식 실 서식의 필수 토큰·월생계비/부양가족 인정값을 뜻하지 않는다.
- **서류·갈음·법원 보정**: `lib/case-requirement-field-plan.ts`는 상담 서류 요구필드와 OCR 후보를 매핑 검토 전 상태로 구별하고, `lib/approve-document-substitution.ts`는 승인된 B+C 갈음의 서류·피처·원천 Fact 확인을 별도 요구한다. `lib/preapproval-correction-item-store.ts`는 `requiredCanonicalFieldIds`·실제 명령 문서/page/기한/응답·접수증을 보존하되 `courtOrderSatisfied:false`다. 이 20개 ID를 쓰는 **실제 사건별 갈음/보정/공식 서식 출력은 미관찰**.
- **기존 회귀 소스**: `tests/household-multirow-ocr-integrity.test.ts`의 다가구원/총원 경합, `tests/feature-lineage-audit.test.ts`의 월별 필수증거/다른 문서 수치 차단, `tests/material-calculation-source-gate.test.ts`의 context-only·중복 분리 등 **존재 확인**. 이번 회차 실제 Node 실행/전체 CI는 **미실행**.

## 재현된 P2 검토 후보 (새로운 법률 확정 오류 판정 아님)
1. **배우자·이혼 증빙의 specialised review candidate 경로 공백 확대**: `spouse_asset_evidence` 및 `divorce_records` 문서에 #341–351이 존재하지만 실제 라우트 family는 `household_composition_support`다. 원본 `reviewScope("household_composition_support")`에서 `SEOUL-406` 후보가 없고, `reviewScope("spouse_synthetic")`에서는 후보가 나온다. 과거 r50/r51 문제와 같은 이름기반 라우팅의 확장 확인. **SEOUL-406의 공식 적용 조건/관할·시행일·변호사 승인은 미검증**이므로 사람 확인 전 법률 로직을 수정하거나 필수성으로 승격하지 않음.
2. **가구원별 지급/비용 중복계상 검토**: #342(다른 가족 수입), #346(지급 부양액), #350/#351(지급자/수령인), #344/#345 및 #348/#349(거주·부양기간)를 동일인·동일 소득기간에 매핑하는 실제 소비처가 직접 typed에는 없다. source-only 증거·사람 역질문을 보존.
3. **청구/미납/실지급 별도 대조**: #352(미납), #354(청구), #359(실납)의 합은 원문 구성관계·이미 환급/보조 받은 금액·지급자·수혜자·청구기간을 검증하지 않고 산출 불가. 잘못된 자동합산을 피하고 검산/법률 재량 자료로 유지.
- 불확실·고위험 법률 인정/산식 의미 변경은 실무자 검토 및 별도 Draft PR 대상. 기존 Draft #51(기간), #54(타인 source), #131(보험 체납 form) 등과 중복 코드 변경·자동 병합 없음. 제품 코드 미변경.

## 보드 일부 검증 ID 5개 (완료하지 않음)
| ID | 독립 기대 / 이번 관찰 | 남은 인수 |
|---|---|---|
| **A3-DATA-010** | 의미 다른 금액 5개와 20 원천 ID, 100 선언 경로, context-only #359 확인. 0 typed ≠ 폐기. | 실제 D1 0/null/상충/당사자·법원 근거 및 보존 재독 |
| **A3-IT-017** | 20 source locator 선언·9문서 sourceOnly/noCrossRecordBorrowing, 저장 테이블/원본 해시 경로 코드 확인. | 서로 다른 가족·페이지 원문에 대한 D1/R2 재조회·hash 및 복수행 차단 |
| **A3-DOC-018** | 9서류/100루트에서 지급자·수혜자·대상·기간 역질문 필요 피처와 field-plan 후보 경로 구별. | 상담→서류요구→갈음/재요청·보정 사건 실체 연결 |
| **A3-CALC-009** | 가족 부양금·소득·청구/체납/실납 5개 금액 종류 구별, #359 material context-only. | 계산18 모듈 실제 입력·산식/중복·월소득/생계비 승인 및 서식 출력 검증 |
| **A3-LAW-008** | 검토 후보 SEOUL-405, 배우자문서 SEOUL-406 후보 공백; 정확 승인 법률 피처 계약 0/20. | 공식 법령·관할/시행일·필요원문·변호사 승인, 미등록/미승인 0% 합격 유지 |

## SHA·범위·다음 시작
- 원본 소스(blob): index `27ecdddd208de82a2f5c675e7482485e3a8838c2`; base family `9884b3fecf44643fefcdc4a421ed66ffc5477b3a`; applicability `6076b26f782c4643a21a7b2f1a8f6261bb588b68`; shared document `9decab974e0909ae24ad927bdfe241d75b71f3a9`. 추가: supplement `63b2bf853acb2e9620a6fb72377dc278ff3cd2a5`; 693 register `dfa1a09cf035a07130e2cf40a6b4e7dae44581d4`; feature-lineage `de81bc3b8c460b8a4dde3fda9e13087e619e74ff`; canonical-binding `60ee5c7762d52b72a165b4f4f8214680eb98f148`; material-gate `0286b44484913b63fa8ec3f7bf0ca59b034d0dab`; DB schema `933f8686845ac14669312dd21bf85e02c62ed5e6`; source store `ec3f6b9d3ad8bf5f9ce4419a6816fadede378125`.
- **최초 등록표/정적 전수 확인: 693/693**. 2차 심층 감사: **360/693 (51.9%)**, 잔여 **333**. 최종 A3 인수 체크 124건 중 **0건 완료**. 이번 회차 제품 코드·운영 DB·D1 migration·사이트/전자제출/법원 인가 확정 실행 없음.
- 다음 **#361 `household_living_expense::household.expense.provider` ~ #380**, 역할 시작 **AX담당자**, 이후 IT/서류/계산/변호사/데이터 순환. #361~362 생활비 공급자/공통비용 뒤 신원·상속 경로를 실제 인덱스 순으로 열거.
