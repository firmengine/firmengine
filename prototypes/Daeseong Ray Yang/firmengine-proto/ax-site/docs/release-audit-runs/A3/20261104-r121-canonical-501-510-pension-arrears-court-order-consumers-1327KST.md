# FirmEngine A3 r121 — canonical OCR #501–510 미납연금·법원 보정명령 증거/계산/법률/양식 소비처 재감사
2026-11-04, KST. 시작 최신 `main` HEAD `cf789996a10c206e8371b1aa782ab3d85918374f`. 범위는 `prototypes/Daeseong Ray Yang/firmengine-proto/ax-site/` 내부 문서만. 전 회차 r120 #491–500(영수증 `20261104-r120-canonical-491-500-pension-vesting-statement-1227KST.md`)에서 계속.

## 업무 순환 · 체크 ID · 검증층
역할 **계산사무장 → 변호사 → 데이터담당자 → IT담당자 → 사용자·서류담당자 → AX담당자**. 이번 부분검증 보드 ID 다섯 개 `A3-CALC-005`, `A3-LAW-013`, `A3-DATA-004`, `A3-IT-020`, `A3-DOC-006`. 전부 **[ ] 유지**, 제품 인수 0/124. AX는 승인 전 법률판정/추론 자동승격 차단 정책 독립 검토, 별도 [x] 체크 없음.

이번은 GitHub **main 실제 JSON/TypeScript 소스의 정적 계약 재조인**, 원본 `bindCanonicalSourceField` V8 동작 시험 **40/40 기술 기대 일치**, `preapproval-correction-item-store.ts`의 원본 `linkedFact` 격리 V8 **4케이스/독립 안전기대 2불일치**. 실제 OCR 파일/페이지/다중행·DB/D1 Fact/typed readback·Node CI·공식 전자양식·변호사 승인·사이트 배포는 모두 **미관찰/미인증**, 테스트 수를 이를 대신한 통과로 표현 금지.

## 최신 인덱스·전체 계약 검산
- canonical index: 독립 기대 **693**, 실제 **693**, 정적 일치
- unique canonical: 독립 기대 **693**, 실제 **693**, 정적 일치
- document types: 독립 기대 **85**, 실제 **85**, 정적 일치
- base OCR families: 독립 기대 **48**, 실제 **48**, 정적 일치
- document-family routes: 독립 기대 **141**, 실제 **141**, 정적 일치
- source slots base+extension+supplement: 독립 기대 **1808**, 실제 **1808**, 정적 일치
- source slot canonical coverage: 독립 기대 **693**, 실제 **693**, 정적 일치
- all index IDs join a source: 독립 기대 **0**, 실제 **0**, 정적 일치
- board A3 check IDs: 독립 기대 **124**, 실제 **124**, 정적 일치
- board completed: 독립 기대 **0**, 실제 **0**, 정적 일치
- calculation modules: 독립 기대 **18**, 실제 **18**, 정적 일치
- calculation declared inputs: 독립 기대 **91**, 실제 **91**, 정적 일치
- calculation unique inputs: 독립 기대 **78**, 실제 **78**, 정적 일치
- risk definitions: 독립 기대 **95**, 실제 **95**, 정적 일치
- legal rules: 독립 기대 **50**, 실제 **50**, 정적 일치
- legal exceptions: 독립 기대 **46**, 실제 **46**, 정적 일치
- local canonical IDs: 독립 기대 **10**, 실제 **10**, 정적 일치
- local source slots: 독립 기대 **10**, 실제 **10**, 정적 일치
- local documentary types: 독립 기대 **2**, 실제 **2**, 정적 일치
- local registered applicability: 독립 기대 **6**, 실제 **6**, 정적 일치
- local source anchor policies: 독립 기대 **10**, 실제 **10**, 정적 일치
- local noCrossRecordBorrowing: 독립 기대 **10**, 실제 **10**, 정적 일치
- direct material matches: 독립 기대 **0**, 실제 **0**, 정적 일치
- direct exact form matches: 독립 기대 **0**, 실제 **0**, 정적 일치
- direct exact legal catalog matches: 독립 기대 **0**, 실제 **0**, 정적 일치
- local hasPeriod true: 독립 기대 **7**, 실제 **7**, 정적 일치
- local hasUnit true: 독립 기대 **4**, 실제 **4**, 정적 일치
추출 원천 1,808 슬롯은 기본 family 1,582, 문서별 extension 207, OCR supplements **19**개를 각 문서×family 단위로 중복 없이 결합한 결과. supplemental 19를 빼면 1,789 슬롯 및 canonical 674개로 잘못 계산되므로 누락 금지. A3 124개 체크 ID 순번과 693 canonical ID 순번은 Appendix A/B를 각각 본 `main` 최신 원본에서 전부 기록.

## 이번 10개 canonical × 증거/소비처/공백
원천 10개 필드는 **2개 증빙서류** (`pension_contribution_statement`, `court_correction_order`), **2 family** (`pension_contribution_benefit`, `procedure_court_orders`), **10개 정확 route**. 10/10 문서 해시/페이지·quote/bbox/필드 라벨/행·대상별 source locator **정적 계약**과 `recordPolicy.noCrossRecordBorrowing=true` 선언 존재. 실제 PDF 페이지 확인이 아님.

| # | canonical ID | 서류@family·원천슬롯 | 타입·단위 ; 기간/주체 | 정확 sourceCondition | 실제 **직접** 소비처 수준 | 보존할 검산·역질문·승인 공백 |
|---:|---|---|---|---|---|---|
| 501 | `pension_contribution_statement::unpaid_amount` | `pension_contribution_statement@pension_contribution_benefit` (1) | money/`KRW` ; not_applicable/document_subject | **미등록/0%** | typed 0 · calc/material 0 · exact form 0 · legal 0 · source-only | 미납액은 납입불능액/납부예정액과 구별. 체납 채무로 승격 시 납입기관·기간·현재 채무증빙·법률 심사 필요. |
| 502 | `pension_contribution_statement::unpaid_months` | `pension_contribution_statement@pension_contribution_benefit` (1) | integer/`month` ; not_applicable/document_subject | **미등록/0%** | typed 0 · calc/material 0 · exact form 0 · legal 0 · source-only | 미납 개월수는 금액이 아님; 연도·월·중복·누적행 검산. |
| 503 | `pension_contribution_statement::unpayable_amount` | `pension_contribution_statement@pension_contribution_benefit` (1) | money/`KRW` ; not_applicable/document_subject | **미등록/0%** | typed 0 · calc/material 0 · exact form 0 · legal 0 · source-only | 납부불능액을 체납액·기납부액과 합산 금지; 행·상태/사유 필요. |
| 504 | `pension_contribution_statement::unpayable_months` | `pension_contribution_statement@pension_contribution_benefit` (1) | integer/`month` ; not_applicable/document_subject | **미등록/0%** | typed 0 · calc/material 0 · exact form 0 · legal 0 · source-only | 납부불능 월수와 미납월수의 포함관계 검토. |
| 505 | `procedure_court_orders::procedure.order.case_number` | `court_correction_order@procedure_court_orders` (1) | string/`not_applicable` ; not_applicable/court | 등록·미승인 | typed 0 · calc/material 0 · exact form 0 · legal 0 · source-only | 사건번호·서류 동일성; 기한 근거 Fact와 혼동 금지. |
| 506 | `procedure_court_orders::procedure.order.court` | `court_correction_order@procedure_court_orders` (1) | party_role/`not_applicable` ; not_applicable/court | 등록·미승인 | typed 0 · calc/material 0 · exact form 0 · legal 0 · source-only | 발령 법원/관할·사건 및 처리기간 확인. |
| 507 | `procedure_court_orders::procedure.order.deadline` | `court_correction_order@procedure_court_orders` (1) | date/`not_applicable` ; due_date/applicant_debtor | 등록·미승인 | typed 0 · calc/material 0 · exact form 0 · legal 0 · source-only | 기한 원문·송달일·보정 항목·법원 안내 대조; legacy court.correctionDeadline 소비처의 canonical 불일치 위험. |
| 508 | `procedure_court_orders::procedure.order.debtor` | `court_correction_order@procedure_court_orders` (1) | party_role/`not_applicable` ; not_applicable/applicant_debtor | 등록·미승인 | typed 0 · calc/material 0 · exact form 0 · legal 0 · source-only | 신청인/채무자 동일성 및 대표/대리 여부 확인. |
| 509 | `procedure_court_orders::procedure.order.effective_date` | `court_correction_order@procedure_court_orders` (1) | date/`not_applicable` ; effective_date/court | 등록·미승인 | typed 0 · calc/material 0 · exact form 0 · legal 0 · source-only | 효력일은 발령일·송달일·보정기한과 다름. |
| 510 | `procedure_court_orders::procedure.order.finality` | `court_correction_order@procedure_court_orders` (1) | enum_or_date/`not_applicable` ; effective_date/court | 등록·미승인 | typed 0 · calc/material 0 · exact form 0 · legal 0 · source-only | 원문 상태 enum/date일 뿐 법률상 확정·종결 자동 승인 금지. |

`canonical-field-binding.ts`의 projection family 목록에 이번 두 family의 typed 대상이 **없음**. `material-calculation-source-gate.ts` / `ocr-chain-matrix.ts::OCR_DECLARED_FORM_TARGETS` 정확 ID 매핑도 0/10. 위험95·법률규칙50·예외46의 정확 canonical ID 문자열 연결 0/10. 이는 **직접 매핑 부재**이지 업무상 무용/삭제/원천 부존재가 아니다. `feature-lineage-audit.ts::reviewScope`의 일반적인 법령·양식·workflow 추천은 승인된 개별 법률/공식 서식 토큰으로 해석 금지.

**간접 소비처 예외:** `lib/preapproval-correction-item-store.ts::validateCorrectionItemDraft`는 legacy `court.correctionDeadline` / `corrections.deadline` 키, 원문 날짜, 동일 document/sourceRef, verified/accepted를 사용한다. #507의 **정확 canonical ID** 결속을 보장하지 않아 직접 typed 매핑 0과 별개의 **보정일정 게이트 간접 사용**이 있다. `db/schema.ts`의 `extraction_records`, `extracted_features` 및 `case_court_correction_item_versions` 저장 계약과 `case-requirements.ts`/`document-substitution.ts` 갈음·법원보정 경로는 선언/코드만 확인. 해당 10개 Fact의 실제 D1 저장/조회·갈음 승인/보정통과는 미실행.

### P2 — 국민연금 확장 4개 적용조건 미등록
#501–504 정확 canonical 은 `shared-document-field-contracts.json`의 `pension_contribution_statement@pension_contribution_benefit` 확장에 있으나 `field-applicability-contracts.json`의 개별 조건은 **4개 모두 null**. 앞 회차 #494–500의 7건과 합쳐 연속 11개 미등록 조사 필요. 해당 4개 **요건의 승인 합격 0%**. `unpaid_amount`(미납 보험료), `unpayable_amount`(납부할 수 없는 보험료), `paid_amount`, `payable_amount`, `standard_monthly_income`은 서로 다른 회계/법률 의미. 미등록이 무조건 납부의무 또는 면책을 의미하지 않음. 금액 KRW 2/10, 월수 month 2/10; 원문 단위·대상·기간 동일성 전 개별 합산/월수→원화 환산 금지.

### P1 미해결 — #507 보정기한 Fact ID 상충 수용의 격리 재현
GitHub `main` `lib/preapproval-correction-item-store.ts` blob `6d11dcfb700909a9fcae7e40fad0713ad8cb05e0`의 **원본 `linkedFact` 술어**에서 TS 인자 타입만 제거하여 V8 실행; `validSourceRef`는 mock `true`로 고정하여 **canonical 검사 분기만** 고립시켰다(전체 validator E2E 아님).

| 합성 Fact 조건 | 독립 안전 기대 | 실제 `linkedFact` 관찰 |
|---|---|---|
| verified/accepted, 동일 orderDocument, canonical #507 양쪽 정확 | true | true |
| Fact.canonicalFieldId가 #505 사건번호로 상충, legacy key 등 상위 제약은 별도 | false | **true (불일치)** |
| fieldObservation.canonicalFieldId가 #505로 상충 | false | **true (불일치)** |
| 다른 orderDocument를 참조 | false | false |

`linkedFact`가 현재 `fact.state`, `fact.recognition`, source document/ref는 검증하지만 `canonicalFieldId`와 `fieldObservation.canonicalFieldId`는 판정하지 않는 것이 원인. 과거 r61에서도 전체 validate 유사 문제를 검출했으며 **기존 Draft PR #149가 수정·회귀를 제안하고 main 미병합 상태**이므로 중복된 새 제품 패치를 하지 않는다. #507 보정기한/송달일/명령일/#509 효력일/#510 확정 상태는 상호 치환 금지; 실제 법원 양식·기한 기준은 사건/변호사 검토 대기. PR #51(기간 요구 false positive) 역시 Draft 미병합.

### P2 — 비기간 피처의 기간 필수판정 과잉
`feature-lineage-audit.ts` **현행 원본 술어** `hasPeriod(role,family) = role !== "not_applicable" || /income|payroll|tax|contribution|transaction|accounting|ledger|medical|education/.test(family)`를 이번 10 슬롯에 적용시 **7/10 true**, 그중 **4개** #501–504는 `temporal_role=not_applicable`인데도 family 이름 `contribution`으로 true. 문서/납입 **기간 검증 자체**를 면제한다는 뜻이 아니라 **개별 필드 기간요건과 문서 기간요건**을 별도 정의해야 하는 후보. 기존 Draft PR #51과 충돌 회피해 main 로직 무변경. `hasUnit`은 실제 4/10 true(2 money, 2 integer), `month`를 KRW로 해석 금지.

## 독립 기술 테스트: 입력·기대·관찰
실제 GitHub `lib/canonical-field-binding.ts` 원본 함수+prefix 정의에서 TypeScript 타입 선언과 non-null assertion만 제거해 **V8 40회 실행**. 각 10 source slot에 네 입력 적용:
1. `{key:local_id,canonicalFieldId:exact_id}` → **기대/관찰** 10/10 `explicit_id`, 동일 ID, `issues=[]`.
2. `{key:local_id}` → **기대/관찰** 10/10 `exact_key`, 동일 ID, `issues=[]`.
3. `{key:"intentionally.wrong_key",canonicalFieldId:exact_id}` → **기대/관찰** 10/10 `unbound`, `canonical_id_key_conflict`.
4. `{key:local_id,canonicalFieldId:"wrong_namespace::"+local_id}` → **기대/관찰** 10/10 `unbound`, `canonical_id_outside_family`.
예: #507 정상 `explicit_id`; 잘못된 key는 `canonical_id_key_conflict`+`canonical_id_outside_family`; #501도 동일 패턴. **40/40은 기술 동작 재현**, OCR 모델 결과/실제 legal outcome/Node CI 통과는 아님.

## 역할별 미완료·보존해야 할 처리
- `A3-CALC-005` 계산사무장: #501 미납액과 #503 납부불능액/타 문서 공적체납액의 동일채무 중복 및 기준월·단위 검산 필요, 금액 자동채무 합산/0원 처리 불가. **[ ]**.
- `A3-LAW-013` 변호사: #507 보정기한 원본 canonical 상충 P1, 법원 사건·송달·보정문구·접수증/법적 기한 승인 미검증, PR #149 검토 대기. **[ ]**.
- `A3-DATA-004` 데이터: 18모듈/91선언입력(78 고유), 정확 typed0, 40/40 원본 binding 격리 통과. D1 원본 Fact→typed SQL/이력 재조회 미실행. **[ ]**.
- `A3-IT-020` IT: 직접 typed/form/legal0 피처를 source-only 보존, source locator/정정 이력·미등록 원인 감사; 운영 저장/미사용큐 미인증. **[ ]**.
- `A3-DOC-006` 서류: 연금납입명세/법원보정명령 원문·발급/송달·문서 SHA/페이지/상세행·소계/갈음 필요서류 확인 미완. **[ ]**.
- AX: 0 소비처/적용조건 null을 자동 비해당/무용/금액0/최종 인정값으로 승격시키지 않는 승인 게이트 E2E 미검증.

실제 고객 문서/개인정보/원본 OCR 사실값/키/.env/비공개 정답은 이 영수증에 포함하지 않았다. 운영 배포·운영 D1 마이그레이션·실제 전자제출·법원 인가 확정 실행 없음.

## 다음 시작 ID · SHA
이번 순차 심층 재감사 **#510/693**; 잔여 **183개**. 다음 시작 **#511 `procedure_court_orders::procedure.order.operative_text`**, 범위 **#511–520**, 다음 회차 선두 **변호사**, 6역할 계속 순환. A3 최종 인수 **0/124**.

| 본 회차 읽은 최신 원본 | GitHub blob SHA |
|---|---|
| `lib/canonical-field-id-index.json` | `27ecdddd208de82a2f5c675e7482485e3a8838c2` |
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
| `lib/material-calculation-source-gate.ts` | `0286b44484913b63fa8ec3f7bf0ca59b034d0dab` |
| `lib/ocr-chain-matrix.ts` | `977de86ba698bd805cc6b95d1384e3b49d0dbb4c` |
| `lib/preapproval-correction-item-store.ts` | `6d11dcfb700909a9fcae7e40fad0713ad8cb05e0` |
| `db/schema.ts` | `933f8686845ac14669312dd21bf85e02c62ed5e6` |
| `docs/PRODUCT_RELEASE_INTEGRATION_BOARD.md` | `a9de6f4a3e34589e6eec59c364d28f2f6c13be31` |

## Appendix A — 최신 canonical OCR 693개 전체 순번
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

## Appendix B — 통합보드 A3 여섯 역할 124 체크 ID 원본 순번
1. `A3-IT-001` — [ ]
2. `A3-IT-002` — [ ]
3. `A3-IT-003` — [ ]
4. `A3-IT-004` — [ ]
5. `A3-IT-005` — [ ]
6. `A3-IT-006` — [ ]
7. `A3-IT-007` — [ ]
8. `A3-IT-008` — [ ]
9. `A3-IT-009` — [ ]
10. `A3-IT-010` — [ ]
11. `A3-IT-011` — [ ]
12. `A3-IT-012` — [ ]
13. `A3-IT-013` — [ ]
14. `A3-IT-014` — [ ]
15. `A3-IT-015` — [ ]
16. `A3-IT-016` — [ ]
17. `A3-IT-017` — [ ]
18. `A3-IT-018` — [ ]
19. `A3-IT-019` — [ ]
20. `A3-IT-020` — [ ]
21. `A3-DOC-001` — [ ]
22. `A3-DOC-002` — [ ]
23. `A3-DOC-003` — [ ]
24. `A3-DOC-004` — [ ]
25. `A3-DOC-005` — [ ]
26. `A3-DOC-006` — [ ]
27. `A3-DOC-007` — [ ]
28. `A3-DOC-008` — [ ]
29. `A3-DOC-009` — [ ]
30. `A3-DOC-010` — [ ]
31. `A3-DOC-011` — [ ]
32. `A3-DOC-012` — [ ]
33. `A3-DOC-013` — [ ]
34. `A3-DOC-014` — [ ]
35. `A3-DOC-015` — [ ]
36. `A3-DOC-016` — [ ]
37. `A3-DOC-017` — [ ]
38. `A3-DOC-018` — [ ]
39. `A3-DOC-019` — [ ]
40. `A3-DOC-020` — [ ]
41. `A3-CALC-001` — [ ]
42. `A3-CALC-002` — [ ]
43. `A3-CALC-003` — [ ]
44. `A3-CALC-004` — [ ]
45. `A3-CALC-005` — [ ]
46. `A3-CALC-006` — [ ]
47. `A3-CALC-007` — [ ]
48. `A3-CALC-008` — [ ]
49. `A3-CALC-009` — [ ]
50. `A3-CALC-010` — [ ]
51. `A3-CALC-011` — [ ]
52. `A3-CALC-012` — [ ]
53. `A3-CALC-013` — [ ]
54. `A3-CALC-014` — [ ]
55. `A3-CALC-015` — [ ]
56. `A3-CALC-016` — [ ]
57. `A3-CALC-017` — [ ]
58. `A3-CALC-018` — [ ]
59. `A3-CALC-019` — [ ]
60. `A3-CALC-020` — [ ]
61. `A3-LAW-001` — [ ]
62. `A3-LAW-002` — [ ]
63. `A3-LAW-003` — [ ]
64. `A3-LAW-004` — [ ]
65. `A3-LAW-005` — [ ]
66. `A3-LAW-006` — [ ]
67. `A3-LAW-007` — [ ]
68. `A3-LAW-008` — [ ]
69. `A3-LAW-009` — [ ]
70. `A3-LAW-010` — [ ]
71. `A3-LAW-011` — [ ]
72. `A3-LAW-012` — [ ]
73. `A3-LAW-013` — [ ]
74. `A3-LAW-014` — [ ]
75. `A3-LAW-015` — [ ]
76. `A3-LAW-016` — [ ]
77. `A3-LAW-017` — [ ]
78. `A3-LAW-018` — [ ]
79. `A3-LAW-019` — [ ]
80. `A3-LAW-020` — [ ]
81. `A3-LAW-021` — [ ]
82. `A3-LAW-022` — [ ]
83. `A3-DATA-001` — [ ]
84. `A3-DATA-002` — [ ]
85. `A3-DATA-003` — [ ]
86. `A3-DATA-004` — [ ]
87. `A3-DATA-005` — [ ]
88. `A3-DATA-006` — [ ]
89. `A3-DATA-007` — [ ]
90. `A3-DATA-008` — [ ]
91. `A3-DATA-009` — [ ]
92. `A3-DATA-010` — [ ]
93. `A3-DATA-011` — [ ]
94. `A3-DATA-012` — [ ]
95. `A3-DATA-013` — [ ]
96. `A3-DATA-014` — [ ]
97. `A3-DATA-015` — [ ]
98. `A3-DATA-016` — [ ]
99. `A3-DATA-017` — [ ]
100. `A3-DATA-018` — [ ]
101. `A3-DATA-019` — [ ]
102. `A3-DATA-020` — [ ]
103. `A3-DATA-021` — [ ]
104. `A3-DATA-022` — [ ]
105. `A3-AX-001` — [ ]
106. `A3-AX-002` — [ ]
107. `A3-AX-003` — [ ]
108. `A3-AX-004` — [ ]
109. `A3-AX-005` — [ ]
110. `A3-AX-006` — [ ]
111. `A3-AX-007` — [ ]
112. `A3-AX-008` — [ ]
113. `A3-AX-009` — [ ]
114. `A3-AX-010` — [ ]
115. `A3-AX-011` — [ ]
116. `A3-AX-012` — [ ]
117. `A3-AX-013` — [ ]
118. `A3-AX-014` — [ ]
119. `A3-AX-015` — [ ]
120. `A3-AX-016` — [ ]
121. `A3-AX-017` — [ ]
122. `A3-AX-018` — [ ]
123. `A3-AX-019` — [ ]
124. `A3-AX-020` — [ ]
