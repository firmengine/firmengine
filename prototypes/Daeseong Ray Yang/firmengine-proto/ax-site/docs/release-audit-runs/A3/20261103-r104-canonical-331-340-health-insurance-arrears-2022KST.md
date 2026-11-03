# FirmEngine A3 r104 — canonical #331–340 건강보험 체납 증거·계산·법률·서식 소비처 재감사

- 감사 기준일: **2026-11-03 KST**. GitHub `main` 검증 시점 HEAD는 `12ab967c26ddb78632b6a00e75cc8dee961239f0`; 변경 허용 범위 `prototypes/Daeseong Ray Yang/firmengine-proto/ax-site/`만.
- 전회 r103 #321–330 후속 **#331~340** 10개 ID. 전회 r17/r52 동일구간 영수증·최근 main 커밋·오픈 Draft PR #131/관련 스키마/원본 함수 대조.
- 담당 역할 순환: 변호사 → 사용자·서류담당자 → 계산사무장 → 데이터담당자 → IT담당자 → AX담당자. 부분 누적 체크 ID 다섯 개: `A3-LAW-003`, `A3-DOC-008`, `A3-CALC-015`, `A3-DATA-008`, `A3-IT-003`. 전부 **미완료 [ ]**.
- 검증 종류: 실제 GitHub JSON/TypeScript 코드 정적 join, 원본 `calculationSourceCellIssues()`의 타입제거 V8 격리 **20/20 현재 분기 재현**, 원본 `hasPeriod/hasUnit` 20판정, 독립 산술·교차필드 반례 3종. TypeScript 런타임 전체와 SQL/실 OCR/실 법원서식 실행이 아니다. 금액 `normalizeMoney`는 **합성 stub**이므로 KRW 정수/외화 분기만 검사하고 실제 원화 변환 정확성은 검증하지 않았다.
- **보안:** 합성 값과 공개 스키마 ID만 사용; 실제 고객 원문·식별정보·OCR fact·키/.env·비공개 정답 0건. 운영 배포/D1 마이그레이션/전자제출/인가 확정 0건.

## 1. 실제 원천 집계 및 판정 경계

| 검증 항목 | 기대값/독립 확인값 | 증빙 종류 |
|---|---:|---|
| canonical ID 순번/중복 | 693/693, 중복 0 | `lib/canonical-field-id-index.json` 전체 열거 |
| 85 문서 / 48 패밀리 | 85 / 48 | `reference-intake-catalog.json` × `document-agent-field-contracts.json` |
| 문서×패밀리 route/선언 원천 슬롯 | 141/1808 | `shared-document-field-contracts.json` + `ocr-field-supplements.json`와 base 병합 전수 순회 |
| 정적 고아/미등록 canonical | 0/0 | 693 인덱스와 1,808 슬롯 set 양방향 차집합 |
| 이번 ID/원천 슬롯 | 10/10 | `social_insurance_arrears@health_insurance_arrears` 각 1 슬롯 |
| 필드별 적용조건 | 10/10 등록, **법률 승인 0/10 확인** | `field-applicability-contracts.json` `source_conditional`은 적용 승인과 다름 |
| 직접 typed/서식 token/계산 선언 | 0/10 · 0/10 · 정확 ID 직접산식 0/10 | `canonical-field-binding.ts`, `ocr-chain-matrix.ts`, 계산 스펙 18/91 |
| Material gate | **#340 1/10** `must_reconcile → debt.principal` | `material-calculation-source-gate.ts`; 자동 부채 인식 아님 |
| 법률 위험/규칙/예외 | 95/50/46 | `risk-catalog.json`, `legal-catalog.json`, `legal-exceptions.json` |
| 법률 증거 승인 seed | `checks=[]`, **실무자 승인 미조회** | `legal-evidence-criteria.ts`; 운영 기준정보 상태는 미관찰 |
| 계산 모듈 / 입력 / 고유 입력 | 18/91/78 | `reference-decision-tables.json` 전체 계산/입력 선언 |
| 원본 V8 필드 검사 / hasPeriod·hasUnit | 20/20 현행 재현 / 20개 술어 적용 | 원본 함수에서 타입만 제거·stub 한정 |
| 체크리스트 전체 | 124/124, 인수 완료 0 | 중앙 보드에서 ID `- [ ] **A3-***` 직접 순회 |

`source_conditional`/원천 증거 필요와 법률 판단 승인/적격한 계산 fact는 서로 다르다. 미등록·미승인 조건은 자동 합격 **0%**. 제품 전체 인수도 **0/124** 유지.

## 2. canonical 10개 원천·단위·기간·대상·소비처/검토 공백

필드별 실제 원본 document SHA·page·bbox·quote·복수행 row ID·부과개월/잔액기준일·대상인식·D1 Fact/typed 저장/재조회는 **전부 미관찰**. 아래 원천은 관측 문서가 아니라 선언 경로다. `required_source_anchor`는 정확 label+row+quote/bbox+document hash/page를 요구하며 행간 차용 금지 선언만 확인.

| # | 실제 canonical | 원천 문서 @ 패밀리 (슬롯) | 타입·원단위·시간역할·대상 | 조건·정확한 소비처 | 독립 검산·역질문 |
|---:|---|---|---|---|---|
| 331 | `health_insurance_arrears::as_of_date` | `social_insurance_arrears@health_insurance_arrears` (1) | `date` / source date format normalized to ISO without loss / `balance_as_of_date` / `subscriber` | `source_conditional`(승인 전); typed **0**; material 직접 0; exact form 0; approved legal 0 | 기준일(잔액 cut-off)과 실제 채무액·동일 납부자·부과기간의 결속, 발급일과 구별 |
| 332 | `health_insurance_arrears::authority` | `social_insurance_arrears@health_insurance_arrears` (1) | `party_role` / not_applicable / `not_applicable` / `subscriber` | `source_conditional`(승인 전); typed **0**; material 직접 0; exact form 0; approved legal 0 | 보험기관/청구권자와 가입자 구별; 법률상 채권확정 아님 |
| 333 | `health_insurance_arrears::disposal_cost` | `social_insurance_arrears@health_insurance_arrears` (1) | `money` / currency and exact source unit if monetary / `not_applicable` / `subscriber` | `source_conditional`(승인 전); typed **0**; material 직접 0; exact form 0; approved legal 0 | 처분/징수비용 별도 원천; 원금·총계와의 포함관계 확인 |
| 334 | `health_insurance_arrears::issue_date` | `social_insurance_arrears@health_insurance_arrears` (1) | `date` / source date format normalized to ISO without loss / `document_issue_date` / `subscriber` | `source_conditional`(승인 전); typed **0**; material 직접 0; exact form 0; approved legal 0 | 발급일은 기준일(#331)·부과기간(#336~337)과 서로 다른 날짜 |
| 335 | `health_insurance_arrears::late_charge` | `social_insurance_arrears@health_insurance_arrears` (1) | `money` / currency and exact source unit if monetary / `not_applicable` / `subscriber` | `source_conditional`(승인 전); typed **0**; material 직접 0; exact form 0; approved legal 0 | 연체금은 미납 원보험료(#340)와 분리; 통화·단위·징수근거 |
| 336 | `health_insurance_arrears::period_end` | `social_insurance_arrears@health_insurance_arrears` (1) | `date` / source date format normalized to ISO without loss / `statement_period_end` / `subscriber` | `source_conditional`(승인 전); typed **0**; material 직접 0; exact form 0; approved legal 0 | 부과기간 종료 < 시작의 교차필드 검증; 단순 날짜 유효검사와 분리 |
| 337 | `health_insurance_arrears::period_start` | `social_insurance_arrears@health_insurance_arrears` (1) | `date` / source date format normalized to ISO without loss / `statement_period_start` / `subscriber` | `source_conditional`(승인 전); typed **0**; material 직접 0; exact form 0; approved legal 0 | 부과기간 시작; 납부기록/분납/이전월의 중복 청구 구별 |
| 338 | `health_insurance_arrears::subscriber` | `social_insurance_arrears@health_insurance_arrears` (1) | `party_role` / not_applicable / `not_applicable` / `subscriber` | `source_conditional`(승인 전); typed **0**; material 직접 0; exact form 0; approved legal 0 | 가입자·피부양자·실제 납부책임자·신청인 동일성은 별도 증명 |
| 339 | `health_insurance_arrears::total_arrear` | `social_insurance_arrears@health_insurance_arrears` (1) | `money` / currency and exact source unit if monetary / `not_applicable` / `subscriber` | `source_conditional`(승인 전); typed **0**; material 직접 0; exact form 0; approved legal 0 | 총체납액은 세부합계와 동일 객체·기준일의 검산 대상, 재합산 금지 |
| 340 | `health_insurance_arrears::unpaid_contribution` | `social_insurance_arrears@health_insurance_arrears` (1) | `money` / currency and exact source unit if monetary / `not_applicable` / `subscriber` | `source_conditional`(승인 전); typed **0**; `must_reconcile → debt.principal`(검산 계약); exact form 0; approved legal 0 | must_reconcile→debt.principal은 증거/typed 일치 대조 계약; 공적채권 우선순위 법률 승인 별개 |

정적 `hasPeriod`는 10개 중 4개 true (#331/#334/#336/#337), `hasUnit`는 4개 true (#333/#335/#339/#340). 금액 셀은 local period 필요 플래그 false여도 동일 원천 행·부과기간·기준일 결속 의무를 면제하는 것은 아니다. `recordPolicy.sourceOnly/noCrossRecordBorrowing` 선언 및 `db/schema.ts`의 추출 관측/행 저장 테이블은 존재하지만 실제 환경 재조회 **0건**.

## 3. 재현 가능한 20개 V8 격리시험 — 입력 / 현재 기대 / 실제 반환

테스트 코드는 `lib/ocr-calculation-input.ts`의 `validDate`, `validTime`, `calculationSourceCellIssues` 본문을 타입 annotation/인터페이스·import만 제거하여 동일 분기 실행. 단위 변환 의존 함수만 합성 `normalizeMoney` stub(정수 KRW만 exact) 주입. 입력이 `not_seen`이면 `[]`을 반환해도 **합격·0·비해당**은 아니다.

| ID | 합성 시나리오 | value / unit / quote / sourceState | **현행 코드** 기대 | 실제 관찰 | 일치 |
|---:|---|---|---|---|---|
| 331 | balance date ISO | `2026-11-03` / `null` / `2026-11-03` / `present` | `[]` | `[]` | 예 |
| 331 | balance date impossible | `2026-02-30` / `null` / `2026-02-30` / `present` | `["SOURCE_DATE_INVALID"]` | `["SOURCE_DATE_INVALID"]` | 예 |
| 332 | authority text only | `health agency` / `null` / `health agency` / `present` | `[]` | `[]` | 예 |
| 332 | authority unverified subject | `unverified` / `null` / `unverified` / `present` | `[]` | `[]` | 예 |
| 333 | disposal cost missing unit | `1000` / `null` / `1,000 KRW` / `present` | `["SOURCE_MONETARY_UNIT_MISSING"]` | `["SOURCE_MONETARY_UNIT_MISSING"]` | 예 |
| 333 | disposal cost won | `1000` / `KRW` / `1000 KRW` / `present` | `[]` | `[]` | 예 |
| 334 | issue date invalid | `2026-13-01` / `null` / `2026-13-01` / `present` | `["SOURCE_DATE_INVALID"]` | `["SOURCE_DATE_INVALID"]` | 예 |
| 334 | issue date valid | `2026-11-03` / `null` / `2026-11-03` / `present` | `[]` | `[]` | 예 |
| 335 | late charge currency quote conflict | `1000` / `KRW` / `1000 USD` / `present` | `[]` | `[]` | 예 |
| 335 | late charge foreign unit | `1000` / `USD` / `1000 USD` / `present` | `["SOURCE_MONEY_NOT_EXACT_KRW"]` | `["SOURCE_MONEY_NOT_EXACT_KRW"]` | 예 |
| 336 | period end valid | `2026-01-01` / `null` / `2026-01-01` / `present` | `[]` | `[]` | 예 |
| 336 | period end impossible | `2026-02-30` / `null` / `2026-02-30` / `present` | `["SOURCE_DATE_INVALID"]` | `["SOURCE_DATE_INVALID"]` | 예 |
| 337 | period start later than period end (local cell) | `2026-12-01` / `null` / `2026-12-01` / `present` | `[]` | `[]` | 예 |
| 337 | period start invalid | `2026-00-01` / `null` / `2026-00-01` / `present` | `["SOURCE_DATE_INVALID"]` | `["SOURCE_DATE_INVALID"]` | 예 |
| 338 | subscriber unverified | `unverified member` / `null` / `unverified member` / `present` | `[]` | `[]` | 예 |
| 338 | subscriber not seen | `` / `null` / `null` / `not_seen` | `[]` | `[]` | 예 |
| 339 | total without component cross-check | `130` / `KRW` / `130 KRW` / `present` | `[]` | `[]` | 예 |
| 339 | explicit zero source | `0` / `KRW` / `0 KRW` / `present` | `[]` | `[]` | 예 |
| 340 | premium value quote conflicts currency | `100` / `KRW` / `100 USD` / `present` | `[]` | `[]` | 예 |
| 340 | premium missing quote | `100` / `KRW` / `null` / `present` | `["SOURCE_QUOTE_MISSING"]` | `["SOURCE_QUOTE_MISSING"]` | 예 |

**독립 업무 기대와 현재 로컬 함수의 분리된 3종 반례:**

1. **통화 상충:** #335/#340의 quote `1000 USD`/unit `KRW`은 로컬 오류 `[]`. 독립 업무 기대는 **HOLD(원문 통화·환산경로·단위 재확인)**. 제품 상위 가드가 검출하는지는 미관찰.
2. **합계 불일치:** 합성 동일 가입자·동일 기준일 원천 #340 원보험료 `100` + #335 연체금 `20` + #333 비용 `5` = **독립 기대 125**인데 #339 총체납액 `130`. 개별 금액 셀 모두 `[]`; **부품합과 총계 차이 5**는 미검증 교차행 경고 대상. 다만 합계가 해당 비용을 포함하는지 원문 청구근거가 확인되기 전에는 125를 법정 총액으로 확정하지 않는다.
3. **기간 역전:** #337 시작 `2026-12-01` / #336 종료 `2026-01-01`은 각각 유효한 단일 날짜여서 local `[]`; **독립 기대는 교차기간 HOLD**. 개별 날짜 유효검사 통과와 동일 주체·부과기간 검증 합격은 다르다.

상기 20/20은 기존 코드 **현행 동작 일치**를 의미한다. 정상/비정상 입력을 안전하게 거부한 비율이 아니다. 실제 제품 오류 확정이나 법률 효력 변경 근거로 사용 불가.

## 4. A3 체크 ID 5개 증빙 누적 — 모두 [ ] 유지

| 체크 ID | 이번 실제 관찰 | 독립 기대 / 미완료 사유 |
|---|---|---|
| `A3-LAW-003` | #340 체납 본금 검산 계약과 원본 계약에 'not ordinary loan principal' 명시, 95/50/46 정적 카탈로그, 승인 법률 seed empty | 우선권·납부의무자·법원 관할·시행일별 공식 근거, 변호사 승인/실제 법률 run 미인증 |
| `A3-DOC-008` | 사회보험 체납 증빙 1문서×10피처, 기간/납부자/보험기관/연체금·비용·총계 원천계약 및 원문앵커 정의 확인 | 실제 발급서/공과금/압류·갈음 승인/보정명령 실문서 없음. 사용자에게 발급처·월별 내역·가입자 증명 역질문 필요 |
| `A3-CALC-015` | #333/#335/#339/#340 세부/총액 구분, 합성 100+20+5 vs 130 반례; #340만 must_reconcile | 동일 청구기간·금액 구성 내역과 D1 typed·원금·우선분류 검산 실행 없음, 세부액·합계 중복합산 금지 |
| `A3-DATA-008` | 693/693 index↔slot 조인, 10개 1패밀리·1문서/필드, 원천 exact sourceAnchor 선언 | 원문 인용·문서해시/페이지·bbox·복수 행·동일 가입자 여부·D1 Fact/typed 관찰 0건 |
| `A3-IT-003` | 18개 산식/91 입력/78 unique 정적 대조, #331–340 직접 typed·calculation 0; OCR 20/20 현행 재현 | 산식 실행·Node CI·staging D1/R2/Cron·실제 서식/변호사 승인은 미인증 |

## 5. 후속 승인·변경·경계

- `feature-lineage-audit.ts` 일반 후보 서식/법률 scope는 **검토후보**일 뿐 승인된 정확 token/법률계약이 아니다. 보험 체납 `health_insurance_arrears`가 보험자산 `D5101`로 오분류될 수 있는 별도 이슈는 **Draft PR #131 (main 미병합)** 에서 이미 다룬다. 이번에 main 코드 중복수정 없음.
- `document-substitution.ts`는 verified+accepted current Fact·문서/페이지 검증 정책을 요구하고 `preapproval-correction-item-store.ts`는 사람 지정 `requiredCanonicalFieldIds`와 법원 명령 출처 버전을 요구한다. 10개 ID의 직접 개별 갈음·보정 인스턴스 **미관찰**; 원문과 법원확정 사실을 만들지 않는다.
- source-only 9개는 폐기·불필요가 아니라 계산 제외/증거·기간검산·법적 우선순위 확인·역질문 대상으로 보존. #340도 아직 법적 인정된 `debt.principal`이 아니다.
- 원문 `not_seen`, `null`, 증거 있는 명시적 `0`, `explicit_none`, `not_applicable`, `conflicting`, `source_only`, `approved_for_evidence_routing`은 서로 다른 값/상태. 사람 승인 없이 자동 변경 금지.
- 원격 main 최신 HEAD 및 보드 blob SHA를 변경 직전 재검증해 기존 타 에이전트 수정은 유지. 이번에는 영수증과 지정 체크 ID 부분 누적만 docs 변경. 전체 Node CI/실 OCR/실 D1·R2·Cron/공식 양식/변호사 승인·운영 배포 **모두 미인증**. 운영 마이그레이션·전자제출 수행 없음.

**누적:** canonical 전체 정적 ID/슬롯 열거 **693/693**, 순차 심층 #340/693, A3 제품 인수 **0/124**. **다음 시작 ID #341 `health_insurance_payment::amount_paid`**, 조사 범위 **#341–350**, 주역 **사용자·서류담당자** 시작 역할 순환. 보험료 체납 vs 납부액·납부기간·현재 미납잔액·같은 사람·동일 월 중복 공제/상계와 서식·법률 소비처 검증.

## 부록 A. 실제 최신 canonical OCR 693개 고유 ID 전체 순번

1. `account_garnishment::account_holder`
2. `account_garnishment::account_id`
3. `account_garnishment::court_or_authority`
4. `account_garnishment::creditor`
5. `account_garnishment::effective_date`
6. `account_garnishment::garnishment_amount`
7. `account_garnishment::issue_date`
8. `account_garnishment::released_amount`
9. `account_garnishment::seized_amount`
10. `account_garnishment::status`
11. `accounting_source::account_name`
12. `accounting_source::closing_balance`
13. `accounting_source::credits`
14. `accounting_source::debits`
15. `accounting_source::entity`
16. `accounting_source::issue_date`
17. `accounting_source::opening_balance`
18. `accounting_source::period_end`
19. `accounting_source::period_start`
20. `accounting_source::source_total`
21. `applicant_narrative_statement::identity.statement.admission_or_correction`
22. `applicant_narrative_statement::identity.statement.author`
23. `applicant_narrative_statement::identity.statement.event_end`
24. `applicant_narrative_statement::identity.statement.event_start`
25. `applicant_narrative_statement::identity.statement.narrative_text`
26. `applicant_narrative_statement::identity.statement.signature_status`
27. `applicant_narrative_statement::identity.statement.signed_at`
28. `applicant_narrative_statement::identity.statement.source_references`
29. `applicant_narrative_statement::identity.statement.statement_version`
30. `applicant_narrative_statement::identity.statement.topic`
31. `application_identity_venue::procedure.application.accepted_at`
32. `application_identity_venue::procedure.application.address`
33. `application_identity_venue::procedure.application.applicant_name`
34. `application_identity_venue::procedure.application.case_number`
35. `application_identity_venue::procedure.application.court`
36. `application_identity_venue::procedure.application.jurisdiction_exception`
37. `application_identity_venue::procedure.application.ordinary_venue_basis`
38. `application_identity_venue::procedure.application.phone_home`
39. `application_identity_venue::procedure.application.phone_mobile`
40. `application_identity_venue::procedure.application.phone_work`
41. `application_identity_venue::procedure.application.resident_id`
42. `application_identity_venue::procedure.application.ruleset_id`
43. `application_identity_venue::procedure.application.submitted_at`
44. `application_identity_venue::procedure.application.transition_rule`
45. `application_identity_venue::procedure.application_date`
46. `application_identity_venue::procedure.venue`
47. `asset_transfer_disposition::asset_id`
48. `asset_transfer_disposition::consideration`
49. `asset_transfer_disposition::market_value`
50. `asset_transfer_disposition::proceeds_received`
51. `asset_transfer_disposition::registration_date`
52. `asset_transfer_disposition::relationship`
53. `asset_transfer_disposition::review_status`
54. `asset_transfer_disposition::transaction_date`
55. `asset_transfer_disposition::transferee`
56. `asset_transfer_disposition::transferor`
57. `asset_transfer_disposition::use_of_proceeds`
58. `bank_account_balance::account_holder`
59. `bank_account_balance::account_id`
60. `bank_account_balance::account_status`
61. `bank_account_balance::balance`
62. `bank_account_balance::balance_as_of`
63. `bank_account_balance::currency`
64. `bank_account_balance::institution`
65. `bank_account_balance::issue_date`
66. `bank_transactions::account_id`
67. `bank_transactions::amount`
68. `bank_transactions::counterparty`
69. `bank_transactions::direction`
70. `bank_transactions::issue_date`
71. `bank_transactions::memo`
72. `bank_transactions::period_end`
73. `bank_transactions::period_start`
74. `bank_transactions::post_balance`
75. `bank_transactions::transaction_datetime`
76. `bank_transactions::transaction_id`
77. `bank_transactions::transaction_nature`
78. `business_asset_inventory::acquisition_date`
79. `business_asset_inventory::book_value`
80. `business_asset_inventory::condition`
81. `business_asset_inventory::disposal_restriction`
82. `business_asset_inventory::goodwill_contract`
83. `business_asset_inventory::market_value`
84. `business_asset_inventory::quantity`
85. `business_asset_inventory::quantity_unit`
86. `business_assets_liabilities::as_of_date`
87. `business_assets_liabilities::asset_or_claim_id`
88. `business_assets_liabilities::business_entity`
89. `business_assets_liabilities::gross_value`
90. `business_assets_liabilities::item_kind`
91. `business_assets_liabilities::ownership_interest`
92. `business_assets_liabilities::payable_amount`
93. `business_assets_liabilities::period_end`
94. `business_assets_liabilities::period_start`
95. `business_assets_liabilities::receivable_amount`
96. `business_assets_liabilities::secured_payoff`
97. `business_costs_and_ledgers::income.business_cost.accounting_basis`
98. `business_costs_and_ledgers::income.business_cost.business_continuity_flag`
99. `business_costs_and_ledgers::income.business_cost.business_entity`
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

## 부록 B. 단일 중앙 보드 A3 124개 ID 전체 순번(체크 상태 보존)

### IT
- [ ] `A3-IT-001`
- [ ] `A3-IT-002`
- [ ] `A3-IT-003`
- [ ] `A3-IT-004`
- [ ] `A3-IT-005`
- [ ] `A3-IT-006`
- [ ] `A3-IT-007`
- [ ] `A3-IT-008`
- [ ] `A3-IT-009`
- [ ] `A3-IT-010`
- [ ] `A3-IT-011`
- [ ] `A3-IT-012`
- [ ] `A3-IT-013`
- [ ] `A3-IT-014`
- [ ] `A3-IT-015`
- [ ] `A3-IT-016`
- [ ] `A3-IT-017`
- [ ] `A3-IT-018`
- [ ] `A3-IT-019`
- [ ] `A3-IT-020`

### DOC
- [ ] `A3-DOC-001`
- [ ] `A3-DOC-002`
- [ ] `A3-DOC-003`
- [ ] `A3-DOC-004`
- [ ] `A3-DOC-005`
- [ ] `A3-DOC-006`
- [ ] `A3-DOC-007`
- [ ] `A3-DOC-008`
- [ ] `A3-DOC-009`
- [ ] `A3-DOC-010`
- [ ] `A3-DOC-011`
- [ ] `A3-DOC-012`
- [ ] `A3-DOC-013`
- [ ] `A3-DOC-014`
- [ ] `A3-DOC-015`
- [ ] `A3-DOC-016`
- [ ] `A3-DOC-017`
- [ ] `A3-DOC-018`
- [ ] `A3-DOC-019`
- [ ] `A3-DOC-020`

### CALC
- [ ] `A3-CALC-001`
- [ ] `A3-CALC-002`
- [ ] `A3-CALC-003`
- [ ] `A3-CALC-004`
- [ ] `A3-CALC-005`
- [ ] `A3-CALC-006`
- [ ] `A3-CALC-007`
- [ ] `A3-CALC-008`
- [ ] `A3-CALC-009`
- [ ] `A3-CALC-010`
- [ ] `A3-CALC-011`
- [ ] `A3-CALC-012`
- [ ] `A3-CALC-013`
- [ ] `A3-CALC-014`
- [ ] `A3-CALC-015`
- [ ] `A3-CALC-016`
- [ ] `A3-CALC-017`
- [ ] `A3-CALC-018`
- [ ] `A3-CALC-019`
- [ ] `A3-CALC-020`

### LAW
- [ ] `A3-LAW-001`
- [ ] `A3-LAW-002`
- [ ] `A3-LAW-003`
- [ ] `A3-LAW-004`
- [ ] `A3-LAW-005`
- [ ] `A3-LAW-006`
- [ ] `A3-LAW-007`
- [ ] `A3-LAW-008`
- [ ] `A3-LAW-009`
- [ ] `A3-LAW-010`
- [ ] `A3-LAW-011`
- [ ] `A3-LAW-012`
- [ ] `A3-LAW-013`
- [ ] `A3-LAW-014`
- [ ] `A3-LAW-015`
- [ ] `A3-LAW-016`
- [ ] `A3-LAW-017`
- [ ] `A3-LAW-018`
- [ ] `A3-LAW-019`
- [ ] `A3-LAW-020`
- [ ] `A3-LAW-021`
- [ ] `A3-LAW-022`

### DATA
- [ ] `A3-DATA-001`
- [ ] `A3-DATA-002`
- [ ] `A3-DATA-003`
- [ ] `A3-DATA-004`
- [ ] `A3-DATA-005`
- [ ] `A3-DATA-006`
- [ ] `A3-DATA-007`
- [ ] `A3-DATA-008`
- [ ] `A3-DATA-009`
- [ ] `A3-DATA-010`
- [ ] `A3-DATA-011`
- [ ] `A3-DATA-012`
- [ ] `A3-DATA-013`
- [ ] `A3-DATA-014`
- [ ] `A3-DATA-015`
- [ ] `A3-DATA-016`
- [ ] `A3-DATA-017`
- [ ] `A3-DATA-018`
- [ ] `A3-DATA-019`
- [ ] `A3-DATA-020`
- [ ] `A3-DATA-021`
- [ ] `A3-DATA-022`

### AX
- [ ] `A3-AX-001`
- [ ] `A3-AX-002`
- [ ] `A3-AX-003`
- [ ] `A3-AX-004`
- [ ] `A3-AX-005`
- [ ] `A3-AX-006`
- [ ] `A3-AX-007`
- [ ] `A3-AX-008`
- [ ] `A3-AX-009`
- [ ] `A3-AX-010`
- [ ] `A3-AX-011`
- [ ] `A3-AX-012`
- [ ] `A3-AX-013`
- [ ] `A3-AX-014`
- [ ] `A3-AX-015`
- [ ] `A3-AX-016`
- [ ] `A3-AX-017`
- [ ] `A3-AX-018`
- [ ] `A3-AX-019`
- [ ] `A3-AX-020`

## 부록 C. 이번 회차 소스 blob SHA / 재현 자료

- `lib/canonical-field-id-index.json`: `27ecdddd208de82a2f5c675e7482485e3a8838c2`
- `lib/document-agent-field-contracts.json`: `9884b3fecf44643fefcdc4a421ed66ffc5477b3a`
- `lib/field-applicability-contracts.json`: `6076b26f782c4643a21a7b2f1a8f6261bb588b68`
- `lib/shared-document-field-contracts.json`: `9decab974e0909ae24ad927bdfe241d75b71f3a9`
- `lib/ocr-field-supplements.json`: `63b2bf853acb2e9620a6fb72377dc278ff3cd2a5`
- `lib/reference-intake-catalog.json`: `ae6aa4fd2ef11ee0266b5ad05b2f9a96164daa99`
- `lib/reference-decision-tables.json`: `6924e3977caf748ce8a3d617fae15aff7d2fe2ce`
- `lib/legal-catalog.json`: `b0898d74f1df69b19ecf6e81cdff0ed09e8d885e`
- `lib/risk-catalog.json`: `e96dd0926e3ae9be5a5573d4551538ba294c4d2e`
- `lib/legal-exceptions.json`: `6e51197226bfd8320e1147d8df3f12c11e00927c`
- `lib/ocr-chain-matrix.ts`: `977de86ba698bd805cc6b95d1384e3b49d0dbb4c`
- `lib/canonical-field-binding.ts`: `60ee5c7762d52b72a165b4f4f8214680eb98f148`
- `lib/material-calculation-source-gate.ts`: `0286b44484913b63fa8ec3f7bf0ca59b034d0dab`
- `lib/ocr-calculation-input.ts`: `8f7f51bf41f7c944b76419d7cc894e49ac771473`
- `lib/feature-lineage-audit.ts`: `de81bc3b8c460b8a4dde3fda9e13087e619e74ff`
- `lib/legal-evidence-criteria.ts`: `6c0b94535700d4fa4d356f8a91d5b9440b5ac52a`
