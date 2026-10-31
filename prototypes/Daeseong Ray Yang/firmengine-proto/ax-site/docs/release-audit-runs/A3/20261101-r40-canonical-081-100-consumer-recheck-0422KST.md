# FirmEngine A3 r40 — canonical #081–100 소비처 심층 재감사 (2026-11-01 KST)

> **검증층:** 최신 GitHub main JSON 계약 정적 조인, main 원본 `hasPeriod/hasUnit` V8 격리 실행, main 소스의 사업경비 원천 검토 분기 단위 확인. **실 OCR/고객문서/Fact SQL read-back/실 계산/Node CI/staging D1·R2·Cron/공식 법원 Word/실무자 승인/사이트 배포 미실행·미인증.** 실제 원본 값, 정답, 개인정보, .env, 키 없음.

## 1. 최신 main·이전 회차 승계 / 6역할 순환

- 감사 작성 직전 읽은 `main` HEAD: `cdf5e0f524e8f6d94e9fb9a9dd7a94e4a46e2387`. 기존 [r39 #061–080](20261101-r39-canonical-061-080-consumer-recheck-0331KST.md)에서 **#081**부터 승계. 이전 [r5 #081–100](20261030-1723-canonical-081-100.md)의 76 source routes 및 기존 [Draft PR #30](https://github.com/firmengine/firmengine/pull/30) (사업경비 원천 검토 소비), [Draft PR #51](https://github.com/firmengine/firmengine/pull/51) (period predicate)와 비교. 두 PR 현재 open/draft·미병합; 제품코드 임의 변경·중복 PR 없음.
- 주요 읽은 Git blob SHA: index `27ecdddd208de82a2f5c675e7482485e3a8838c2`, family `9884b3fecf44643fefcdc4a421ed66ffc5477b3a`, document `9decab974e0909ae24ad927bdfe241d75b71f3a9`, supplement `63b2bf853acb2e9620a6fb72377dc278ff3cd2a5`, applicability `6076b26f782c4643a21a7b2f1a8f6261bb588b68`, lineage `de81bc3b8c460b8a4dde3fda9e13087e619e74ff`, binding `60ee5c7762d52b72a165b4f4f8214680eb98f148`, material `0286b44484913b63fa8ec3f7bf0ca59b034d0dab`, business net `60a4fc295943dce404a7f99efffe88f58dd2d4ff`, identity crosswalk `73331de276f9bc78e2c9d43fc48e179cf6ba161c`, extraction row `ec3f6b9d3ad8bf5f9ce4419a6816fadede378125`.
- 이번 5역할: **변호사 → 데이터담당자 → 계산사무장 → 사용자·서류담당자 → AX담당자** (직전 회차 계산사무장 시작과 구분); `A3-LAW-014`, `A3-DATA-019`, `A3-CALC-007`, `A3-DOC-007`, `A3-AX-018` 모두 **부분검증 [ ] 유지**. 다음 회차는 IT담당자 선행.

## 2. 693 canonical·85서류/48패밀리 / 18계산·91입력 / 95위험·50규칙·46예외 검증 범위

- 최신 `lib/canonical-field-id-index.json`의 **693개 index 순서 실제 열거**, 중복 `0`. `85` 문서가 허용한 `48` family를 base `document-agent-field-contracts.json` + 문서확장 `shared-document-field-contracts.json` + supplement `ocr-field-supplements.json`으로 **전체 조인한 1,808 source slots**; 고아 index `0`, 미등록 원천 ID `0`, 동일 route 중복 `0`.
- #081–100 20 IDs / **76 슬롯 / 9 고유 서류**, 정확 적용조건 등록 **15/20**, 미등록 **5/20 (#081–085)**. 미등록 필드는 **0% 합격**(해당 5건), 삭제하거나 법률상 무조건 필수로 변경하지 않음.
- `reference-decision-tables.json` 계산 **18개**, 선언 `inputs` 총 **91회**; `risk-catalog.json` 위험 **95**, `legal-catalog.json` 규칙 **50**, `legal-exceptions.json` 예외 **46**를 실제 JSON 집계. 이번 20 ID에서 **직접 typed projection 0/20**, exact OCR→공식 서식 token **0/20**, 정적 risk/rule/exception JSON의 정확 canonical ID 출현 **0/20**, `must_reconcile` **0**, `context_only` **1 (#089)**. 모든 18 계산/95·50·46 법률 항목의 실제 런타임 검증이나 법적 승인 완료를 의미하지 않음.
- `shared-document-field-contracts.json` recordPolicy는 `one_source_entity_event_or_period_per_record`, `source_row_or_paragraph_ordinal`, noCrossRecordBorrowing/summary-detail 분리 및 `present/blank/masked/unreadable/explicit_none` 분리를 선언. `extraction-row-store.ts`에 문서·page·record ordinal·field ordinal·source SHA·원본 값·sourceState 보존 경로 **존재**. **실제 해당 76슬롯의 특정 고객 원문 위치·페이지·복수행·DB 입력/재독 0건 관찰**, 앵커 선언을 실증이라고 표기하지 않음.

## 3. #081–100 개별 실제 원천-계약 소비처/공백

- 직접 typed projection은 `canonical-field-binding.ts`의 명시 family mapping 기준 전부 없음. 테이블의 **검토 소비 후보**는 계산·법적 인정·법원 제출 근거가 아님. 기간/단위 P/U는 최신 `feature-lineage-audit.ts` 원본 predicate의 결과이며 정당한 개별 요구라는 뜻이 아님.

| # | 정확 canonical ID | 원천 슬롯 (문서) | 데이터형/원단위/시간역할/대상 | 적용조건 | 원본 P/U | material | 검토 소비 또는 증거 보존 역할 |
|---:|---|---|---|---|---|---|---|
| 081 | `business_asset_inventory::disposal_restriction` | 1 (business_asset_inventory) | string / not_applicable / not_applicable / document_subject | **미등록·미인증** | N / N | — | 증거/검산/역질문 후보 |
| 082 | `business_asset_inventory::goodwill_contract` | 1 (business_asset_inventory) | text_or_list / not_applicable / not_applicable / document_subject | **미등록·미인증** | N / N | — | 증거/검산/역질문 후보 |
| 083 | `business_asset_inventory::market_value` | 1 (business_asset_inventory) | money / source currency/unit / not_applicable / document_subject | **미등록·미인증** | N / Y | — | 증거/검산/역질문 후보 |
| 084 | `business_asset_inventory::quantity` | 1 (business_asset_inventory) | quantity / source quantity unit / not_applicable / document_subject | **미등록·미인증** | N / Y | — | 증거/검산/역질문 후보 |
| 085 | `business_asset_inventory::quantity_unit` | 1 (business_asset_inventory) | string / not_applicable / not_applicable / document_subject | **미등록·미인증** | N / N | — | 증거/검산/역질문 후보 |
| 086 | `business_assets_liabilities::as_of_date` | 5 (business_asset_inventory, receivable_statement, receivable_collectability, closure_certificate, business_liquidation) | date / source date format normalized to ISO without loss / balance_as_of_date / business_entity | 등록 | Y / N | — | 증거/검산/역질문 후보 |
| 087 | `business_assets_liabilities::asset_or_claim_id` | 5 (business_asset_inventory, receivable_statement, receivable_collectability, closure_certificate, business_liquidation) | identifier / not_applicable / not_applicable / business_entity | 등록 | N / N | — | 증거/검산/역질문 후보 |
| 088 | `business_assets_liabilities::business_entity` | 5 (business_asset_inventory, receivable_statement, receivable_collectability, closure_certificate, business_liquidation) | party_role / not_applicable / not_applicable / business_entity | 등록 | N / N | — | 증거/검산/역질문 후보 |
| 089 | `business_assets_liabilities::gross_value` | 5 (business_asset_inventory, receivable_statement, receivable_collectability, closure_certificate, business_liquidation) | money / currency and exact source unit if monetary / not_applicable / business_entity | 등록 | N / Y | context_only | 증거/검산/역질문 후보 |
| 090 | `business_assets_liabilities::item_kind` | 5 (business_asset_inventory, receivable_statement, receivable_collectability, closure_certificate, business_liquidation) | category / not_applicable / not_applicable / business_entity | 등록 | N / N | — | 증거/검산/역질문 후보 |
| 091 | `business_assets_liabilities::ownership_interest` | 5 (business_asset_inventory, receivable_statement, receivable_collectability, closure_certificate, business_liquidation) | ratio / ratio/fraction as stated / not_applicable / business_entity | 등록 | N / Y | — | 증거/검산/역질문 후보 |
| 092 | `business_assets_liabilities::payable_amount` | 5 (business_asset_inventory, receivable_statement, receivable_collectability, closure_certificate, business_liquidation) | money / currency and exact source unit if monetary / not_applicable / business_entity | 등록 | N / Y | — | 증거/검산/역질문 후보 |
| 093 | `business_assets_liabilities::period_end` | 5 (business_asset_inventory, receivable_statement, receivable_collectability, closure_certificate, business_liquidation) | date / source date format normalized to ISO without loss / statement_period_end / business_entity | 등록 | Y / N | — | 증거/검산/역질문 후보 |
| 094 | `business_assets_liabilities::period_start` | 5 (business_asset_inventory, receivable_statement, receivable_collectability, closure_certificate, business_liquidation) | date / source date format normalized to ISO without loss / statement_period_start / business_entity | 등록 | Y / N | — | 증거/검산/역질문 후보 |
| 095 | `business_assets_liabilities::receivable_amount` | 5 (business_asset_inventory, receivable_statement, receivable_collectability, closure_certificate, business_liquidation) | money / currency and exact source unit if monetary / not_applicable / business_entity | 등록 | N / Y | — | 증거/검산/역질문 후보 |
| 096 | `business_assets_liabilities::secured_payoff` | 5 (business_asset_inventory, receivable_statement, receivable_collectability, closure_certificate, business_liquidation) | money / currency and exact source unit if monetary / not_applicable / business_entity | 등록 | N / Y | — | 증거/검산/역질문 후보 |
| 097 | `business_costs_and_ledgers::income.business_cost.accounting_basis` | 4 (business_income_report, financial_statement, sales_purchase_summary, operating_expenses) | enum / not_applicable / not_applicable / business_entity | 등록 | Y / N | — | 증거/검산/역질문 후보 |
| 098 | `business_costs_and_ledgers::income.business_cost.business_continuity_flag` | 4 (business_income_report, financial_statement, sales_purchase_summary, operating_expenses) | text_or_enum / not_applicable / not_applicable / business_entity | 등록 | Y / N | — | 증거/검산/역질문 후보 |
| 099 | `business_costs_and_ledgers::income.business_cost.business_entity` | 4 (business_income_report, financial_statement, sales_purchase_summary, operating_expenses) | party_role / not_applicable / not_applicable / business_entity | 등록 | Y / N | — | identity_crosswalk + net_preflight |
| 100 | `business_costs_and_ledgers::income.business_cost.expense_category` | 4 (business_income_report, financial_statement, sales_purchase_summary, operating_expenses) | enum_or_text / not_applicable / not_applicable / business_entity | 등록 | Y / N | — | business_net_preflight |

- **정확 공식 서식 토큰/승인 법률증거 직접 선언은 위 20건 모두 0**. `reviewScope`의 D5101/D5110 또는 D5103/D5110 추천과 risk/workflow route는 서식 token 값·법률 인정 조건이 아님. 실제 갈음 B+C/법원 보정명령에서 이번 20개 canonical 정확 필요·완료 연계도 **실제 사례 실행 미관찰**; 조건부 역질문·법률근거 확인에 남김.

## 4. 독립 기대 입력·실행 관찰 (원본 데이터 계약/V8)

- `hasPeriod` 원본 `(role,family)=>role!=="not_applicable" || /income|payroll|tax|contribution|transaction|accounting|ledger|medical|education/.test(family)`와 `hasUnit` 원본 타입 검사 함수를 TypeScript 타입주석만 제거하여 **V8 격리 실행**. 20개 피처 각각 P/U 총 **40번 평가**, P=true **7개**, U=true **7개**. 시간역할 `not_applicable`인데 P=true인 **#097–100 4건**은 문서 family 문자열 `ledger`로 인한 의미 불일치 후보. 실제 OCR 오차·사건 요건 위반은 실증하지 않음.
- 원본 `preflightBusinessNet()`은 `f===gross?VAT:COST` 분기에서 source row의 `business_entity`(#099)를 `rowUnique`로 찾고, 비용 행의 `expense_category`(#100)를 승인 비용범주와 대조. `businessIdentityCrosswalk`도 #099 정확 ID를 사용. **직접 typed/산식 0이라도 source-review 소비 후보가 최소 2건**. 반면 main `feature-lineage-audit.ts`의 `buildFeatureLineageAudit`는 `sourceReviewConsumers`를 별도로 제공하지 않음. [Draft PR #30](https://github.com/firmengine/firmengine/pull/30)이 제안한 false-negative 해결은 미병합; 실제 E2E 수행을 뜻하지 않음.
- 독립 기대·관찰 테스트: 아래 **20/20 기대 일치**. 이는 일부 코드 본문·JSON 정적 비교 및 함수 격리 실행, **Node/CI 합격이 아님**. #099 첫 탐색 시 문자열 오라클을 `COST+"business_entity"`로 지나치게 고정하여 1건 false negative가 났으나 실제 코드는 동적 `family+(...)` 경로임을 확인하고 **오라클만 수정한 후 재실행하여 일치**시킴(제품 결함으로 계상하지 않음).

| 테스트 | 독립 기대 입력/규칙 | 기대 | 관찰 | 판정 |
|---|---|---|---|---|
| T01 | #081 적용조건 미등록 | `true` | `true` | 기대일치 |
| T02 | #085 적용조건 미등록 | `true` | `true` | 기대일치 |
| T03 | #086 적용조건 등록 | `true` | `true` | 기대일치 |
| T04 | #089 material context_only | `true` | `true` | 기대일치 |
| T05 | #097 temporal_role NA + hasPeriod=true | `true` | `true` | 기대일치 |
| T06 | #100 temporal_role NA + hasPeriod=true | `true` | `true` | 기대일치 |
| T07 | #084 quantity unit check | `true` | `true` | 기대일치 |
| T08 | #085 string unit check | `false` | `false` | 기대일치 |
| T09 | 서식 exact 직접 선언 0 | `0` | `0` | 기대일치 |
| T10 | 법률 카탈로그 exact ID 조회 0 | `0` | `0` | 기대일치 |
| T11 | #099 net preflight source consumer | `true` | `true` | 기대일치 |
| T12 | #099 identity crosswalk source consumer | `true` | `true` | 기대일치 |
| T13 | #100 net preflight category | `true` | `true` | 기대일치 |
| T14 | main lineage review 소비 표시 없음 | `false` | `false` | 기대일치 |
| T15 | 인덱스 고유 | `true` | `true` | 기대일치 |
| T16 | 전체 원천 조인 충돌/고아 없음 | `true` | `true` | 기대일치 |
| T17 | 전체 1,808 슬롯 | `1808` | `1808` | 기대일치 |
| T18 | 구간 76 슬롯 | `76` | `76` | 기대일치 |
| T19 | 적용조건 15/20 | `15` | `15` | 기대일치 |
| T20 | 계산 18/91 | `true` | `true` | 기대일치 |

## 5. 수정 필요·승인 보류 판정

1. **P2 적용조건 미등록 5건 #081–085**: 정식 index/문서확장에는 등록되어 있으나 `field-applicability-contracts.json`의 `business_assets_liabilities.fields`에 정확 canonical ID가 없다. `compactFamilyFieldContract`의 `sourceCondition=conditions?.fields.find(...id)?.sourceCondition??null` 결과가 이 다섯 ID에 null이 될 **정적 경로** 확인. 이는 별도 문서확장 정책 가능성을 배제하지 않으므로 관리자·서류담당자 정책 판정 전 무단 등록 금지.
2. **P2 기간 predicate 후보 4건 #097–100**: 단독 필드는 `temporal_role=not_applicable`, family `business_costs_and_ledgers`의 `ledger`로 P=true. 원본 소득 비용 증빙은 문서 기간 검증이 필요할 수 있지만 **사업자·범주·회계기준 자체가 기간값이라는 뜻은 아님**. 기존 Draft PR #51에 영향범위 검토 필요.
3. **P1 감사 메타데이터 false negative 2건 #099–100**: 메인 `buildFeatureLineageAudit`의 정확 원천 검토 소비처 분류 미표시. 같은 ID를 `business-net-reconciliation.ts`/identity crosswalk는 읽음. 기존 Draft PR #30 미병합; 타 에이전트 변경과 충돌할 수 있어 별도 코드 변경하지 않음. 표기 누락이 실제 검토 실행 실패라는 증거는 아님.
4. **P2 계산 의미·법률 보류**: #083 시장가/수량, #089 장부총액(`context_only`), #091 지분, #092 미지급, #095 미수, #096 담보상환액을 서로 **독립 자산으로 합산 금지**. 사업자/자산 식별 ID·평가기준일·통화/단위·실물 소유·중복지급 여부/회수가능성/회계기준은 추가 원문·직원·계산사무장·변호사 검토 필요. #097 회계기준·#098 영업계속성은 정확 소비처/실무 요건 미확정; 임의 인가·원화 환산 금지.
5. **증거상태 분리**: 미관찰·null·관측 0·원문 명시 none·비해당·상충·source-only·법률승인 전을 동치화하지 않음. [Draft PR #99](https://github.com/firmengine/firmengine/pull/99)의 source-only 검증은 미병합. source-only 보존은 자동 합격·폐기가 아니다.

## 6. 회차 인수 판정 / 다음 시작

- 선택한 **5개 A3 보드 체크 ID**는 모두 부분 검증만 했고 **[ ] 유지**. 이유: 실제 고객 OCR·서류 요구/갈음·보정 / D1 append/readback / 18 산식 실입력·배포 / 법원 공식 서식 / 법률 승인·회귀 전체 CI 미관찰. **제품 인수 완료 0건**.
- **다음 시작 canonical #101** `business_costs_and_ledgers::income.business_cost.gross_amount` (다음 회차 최신 index 재조회 필수) → #120, 역할 **IT담당자** 선행. #081–085 등록정책 결정, #097–100 기간 술어, #099–100 Draft PR #30·#51의 소스 충돌·회귀를 추적. 운영 배포/운영 D1 마이그레이션/전자제출/법원 인가 확정 전혀 실행하지 않음.
