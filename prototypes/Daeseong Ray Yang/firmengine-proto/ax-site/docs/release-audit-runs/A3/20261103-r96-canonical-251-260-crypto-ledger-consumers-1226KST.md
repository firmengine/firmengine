# FirmEngine A3 r96 — canonical #251~260 거래원장 원단위·대상·법률·서식 소비처 검증 (2026-11-03 KST)

## 1. 시작 기준·범위·검증 수준
- 기준 GitHub **main HEAD `55b168254f9b56bd8877821e0e53549a38e4c267`**, 대상은 오직 `prototypes/Daeseong Ray Yang/firmengine-proto/ax-site/`. 이전 r95 #241~250 다음 번호 **#251~260**. 최신 canonical 인덱스 blob `27ecdddd208de82a2f5c675e7482485e3a8838c2`; 단일 보드 blob `214f4ccd311b300ef39f21a1a59aae9915f2396f`.
- 역할 순환 **계산사무장 → 데이터담당자 → IT담당자 → 사용자·서류담당자 → 변호사 → AX담당자**. 이번 5개 체크 ID: `A3-CALC-018`, `A3-DATA-019`, `A3-IT-007`, `A3-DOC-010`, `A3-LAW-017`. **모두 부분 [ ]**, 제품 인수 통과 표시 금지.
- 원천 JSON + 문서/패밀리/추가 필드 독립 조인: **693 canonical 고유, 85개 문서, 48패밀리, 문서×family 141개, 기본+문서확장+보충 총 1,808 선언 source 슬롯**, 고아/의미충돌/중복 ID 없음. 번호표 693행과 index 순서 정확 일치. **현재 #251~260 10개/10슬롯/1문서/1패밀리**, 행 전체 열거는 표 참조. 18 계산/91 선언 입력(78고유), 법률 위험95/규칙50/예외46은 실제 최신 JSON 카운트.
- 실행 방법: 현재 GitHub 원본 `canonical-field-binding.ts`, `ocr-calculation-input.ts`, `feature-lineage-audit.ts`에서 **검사 함수 본문을 그대로 추출**하고 타입선언만 제거해 JavaScript V8에서 호출. canonical ID 결속 정상10/미등록10/키충돌10 = **30/30 현행 분기 기대 일치**; 로컬 OCR 셀 **19/19 현행 분기 기대 일치**; 실제 기간·단위 술어 각 10회 및 reviewScope 2회. **금액 정규화 외부 함수는 KRW-only 합성 stub**. 개별 코어 함수 동작 재현이지 **실제 Node/CI, 전체 계산, D1 Fact/typed, OCR 사실, 스테이징, 법률 적합 승인, 공식 서식 출력의 합격이 아니다**.
- #251~260 **적용조건 등록 0/10**, 즉 미등록 요건의 승인 합격은 **각각 0%**. 원천이 없다는 뜻 아님. 확인되지 않은 법률상 필수성도 합격 0%; 담당자에게 판단 요청. 개인 실제 문서·계좌·주소·키·env·비공개 정답은 사용/기록하지 않음.

## 2. 개별 피처 source/계산/법률/서식 소비처 및 검산·역질문
- 모든 10 ID는 `crypto_transactions` 문서, `bank_transactions` OCR family의 **정확한 문서확장 source field 하나씩**. 원본 위치 계약 `exact field/column label + stable party/asset/account/period/transaction row identity + quote/bbox + document hash/page` 필요. 실제 문서/PDF 페이지/복수 거래행/대상자/원통화/기간/원문 hash는 **미관찰**.
- 마지막 4수치 = **정확 ID 직접 typed / material 계산 / 공식 서식 token / 승인 법률 계약**. 전부 0/0/0/0은 원문·서류 증거의 무용·폐기를 뜻하지 않는다. P/U는 `hasPeriod()`/`hasUnit()` 원본 술어이고 법원·문서상의 요건과 별개.

| 번호 | canonical ID | 데이터형 / 원단위 | 시간역할 / 대상 | 기간 P / 단위 U | 적용조건 | typed/material/form/legal | source-only 보존·소비처/역질문 |
|---:|---|---|---|---|---|---|---|
| 251 | `crypto_transactions::completed_at` | `datetime` / `not_applicable` | `source_date_time_or_period` / `document_subject` | Y (document) / 일치; N (unit) | 미등록 **0%** | **0/0/0/0** | 거래 완료시각은 요청시각 #261·잔고 시각과 구분. 승인된 실행/정산·시간대 확인 전 재산 변동 확정 금지. |
| 252 | `crypto_transactions::counterparty_account_identity` | `party_role` / `not_applicable` | `not_applicable` / `document_subject` | Y (document) / P2 개별기간과잉; N (unit) | 미등록 **0%** | **0/0/0/0** | 거래 상대 계정의 표기≠실질소유. 원천계정·도착계정·KYC·거래행 확인 필요. |
| 253 | `crypto_transactions::crypto_event_kind` | `category` / `not_applicable` | `not_applicable` / `document_subject` | Y (document) / P2 개별기간과잉; N (unit) | 미등록 **0%** | **0/0/0/0** | 전송/매매/내부이체/취소/스왑 구분 전 현금흐름·소득 분류 금지. |
| 254 | `crypto_transactions::destination_address` | `identifier` / `not_applicable` | `not_applicable` / `document_subject` | Y (document) / P2 개별기간과잉; N (unit) | 미등록 **0%** | **0/0/0/0** | 수신 지갑은 보유권·실제 수령확정의 단독 근거 아님; 네트워크/txid 교차검산. |
| 255 | `crypto_transactions::fee_asset` | `string` / `not_applicable` | `not_applicable` / `document_subject` | Y (document) / P2 개별기간과잉; N (unit) | 미등록 **0%** | **0/0/0/0** | 수수료 자산 원단위(ETH 등)를 거래자산·표시통화와 별도 보존. |
| 256 | `crypto_transactions::fee_quantity` | `quantity` / `source fee asset unit` | `not_applicable` / `document_subject` | Y (document) / P2 개별기간과잉; Y (unit) | 미등록 **0%** | **0/0/0/0** | 수수료 수량의 소수·음수·문자값 검사 공백; 지급/환급/할인과 별도 회계 의미 검토. |
| 257 | `crypto_transactions::gross_trade_amount` | `money` / `source currency/unit` | `not_applicable` / `document_subject` | Y (document) / P2 개별기간과잉; Y (unit) | 미등록 **0%** | **0/0/0/0** | 거래 총표시금액은 현금입금·현재 보유재산·취득원가와 다름. USD/KRW/USDT quote 충돌 검토. |
| 258 | `crypto_transactions::network` | `string` / `not_applicable` | `not_applicable` / `document_subject` | Y (document) / P2 개별기간과잉; N (unit) | 미등록 **0%** | **0/0/0/0** | 동일 기호라도 네트워크·컨트랙트가 다를 수 있어 거래 합산 전 식별 검토. |
| 259 | `crypto_transactions::quantity` | `quantity` / `asset-native unit` | `not_applicable` / `document_subject` | Y (document) / P2 개별기간과잉; Y (unit) | 미등록 **0%** | **0/0/0/0** | 거래 수량과 잔고 #245를 합산하지 않음. 요청/체결·매수/매도·내부이체/수수료 교차검산. |
| 260 | `crypto_transactions::quote_currency` | `string` / `not_applicable` | `not_applicable` / `document_subject` | Y (document) / P2 개별기간과잉; N (unit) | 미등록 **0%** | **0/0/0/0** | 호가통화는 수수료 자산·원화 정산통화와 다름. 실 환율/기준시각 검증 전 자동 원화 환산 금지. |

- **정확 typed 0/10**: `canonical-field-binding.ts` 원본 함수에 extension source ID를 넣고 9 typed category 투영 호출. 10개 모두 `canonicalProjectionKey=null`. 같은 family의 `bank_transactions::amount` 등 기존 별도 필드는 본 확장 ID와 동의어가 아니며, 이름이 비슷하다고 자동 투영하면 안 된다.
- **정확 계산/91 입력 0/10**: `material-calculation-source-gate.ts` 정확 ID 등록 없음, `ocr-chain-matrix.ts` 정확 form 계산 선언 없음. 원천 거래량/총액/수수료는 `income.net`/자산 현가/현금 잔액/채무에 자동 편입 금지; 독립 원천 검산·역질문으로 보존한다. 18/91 선언 목록을 조회했지만 18 계산 엔진 자체 실행 검증은 **0**.
- **법률 0/10 승인**: 위험95/규칙50/예외46 현재 정적 카탈로그와 `legal-evidence-criteria.ts` 기본 seed `checks=[]` 확인. seed가 빈 사실은 실제 운영기준정보 0건이라는 증거가 아님. 정확 ID 승인·관할/시행일·공식 출처·변호사 확인 **미관찰**. `reviewScope("bank_transactions")` 법률 후보에는 `SEOUL-408`이 없고 `reviewScope("crypto_transactions")`에는 있음. **실제 V8 원본 함수에서 차이 재현**. 기존 미병합 Draft PR #56/#59와 중복/충돌 검토, 자동 법률값 승격 금지.
- **서식 0/10 정확 토큰**: source family에서는 `EVIDENCE_INDEX` 후보만 생성, 공식 D5101·D5110 직접 token은 미선언. 서식 후보≠법원 양식 공식 기재 근거. `source-only` 원문 추적, 서류 갈음·보정 대조·담당자 역질문은 여전히 필요한 용도.
- **DB 스키마 경로 정적 확인**: `db/schema.ts` `extraction_records`, `extracted_features`의 `canonical_field_id/raw_value_json/unit/source_state/quote/bbox_json`, `extraction_field_coverage`, `case_calculation_features` 구조. 문서 hash+page+row+source state+원통화/원단위를 분리 저장할 계약이지 D1에 실 행이 존재한다는 뜻 아님.
- **서류 갈음/법원 보정**: 해당 1문서에 대한 사건별 요구·갈음·보정·재검토·공식 토큰 소비의 실제 동적 증거 없음. 미관찰/null/명시적0/비해당/상충/source-only/승인전 상태는 합치거나 임의 원화화하지 않았다.

## 3. 실제 V8 원본 함수 테스트: 합성 입력 / 현재 코드 기대 / 관찰 / 독립 업무안전 미충족
- 아래 **19/19는 현재 코어 함수 동작의 기대와 재현 일치**라는 의미이며 **독립 안전 기대가 모두 충족됐다는 뜻이 아니다**. `money`의 normalization은 KRW-only stub만 사용했고 날짜·문자열·수량은 원본 함수 본문을 그대로 실행했다.
| 테스트 | 합성 입력 | 현행 기대 | 실제 관찰 | 독립 안전 관점 |
|---|---|---|---|---|
| 251 완료시각 유효 | 2026-11-03T02:21:00Z | [] | [] | 동작 일치 |
| 251 잘못된 날짜 | 2026-02-30T02:21:00Z | SOURCE_DATETIME_INVALID | SOURCE_DATETIME_INVALID | 동작 일치 |
| 252 상대 계정 | ?? | [] | [] | 의미검증 미수행 |
| 253 임의 거래유형 | unrecognized_rocket_event | [] | [] | P2 검토 |
| 254 임의 주소 | ??? | [] | [] | P2 검토 |
| 255 수수료 자산 | ETH | [] | [] | 동작 재현 |
| 256 음수 수수료수량 | -0.10 ETH | [] | [] | 독립 안전 기대: 단위/부호 검토, 불충족 후보 |
| 256 문자 수수료수량 | nonsense ETH | [] | [] | 독립 안전 기대: 비숫자 차단, 불충족 |
| 257 금액 단위 누락 | 200 + null | SOURCE_MONETARY_UNIT_MISSING | SOURCE_MONETARY_UNIT_MISSING | 동작 일치 |
| 257 USD 원화정규화 | 200 USD | SOURCE_MONEY_NOT_EXACT_KRW | SOURCE_MONEY_NOT_EXACT_KRW | KRW-only 합성 stub |
| 257 USD 인용·KRW 필드 | 200 KRW, quote='200 USD' | [] | [] | 독립 안전 기대: 원문교차 검토, 불충족 |
| 258 임의 네트워크 | MARS | [] | [] | 등록/체인 검증 공백 |
| 259 음수 수량 | -2.5 BTC | [] | [] | 독립 안전 기대: 부호 검토, 불충족 후보 |
| 259 비숫자 수량 | bananas BTC | [] | [] | 독립 안전 기대: 비숫자 차단, 불충족 |
| 260 임의 호가통화 | MARS | [] | [] | 통화 카탈로그 검사 공백 |
| 251 미관찰 null | null + unknown | [] | [] | 미관찰 ≠ 0 |
| 251 present null | null + present | SOURCE_PRESENT_VALUE_MISSING | SOURCE_PRESENT_VALUE_MISSING | 명시적 누락 검사 |
| 256 값 0 | 0 ETH + present | [] | [] | 0 ≠ unknown/비해당 |
| 257 명시 0원 | 0 KRW + present | [] | [] | 원천 표시 ≠ 법률 승인 |
- **독립 안전 RED 후보**: #256/#259 음수·문자 수량 로컬 함수에서 모두 오류 `[]` → 수량 숫자/부호/소수정밀도/원단위 확인 필요(음수는 거래역할에 따라 허용 가능하므로 무조건 금지하는 의미 아님). #257 원문 인용 USD vs 셀 입력 KRW `[]` → 원문·단위 교차검증 필요. #253 임의 거래유형, #258 임의 네트워크, #260 임의 호가통화도 로컬 검사 `[]`. **상위 API/DB/OCR/유효 참조 확인은 아직 실행하지 않아 제품 전체 P1/P2 확정 불가**.
- 원본 `hasPeriod(role,family)`로 **10/10 true**, 개별 `temporal_role=not_applicable`인데 family-wide 기간 flag true는 **9/10**. 이는 문서·거래기록 기간과 개별 컬럼 날짜요건을 혼동할 수 있는 P2 후보. 기존 미병합 Draft PR #51과 충돌하는 영역이므로 main 코드 수정하지 않음. 원본 `hasUnit`은 3/10 true (#256/#257/#259), 이는 원단위의 실제 유효성 검증과 다름.
- 각 거래행의 `txid`(#263 이후), `requested_at`(#261), 원본 발신주소(#262), 상태/유형, 완료시각 #251, 상대 계좌 #252, 수신주소 #254, 자산기호 #250, 네트워크 #258, 수수료 원자산 #255와 수량 #256, 호가통화 #260과 총액 #257의 **동일 문서+row+대상+시각 identity**가 확인되지 않으면 교차 합산/수익·자산 전환 금지. 동일 내부이체 유입·유출을 두 자산으로 셈하거나 fee quantity를 매매수량에서 이중 차감하지 않는다. 실제 E2E 검산 테스트는 미수행.

## 4. 보드 ID별 부분 근거와 미검증 사항
| 체크/역할 | 이번 실제 확인 | 인수 결함·남은 단계 |
|---|---|---|
| `A3-CALC-018` 계산사무장 | 원통화/거래 총액과 잔고, 수수료 및 거래 수량 비합산 원칙 대조, 18계산·91입력 정적 조회; material 정확 0/10 | 계산 18개 실행/시점·행 검산/환율·잔고 D1 E2E **미수행** |
| `A3-DATA-019` 데이터 | 693/693 번호표, 85/48/141/1808 원천 join, ID별 적용조건 0/10, typed 0/10 확인 | 적용조건 필드별 등록·관리 승인, 실제 D1 원문+typed 재조회 미관찰 |
| `A3-IT-007` IT | ID 결속 V8 30/30, 셀 V8 19/19 현행분기 재현, 10/10 기간/단위 실제 함수 호출 | 독립 안전공백(수량·통화·문서원문 교차)과 전체 Node/CI 미검증 |
| `A3-DOC-010` 사용자·서류 | 1문서/10 원천행 및 문서 hash/page/quote/bbox+row/subject locator 요구 선언 | 문서 실제 OCR/거래행·갈음·보정·서식 출력 미관찰 |
| `A3-LAW-017` 변호사 | 위험95/규칙50/예외46 및 family→SEOUL-408 후보 라우팅 차이 원본 V8 관찰 | 승인 법적 근거, 관할·시행일, 공식 출처/변호사 사건별 검토 **0%** |

## 5. 이번 조치·충돌 방지·다음 조사
- 선행 미병합 Draft #51(기간 판정), #56/#59(가상자산 법률 후보)와 중복 위험이 있으므로 의미변경 제품코드·운영배포는 실행하지 않음. **실행되지 않은 수정/테스트를 통과로 기재하지 않음.** 5개 보드 ID 모두 **[ ]** 미완료.
- 이 영수증은 `ax-site/docs/release-audit-runs/A3/` 신규 고유 파일. 중앙 보드는 해당 5 ID만 HEAD/blob 재확인 뒤 보존 병합. 최종 산출 Git HEAD/커밋은 각 쓰기 응답과 사후 조회로 별도 확인.
- 다음 canonical **#261 `crypto_transactions::requested_at`**, 범위 **#261~270**. 다음 회차 역할 **데이터담당자 시작**; 요청/완료/출발/수취/txid/상태·스왑/내부이체/손익/가상자산 보유잔고 중복 방지 추가 검증.
- **현재 A3 제품 인수 0/124**. 정적 존재 ≠ V8 격리 재현 ≠ 전체 Node CI ≠ staging D1/R2/Cron ≠ 공식 양식/변호사 승인 ≠ 사이트 배포. 운영 DB 마이그레이션·법원제출·인가 확정 미수행.

## 부록 A — GitHub 최신 canonical 전체 693개 정확 순번
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

## 부록 B — 중앙 인수 보드의 6역할 A3 체크 ID 전체 순번 (124)
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

## 부록 C — 기준 소스 Blob 영수증
- `lib/canonical-field-id-index.json`: blob `27ecdddd208de82a2f5c675e7482485e3a8838c2`
- `lib/shared-document-field-contracts.json`: blob `9decab974e0909ae24ad927bdfe241d75b71f3a9`
- `lib/field-applicability-contracts.json`: blob `6076b26f782c4643a21a7b2f1a8f6261bb588b68`
- `docs/PRODUCT_RELEASE_INTEGRATION_BOARD.md`: blob `214f4ccd311b300ef39f21a1a59aae9915f2396f`
- `lib/ocr-calculation-input.ts`: blob `8f7f51bf41f7c944b76419d7cc894e49ac771473`
- `lib/canonical-field-binding.ts`: blob `60ee5c7762d52b72a165b4f4f8214680eb98f148`
- `lib/feature-lineage-audit.ts`: blob `de81bc3b8c460b8a4dde3fda9e13087e619e74ff`
- `lib/material-calculation-source-gate.ts`: blob `0286b44484913b63fa8ec3f7bf0ca59b034d0dab`
- `lib/ocr-chain-matrix.ts`: blob `977de86ba698bd805cc6b95d1384e3b49d0dbb4c`
- `lib/reference-decision-tables.json`: blob `6924e3977caf748ce8a3d617fae15aff7d2fe2ce`
- `lib/risk-catalog.json`: blob `e96dd0926e3ae9be5a5573d4551538ba294c4d2e`
- `lib/legal-catalog.json`: blob `b0898d74f1df69b19ecf6e81cdff0ed09e8d885e`
- `lib/legal-exceptions.json`: blob `6e51197226bfd8320e1147d8df3f12c11e00927c`
- `docs/ocr-693-field-register.md`: blob `dfa1a09cf035a07130e2cf40a6b4e7dae44581d4`
- `lib/ocr-field-supplements.json`: blob `63b2bf853acb2e9620a6fb72377dc278ff3cd2a5`
- `lib/document-agent-field-contracts.json`: blob `9884b3fecf44643fefcdc4a421ed66ffc5477b3a`
