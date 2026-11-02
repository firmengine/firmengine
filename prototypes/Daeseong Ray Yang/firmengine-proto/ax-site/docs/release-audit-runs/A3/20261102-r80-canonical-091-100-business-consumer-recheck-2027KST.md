# FirmEngine A3 r80 — canonical #091–100 사업 자산/비용의 증거·계산·법률·서식 실제 소비처 감사

작성: **2026-11-02 20:27 KST** · 범위: `prototypes/Daeseong Ray Yang/firmengine-proto/ax-site/` 하위 **A3만**. 실고객 자료·원본 OCR 사실값·PII·키/환경변수 사용 또는 공개 저장 없음. 이전 [r79 #081–090](20261102-r79-canonical-081-090-business-assets-consumer-recheck-1925KST.md) 이후 #091에서 이어서 수행.

## 1. 최신 main·최근 PR·기준 코드·6역할

- 감사 시점 GitHub `main` HEAD: `1849f8a88acad6fe59309ee5bda6bb0a5addbda7`; 중앙 보드 blob: `02ca6f9727ecf741299487fa61d9de4d48ddc5f3`. 최근 병렬 A1/A2/A4 커밋이 존재하므로 같은 파일 동시 교체 금지.
- 미병합 Draft [PR #30](https://github.com/firmengine/firmengine/pull/30) (사업비용 실제 소비후보), [PR #51](https://github.com/firmengine/firmengine/pull/51) (기간 검출), [PR #179](https://github.com/firmengine/firmengine/pull/179) (자산처분 후행증거). **본 감사에서 재병합·중복 정책 수정 없음**.
- 역할 순서: **IT → 사용자·서류 → 계산사무장 → 변호사 → 데이터 → AX**. 이번 보드 부분 검증 ID 5개: `A3-IT-007`, `A3-DOC-007`, `A3-CALC-007`, `A3-LAW-014`, `A3-DATA-010`. 모두 **[ ] 유지**. AX 소비처 발견은 영수증에 기록, 완료 인수 처리 금지.
- 전수 원천: canonical index `693 unique`, `85` documents, `48` families, `1,808` document-family-canonical slots, 고아/중복/비등록 ID **0**. 18개 계산×입력선언 전체 **91개**, risk95/rules50/exceptions46. A3 6담당 보드 ID **124개**를 본문과 부록에서 실제 최신 보드 순서로 열거.
- 이번 범위 **10개 canonical / 46개 문서-필드 슬롯 / 9종 문서 / 2 OCR family**. exact 적용조건 **10/10 등록**, 단 **법률승인 0/10**. direct typed 0/10, material `must_reconcile` 0/10, direct form token 0/10, risk/rules/exception의 정확 canonical 승인계약 0/10. **#099·#100은 typed가 아니라 별도 사업소득 월별 사전검토에서 원문 Fact를 실제 소비**하므로 “총 소비처 0/10”이라고 표기하면 오류.
- 문서별 `recordPolicy` 9/9: `one_source_entity_event_or_period_per_record`, `noCrossRecordBorrowing=true`, `sourceOnly=true`, summary/detail 분리 및 `present/blank/masked/unreadable/explicit_none` 보존을 **선언**. `extraction-row-store.ts`의 document/page/record ordinal/source SHA/quote/bbox 저장 로직은 별도로 참조. 이번 실제 D1 Fact/typed·R2 OCR 페이지/복수행 원문 read-back **0건**, 선언이 실증은 아님.

### 코드 blob SHA (최신 main에서 읽은 값)
- `lib/canonical-field-id-index.json`: `27ecdddd208de82a2f5c675e7482485e3a8838c2`
- `lib/document-agent-field-contracts.json`: `9884b3fecf44643fefcdc4a421ed66ffc5477b3a`
- `lib/shared-document-field-contracts.json`: `9decab974e0909ae24ad927bdfe241d75b71f3a9`
- `lib/ocr-field-supplements.json`: `63b2bf853acb2e9620a6fb72377dc278ff3cd2a5`
- `lib/field-applicability-contracts.json`: `6076b26f782c4643a21a7b2f1a8f6261bb588b68`
- `lib/reference-decision-tables.json`: `6924e3977caf748ce8a3d617fae15aff7d2fe2ce`
- `lib/risk-catalog.json`: `e96dd0926e3ae9be5a5573d4551538ba294c4d2e`
- `lib/legal-catalog.json`: `b0898d74f1df69b19ecf6e81cdff0ed09e8d885e`
- `lib/legal-exceptions.json`: `6e51197226bfd8320e1147d8df3f12c11e00927c`
- `lib/template-token-catalog.json`: `899c4d564fcb1726861f89dcf04dbf1b7e372687`
- `lib/material-calculation-source-gate.ts`: `0286b44484913b63fa8ec3f7bf0ca59b034d0dab`
- `lib/canonical-field-binding.ts`: `60ee5c7762d52b72a165b4f4f8214680eb98f148`
- `lib/feature-lineage-audit.ts`: `de81bc3b8c460b8a4dde3fda9e13087e619e74ff`
- `lib/ocr-calculation-input.ts`: `8f7f51bf41f7c944b76419d7cc894e49ac771473`
- `lib/business-net-reconciliation.ts`: `60a4fc295943dce404a7f99efffe88f58dd2d4ff`
- `lib/business-source-evidence.ts`: `0b796d9c3bc608c1224c5f9a049c80b6951a8b74`

## 2. canonical ID별 원천·소비처/공백 누적 (P/U=원본 period/unit predicate)

| # | canonical ID | 85문서 내 해당 추출문서(슬롯) | 형식 / 원단위 / 시간역할 / 대상 | 조건 | P/U | 실제 소비처·계산/서식/법률 갭 |
|---:|---|---|---|---|:---:|---|
| 091 | `business_assets_liabilities::ownership_interest` | 5: business_asset_inventory, receivable_statement, receivable_collectability, closure_certificate, business_liquidation | ratio / ratio/fraction as stated / not_applicable / business_entity | 등록(승인 아님) | N/Y | 직접 typed·material·token·승인 법률 링크 미확인; 증거/검산/역질문 후보 |
| 092 | `business_assets_liabilities::payable_amount` | 5: business_asset_inventory, receivable_statement, receivable_collectability, closure_certificate, business_liquidation | money / currency and exact source unit if monetary / not_applicable / business_entity | 등록(승인 아님) | N/Y | 직접 typed·material·token·승인 법률 링크 미확인; 증거/검산/역질문 후보 |
| 093 | `business_assets_liabilities::period_end` | 5: business_asset_inventory, receivable_statement, receivable_collectability, closure_certificate, business_liquidation | date / source date format normalized to ISO without loss / statement_period_end / business_entity | 등록(승인 아님) | Y/N | 직접 typed·material·token·승인 법률 링크 미확인; 증거/검산/역질문 후보 |
| 094 | `business_assets_liabilities::period_start` | 5: business_asset_inventory, receivable_statement, receivable_collectability, closure_certificate, business_liquidation | date / source date format normalized to ISO without loss / statement_period_start / business_entity | 등록(승인 아님) | Y/N | 직접 typed·material·token·승인 법률 링크 미확인; 증거/검산/역질문 후보 |
| 095 | `business_assets_liabilities::receivable_amount` | 5: business_asset_inventory, receivable_statement, receivable_collectability, closure_certificate, business_liquidation | money / currency and exact source unit if monetary / not_applicable / business_entity | 등록(승인 아님) | N/Y | 직접 typed·material·token·승인 법률 링크 미확인; 증거/검산/역질문 후보 |
| 096 | `business_assets_liabilities::secured_payoff` | 5: business_asset_inventory, receivable_statement, receivable_collectability, closure_certificate, business_liquidation | money / currency and exact source unit if monetary / not_applicable / business_entity | 등록(승인 아님) | N/Y | 직접 typed·material·token·승인 법률 링크 미확인; 증거/검산/역질문 후보 |
| 097 | `business_costs_and_ledgers::income.business_cost.accounting_basis` | 4: business_income_report, financial_statement, sales_purchase_summary, operating_expenses | enum / not_applicable / not_applicable / business_entity | 등록(승인 아님) | Y/N | 직접 typed·material·token·승인 법률 링크 미확인; 증거/검산/역질문 후보 |
| 098 | `business_costs_and_ledgers::income.business_cost.business_continuity_flag` | 4: business_income_report, financial_statement, sales_purchase_summary, operating_expenses | text_or_enum / not_applicable / not_applicable / business_entity | 등록(승인 아님) | Y/N | 직접 typed·material·token·승인 법률 링크 미확인; 증거/검산/역질문 후보 |
| 099 | `business_costs_and_ledgers::income.business_cost.business_entity` | 4: business_income_report, financial_statement, sales_purchase_summary, operating_expenses | party_role / not_applicable / not_applicable / business_entity | 등록(승인 아님) | Y/N | `preflightBusinessNet` COST+`business_entity` → 동일 sourceRecord 검증, `sourceFactIds` 포함 |
| 100 | `business_costs_and_ledgers::income.business_cost.expense_category` | 4: business_income_report, financial_statement, sales_purchase_summary, operating_expenses | enum_or_text / not_applicable / not_applicable / business_entity | 등록(승인 아님) | Y/N | `preflightBusinessNet` COST+`expense_category` → 승인 분류표 대조, `sourceFactIds` 포함 |

- #091 소유지분은 비율이지 현금금액이 아니다. 출처가 비율의 분모·법률/경제적 소유 주체와 평가기준일을 선언하지 않으면 신청인 몫 산입 불가. #092 사업 미지급금, #095 사업 미수금, #096 담보 실제 상환액, #089 총액/종전 #083 시가·#079 장부가는 서로 다른 경제적 상태; 정산·순액 계산 전 동일 사업·대상·기간·중복 여부/실수금 근거 확인.
- #093·#094 회계 운영기간은 #086 자산 잔액기준일과 동일 의미가 아님. 대상/페이지/행/기간/금액 단위·통화가 다르면 임의 원화 환산·상계 금지.
- #097 회계기준(cash/accrual/other)은 월별 매출·비용의 인식기준 분리 용도, #098 사업 지속목적은 원문 설명·추가자료 검토 후보. 이번 별도 `preflightBusinessNet` 본문에서 #097/#098의 정확 직접 소비는 확인되지 않았고, 소비 없음=무용·삭제가 아님.
- **#099·#100 실소비**: `lib/business-net-reconciliation.ts`에서 `COST="business_costs_and_ledgers::income.business_cost."`, 원본 `preflightBusinessNet`이 `rowUnique(...,COST+"business_entity")`와 `rowUnique(...,COST+"expense_category")`를 요구함. #099 원천 행 사업주체를 사용해 빈 주체 차단하고 #100 값을 별도 승인 비용범주 표와 비교, 두 Fact ID 모두 `sourceFactIds`·검토 기초지문에 포함. **이는 실제 운영 법적 승인이나 월소득 계산 최종 반영 입증이 아님**. 직원/변호사의 소득·비용 인정과 법원별 공식 기준은 별도 인수.
- 정확 공식 법원 서식 token·전자제출 필드와 original #091–100의 연결 0; `template-token-catalog.json` 정적 exact 검사는 공식 양식 호환 승인/실제 Word 생성 시험이 아니다. 갈음 B+C·법원 보정은 문서 요구/출처의 *후속 후보*로만 보존; 개별 사건 실실행과 승인 0.

## 3. 실제 수행한 격리시험 — 입력 / 독립 기대 / 실제 관찰

**엔진:** GitHub 최신 TypeScript 원본의 함수 본문을 V8 JS로 **타입 선언만 제거하여 실행**. 참조 파일: `canonical-field-binding.ts`, `feature-lineage-audit.ts`, `ocr-calculation-input.ts`, `business-net-reconciliation.ts`. `preflightBusinessNet`은 원본 함수 본문을 실행하되 `sourceFact`, `rowUnique`, `money`, `approvedBusinessIncomeRule`, case index/정규화·날짜 helper와 식별자 발급을 **합성 stub**으로 대체. 정책 예시에서 'rent'를 허용한 것은 테스트용 허용값일 뿐 법률상 비용 인정을 뜻하지 않는다. Node 프로젝트 실행/CI·실 D1·R2 또는 관할 승인 시험이 아니다.

| 독립 테스트 입력·경계 | 독립 기대값 | 실제 관찰 / 판정 |
|---|---|---|
| 46개 document-family-ID 정확 `{canonicalFieldId, key:local_id}` | 모두 해당 exact ID로 결속 | **46/46 일치** |
| 동일 46개에 `key=definitely_wrong_key` | 전부 unbound, ID 자동 추정 차단 | **46/46 일치** |
| 46원천×9 typed category projection | 명시 매핑 없는 대상은 null; 라벨 유사성 매핑 불허 | **414/414 null** |
| 10 필드의 원본 `hasPeriod`/`hasUnit` | 선언과 실제 반환 각각 기록 | 기간 Y 6개(93,94,97–100), 단위 Y 4개(91,92,95,96) |
| #091 ratio `bananas`, 단위 null | 형식검사 현재 동작은 `[]` / **업무 안전상 별도 ratio 검증 필요** | `[]`; 독립 안전조건 **미충족 후보** |
| #091 ratio `220%`, 단위 `%` | 현 함수 `[]` / **분모·상한·원문 확인 필요** | `[]`; **업무 안전 미인증** |
| #092 money `100`, unit null | `SOURCE_MONETARY_UNIT_MISSING` | 동일 |
| #093 date `2026-02-30` | `SOURCE_DATE_INVALID` | 동일 |
| #100 enum_or_text `not-reviewed` | OCR 셀 형식검사 `[]`, **승인 분류 아님** | `[]` |
| 사업소득 preflight 정상 합성: 2026-09 월 gross=1000, cost=300, 독립 row/사업주체, 테스트용 허용비용 `rent` | `netWon=700`, cost entity + category Fact ID 스냅샷 포함 | **정확 700, 두 Fact 포함** |
| 동일 preflight에서 category=`other`(허용목록 외) | `BUSINESS_EXPENSE_CATEGORY_NOT_APPROVED:cost-category` | 동일 |
| category Fact 누락 | `BUSINESS_ROW_FIELD_MISSING_OR_MULTIPLE:...expense_category` | 동일 |
| business entity Fact 누락 | `BUSINESS_ROW_FIELD_MISSING_OR_MULTIPLE:...business_entity` | 동일 |
| 비용 행의 시작기간을 2026-08-01로 변경 | `BUSINESS_SOURCE_PERIOD_DIFFERS:cost` | 동일 |

- 현 함수 반환 동작의 **OCR 5/5**, `preflightBusinessNet` 원본문 **합성 5/5**, exact ID 결속 **92/92** 및 typed 조회 **414/414**는 독립 업무 안전 100% 또는 전체 CI와 다름.
- **P2 후보 ① #091:** ratio는 `hasUnit=true`인데 `calculationSourceCellIssues`는 ratio 숫자형/범위/원천 비율단위 검사 분기가 없어 `bananas`와 `220%`를 이 함수에서 보류하지 않았다. 상위 normalized ratio와 경계/특정 서식 차단은 *미관찰*이므로 “제품이 220%를 인정”으로 확정 금지. 다른 타입/법률 의미 변경 전 별도 Draft PR+테스트 및 실무자 검토 필요.
- **P2 후보 ② #097–100:** `temporal_role=not_applicable` 4개가 `hasPeriod=true`(family 이름의 `ledger` match). 필드 시간역할과 문서 회계기간 coverage를 구분해야 한다. 현재 Draft #51과 변경영역 중복; 본 감사 임의 교체 안 함.
- **검증상 구별:** `unknown` / source `null` / 관찰 `0` / `not_applicable_reviewed` / `conflicting` / `source_only` / `pending_human_approval`은 서로 별개 상태. 원문 증거 삭제, 합성 금액의 임의 원화 합산, 인간 승인 없는 법률상 인정 승격 없음.

## 4. 중앙 보드 5 ID — 이번 부분 검증, 최종 [ ] 유지

| 역할/ID | 이번 실제 검증 | 남은 인수 |
|---|---|---|
| IT `A3-IT-007` | ratio/money/date/enum 타입, P/U 10 필드, binding 92 및 projection 414 | 원문 단위/사실 정규화·전체 시스템 정책의 비율 검증 미실행 |
| 사용자·서류 `A3-DOC-007` | 9문서/46슬롯과 source row 분리 선언·회계기준/경비 유형 | 실제 85서류 요구·갈음 B+C·법원 보정/문서페이지 미실행 |
| 계산사무장 `A3-CALC-007` | 18/91 선언, #099/#100 실 preflight 소비 합성 5조건, #092/#095/#096 비상계 | 전체 18계산/청산가치/월소득 D1 종단 및 승인 미인증 |
| 변호사 `A3-LAW-014` | 95/50/46 정적 exact 계약0, 비율·채권·담보 법적 의미 미승격 | 법원/시행일/법률근거·사람의 인정·서식 검토 미완 |
| 데이터 `A3-DATA-010` | 693/85/48/1808 조인·#091–100 46원천·10/10 등록, 중복·고아0 | OCR page/row/source hash 재조회·D1 Fact/typed 실행 0 |

**A3 최종 인수 0/124**, 순차 *정적 조사* 693/693은 제품 완료가 아니다. 전체 Node CI, staging D1/R2/Cron, 공식 법원 문서와 변호사 승인, 사이트 배포는 미인증·미실행. 운영 배포·D1 운영 migration·실제 전자제출·법원 인가 확정 실행 안 함.

**다음 시작 ID: #101 `business_costs_and_ledgers::income.business_cost.gross_amount` — #101~110. 다음 역할 선행: AX담당자.** #097–100의 4개 회계분류와 실제 행·월별 사업소득 리뷰 범위를 먼저 연결하고 #101~110의 source/typed/법률/서식을 이어서 확인.

## 부록 A — 최신 main canonical OCR 전체 순서 (693개, blob `27ecdddd208de82a2f5c675e7482485e3a8838c2`)

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

## 부록 B — 최신 단일 인수 보드 A3 6역할 전체 체크 ID (총 124, blob `02ca6f9727ecf741299487fa61d9de4d48ddc5f3`)

- **IT 20개:** `A3-IT-001` · `A3-IT-002` · `A3-IT-003` · `A3-IT-004` · `A3-IT-005` · `A3-IT-006` · `A3-IT-007` · `A3-IT-008` · `A3-IT-009` · `A3-IT-010` · `A3-IT-011` · `A3-IT-012` · `A3-IT-013` · `A3-IT-014` · `A3-IT-015` · `A3-IT-016` · `A3-IT-017` · `A3-IT-018` · `A3-IT-019` · `A3-IT-020`
- **DOC 20개:** `A3-DOC-001` · `A3-DOC-002` · `A3-DOC-003` · `A3-DOC-004` · `A3-DOC-005` · `A3-DOC-006` · `A3-DOC-007` · `A3-DOC-008` · `A3-DOC-009` · `A3-DOC-010` · `A3-DOC-011` · `A3-DOC-012` · `A3-DOC-013` · `A3-DOC-014` · `A3-DOC-015` · `A3-DOC-016` · `A3-DOC-017` · `A3-DOC-018` · `A3-DOC-019` · `A3-DOC-020`
- **CALC 20개:** `A3-CALC-001` · `A3-CALC-002` · `A3-CALC-003` · `A3-CALC-004` · `A3-CALC-005` · `A3-CALC-006` · `A3-CALC-007` · `A3-CALC-008` · `A3-CALC-009` · `A3-CALC-010` · `A3-CALC-011` · `A3-CALC-012` · `A3-CALC-013` · `A3-CALC-014` · `A3-CALC-015` · `A3-CALC-016` · `A3-CALC-017` · `A3-CALC-018` · `A3-CALC-019` · `A3-CALC-020`
- **LAW 22개:** `A3-LAW-001` · `A3-LAW-002` · `A3-LAW-003` · `A3-LAW-004` · `A3-LAW-005` · `A3-LAW-006` · `A3-LAW-007` · `A3-LAW-008` · `A3-LAW-009` · `A3-LAW-010` · `A3-LAW-011` · `A3-LAW-012` · `A3-LAW-013` · `A3-LAW-014` · `A3-LAW-015` · `A3-LAW-016` · `A3-LAW-017` · `A3-LAW-018` · `A3-LAW-019` · `A3-LAW-020` · `A3-LAW-021` · `A3-LAW-022`
- **DATA 22개:** `A3-DATA-001` · `A3-DATA-002` · `A3-DATA-003` · `A3-DATA-004` · `A3-DATA-005` · `A3-DATA-006` · `A3-DATA-007` · `A3-DATA-008` · `A3-DATA-009` · `A3-DATA-010` · `A3-DATA-011` · `A3-DATA-012` · `A3-DATA-013` · `A3-DATA-014` · `A3-DATA-015` · `A3-DATA-016` · `A3-DATA-017` · `A3-DATA-018` · `A3-DATA-019` · `A3-DATA-020` · `A3-DATA-021` · `A3-DATA-022`
- **AX 20개:** `A3-AX-001` · `A3-AX-002` · `A3-AX-003` · `A3-AX-004` · `A3-AX-005` · `A3-AX-006` · `A3-AX-007` · `A3-AX-008` · `A3-AX-009` · `A3-AX-010` · `A3-AX-011` · `A3-AX-012` · `A3-AX-013` · `A3-AX-014` · `A3-AX-015` · `A3-AX-016` · `A3-AX-017` · `A3-AX-018` · `A3-AX-019` · `A3-AX-020`
