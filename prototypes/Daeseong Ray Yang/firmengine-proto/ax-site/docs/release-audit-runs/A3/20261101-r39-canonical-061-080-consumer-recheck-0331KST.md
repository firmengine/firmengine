# FirmEngine A3 r39 — canonical #061–080 소비처·증거 재감사 (2026-11-01 KST)

> 상태: **정적 계약 인덱스 조인 + 원본 `calculatedFrom` 함수 V8 격리 실행만 수행**. 실제 OCR/CaseData/D1/R2/Cron·Node 전체 CI·공식 전자서식·법률승인·운영 배포 **미실행/미인증**. 합성 기대값 불일치 항목을 통과 표시하지 않는다. 실제 고객 자료, 키, OCR 실값 없음.

## 1. 재현 기준·중복작업 방지

- 읽은 `main` HEAD: `2559ae8297ed7113427fa17225fa4bdc6d1dc592`; canonical index blob `27ecdddd208de82a2f5c675e7482485e3a8838c2`; 통합 인수 보드 blob `8bb56087b338a21189f7a5e4369043a4d84255a0`.
- 관련 현재 코드 blob: binding `60ee5c7762d52b72a165b4f4f8214680eb98f148`, lineage `de81bc3b8c460b8a4dde3fda9e13087e619e74ff`, material gate `0286b44484913b63fa8ec3f7bf0ca59b034d0dab`, document definitions `9decab974e0909ae24ad927bdfe241d75b71f3a9`, applicability `6076b26f782c4643a21a7b2f1a8f6261bb588b68`.
- 승계: r38 #041–060 영수증 및 앞선 r4 #061–080의 5개 거래검토 후보 누락. `main`의 후보 누락은 아직 재현됨. 중복 수정하지 않고 기존 **Draft PR #26** (transaction review audit 후보), **Draft PR #51** (기간 검사), **Draft PR #22** (법률 위험 경고) 검토로 남김. PR들은 2026-11-01 확인 시 모두 `open/draft/미병합`.
- 역할 순환(5역할, 기존 r38 변호사 시작 이후 전환): **계산사무장 → 사용자·서류담당자 → 데이터담당자 → IT담당자 → AX담당자**. 보드 ID `A3-CALC-018`, `A3-DOC-012`, `A3-DATA-004`, `A3-IT-002`, `A3-AX-018`: **부분검증 [ ] 유지**.

## 2. 전수 등록 구조·독립 정적 확인

- `canonical-field-id-index.json` **693개/중복 0**, 최신 85 문서 × 48 OCR family의 base/문서확장/보강을 모두 조인한 실제 원천 슬롯 **1,808**, 인덱스 미등록·미참조/자료형·단위·local-key 충돌 **0** (실 데이터 값 검증 아님).
- 이번 **20 ID / 164 슬롯 / 15 고유 문서**. 상세 원천 문서 ID: `bank_balance_certificate`, `bank_statement`, `business_asset_inventory`, `card_statement`, `crypto_transactions`, `deposit_rights`, `disposal_records`, `income_bank_statement`, `interest_income_statement`, `loan_contract`, `loan_use_of_funds`, `private_loan_transfer`, `salary_bank_statement`, `securities_transactions`, `selective_payment_records`.
- 소스 앵커 요구 선언 **20/20**; `field-applicability-contracts.json`에 정확 ID 등록 **17/20**, 미등록 **#078–080 3/3 → 0% 합격**. source-only 원문 의미는 보존하며 필수요건으로 자동 변경하지 않음.
- 직접 typed projection **5/20 (#066–069, #075)**, 나머지 15/20 직접 typed 없음. 계산용 **material must_reconcile 1/20 (#061 `asset.grossValue`)**, 정확 `OCR_DECLARED_FORM_TARGETS` 서식 토큰 **0/20**, 승인된 canonical 법률증거 seed 직접 매핑 **0/20**(운영 Reference DB 별도 승인 상태는 미관찰).
- 현재 선언 규모: 계산 **18개 / 입력 선언 91회 (78 고유)**, 법률 risk **95**, 규칙 **50**, 예외 **46**, 등록 form-target **13**. 실제 18개 산식·95/50/46 법률 조항을 이 회차에서 실운영 엔진으로 실행·승인하지 않음.
- `shared-document-catalog.ts`에서 base/extension/supplement를 family별 개별 route로 조립함. `extraction-row-store.ts`의 문서/페이지/record ordinal/field ordinal/원본 SHA 및 원천상태 저장 경로는 **코드 경로 확인**, D1 원문 행·복수행 read-back은 **미관찰**. 대상자/단위/기간의 **선언 여부**와 실제 특정 고객 행의 증거 참값은 구별함.

## 3. 20개 ID — 소비처·공백 (원천 내용이나 고객 값 없이 선언만)

문서 컬럼 슬롯 1은 해당 source 문서 1종, 슬롯 13은 은행거래 family를 허용한 서로 다른 문서 13종이다. **이 13개가 동일인의 13개 독립 거래를 의미하지 않는다.** 이번 모든 행은 DB `extraction_records/extracted_features`에 기록하는 설계의 원천 후보이며 실제 persist/read-back 확인은 0건.

| # | canonical ID | 선언 슬롯 | 타입 / 단위 / 기간 / 대상 | 적용조건 | 정확 typed 선언 | material 직접대조 | 정확 form token |
|---:|---|---:|---|---|---|---|---|
| 061 | `bank_account_balance::balance` | 1 | money / currency and exact source unit if monetary / not_applicable / account_holder | 등록 | typed 직접 없음 | must_reconcile→asset.grossValue | 직접 토큰 없음 |
| 062 | `bank_account_balance::balance_as_of` | 1 | date / source date format normalized to ISO without loss / balance_as_of_date / account_holder | 등록 | typed 직접 없음 | — | 직접 토큰 없음 |
| 063 | `bank_account_balance::currency` | 1 | string / not_applicable / not_applicable / account_holder | 등록 | typed 직접 없음 | — | 직접 토큰 없음 |
| 064 | `bank_account_balance::institution` | 1 | party_role / not_applicable / not_applicable / account_holder | 등록 | typed 직접 없음 | — | 직접 토큰 없음 |
| 065 | `bank_account_balance::issue_date` | 1 | date / source date format normalized to ISO without loss / document_issue_date / account_holder | 등록 | typed 직접 없음 | — | 직접 토큰 없음 |
| 066 | `bank_transactions::account_id` | 13 | identifier / not_applicable / not_applicable / account_holder | 등록 | `transaction.account_id` | — | 직접 토큰 없음 |
| 067 | `bank_transactions::amount` | 13 | money / currency and exact source unit if monetary / not_applicable / account_holder | 등록 | `transaction.amount` | — | 직접 토큰 없음 |
| 068 | `bank_transactions::counterparty` | 13 | party_role / not_applicable / not_applicable / account_holder | 등록 | `transaction.counterparty` | — | 직접 토큰 없음 |
| 069 | `bank_transactions::direction` | 13 | category / not_applicable / not_applicable / account_holder | 등록 | `transaction.direction` | — | 직접 토큰 없음 |
| 070 | `bank_transactions::issue_date` | 13 | date / source date format normalized to ISO without loss / document_issue_date / account_holder | 등록 | typed 직접 없음 | — | 직접 토큰 없음 |
| 071 | `bank_transactions::memo` | 13 | string / not_applicable / not_applicable / account_holder | 등록 | typed 직접 없음 | — | 직접 토큰 없음 |
| 072 | `bank_transactions::period_end` | 13 | date / source date format normalized to ISO without loss / statement_period_end / account_holder | 등록 | typed 직접 없음 | — | 직접 토큰 없음 |
| 073 | `bank_transactions::period_start` | 13 | date / source date format normalized to ISO without loss / statement_period_start / account_holder | 등록 | typed 직접 없음 | — | 직접 토큰 없음 |
| 074 | `bank_transactions::post_balance` | 13 | money / currency and exact source unit if monetary / not_applicable / account_holder | 등록 | typed 직접 없음 | — | 직접 토큰 없음 |
| 075 | `bank_transactions::transaction_datetime` | 13 | datetime / source date format normalized to ISO without loss / transaction_datetime / account_holder | 등록 | `transaction.date` | — | 직접 토큰 없음 |
| 076 | `bank_transactions::transaction_id` | 13 | identifier / not_applicable / not_applicable / account_holder | 등록 | typed 직접 없음 | — | 직접 토큰 없음 |
| 077 | `bank_transactions::transaction_nature` | 13 | category / not_applicable / not_applicable / account_holder | 등록 | typed 직접 없음 | — | 직접 토큰 없음 |
| 078 | `business_asset_inventory::acquisition_date` | 1 | date / not_applicable / source_date_time_or_period / document_subject | 미등록·미인증 | typed 직접 없음 | — | 직접 토큰 없음 |
| 079 | `business_asset_inventory::book_value` | 1 | money / source currency/unit / not_applicable / document_subject | 미등록·미인증 | typed 직접 없음 | — | 직접 토큰 없음 |
| 080 | `business_asset_inventory::condition` | 1 | string / not_applicable / not_applicable / document_subject | 미등록·미인증 | typed 직접 없음 | — | 직접 토큰 없음 |

**모든 20행의 법률/서식 판단 상태:** `source-only 또는 typed 후보`와 별개로 공식 출처/관할/시행일/사람승인 확인 전. 법률 risk 문서 route 또는 `reviewScope()` 결과는 정확 승인 법률증거가 아님. 갈음·법원보정은 서류/요구 ID 기반의 별도 사람검토 흐름이며 이번 20 canonical의 **실제 갈음 승인·보정명령 충족 연결 관측 0건**(0개 필요하다는 뜻 아님).

## 4. 원본 V8 격리 실행 — 입력·독립 기대·관찰

`lib/feature-lineage-audit.ts` blob `de81bc3b8c460b8a4dde3fda9e13087e619e74ff`에서 `calculatedFrom` 본문을 읽고 TypeScript 타입주석만 제거한 **원본 함수**를 실행했다. 변경 코드/모델·DB·Node 앱 실구동 아님.

| 입력 typed 객체 | 독립 기대(실제 `case-execution.ts` → `scanTransactions` 코드 기준의 **감사 후보**만) | main 관찰 | 판정 |
|---|---|---|---|
| `transaction.account_id` | `transaction_review` | `[]` | **불일치** |
| `transaction.amount` | `transaction_review` | `[]` | **불일치** |
| `transaction.counterparty` | `transaction_review` | `[]` | **불일치** |
| `transaction.direction` | `transaction_review` | `[]` | **불일치** |
| `transaction.date` | `transaction_review` | `[]` | **불일치** |
| `[]` | `[]` | `[]` | 일치 |
| `income.net` | `income_aggregation,income_average,monthlyIncomeWon` | `income_aggregation,income_average,monthlyIncomeWon` | 일치 |
| `asset.gross_value` | `asset_liquidation,liquidationValueWon` | `asset_liquidation,liquidationValueWon` | 일치 |
| `transaction.balance` | `[]` | `[]` | 일치 |

**9 입력 중 4 기대 일치 / 5 불일치**. #066/067/068/069/075는 원본 `calculatedFrom`에 `transaction` case가 없어 `transaction_review` 후보가 누락됨. 이는 감사 메타데이터의 false-negative이며 실제 거래검토 실행이 발생하지 않는다는 증명이 아님. 기존 Draft PR #26의 패치·합성 테스트는 존재하나 main 병합/Node CI 미인증.

원본 `hasPeriod(role,family)`, `hasUnit(datatype)`와 20개 metadata 조인에서 기간 검사 후보 **15/20**, 단위 검사 후보 **4/20**를 반환. 기간 `temporal_role=not_applicable`인데 family 정규식으로 `true`인 **8개**: #066, #067, #068, #069, #071, #074, #076, #077. 문서 전체 기간확인과 필드별 시간속성 구분 필요. 실제 OCR 실패를 관측하지 않았고 Draft PR #51과 중복 수정하지 않음.

## 5. 구체 공백·보수적 결론 / 실무자 검토

1. **P2 #078–080**: `business_asset_inventory::acquisition_date/book_value/condition` 3개 source extension이 `business_assets_liabilities` family의 적용조건 목록에 등록되지 않음. 문서확장 정책의 의도적 분리인지 확인 전 **미등록 합격 0%**, 자동 정책 추가/삭제 금지. 장부가(#079)는 처분가·시가·청산가치에 바로 합산 불가.
2. **P2 #061**: `bank_account_balance::balance`는 직접 typed projection이 **0**이지만 `MATERIAL_CALCULATION_SOURCES`에서 `must_reconcile→asset.grossValue`. `auditMaterialCalculatorSources`는 검증된 해당 Fact가 있고 링크된 자산행이 없으면 `CALC_INPUT_UNCONNECTED_MATERIAL` 차단하도록 코드 작성됨. 기존 `tests/material-calculation-source-gate.test.ts`에 합성 테스트 **존재**(이번 Node 실행 없음). 은행 잔액, 거래 후 잔액(#074), 자산 장부가(#079)는 상호 중복·평가 시점/통화·소유자 확인 전 합산 금지.
3. **P2 #074**: `bank_transactions::post_balance`는 source-only이고 `transaction-review.ts` 잔액 검산은 별도 사람 검토된 `transaction.balance` Fact가 있을 때만 수행. raw OCR→해당 Fact의 정확 투영/사용자 확인 루트는 **이번에 입증 못함**, 무조건 연결 코드 추가하거나 값을 원화로 가정하지 않음.
4. **P2 기간 predicate**: #066/067/068/069/071/074/076/077은 `temporal_role=not_applicable`인데 `hasPeriod=true`. 현재 metadata는 필드 자체 기간 필요를 넓게 선언할 수 있음. Draft PR #51과 영향 중복 검토 필요.
5. **P1 감사 후보 누락**: 5 typed transaction 피처의 검토후보 미표시 `main` 원본에서 재현. 이미 PR #26 존재하므로 이 회차 별도 코드 변경·중복 PR 없음. #066–077의 거래금액/입출금/문서기간/거래일·계좌·상대방은 실제 소득 인식과 다름.

**불확실성/후속 검수**: DB Fact 승인상태`verified/accepted`·실제 source hash/페이지 bbox/복수행·기간중복/계좌식별, raw KRW 환산, 현금/증권/가상자산 내부이체 대조, 18 계산 실입력 및 공식 D5101·D5110 토큰·갈음/법원보정 요구·관할/법률판본/변호사 승인 전부 별도 보류. 미관찰/null/0/명시 없음/비해당/상충을 서로 대체하지 않는다. 운영 배포/D1 migration/전자제출/법원 인가 조작 없음.

**다음 시작**: #081 `business_asset_inventory::disposal_restriction` (정확 ID는 다음 회차 최신 index 재조회 후 확정) → #100, 역할 **변호사** 선행 후 다른 역할 순환; 기존 Draft PR #26/#51의 실제 CI·충돌 검수 및 #078–080 적용조건 누락 정책검토 병행. **완료 체크 0개**, 693개 최초 정적 조사 완료와 심층 재감사 #001–080은 구분.
