# FirmEngine A3 r98 — canonical #271–280 비근로소득·채무증명 피처 증거/계산/법률/양식 소비처 재감사

- 기준시각: 2026-11-03 14:31 KST. GitHub `main` 감사 영수증 작성 직전 HEAD: `5b78888ec9a0e83cd36c998121c4b6c09d608449`.
- **경계**: `prototypes/Daeseong Ray Yang/firmengine-proto/ax-site/` 하위만 읽기·쓰기. A3 외 코드·운영 데이터 무변경. 단일 보드 `docs/PRODUCT_RELEASE_INTEGRATION_BOARD.md`.
- **순차 인수**: r97 #261–270 다음 순번 **#271–280** 10 canonical, **46 원천 문서×패밀리 슬롯**, 고유 문서 14종(소득 4+채무 10, 겹침 없음). r49 20개 선행 비교 영수증도 확인. 이번은 후속 독립 재조회이며 제품 전체 재인수 아님.
- **역할 순환**: IT → 사용자·서류 → 계산사무장 → 변호사 → 데이터 → AX. 보드 부분기록 5 ID: `A3-IT-003`, `A3-DOC-015`, `A3-CALC-005`, `A3-LAW-003`, `A3-DATA-008`; AX는 후속 역질문·정책승격 위험 검토. **모두 [ ] 미완료**.
- 최신 계약 정적 실열거: canonical **693/693 unique**, 등록 문서 **85**, 패밀리 **48**, 문서×패밀리 **141**, 슬롯 **1582 base + 207 문서확장 + 19 OCR 보충 = 1808**. 이번 ID 적용조건 등록 **8/10**, 미등록 **#278/#280 각각 0%**. 직접 typed **6/10**, material gate **#273 1개(must_reconcile, income.net)**, 직접 OCR→form token 선언 **#278 1개(D5106.creditor.cause)**, 정확 위험95·법률규칙50·예외46 법적 증거링크 **0/10**. 이 값들은 실제 고객 문서행/운영 DB 결괏값이 아님.
- 최신 등록 계산 **18 모듈/91 선언 입력(78 고유 입력 경로)/42 출력 선언**: 정적 기준정보 검증, 실제 계산 재실행/공식 서식 합격 아님.
- **실제 V8 격리시험**: 원본 `canonical-field-binding.ts`의 바인딩·typed 함수 본문(타입표기만 삭제), 10 정확 ID+10 정확 local key+10 잘못된 namespace → **30/30 현재 동작 일치**. 원본 `ocr-calculation-input.ts`의 date/datetime 및 `calculationSourceCellIssues` 함수 본문(타입표기만 제거) 24 합성 호출 → **24/24 현재 분기 재현**. 외부 `normalizeMoney`는 **KRW 정수 여부만 판단하는 합성 stub**: 실 금액 변환 정확성 인증 아님. `feature-lineage-audit.ts`의 `hasPeriod/hasUnit` 원본 술어 각 10회, 기간 true=7/10, 단위 true=3/10; 기간이 개별 `temporal_role=not_applicable`인데 true인 **#272/#274/#276 3개** 발견(패밀리 전체의 기간 필요성과 별개).
- 법률 위험의 엄격 구분: `legal-evidence-criteria.ts` seed `checks=[]`; 최신 risk-catalog 95, legal-catalog rules 50, legal-exceptions scenarios 46을 정확 canonical ID와 비교해 직접 법률 계약 0. 운영에서 편집한 사람승인 정책, 법원/시행일/공식원문 검증 미실시. **#278 form token은 code-level 선언·source projection일 뿐 공식 양식 동등성 인증 아님**.

## 1. 개별 ID 10개 — 실제 선언 소비처·공백

공통 source anchor 선언: `document_instances` 문서 identity, 원문 해시·페이지, `extraction_records`의 record ordinal(복수행), `extracted_features`의 canonical ID/raw value/단위/quote/bbox/상태와 `extraction_field_coverage`. 문서 85종의 `recordPolicy`는 `noCrossRecordBorrowing=true`, 요약행/상세행 중복금지. 개별 **실제 페이지·본문·행·대상자·송금 주체·확정 원천 Fact는 모두 미관찰**.

| # | canonical ID | 실제 서류 경로 | 슬롯 | 타입 / 단위 / 기간 / 대상 | 적용조건 | typed | P/U | material | exact form | 법률 exact | 증거/공백·검산 |
|---:|---|---|---:|---|---|---|:---:|---|---|:---:|---|
| 271 | current_nonwage_income::income.other.gross_amount | income_source_inventory / rental_income_contract / interest_income_statement / dividend_statement | 4 | money / KRW / period_scope / applicant_debtor | 등록·승인전 | income.gross | Y/Y | 0 | 0 | 0 | 세전총액·다른 서류 동일 소득행 중복 방지; 비용 #267·실수령 #273과 기간/소득원 결속 후 검산 |
| 272 | current_nonwage_income::income.other.income_kind | 상동 4종 | 4 | enum / N/A / N/A / applicant_debtor | 등록·승인전 | income.kind | Y/N | 0 | 0 | 0 | 지급소득 종류 원문분류와 법률분류를 별도 검토; 임의 enum 상위 허용 미검증 |
| 273 | current_nonwage_income::income.other.net_received | 상동 4종 | 4 | money / KRW / event_date / applicant_debtor | 등록·승인전 | income.net | Y/Y | must_reconcile→income.net | 0 | 0 | 실수령액≠반복 월소득; 지급인/수령인·입금일·원천공제/중복수령 재검증 |
| 274 | current_nonwage_income::income.other.payer | 상동 4종 | 4 | party_role / N/A / N/A / payer | 등록·승인전 | — (source-only) | Y/N | 0 | 0 | 0 | 원문 지급의무자/송금자/계약상 지급주체 동일성·마스킹·서로 다른 지급행 분리 |
| 275 | current_nonwage_income::income.other.payment_date | 상동 4종 | 4 | date / N/A / event_date / applicant_debtor | 등록·승인전 | — (source-only) | Y/N | 0 | 0 | 0 | 현금입금일 vs 귀속 소득기간 #268~269·계약종료일 #266; 지연/선수금 식별 |
| 276 | current_nonwage_income::income.other.recipient | 상동 4종 | 4 | party_role / N/A / N/A / applicant_debtor | 등록·승인전 | — (source-only) | Y/N | 0 | 0 | 0 | 실수령자·신청인·가족·공동소유자 식별; 지급자 #274와 혼동 금지 |
| 277 | debt_certificate::as_of_date | debt_certificate / creditor_request_copy / loan_contract / card_statement / private_loan_transfer / mortgage_balance / loan_use_of_funds / vehicle_lease_contract / prior_creditor_list / private_adjustment_records | 10 | date / 원문날짜형식 / balance_as_of_date / debtor | 등록·승인전 | debt.as_of | Y/N | 0 | 0 | 0 | 채권원금/미수이자 같은 잔액 기준일만 비교; 증명발급일·양도일 구분 |
| 278 | debt_certificate::claim_cause | debt_certificate | 1 | string / N/A / N/A / document_subject | 미등록·0% | debt.cause | N/N | 0 | D5106.creditor.cause 선언 | 0 | **OCR 보충 필드 1문서 전용**. 원인 텍스트는 출처/채권자/계약별 개별 대조. token 선언·form-mapping `objectFact(debt,cause,debt.id)` 존재 ≠ 공식 법원 요구사항/법률상 승인 |
| 279 | debt_certificate::contract_id | debt_certificate / creditor_request_copy / loan_contract / card_statement / private_loan_transfer / mortgage_balance / loan_use_of_funds / vehicle_lease_contract / prior_creditor_list / private_adjustment_records | 10 | identifier / N/A / N/A / debtor | 등록·승인전 | debt.contract_id | N/N | 0 | 0 | 0 | 계약번호 마스킹 보존, 같은 계약인지 다른 채권/양도후 청구인지 식별; 임의 '???' 로컬 검사 수용 |
| 280 | debt_certificate::contract_interest_rate | debt_certificate | 1 | decimal_or_text / source rate unit / N/A / document_subject | 미등록·0% | — (source-only) | N/Y | 0 | 0 | 0 | **OCR 보충 필드 1문서 전용**. 금리 `%`·연/월·약정/연체·유효기간과 원금 혼용 금지; unit 요구 predicate=true이나 로컬 datatype 분기 없어 `bananas`·단위 null 허용 |

- #271–276: 동일 family를 4문서로 반복 추출하므로 계약ID/수익원/소득 귀속기간/수급자/송금자/실수령 근거를 결속해야 함. `income.gross`(세전)·`income.net`(실수령)·`income.expenses`(비용)·`income.kind`(성격) 값은 서로 다른 역할. **급여/임대/배당/이자 4문서 원화 단순 합산이나 차감 금지**.
- #277–280: 채권자·원채권자·계약번호·잔액기준일·원인·이율은 같은 source record/claim identity에 한정. #278의 source-only가 아닌 **typed debt.cause / form token 후보**는 법적 결론 아님. #280 무등록 보충필드는 source-only 보존·검산/역질문 필요.
- `debt_certificate::claim_cause`는 1문서 보충이지만 D5106 `creditor.cause` 정확 토큰 등록과 `form-mapping.ts` `objectFact("debt","cause",debt.id)`의 **매핑 경로는 존재**. 자동 출력·공식 제출 승인/갈음 동일성 및 토큰에 사실값 전달되는지 E2E 미확인.
- 기간 플래그 #272/#274/#276은 `hasPeriod(role,family)`의 `income` family fallback 때문에 true. **필드 자체에는 기간이 무관하더라도 그 문서/거래의 기간 검토를 삭제하자는 제안은 아님**. 기존 Draft #51과 중복 코드 수정 보류.

## 2. 실제 소스 함수 격리 합성 입력/독립 예상/관찰

| ID | 합성 입력 요약 (고객정보 아님) | 현재 코드 분기 예상 | 관찰 |
|---|---|---|---|
| #271 | 1200000 / KRW / quote '1200000 KRW' | [] | [] |
| #271 | 1200000 / 단위 누락 | SOURCE_MONETARY_UNIT_MISSING | 동일 |
| #271 | 1200000 / KRW / quote '1200000 USD' | [] | [] **(원문 통화 상충 미검출 후보)** |
| #272 | invented_type / null | [] | [] |
| #273 | 1100000 / KRW | [] | [] |
| #273 | 1100000 / null | SOURCE_MONETARY_UNIT_MISSING | 동일 |
| #274 | ? / null | [] | [] |
| #275 | 2026-02-30 | SOURCE_DATE_INVALID | 동일 |
| #275 | 2026-11-03 | [] | [] |
| #276 | ??? | [] | [] |
| #277 | 2026-02-30 | SOURCE_DATE_INVALID | 동일 |
| #277 | 2026-11-03 | [] | [] |
| #278 | invented_cause | [] | [] |
| #279 | ??? | [] | [] |
| #280 | bananas / null | [] | [] **(rate/unit 검사 미실시)** |
| #280 | 250% / null | [] | [] |
| #280 | 10.2 / null | [] | [] |
| #280 | 10.2 / % | [] | [] |
| #271 | present + value null | SOURCE_PRESENT_VALUE_MISSING | 동일 |
| #273 | 1000 / USD | SOURCE_MONEY_NOT_EXACT_KRW | 동일 (KRW-only 합성 정규화) |
| #274 | present + 빈값 | SOURCE_PRESENT_VALUE_MISSING | 동일 |
| #276 | value=a / quote 빈값 | SOURCE_QUOTE_MISSING | 동일 |
| #278 | value=a / quote=test | [] | [] |
| #279 | value=a / quote=test | [] | [] |

- 동작 24/24는 **현행 함수 재현**, 업무 적격성 인수 합격 24/24가 아니다. 별도 독립 안전기대: #271 원문 quote USD와 입력 KRW 불일치 검출 필요(현 로컬 검사 []); #280 기준금리의 rate datatype/단위/기간·적용구간 검증 필요(현 []); #272 소득종류 enum 임의텍스트 허용(현 []); #279 계약번호 유효/중복 판단은 원천/상위에서 실증 필요.
- #273 `income.net`과 material `must_reconcile` 등록은 **원천 Fact id 검증, 동일 월/소득원 집계, 소득 인정 심사, 18 계산 실행 검증**이 있어야만 월별 금액에 투입 가능. 값이 0, null, 미관찰, 비해당, 상충, 승인전 중 어느 상태인지 구분하지 않았으면 계산 확정 금지.
- #278 서식 토큰은 D5106 인벤토리에서 `creditor.cause` 존재함을 확인; 공식 법원/전자제출의 필수성·제출 버전은 미인증. 원문 그대로 typed cause로 투영되더라도 사람의 채권원인 판정은 독립.
- `hasUnit(decimal_or_text)=true`이지만 로컬 `calculationSourceCellIssues()`는 돈·날짜·정수만 분기: #280 `source rate unit`에 대한 null·문자 입력이 부정확한 합격으로 소비될 수 있는 **P2 형식 공백 후보**. 이율 250%가 법적으로 무효라고 판단한 것은 아님.

## 3. 저장·법률·갈음·보정 증거의 검증 경계

1. **증거**: `db/schema.ts`의 `document_instances`, `extraction_runs`, `extraction_records`, `extracted_features`, `extraction_field_coverage` 및 `case_calculation_features.source_fact_ids_json/input_refs_json`은 선언 확인. 실제 D1 row/read-back, 임의 caseId·OCR 원문 페이지·복수행·문서별 동일 채권/소득원 중복방지 테스트는 **실행 0**.
2. **계산**: `execution-catalog.ts` → `reference-decision-tables.json` 18/91 입력, `canonical-field-binding.ts` 6 typed, `material-calculation-source-gate.ts` #273 1 must_reconcile. `calculatedFrom()`의 `income_average/income_aggregation/monthlyIncomeWon`, `debt_total/debtPrincipalWon/debtInterestWon`은 **간접 참조 후보**, 실제 18개 산식의 실행 영수증·독립 재계산 결과가 아님. #278/#280 채권 원인/이율을 원금·이자 계산값으로 승격하지 않음.
3. **법률**: risk95/rule50/exception46 기준정보에서 정확한 canonical 필드 승인 계약 0/10, `legalEvidencePolicy` seed 빈 배열; 관할/효력시점/우선권·별제권·다툼·채권자 승인 미검증, **법률 합격 0%**.
4. **서식·갈음/보정**: #278 D5106 token 후보 1은 코드 등록 상태일 뿐 `FORM_CONTRACTS`의 공식 현행 서식 동등성·토큰 입력/출력 실측 미인증. `case-requirements` / `document-substitution` / `preapproval-correction-audit` 경로에서 별도 증빙으로 갈음·법원 보정 명령과 연결되는지 케이스별 인수 **0건**. 검증하지 않은 것을 '없음'이나 '비해당'으로 전환하지 않음.
5. **6상태 분리**: `미관찰`(조회하지 않음), `null`(원본 값 없음/미확정), `0`(출처가 실제 영 값 증명), `비해당`(담당자 검토+근거), `상충`(둘 이상 후보 유지), `source-only`(증거·검산 목적 유지), `승인전`(법률·공식서식 인수 미확정) **별도**. 미등록 요건 #278/#280은 0% (삭제/자동 비해당 금지).

## 4. 독립 후속 P2 후보·회차 인수

- P2-A **#280** 보충금리 source rate unit 정형/수치/유효기간/특수이자 혼용 방지. 양식/법률 효과 수정 전 변호사·계산사무장 검토 및 별도 Draft PR. 이번 코드 수정 없음.
- P2-B **#271/273** 원문 USD vs declared KRW 불일치, 동일 실수령·총액 문서4종 중복정합성 검증. 로컬검사만 재현, 상위 저장/계산 검사 여부 미증명.
- P2-C **#278/#280** 정확 적용조건 미등록 2개, 각 0% 법률·업무 승인, source-only 보존. 피처 삭제·무단 합산 금지.
- P2-D **#272/#274/#276** 개별 필드 기간역할과 family 기간 플래그 분리. 기존 Draft PR #51과 중복 해결 피하고 회귀/실 Node 실행 후 판단.
- 보드 5 ID는 위 **정적 계약+실제 V8 격리시험의 부분 결과만** 기록, [ ] 유지. 전체 Node CI/staging D1·R2/Cron/공식 법원 양식/변호사 승인/운영 배포/전자제출 전부 미실행. 제품 코드·공개 개인정보/키·원본 OCR·법률 인가를 변경하지 않았음.

**순차 완료: #280. 다음 시작 #281** (정확 ID는 직후 최신 canonical 인덱스에서 확인할 것), 다음 범위 #281–290. 다음 회차 시작 역할 **사용자·서류담당자** (이번 IT부터 순환).

## 부록 A — 최신 canonical OCR 693개 전체 순번 (실제 인덱스 열거)

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

## 부록 B — 보드 A3 6역할 체크 ID 124개 전체 순번 (실제 보드 열거)

001. `A3-IT-001`
002. `A3-IT-002`
003. `A3-IT-003`
004. `A3-IT-004`
005. `A3-IT-005`
006. `A3-IT-006`
007. `A3-IT-007`
008. `A3-IT-008`
009. `A3-IT-009`
010. `A3-IT-010`
011. `A3-IT-011`
012. `A3-IT-012`
013. `A3-IT-013`
014. `A3-IT-014`
015. `A3-IT-015`
016. `A3-IT-016`
017. `A3-IT-017`
018. `A3-IT-018`
019. `A3-IT-019`
020. `A3-IT-020`
021. `A3-DOC-001`
022. `A3-DOC-002`
023. `A3-DOC-003`
024. `A3-DOC-004`
025. `A3-DOC-005`
026. `A3-DOC-006`
027. `A3-DOC-007`
028. `A3-DOC-008`
029. `A3-DOC-009`
030. `A3-DOC-010`
031. `A3-DOC-011`
032. `A3-DOC-012`
033. `A3-DOC-013`
034. `A3-DOC-014`
035. `A3-DOC-015`
036. `A3-DOC-016`
037. `A3-DOC-017`
038. `A3-DOC-018`
039. `A3-DOC-019`
040. `A3-DOC-020`
041. `A3-CALC-001`
042. `A3-CALC-002`
043. `A3-CALC-003`
044. `A3-CALC-004`
045. `A3-CALC-005`
046. `A3-CALC-006`
047. `A3-CALC-007`
048. `A3-CALC-008`
049. `A3-CALC-009`
050. `A3-CALC-010`
051. `A3-CALC-011`
052. `A3-CALC-012`
053. `A3-CALC-013`
054. `A3-CALC-014`
055. `A3-CALC-015`
056. `A3-CALC-016`
057. `A3-CALC-017`
058. `A3-CALC-018`
059. `A3-CALC-019`
060. `A3-CALC-020`
061. `A3-LAW-001`
062. `A3-LAW-002`
063. `A3-LAW-003`
064. `A3-LAW-004`
065. `A3-LAW-005`
066. `A3-LAW-006`
067. `A3-LAW-007`
068. `A3-LAW-008`
069. `A3-LAW-009`
070. `A3-LAW-010`
071. `A3-LAW-011`
072. `A3-LAW-012`
073. `A3-LAW-013`
074. `A3-LAW-014`
075. `A3-LAW-015`
076. `A3-LAW-016`
077. `A3-LAW-017`
078. `A3-LAW-018`
079. `A3-LAW-019`
080. `A3-LAW-020`
081. `A3-LAW-021`
082. `A3-LAW-022`
083. `A3-DATA-001`
084. `A3-DATA-002`
085. `A3-DATA-003`
086. `A3-DATA-004`
087. `A3-DATA-005`
088. `A3-DATA-006`
089. `A3-DATA-007`
090. `A3-DATA-008`
091. `A3-DATA-009`
092. `A3-DATA-010`
093. `A3-DATA-011`
094. `A3-DATA-012`
095. `A3-DATA-013`
096. `A3-DATA-014`
097. `A3-DATA-015`
098. `A3-DATA-016`
099. `A3-DATA-017`
100. `A3-DATA-018`
101. `A3-DATA-019`
102. `A3-DATA-020`
103. `A3-DATA-021`
104. `A3-DATA-022`
105. `A3-AX-001`
106. `A3-AX-002`
107. `A3-AX-003`
108. `A3-AX-004`
109. `A3-AX-005`
110. `A3-AX-006`
111. `A3-AX-007`
112. `A3-AX-008`
113. `A3-AX-009`
114. `A3-AX-010`
115. `A3-AX-011`
116. `A3-AX-012`
117. `A3-AX-013`
118. `A3-AX-014`
119. `A3-AX-015`
120. `A3-AX-016`
121. `A3-AX-017`
122. `A3-AX-018`
123. `A3-AX-019`
124. `A3-AX-020`
