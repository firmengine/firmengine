# FirmEngine A3 r81 — canonical #101–110 사업경비 지급·세액·사업계약 소비처 독립 재감사

작성일: **2026-11-02 KST**. 작업 범위: `prototypes/Daeseong Ray Yang/firmengine-proto/ax-site/` **A3만**. 정적 카탈로그·함수 본문 격리 실행과 실제 제품 전체 검증을 분리한다. 합성 source 예시만 사용하였으며 실고객/PII/OCR 원문/.env/키/비공개 정답은 기록하지 않았다.

## 1. 시작점과 읽은 GitHub 원천
- 시작 `main` SHA **`077687cd0f545f6eecf831b268eba00bf4366464`**, 중앙 보드 blob `bc336510e6381989954edc9588eacb869062596a`. 이전 r80 영수증 #091–100에서 **#101**부터 이어 시작. 실제 최근 PR #189는 이 회차에서 실무/법률 의미가 달라질 수 있는 **진단 RED 테스트만** 별도 분리한 Draft.
- 선행 미병합 PR: #30(사업비용 소비후보), #51(기간 분류), #179(자산처분 새로운 증거), #189(이번 비용 지급증거) 확인. 해당 코드는 main에 임의 반영하지 않음.
- 역할 순환: **AX → 데이터 → 계산사무장 → 변호사 → 사용자·서류 → IT**. 이번 중앙 보드 부분체크: `A3-AX-017`, `A3-DATA-013`, `A3-CALC-016`, `A3-LAW-020`, `A3-DOC-017` 5개, 전부 **[ ] 미완료 유지**. IT 관점은 원본 인덱스/blob/PR 충돌 보호·조회로 수행하되 별도 체크 ID를 추가 완료 처리하지 않음.
- 최신 원천 파일 blob:
  - `lib/canonical-field-id-index.json`: `27ecdddd208de82a2f5c675e7482485e3a8838c2`
  - `lib/document-agent-field-contracts.json`: `9884b3fecf44643fefcdc4a421ed66ffc5477b3a`
  - `lib/shared-document-field-contracts.json`: `9decab974e0909ae24ad927bdfe241d75b71f3a9`
  - `lib/ocr-field-supplements.json`: `63b2bf853acb2e9620a6fb72377dc278ff3cd2a5`
  - `lib/field-applicability-contracts.json`: `6076b26f782c4643a21a7b2f1a8f6261bb588b68`
  - `lib/material-calculation-source-gate.ts`: `0286b44484913b63fa8ec3f7bf0ca59b034d0dab`
  - `lib/business-net-reconciliation.ts`: `60a4fc295943dce404a7f99efffe88f58dd2d4ff`
  - `lib/business-source-evidence.ts`: `0b796d9c3bc608c1224c5f9a049c80b6951a8b74`
  - `lib/canonical-field-binding.ts`: `60ee5c7762d52b72a165b4f4f8214680eb98f148`
  - `lib/feature-lineage-audit.ts`: `de81bc3b8c460b8a4dde3fda9e13087e619e74ff`
  - `lib/ocr-calculation-input.ts`: `8f7f51bf41f7c944b76419d7cc894e49ac771473`
  - `lib/reference-decision-tables.json`: `6924e3977caf748ce8a3d617fae15aff7d2fe2ce`
  - `lib/risk-catalog.json`: `e96dd0926e3ae9be5a5573d4551538ba294c4d2e`
  - `lib/legal-catalog.json`: `b0898d74f1df69b19ecf6e81cdff0ed09e8d885e`
  - `lib/legal-exceptions.json`: `6e51197226bfd8320e1147d8df3f12c11e00927c`
  - `lib/template-token-catalog.json`: `899c4d564fcb1726861f89dcf04dbf1b7e372687`
  - `docs/PRODUCT_RELEASE_INTEGRATION_BOARD.md`: `bc336510e6381989954edc9588eacb869062596a`
- 실제 조회 스코프: **693 canonical unique**, **85 doc**, **48 OCR family**, **141 문서×패밀리 route**, base+extension+**OCR supplement 19 슬롯**을 합쳐 **1,808 unique source slots**(중복0/고아0). 보충 OCR 19개를 빼면 **1,789**로 과소 집계됨. 이전 r80의 1,808을 재현하려면 `ocr-field-supplements.json` 결합이 필수.
- `reference-decision-tables.json`: **18 계산, 선언 input 합 91** (고유 input 78 여부는 별개). `risk-catalog.json` 95 risk, `legal-catalog.json` 50 rules, `legal-exceptions.json` 46 scenarios. 실제 Node 계산 18개 end-to-end 실행 아님.
- 이번 실제 #101–110은 **10개 canonical / 40개 고유 source slots / 8개 서로 다른 문서 / 2개 family**, exact 적용조건 **10/10 등록**(사람/법률상 승인과 무관). 각 필드는 명시 문서·family·원문 document ID·page/row/quote/bbox/hash를 보존해야 한다는 **계약 선언** 확인. 실제 고객 행·페이지/복수행/R2/D1 Fact 회수 **0건**.

## 2. #101–110 원천→소비처/공백 테이블

| # | 정확 canonical ID | 문서 (개수/명칭) | datatype · 원단위 · temporal · subject | 적용조건 / period unit | 코드로 확인한 소비처와 미인증 공백 |
|---:|---|---|---|---|---|
| 101 | `business_costs_and_ledgers::income.business_cost.gross_amount` | 4: business_income_report, financial_statement, sales_purchase_summary, operating_expenses | money / KRW / period_scope / business_entity | 조건등록(**승인 아님**); P=Y, U=Y | `business-source-evidence.ts:BUSINESS_SOURCE_MONEY_ROLES` → cost_line; `preflightBusinessNet` 비용 Fact 직접선정 및 net 차감(검토 전), `MATERIAL_CALCULATION_SOURCES=context_only`; VAT/순액 분리 |
| 102 | `business_costs_and_ledgers::income.business_cost.payment_date` | 4: business_income_report, financial_statement, sales_purchase_summary, operating_expenses | date / not_applicable / event_date / business_entity | 조건등록(**승인 아님**); P=Y, U=N | `preflightBusinessNet`의 `sourceFactIds`·basis 직접 포함 확인 못함; 후행 지급일 변경으로 검토 지문 변화 0(합성) |
| 103 | `business_costs_and_ledgers::income.business_cost.payment_status` | 4: business_income_report, financial_statement, sales_purchase_summary, operating_expenses | enum / not_applicable / not_applicable / business_entity | 조건등록(**승인 아님**); P=Y, U=N | 동 함수 직접 포함 0; `paid→unpaid` 후 원본 사전검토 net=2000000 형식 유지(합성); 법률상 비용 인정·현금주의 판단 미검증 |
| 104 | `business_costs_and_ledgers::income.business_cost.period_end` | 4: business_income_report, financial_statement, sales_purchase_summary, operating_expenses | date / not_applicable / statement_period_end / business_entity | 조건등록(**승인 아님**); P=Y, U=N | `preflightBusinessNet` `rowUnique`의 비용 종료일 exact 월말 비교 + sourceFactIds/basis 포함 |
| 105 | `business_costs_and_ledgers::income.business_cost.period_start` | 4: business_income_report, financial_statement, sales_purchase_summary, operating_expenses | date / not_applicable / statement_period_start / business_entity | 조건등록(**승인 아님**); P=Y, U=N | `preflightBusinessNet` `rowUnique`의 비용 시작일 exact 월초 비교 + sourceFactIds/basis 포함 |
| 106 | `business_costs_and_ledgers::income.business_cost.supplier` | 4: business_income_report, financial_statement, sales_purchase_summary, operating_expenses | party_role / not_applicable / not_applicable / payee | 조건등록(**승인 아님**); P=Y, U=N | `preflightBusinessNet` 추가 원천 지급상대방 Fact 직접 포함 0; 사업체/상대방 동일성·자금행방은 별도 검토 |
| 107 | `business_costs_and_ledgers::income.business_cost.tax_component` | 4: business_income_report, financial_statement, sales_purchase_summary, operating_expenses | money / KRW / period_scope / business_entity | 조건등록(**승인 아님**); P=Y, U=Y | `business-source-evidence.ts` `input_vat`; `preflightBusinessNet` 같은 source row에서 별도 검산용 값으로 sourceFactIds에 포함하되 비용으로 2회 차감하지 않음 |
| 108 | `business_current_income_summary::income.self_employment.business_costs` | 4: income_source_inventory, business_contract, business_income_report, platform_settlement | money_or_itemized / KRW / period_scope / business_entity | 조건등록(**승인 아님**); P=Y, U=Y | `business-source-evidence.ts` `cost_summary`; `material` context_only. 세부경비 #101과 이중 차감 금지, 본 preflight 직접 비용목록에 넣지 않음 |
| 109 | `business_current_income_summary::income.self_employment.contract_end` | 4: income_source_inventory, business_contract, business_income_report, platform_settlement | date / not_applicable / effective_date / applicant_debtor | 조건등록(**승인 아님**); P=Y, U=N | 사업계약 효력 종료일 source-only; 신청기준 시점/지속성 사람검토, 정확 typed·material·서식 직접 매핑 0 |
| 110 | `business_current_income_summary::income.self_employment.contract_id` | 4: income_source_inventory, business_contract, business_income_report, platform_settlement | string / not_applicable / not_applicable / applicant_debtor | 조건등록(**승인 아님**); P=Y, U=N | 사업계약 ID source-only; 사업자·지급처·중복 계약 원천대조 후보, 정확 typed·material·서식 직접 매핑 0 |

공통 정확 정적 대조: #101~110 **direct typed projection 0/10**(`canonical-field-binding.ts`의 business_costs/business_current 대상 직접 projections 없음), **direct official form token 0/10**(`template-token-catalog.json`), **정확 canonical 법률위험95/규칙50/예외46 승인 계약 0/10**. 하지만 #101/#104/#105/#107의 독립 사업소득 사전검토·증거검산 소비를 **0개 전체 소비처로 잘못 단정하면 안 됨**. #101, #108 `MATERIAL_CALCULATION_SOURCES`는 각각 **context_only**, must_reconcile이 아님; 법률상 허용 경비를 자동 인정하지 않는다.

**자료 구조 의미:** 40 source slots의 `recordPolicy`는 `one_source_entity_event_or_period_per_record`, `noCrossRecordBorrowing=true`, `sourceOnly=true`, 원문 row/summary-detail/기간/사업주체 분리를 선언. 실제 사건 D1 저장→읽기 및 갈음/법원보정의 행 단위 E2E는 미관찰. `present/null/zero/explicit_none/not_applicable_reviewed/conflicting`을 동치 처리하지 않고, 승인전은 별도 상태.

## 3. 실제 실행한 합성시험 — 원본 반환과 독립 안전 기대 분리

### 3-1. 원본 TypeScript 함수 본문 V8 격리 6개 시나리오
- `business-net-reconciliation.ts`의 **preflightBusinessNet 실제 원본 body 75줄**을 header 타입 선언만 제거한 뒤 V8 `Function()`으로 실행. `sourceFact`, `rowUnique`, `money`, `approvedBusinessIncomeRule`, `businessNetReviewBasis`와 row/index는 **합성 stub**, 실제 Node `CaseData`/공식정책/법원 승인 아님. 원본 `sourceFactIds` 선정과 새 evidence 참여 여부를 검증.
- 입력 기준: 2026-09 월, gross **3000**, cost **1000**, test 승인범주 `rent` (법률 인정 아님), case as-of 2026-10-31. 별도 날짜표시의 2026-11/12는 후행 증거 후보를 노출하기 위한 합성값이다.

| 단계·합성 입력 | 독립 기대 | 실제 원본 함수 관찰 | 판정 |
|---|---|---|---|
| 기본 gross3000-cost1000, 같은 period/사업주체와 category | net=2000, 금액·원천행·기간·category Fact ID 결속 | net `2000`, 10개 sourceFactIds | 합성 격리 동작 일치 |
| 비용 행에 #103 `payment_status=paid` 새 Fact 추가 | 새 증거를 재검토 대상으로 노출 | net=2000, source ID·가상 basis **변경 0** | **독립 안전 기대 미충족 후보** |
| 같은 #103 Fact를 `unpaid`로 변경 | 이전 지급상태 검토 근거 재평가 | net=2000, source ID·가상 basis **변경 0** | **미충족 후보** |
| #102 `payment_date=2026-12-20`, #106 supplier 추가 | 지급시점·상대방 증거에 대한 재검토 필요 | net=2000, source ID·가상 basis **변경 0** | **미충족 후보** |
| #107 `tax_component=100` 같은 비용행 추가 | input VAT는 중복 비용 차감 금지, 검산 증거 ID 포함 | net=2000 유지, `input-vat` Fact ID 추가 | 합성 원본문 일치 |
| #104 비용행 end를 `2026-08-31`로 바꿈 | 기간 불일치 차단 | `BUSINESS_SOURCE_PERIOD_DIFFERS:cost` | 합성 원본문 일치 |

**핵심 경계:** `businessNetReviewBasis`는 원본 대신 선택된 Fact의 ID·값을 이용한 **synthetic basis stub**으로 대체했으므로 `basisSnapshot` 동등성은 원본 제품 SHA의 E2E 증거가 아니다. 그러나 **원본 preflight의 sourceFactIds 자체가 #102/#103/#106을 추가하지 않는 현상은 직접 관찰**했다. 실제 서비스에서 이미 승인된 소득의 staleness까지 확정하려면 `proposeBusinessNet→adoptBusinessNet→reviewedBusinessIncomeIds`를 Node 실환경에서 회귀해야 한다.

### 3-2. `ocr-calculation-input.ts` 원본 셀 형식검사 11개 격리 시험
- `calculationSourceCellIssues` 실제 body와 `validDate/validTime`를 V8로 실행; `normalizeMoney`는 **KRW 정수만 exact**인 합성 stub. 원본의 형식검사 동작과 독립 법률인정은 다름.

| ID | 합성 raw | unit | 기대 **형식검사 반환** | 실제 관찰 |
|---:|---|---|---|---|
| #101 | `100` | null | `SOURCE_MONETARY_UNIT_MISSING` | 동일(원본 함수 body 격리) |
| #101 | `100` | `KRW` | `[]` | 동일(원본 함수 body 격리) |
| #102 | `2026-02-30` | null | `SOURCE_DATE_INVALID` | 동일(원본 함수 body 격리) |
| #103 | `unpaid` | null | `[]` | 동일(원본 함수 body 격리) |
| #104 | `2026-09-30` | null | `[]` | 동일(원본 함수 body 격리) |
| #105 | `2026-09-01` | null | `[]` | 동일(원본 함수 body 격리) |
| #106 | `unspecified-payee` | null | `[]` | 동일(원본 함수 body 격리) |
| #107 | `30` | null | `SOURCE_MONETARY_UNIT_MISSING` | 동일(원본 함수 body 격리) |
| #108 | `100` | null | `SOURCE_MONETARY_UNIT_MISSING` | 동일(원본 함수 body 격리) |
| #109 | `2026-02-30` | null | `SOURCE_DATE_INVALID` | 동일(원본 함수 body 격리) |
| #110 | `not-observed` | null | `[]` | 동일(원본 함수 body 격리) |

**11/11은 현재 원본문 형식검사 반환 재현**이다. #103의 `unpaid`, #106의 임의 공급자, #110의 임의 계약식별자 문자열이 이 함수에서 오류 0인 것은 의미 검증/사실 확인/사람 승인 성공이 아니다. `feature-lineage-audit.ts`의 `hasPeriod`는 10/10 true였고 #103/#106/#110은 field `temporal_role=not_applicable`인데 family regex `ledger`/`income`에 의해 true여서 **문서기간과 필드기간 검사 구별 필요** (기존 Draft PR #51과 중복 변경 없음).

### 3-3. 독립 목록·경계 검사 (정적 실제 소스 조인)
- exact 10 canonical ID 인덱스 순번, 40개 문서×family×ID 원천 슬롯, 부수 19 supplemental 슬롯 포함 전체 1,808 경로를 실제 JSON에서 계산: **중복 0 / orphan 0**.
- 10/10 exact applicability 등록; 미등록/미승인인 상위 법률·계산 요구는 **0% 합격**, 0/null/미관찰/비해당/source-only 승격 금지. 18산식/91입력은 계약 **구조조회만**, 18개 실제 함수 실행 0.
- exact 법률 승인 링크·공식 서식 토큰은 0/10. `D5103/D5110` 등은 일반 **검토 후보**이며 특정 법원 공식 양식 token과 합격 동의어 아님. 갈음 B+C·보정명령의 사례별 실제 연결은 아직 0/10 미인증 (자료 가치 0이라는 뜻 아님).

## 4. 조사 후보와 코드 변경 분리
- **P1 조사 후보**: 이미 검토한 경비의 `payment_status`/지급일/공급자 사실이 새로 확인되거나 바뀌어도 `preflightBusinessNet`의 선택 source fact 목록에 포함되지 않는 경로. 세무 현금주의·발생주의와 공식 승인 비용정책에 따라 실제 법률 의미가 달라서 자동 비용 제외/수정 금지.
- 고위험/법률 의미 변경 금지에 따라 **[Draft PR #189](https://github.com/firmengine/firmengine/pull/189)** 에 합성 Node RED 진단 **control 1 + 기대 실패 3**을 새 테스트 파일 1개로만 분리함. PR commit `34c93918fbb624611e618f3479b976d198f74338`, **미병합**. 실제 Node/CI 실행 **0건**; 실패 예측이 곧 실행 영수증은 아님. 기존 main 제품 코드·실 DB·법률 정책 미변경.
- 실무자/법률 승인 필요: `payment_status`/지급일/공급자가 경비 인식·추가 확인·승인지문에 미치는 조건부 의미를 계산사무장+변호사가 결정하고, 동일 행/원천 Fact 갱신 vs 추가·문서 hash/정책 판본/위변조·충돌을 actual Node/D1 integration으로 재시험할 것.

## 5. 검증 수준·승인경계·후속
- **직접 확인:** live GitHub main JSON/TS source/board blob, canonical 10개·40슬롯 및 full 693/1808/124 inventory, 6개 original function body V8 dependency-stubbed scenario, 11개 OCR format V8 scenario, 2 predicate functions.
- **미관찰:** 원본 OCR 원문·페이지/복수행·D1 Fact/typed readback, 전체 Node CI, 공식 D5103/D5110 출력 검증, staging D1/R2/Cron, 법원 공식 근거 최신성·변호사 승인, 전체 18계산 E2E, 실제 갈음/법원보정. **최종 A3 체크 [x] 0/124**, 이 회차 통과확정 ID **0**. 운영배포·D1 운영 마이그레이션·전자제출·인가 확정 금지, 실제로 미수행.
- 다음 회차 시작: **#111 `business_current_income_summary::income.self_employment.gross_receivable`**. 조사 범위 **#111–120**, **IT부터 역할 순환**, #108 누적 사업경비→월별 수입·계약 종료·입금의 source/typed/법률·정식 서식 연결을 확인.

## 부록 A — 최신 canonical OCR 693개 원본 순번 전수 열거

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

## 부록 B — 중앙 보드 A3 6담당자 124개 ID 전수 열거

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
