# FirmEngine A3 r95 — canonical #241~250 가상자산 평가·지갑·거래 소비처 감사 (2026-11-03 KST)

## 1. 감사 기준과 독립검증 수준
- GitHub `main` 시작 HEAD: `29b008c284011a8c025ff5baf38091d7b5517b7f`; 최신 canonical 인덱스 blob `27ecdddd208de82a2f5c675e7482485e3a8838c2`; 단일 보드 blob `9d14de27b19765bf6e048e51ec1d3d419ed4692a`. r94 #231~240의 다음 #241부터 감사.
- 역할 순환: **사용자·서류 → 계산사무장 → 변호사 → 데이터 → IT → AX**. 5개 보드 체크 `A3-DOC-010`, `A3-CALC-018`, `A3-LAW-007`, `A3-DATA-019`, `A3-IT-007`는 모두 부분 [ ] 상태 유지, AX는 본 영수증에 역질문 후보 기록.
- 원본 JSON에서 **canonical 693 고유 / 문서85 / 패밀리48 / 문서×패밀리141 / 기본1,582+공유207+보충19=원천1,808 슬롯** 전수 계산. 18 계산/91 입력. 95 위험/50 법률규칙/46 예외는 앞선 원본 조회+인수보드와 일치. 이 숫자는 **등록 선언만** 의미하며 실제 DB 행 또는 법원 확인 실적이 아니다.
- 대상 **10 ID/10 source 슬롯/2 문서**: crypto_balance 9, crypto_transactions 1. 원천 계약은 문서hash·page·row/subject·quote/bbox·단위·기간·자산 식별 요구; 실제 OCR 문서/페이지/복수행 및 수집된 원천 Fact는 **미관찰**.
- 실제 원본 함수 본문에서 TS 타입만 제거한 V8 격리 실행: `canonical-field-binding.ts` 정상10/외부 ID10/충돌키10 = **30/30 기존 코드 기대 일치**; `feature-lineage-audit.ts` hasPeriod10/hasUnit10/reviewScope3 = **23 호출**, `ocr-calculation-input.ts` **16/16** 현행 동작 재현. `normalizeMoney`는 합성 KRW stub; 실제 원화 정밀도, 상위 Node, 전체 CI, E2E는 검증하지 못함.
- `db/schema.ts`의 `extraction_records/extracted_features/extraction_field_coverage`, `canonical_field_id/raw_value_json/quote/bbox_json/source_state/projection_key`, `case_calculation_features`와 `tests/feature-lineage-audit.test.ts`, `tests/ocr-calculation-db-contract.test.ts`, `tests/material-calculation-source-gate.test.ts`, `tests/a3-canonical-register-order.test.mjs` 실제 파일은 별도 읽기에서 존재 확인. Node CI/D1 Fact/typed 재조회/staging R2-Cron/공식 서식·변호사 승인 **미실행**. 
- 중복 수정 위험: 기존 Open Draft [PR #51](https://github.com/firmengine/firmengine/pull/51) 기간 술어 및 [PR #56](https://github.com/firmengine/firmengine/pull/56) crypto 법률후보 관련, 본 회차 의미변경 제품 코드 수정·운영 배포 없음.

## 2. 10개 ID 정확 증거/계산/법률/서식 소비처·공백 누적
마지막 4수치는 정확 ID의 **직접 typed / material / 공식 token / 승인 법률 계약** 정적 건수. 모두 0/0/0/0: family 수준의 검토후보는 **정확 직접 승인 경로가 아님**. '0 소비처=무용'이 아니며 source-only 증거·검산·역질문으로 보존. P/U는 원본 hasPeriod/hasUnit 출력, 개별 공식 법원 필수요건 의미 아님.

| # | canonical ID | 문서/family(슬롯) | 타입/원단위 | 시간역할/대상 | 적용조건 | P/U | typed/material/form/legal | 대조·질의 의미 |
|---:|---|---|---|---|---|---|---|---|
| 241 | `crypto_balance::displayed_valuation` | `crypto_balance`/`cash_deposit_asset` (1) | money/source currency/unit | not_applicable/document_subject | 미등록 **0%** | N/Y | 0/0/0/0 | 표시 평가금액(총가액)은 수량×시점단가 대조용; 양자 합산 금지·평가기준일 법률 검토 |
| 242 | `crypto_balance::exchange_or_wallet` | `crypto_balance`/`cash_deposit_asset` (1) | identifier/not_applicable | not_applicable/document_subject | 미등록 **0%** | N/N | 0/0/0/0 | 거래소/지갑 식별; 다른 snapshot 동일잔고·계정 소유자 교차검산 |
| 243 | `crypto_balance::locked_quantity` | `crypto_balance`/`cash_deposit_asset` (1) | quantity/asset-native unit | not_applicable/document_subject | 미등록 **0%** | N/Y | 0/0/0/0 | 잠김 수량 ≠ 추가 자산: 가용수량(#239)+잠금수량 대 총수량(#245) 검산 |
| 244 | `crypto_balance::network` | `crypto_balance`/`cash_deposit_asset` (1) | string/not_applicable | not_applicable/document_subject | 미등록 **0%** | N/N | 0/0/0/0 | 같은 심볼이라도 네트워크/토큰계약 다르면 별도 자산; 동일성 검토 |
| 245 | `crypto_balance::total_quantity` | `crypto_balance`/`cash_deposit_asset` (1) | quantity/asset-native unit | not_applicable/document_subject | 미등록 **0%** | N/Y | 0/0/0/0 | 총수량과 가용/잠금수량은 중복·관계검산 대상, 소유권/환가액 아님 |
| 246 | `crypto_balance::valuation_currency` | `crypto_balance`/`cash_deposit_asset` (1) | string/not_applicable | not_applicable/document_subject | 미등록 **0%** | N/N | 0/0/0/0 | 시세 표시통화·시장(USD/USDT/KRW) 구분; 원화 자동 환산 금지 |
| 247 | `crypto_balance::valuation_datetime` | `crypto_balance`/`cash_deposit_asset` (1) | datetime/not_applicable | source_date_time_or_period/document_subject | 미등록 **0%** | Y/N | 0/0/0/0 | 평가기준 시각·시간대와 거래 체결시각/잔고 표기시각 분리 |
| 248 | `crypto_balance::valuation_unit_price` | `crypto_balance`/`cash_deposit_asset` (1) | money/source quote currency/asset unit | not_applicable/document_subject | 미등록 **0%** | N/Y | 0/0/0/0 | 1토큰당 평가단가 ≠ 평균취득단가(#240); 표시 총액과 검산만 |
| 249 | `crypto_balance::wallet_address` | `crypto_balance`/`cash_deposit_asset` (1) | identifier/not_applicable | not_applicable/document_subject | 미등록 **0%** | N/N | 0/0/0/0 | 지갑주소 문자열만으로 실질소유/접근권한 확인 불가; 원문·체인/txid 필요 |
| 250 | `crypto_transactions::asset_symbol` | `crypto_transactions`/`bank_transactions` (1) | string/not_applicable | not_applicable/document_subject | 미등록 **0%** | Y/N | 0/0/0/0 | 거래이력의 자산기호는 현재 잔고 증명이 아님; 거래행·보유자 동일성 점검 |

- `field-applicability-contracts.json` 정확 ID **0/10 등록**: **10/10 요건 합격 0%** 유지, 담당자 승인 전 자동 비해당·0값·공제·삭제 금지.
- `canonical-field-binding.ts`는 해당 확장키를 원금액/자산가치에 직접 투영하지 않으며 `material-calculation-source-gate.ts`/ `ocr-chain-matrix.ts`에도 10 ID의 직접 material/form 토큰 0; 18개 계산식 입력으로 실행된 것이 아님. 법률위험95/규칙50/예외46에서 원천 ID별 승인 근거·관할·시행일/담당변호사 확인 없음(승인 0%). `legal-evidence-criteria.ts` 기본 seed `checks=[]`는 운영 승인정책을 대변하지 않는다.
- 원본 `reviewScope`는 base route `cash_deposit_asset` 및 `bank_transactions`에서 가상자산 전문 검토후보 `SEOUL-408`을 제공하지 않지만 `crypto_balance` 직접 family에서는 제공한다. 확장 라우트의 전문후보 누락 **P2 조사 후보**. 기존 Draft #56 및 #59와 중복/관할·법률판본 검토 필요, 자동 법률 결론 금지.
- 서류 갈음·법원 보정 경로의 실제 사건별 대체판정, 공식 D5101/D5110 서식행, 법원·변호사 승인 **미관찰**. 비관측/null/0/명시적 비해당/상충/source-only/승인전 엄격 분리.

## 3. 원본 함수 실제 호출·입력·독립 기대 vs 관찰
**다음 표의 기대는 기존 셀 단위 코드 동작 기준**이다. 업무 안전 독립 기대(quote/통화 원문 일치, quantity 음수/비숫자 차단, 수량·평가식 관계검산)는 아래 별도 미충족 후보로 분리한다. 테스트 값은 전부 합성으로 실제 고객 정보·OCR 사실값 아님.

| 케이스 | 입력(value/unit/quote/state) | 현재 동작 기대 | 관찰 | 수준 |
|---|---|---|---|---|
| #241 valid KRW | `{"v":"300","unit":"KRW","quote":"300 KRW","state":"present"}` | `[]` | `[]` | 기존 동작 재현 |
| #241 unit missing | `{"v":"300","unit":null,"quote":"300","state":"present"}` | `["SOURCE_MONETARY_UNIT_MISSING"]` | `["SOURCE_MONETARY_UNIT_MISSING"]` | 기존 동작 재현 |
| #241 USD quote with KRW cell | `{"v":"300","unit":"KRW","quote":"300 USD","state":"present"}` | `[]` | `[]` | 기존 동작 재현 |
| #241 non-KRW | `{"v":"300","unit":"USD","quote":"300 USD","state":"present"}` | `["SOURCE_MONEY_NOT_EXACT_KRW"]` | `["SOURCE_MONEY_NOT_EXACT_KRW"]` | 기존 동작 재현 |
| #243 negative quantity | `{"v":"-2.1","unit":"BTC","quote":"-2.1 BTC","state":"present"}` | `[]` | `[]` | 기존 동작 재현 |
| #243 nonnumeric quantity | `{"v":"nonsense","unit":"BTC","quote":"nonsense BTC","state":"present"}` | `[]` | `[]` | 기존 동작 재현 |
| #245 bad total quantity | `{"v":"bananas","unit":"BTC","quote":"bananas BTC","state":"present"}` | `[]` | `[]` | 기존 동작 재현 |
| #246 unknown currency | `{"v":"MARS","unit":null,"quote":"MARS","state":"present"}` | `[]` | `[]` | 기존 동작 재현 |
| #247 valid datetime | `{"v":"2026-11-03T02:20:00Z","unit":null,"quote":"2026-11-03T02:20:00Z","state":"present"}` | `[]` | `[]` | 기존 동작 재현 |
| #247 invalid day | `{"v":"2026-11-31T02:20:00Z","unit":null,"quote":"invalid day","state":"present"}` | `["SOURCE_DATETIME_INVALID"]` | `["SOURCE_DATETIME_INVALID"]` | 기존 동작 재현 |
| #247 invalid hour | `{"v":"2026-11-03T29:20:00Z","unit":null,"quote":"bad hour","state":"present"}` | `["SOURCE_DATETIME_INVALID"]` | `["SOURCE_DATETIME_INVALID"]` | 기존 동작 재현 |
| #248 quote USD with KRW cell | `{"v":"100","unit":"KRW","quote":"100 USD/BTC","state":"present"}` | `[]` | `[]` | 기존 동작 재현 |
| #249 unrecognized wallet | `{"v":"???","unit":null,"quote":"???","state":"present"}` | `[]` | `[]` | 기존 동작 재현 |
| #250 asset label | `{"v":"BTC","unit":null,"quote":"BTC","state":"present"}` | `[]` | `[]` | 기존 동작 재현 |
| #245 null unknown | `{"v":null,"unit":null,"quote":null,"state":"unknown"}` | `[]` | `[]` | 기존 동작 재현 |
| #245 null present | `{"v":null,"unit":null,"quote":"present null","state":"present"}` | `["SOURCE_PRESENT_VALUE_MISSING"]` | `["SOURCE_PRESENT_VALUE_MISSING"]` | 기존 동작 재현 |

- **P2 셀 로컬 공백**: #243 `-2.1 BTC`, `nonsense BTC`와 #245 `bananas BTC`가 `quantity` 분기가 없어 오류 `[]`. #241/#248 원문 quote USD와 입력 unit KRW가 충돌해도 `[]`; #246 임의 통화 `MARS`, #249 주소 `???`에도 로컬 형식검사 없음. 상위 원문/typed/DB 검증은 미실행 → 제품 전체 결함 단정 금지.
- 기간검사 원본 `hasPeriod` true 2/10, `hasUnit` true 4/10; temporal_role=not_applicable과 기간검사 충돌 ID #250. 거래 family #250의 문서 범위 검사와 개별 필드 시간역할을 분리할지 검토, PR #51 병합/법률판본 검토 대기.
- **독립 관계검산 기대만 제시, 미실행**: 같은 지갑·토큰·시각의 가용5+잠금3과 표시총수량10은 상충으로 보류해야 함(5+3≠10). #241 표시총액 vs #245×#248 역시 단위/시간/시장·자산이 같을 때만 대조. 둘을 합산하면 중복 계상; 임의 KRW 환산 금지.

## 4. 보드 5개 체크 ID 부분 결과·남은 인수조건
| 체크 ID/역할 | 실제 조회/검증 | 남은 공백 |
|---|---|---|
| A3-DOC-010 사용자·서류 | 문서2·정확 원천10 및 원문 해시/page/row/quote/bbox 요구 선언 확인 | 실제 문서/갈음·법원 보정·전자서식 미관찰 |
| A3-CALC-018 계산사무장 | 표시가치와 수량·잠금·단가를 비합산/검산 대상으로 정의; 18/91 정적조회 | 실 계산/청산가치/FX·중복검산 E2E 0 |
| A3-LAW-007 변호사 | 법률상 실질소유·면제 승인과 source-only 구분; 전문 검토후보 공백 재현 | 관할/법령시행일·소유자/공제/면제·변호사 승인 0% |
| A3-DATA-019 데이터 | 인덱스693·원천1808 등록 vs applicability 0/10 재계산 | 관리 승인·실 D1 Fact/typed 저장 재조회 0 |
| A3-IT-007 IT | 원본 binding 30/30·OCR 로컬 검사16/16와 P2 타입/원통화 교차검증 공백 | Node22/DB/실 OCR/고부하·상충 후속 차단 미검증 |

AX 관점: 원천 전용 피처는 검산·모순 탐지·직원 역질문·법률 검토 대기열 후보로 남긴다. **코드 존재 ≠ V8 격리테스트 ≠ 전체 CI ≠ staging D1/R2/Cron ≠ 공식서식·변호사 승인 ≠ 운영배포**.

## 5. 다음 시작·범위
- 순차 심층 감사 **#250/693**, A3 최종 인수 **0/124**. 다음 **#251 `crypto_transactions::completed_at` ~ #260**, 계산사무장부터 역할 회전. 거래 체결/요청/입출금, 수수료·원통화, 주소/txid·계정·네트워크·동일 거래/잔고 이중 인식 확인.
- 제품 코드 수정·운영배포·D1 운영 마이그레이션·전자제출·법원 인가확정 없음. 실제 OCR 원문/개인정보/비공개 정답/키는 Git 미기록.

## 부록 A — 최신 canonical 693개 순번
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

## 부록 B — 중앙 보드 6역할 A3 124개 ID
- IT(20): A3-IT-001, A3-IT-002, A3-IT-003, A3-IT-004, A3-IT-005, A3-IT-006, A3-IT-007, A3-IT-008, A3-IT-009, A3-IT-010, A3-IT-011, A3-IT-012, A3-IT-013, A3-IT-014, A3-IT-015, A3-IT-016, A3-IT-017, A3-IT-018, A3-IT-019, A3-IT-020
- DOC(20): A3-DOC-001, A3-DOC-002, A3-DOC-003, A3-DOC-004, A3-DOC-005, A3-DOC-006, A3-DOC-007, A3-DOC-008, A3-DOC-009, A3-DOC-010, A3-DOC-011, A3-DOC-012, A3-DOC-013, A3-DOC-014, A3-DOC-015, A3-DOC-016, A3-DOC-017, A3-DOC-018, A3-DOC-019, A3-DOC-020
- CALC(20): A3-CALC-001, A3-CALC-002, A3-CALC-003, A3-CALC-004, A3-CALC-005, A3-CALC-006, A3-CALC-007, A3-CALC-008, A3-CALC-009, A3-CALC-010, A3-CALC-011, A3-CALC-012, A3-CALC-013, A3-CALC-014, A3-CALC-015, A3-CALC-016, A3-CALC-017, A3-CALC-018, A3-CALC-019, A3-CALC-020
- LAW(22): A3-LAW-001, A3-LAW-002, A3-LAW-003, A3-LAW-004, A3-LAW-005, A3-LAW-006, A3-LAW-007, A3-LAW-008, A3-LAW-009, A3-LAW-010, A3-LAW-011, A3-LAW-012, A3-LAW-013, A3-LAW-014, A3-LAW-015, A3-LAW-016, A3-LAW-017, A3-LAW-018, A3-LAW-019, A3-LAW-020, A3-LAW-021, A3-LAW-022
- DATA(22): A3-DATA-001, A3-DATA-002, A3-DATA-003, A3-DATA-004, A3-DATA-005, A3-DATA-006, A3-DATA-007, A3-DATA-008, A3-DATA-009, A3-DATA-010, A3-DATA-011, A3-DATA-012, A3-DATA-013, A3-DATA-014, A3-DATA-015, A3-DATA-016, A3-DATA-017, A3-DATA-018, A3-DATA-019, A3-DATA-020, A3-DATA-021, A3-DATA-022
- AX(20): A3-AX-001, A3-AX-002, A3-AX-003, A3-AX-004, A3-AX-005, A3-AX-006, A3-AX-007, A3-AX-008, A3-AX-009, A3-AX-010, A3-AX-011, A3-AX-012, A3-AX-013, A3-AX-014, A3-AX-015, A3-AX-016, A3-AX-017, A3-AX-018, A3-AX-019, A3-AX-020
