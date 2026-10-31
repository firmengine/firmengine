# FirmEngine A3 r43 — canonical #141~160 소비처 심층 재감사 (2026-11-01 KST)

> 검증 층위: **GitHub 최신 정적 계약/원본 코드 식의 JS 격리 실행**. 실제 OCR 원문·페이지/다중행 D1 Fact·typed 저장/재독, 18계산/91입력 E2E, 전체 Native Node·CI, staging D1/R2/Cron, 공식 법원 서식 Word/e-form·변호사 승인·배포 **미인증**. 원본 의뢰인 정보, OCR 추출값, 키, .env, 비공개 정답 및 실제 제출물 사용 안 함.

## 1. 근거, 직전 진행, 순환 역할

- 조회 당시 `main` HEAD `127a5791195c45422653cfc8145ce98fafb8b4b0`; 이전 [r42 #121~140](20261101-r42-canonical-121-140-consumer-recheck-0631KST.md)과 이전 [r08 동일 #141~160](20261030-2025-canonical-141-160.md)을 이어 진행. 기존 [Draft PR #44](https://github.com/firmengine/firmengine/pull/44), [Draft PR #51](https://github.com/firmengine/firmengine/pull/51)는 **open/미병합**, 중복 수정·자동 병합하지 않음.
- 실제 원천 blob SHA: canonical `27ecdddd208de82a2f5c675e7482485e3a8838c2`; 48 family `9884b3fecf44643fefcdc4a421ed66ffc5477b3a`; 85 documents `9decab974e0909ae24ad927bdfe241d75b71f3a9`; 보강 `63b2bf853acb2e9620a6fb72377dc278ff3cd2a5`; 적용조건 `6076b26f782c4643a21a7b2f1a8f6261bb588b68`; typed `60ee5c7762d52b72a165b4f4f8214680eb98f148`; lineage `de81bc3b8c460b8a4dde3fda9e13087e619e74ff`; form `977de86ba698bd805cc6b95d1384e3b49d0dbb4c`. 693 번호 대조는 `docs/ocr-693-field-register.md` (blob `dfa1a09cf035a07130e2cf40a6b4e7dae44581d4`)와 별도 독립 실행.
- 이번 회차 역할 순서 **AX→IT→데이터→계산사무장→변호사**, 체크 `A3-AX-009`, `A3-IT-014`, `A3-DATA-012`, `A3-CALC-007`, `A3-LAW-007`의 **부분 증거**만 보강. 모두 `[ ]` 유지. 다음 시작 역할은 **사용자·서류담당자**.

## 2. 실제 입력·독립 기대값·관찰 결과

- 693개 최신 `canonical-field-id-index.json` 전체 배열 순서와 693행 번호표를 대조하여 **순서·중복 오류 0**. 모든 문서의 allowed family별 base+document-extension+supplement 경로를 1,808건 직접 결합; ID 고아 0, 동일 ID 의미(원천 local ID/타입/단위) 상충 0, 48 family/85서류. 기존 별도 JS 정적 불변식 **35/35 기대 일치**(입력 파일·원본 코드만, 실 OCR/법률 합격 아님).
- 이번 #141~160 **20 canonical ID/56 선언 슬롯/5 증빙** (card_statement:12, bank_balance_certificate:10, securities_balance:10, crypto_balance:10, cash_holding_statement:14); 각각 source anchor·missing/conflict 계약은 **56/56 선언 존재**만 검증. 실제 원문 인용/페이지/row와 D1 저장값의 존재를 의미하지 않음.
- 정확 적용조건 계약 **10/20 등록, 10/20 미등록** (#141~146의 카드 확장 6, #157~160의 현금진술 확장 4). `document-agent-registry.ts`의 `conditions?.fields.find(condition=>condition.id===field.global_field_id)?.sourceCondition??null` 때문에 이 10개는 프롬프트 축약 조건 **null**이 되는 코드 경로. `components/field-coverage.tsx`는 정확한 조건 없으면 '식별자 연결 확인 필요' 표시. **미등록 10개에 대한 적용조건 합격률 0%.**
- typed 직접 변환 선언 **6/20** (#147,148,150,152,154,156), source-only/직접변환 미선언 14/20. material `must_reconcile` **1/20** (#152 `cash_deposit_asset::gross_value` → `asset.grossValue`); 서식 직접 **선언 후보 1/20** (#152 → `D5101.asset.value`, `D5110.liquidation_value`, 템플릿 토큰 존재). 법률위험 95/법률규칙 50/예외 46 static JSON에서 정확 canonical 문자열 증거계약 **0/20**, `LEGAL_EVIDENCE_POLICY_SEED.checks=[]`. 운영 DB 관리 승인값·전문가 인정은 미조회.
- 원본 `feature-lineage-audit.ts`의 `hasPeriod(role,family)`, `hasUnit(datatype)` **원문 함수식 추출 후 격리 실행 56라우트×2 = 112회**. 독립 기대: `temporal_role=not_applicable`인 **필드 자체**에 기간 필수 true를 부여하지 않는 것. 카드 `bank_transactions` 분기 #142,143,144,145,146에서 **5개 과잉 true**. [Draft PR #51](https://github.com/firmengine/firmengine/pull/51) 수정식에서 #142·144만 없어지고 **숫자형 #143·145·146의 3개 후보는 남음**(해당 수정식 JS 동등실행). 실제 OCR 경고/거절·법률 필요성은 테스트하지 않음.

## 3. 피처별 서류·대상·시점·원문단위·DB/typed/계산·법률/서식·source-only 검수

> 표의 슬롯은 **정적 문서×family×필드 라우트 선언** 수. 해당 건수만큼 실제 OCR/Fact가 적재됐거나 source-only 검증·법률채택됐다는 의미가 아니다. `extraction-row-store.ts`는 `extraction_records` / `extracted_features` / `extraction_field_coverage` 및 문서ID·페이지·record/field 순번·원문 위치·SHA를 보존하는 코드 경로. 이번에 실제 사건의 행/원문 인용, 복수행, Fact/typed, 서식 생성·갈음/보정 접수증을 확인하지 않았음.

| # | canonical ID | 선언 슬롯/원천 서류·family | 자료형/원단위 | 기간·대상 역할 | 정확 적용조건 | 직접 typed | 검산·소비처/승인 공백 |
|---:|---|---|---|---|---|---|---|
| 141 | `card_statement::billing_period` | 2 / card_statement/debt_certificate, card_statement/bank_transactions | period; not_applicable | source_date_time_or_period; document_subject | **미등록:0%** | source-only/직접변환미선언 | 청구기간·채무잔액기준일 분리 |
| 142 | `card_statement::card_product_kind` | 2 / card_statement/debt_certificate, card_statement/bank_transactions | category; not_applicable | not_applicable; document_subject | **미등록:0%** | source-only/직접변환미선언 | 상품 분류·리볼빙/할부 확인 |
| 143 | `card_statement::installment_count` | 2 / card_statement/debt_certificate, card_statement/bank_transactions | integer; count | not_applicable; document_subject | **미등록:0%** | source-only/직접변환미선언 | 총 할부회차(count), 금액 아님 |
| 144 | `card_statement::merchant` | 2 / card_statement/debt_certificate, card_statement/bank_transactions | party_role; not_applicable | not_applicable; document_subject | **미등록:0%** | source-only/직접변환미선언 | 원 거래 가맹점 ≠ 법적 채권자 |
| 145 | `card_statement::purchase_amount` | 2 / card_statement/debt_certificate, card_statement/bank_transactions | money; source currency/unit | not_applicable; document_subject | **미등록:0%** | source-only/직접변환미선언 | 결제액 ≠ 현재 채무원금·통화확인 |
| 146 | `card_statement::remaining_installments` | 2 / card_statement/debt_certificate, card_statement/bank_transactions | integer; count | not_applicable; document_subject | **미등록:0%** | source-only/직접변환미선언 | 잔여회차(count), 잔여원금 자동산정 금지 |
| 147 | `cash_deposit_asset::actual_payoff` | 4 / bank_balance_certificate/cash_deposit_asset, securities_balance/cash_deposit_asset, crypto_balance/cash_deposit_asset, cash_holding_statement/cash_deposit_asset | money; currency and exact source unit if monetary | not_applicable; owner_legal | 등록(승인전) | asset.secured_payoff | 실상환액·담보귀속·이중공제 검토 |
| 148 | `cash_deposit_asset::as_of_date` | 4 / bank_balance_certificate/cash_deposit_asset, securities_balance/cash_deposit_asset, crypto_balance/cash_deposit_asset, cash_holding_statement/cash_deposit_asset | date; source date format normalized to ISO without loss | valuation_as_of_date; owner_legal | 등록(승인전) | asset.as_of | 평가 기준일·시점 검산 |
| 149 | `cash_deposit_asset::asset_id` | 4 / bank_balance_certificate/cash_deposit_asset, securities_balance/cash_deposit_asset, crypto_balance/cash_deposit_asset, cash_holding_statement/cash_deposit_asset | identifier; not_applicable | not_applicable; owner_legal | 등록(승인전) | source-only/직접변환미선언 | 계좌/자산 식별자로 여러 증빙 중복 대조 |
| 150 | `cash_deposit_asset::asset_kind` | 4 / bank_balance_certificate/cash_deposit_asset, securities_balance/cash_deposit_asset, crypto_balance/cash_deposit_asset, cash_holding_statement/cash_deposit_asset | category; not_applicable | not_applicable; owner_legal | 등록(승인전) | asset.kind | 현금/예금/증권/가상자산 원천 구분 |
| 151 | `cash_deposit_asset::encumbrance` | 4 / bank_balance_certificate/cash_deposit_asset, securities_balance/cash_deposit_asset, crypto_balance/cash_deposit_asset, cash_holding_statement/cash_deposit_asset | category; not_applicable | not_applicable; owner_legal | 등록(승인전) | source-only/직접변환미선언 | 담보·압류·질권 주장 법률보류 |
| 152 | `cash_deposit_asset::gross_value` | 4 / bank_balance_certificate/cash_deposit_asset, securities_balance/cash_deposit_asset, crypto_balance/cash_deposit_asset, cash_holding_statement/cash_deposit_asset | money; currency and exact source unit if monetary | not_applicable; owner_legal | 등록(승인전) | asset.gross_value | 원천 총액→typed 자산/계산 대조, D5101/D5110 선언 |
| 153 | `cash_deposit_asset::owner` | 4 / bank_balance_certificate/cash_deposit_asset, securities_balance/cash_deposit_asset, crypto_balance/cash_deposit_asset, cash_holding_statement/cash_deposit_asset | party_role; not_applicable | not_applicable; owner_legal | 등록(승인전) | source-only/직접변환미선언 | 등록 소유자 ≠ 귀속 확정 |
| 154 | `cash_deposit_asset::ownership_share` | 4 / bank_balance_certificate/cash_deposit_asset, securities_balance/cash_deposit_asset, crypto_balance/cash_deposit_asset, cash_holding_statement/cash_deposit_asset | ratio; ratio/fraction as stated | not_applicable; owner_legal | 등록(승인전) | asset.ownership_share | 지분율·원문 분모/bps·사람 승인 |
| 155 | `cash_deposit_asset::protected_or_excluded_claim` | 4 / bank_balance_certificate/cash_deposit_asset, securities_balance/cash_deposit_asset, crypto_balance/cash_deposit_asset, cash_holding_statement/cash_deposit_asset | money; currency and exact source unit if monetary | not_applicable; owner_legal | 등록(승인전) | source-only/직접변환미선언 | 면제·보호 주장 ≠ 인정 공제액 |
| 156 | `cash_deposit_asset::valuation_basis` | 4 / bank_balance_certificate/cash_deposit_asset, securities_balance/cash_deposit_asset, crypto_balance/cash_deposit_asset, cash_holding_statement/cash_deposit_asset | string; not_applicable | not_applicable; owner_legal | 등록(승인전) | asset.valuation_basis | 평가 근거/기준일·적용 여부 확인 |
| 157 | `cash_holding_statement::acquisition_source` | 1 / cash_holding_statement/cash_deposit_asset | string; not_applicable | not_applicable; document_subject | **미등록:0%** | source-only/직접변환미선언 | 현금 취득 경위·입금과 중복 대조 |
| 158 | `cash_holding_statement::cash_currency` | 1 / cash_holding_statement/cash_deposit_asset | string; not_applicable | not_applicable; document_subject | **미등록:0%** | source-only/직접변환미선언 | 외화/원화 별도, 무단 환산 금지 |
| 159 | `cash_holding_statement::declaration_author` | 1 / cash_holding_statement/cash_deposit_asset | party_role; not_applicable | not_applicable; document_subject | **미등록:0%** | source-only/직접변환미선언 | 진술 작성자 ≠ 자산 소유자 |
| 160 | `cash_holding_statement::declaration_date` | 1 / cash_holding_statement/cash_deposit_asset | date; not_applicable | source_date_time_or_period; document_subject | **미등록:0%** | source-only/직접변환미선언 | 진술 날짜 ≠ 평가 기준일 |

## 4. P2/P1 및 법률/계산 안전 경계

1. **P2: 정확 적용조건 미등록 10개.** 카드 청구기간·상품·원거래액/할부 및 현금 보유 진술의 작성자·통화/취득경위/작성일은 등록 canonical과 source anchor가 있어도 담당자 관리 적용조건이 없다. 각 필드 sourceCondition null, 미승인/미등록은 0% 합격. doc-extension 전용 정책 필요성은 서류/데이터/AX 담당자가 검토. 삭제·기준정보 임의 등록/법률 필수화 금지.
2. **P2: 기간 과잉 원본 5건·Draft PR #51 잔여 3건.** 문서 전체 청구기간 확인과 개별 상품종류·원거래·회차 필드의 temporal 역할은 다름. PR #51만으로 모두 해결된다고 표시하면 안 됨. 실제 사용상 에러/문서 판단은 미재현.
3. **P1 기존 [Draft PR #44](https://github.com/firmengine/firmengine/pull/44):** #152의 OCR raw 값/단위가 정정됐는데 cached numeric과 typed 자산행이 동일한 채 남는 계산원천 대조 false-negative. 과거 r08 격리 테스트·PR 회귀 작성은 별도 기록. 이번 회차 Native Node 테스트나 운영 코드 병합은 실행하지 않음.
4. **법률상 자산/채무 인정 금지:** #152 총가치, #154 지분, #147 실제 담보상환, #155 보호/면제 **주장**, #153 소유자, #148 평가일/#156 근거의 귀속·원천이 일치하고 변호사 검토하기 전 청산가치·면제액을 확정하지 않는다. #145 카드 원거래액/이전 #140 카드청구액을 채무원금으로 변환하거나 #158 외화 현금·계좌잔액을 승인 없는 KRW로 합산하지 않는다. 문서 5종 중복은 별도 자산 5건을 뜻하지 않음.
5. **법률·양식·갈음/보정 소비처:** `legal-evidence-criteria.ts`는 정확 evidence mapping의 관리 승인형 정책(기본 seed 0), `ocr-chain-matrix.ts`는 정확 토큰 선언 후보, `form-contracts.ts`는 공식 e-form 인수 별도. `document-substitution.ts`, `case-substitution-watch.ts`, `preapproval-correction-item-store.ts`는 문서 요구·갈음·법원 보정의 **범용 코드 경로**. 이 20개에 대한 승인된 법률위험/갈음·보정/법원서식의 **정확 실제 사건 소비**는 미관찰, source-only라도 증거·검산·역질문으로 보존.

## 5. 중앙 체크 ID 부분 진행 및 다음 회차

- `A3-AX-009`: 문서확장 10 필드의 적용조건 null/모델 프롬프트 동기화 공백. 실제 추출 모델 재시험·법률 승인 미실시 — **[ ]**.
- `A3-IT-014`: null vs 0 vs 미관찰·상충, stale numeric 대조 P1 PR #44 이력 추적. D1/Node 미인증 — **[ ]**.
- `A3-DATA-012`: 56 선언 슬롯·원천 unit/time/owner state, Fact/typed 저장·재투영 미인증 — **[ ]**.
- `A3-CALC-007`: #147/152/154/155 담보·총가치·지분·보호 주장과 typed/금액 원천의 별도 검산, 원화 자동합산 금지 — **[ ]**.
- `A3-LAW-007`: #153 owner, #155 보호/면제, 배우자/제3자 소유권·법원별 법률 근거/승인 미인증 — **[ ]**.

**다음 canonical #161: `cash_holding_statement::storage_location`** (#161~180). 최초 순차 정적 조사는 693/693, 소비처 심층 재감사는 **160/693**. A3 6역할 124 체크 ID의 최종 인수 완료 **0개**. 운영 배포, 운영 D1 migration, 실제 전자제출, 법원 인가확정 **미수행**.
