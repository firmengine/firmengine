# FirmEngine A3 r56 — OCR canonical #401~420 소비처 심층 재감사 (2026-11-01 20:25 KST)

## 실행 범위 및 근거
- GitHub `firmengine/firmengine` `main` 시작 SHA `2d1f7ed11d244d857f6ff69cffe3cabff4ac35c4`; 수정 허용 위치 `prototypes/Daeseong Ray Yang/firmengine-proto/ax-site/`만. 직전 [r55 #381~400](20261101-r55-canonical-381-400-consumer-recheck-1931KST.md)와 과거 [r21 #401~420](20261031-r21-canonical-401-420-0929KST.md)을 대조해 최신 원본을 다시 조회.
- **AX → IT → 사용자·서류 → 계산사무장 → 변호사** 순서로 `A3-AX-019`, `A3-IT-017`, `A3-DOC-011`, `A3-CALC-008`, `A3-LAW-015`를 부분 검사. 전부 `[ ]` 유지. 다음 회차는 데이터담당자부터.
- 원본 GitHub JSON/코드·기존 합성 테스트 코드를 읽고, V8에서 **원본 `hasPeriod`·`hasUnit` 각각 109회**, 원본 `reviewScope` 3회, **독립 예상 불변식 37/37 일치**. 실행한 것은 정적·원본 함수 술어 격리 검증뿐. **Node 프로젝트 테스트/CI, 실제 OCR, D1/R2/Cron/staging, 공식 법원 서식, 변호사 승인, 사이트 배포 미실행·미인증.**

## 최신 693개 등록 인덱스·원천 연결
- 인덱스 고유 **693/693**, 중복·고아 0; **85개 서류 / 48개 OCR 패밀리 / 1,808개 원천 슬롯**의 최신 원본 join. 이번 **20개 ID / 109 원천 슬롯 / 11개 고유 서류**를 실제 순서대로 개별 조회.
- 보험 4개 ID × 2서류(보험 해약환급금·약관대출) = **8 슬롯**; 임대차 확정일자 1 ID × 1서류 = **1 슬롯**; 임대차 14개 ID × 7서류 = **98 슬롯**; 소송사건번호 1 ID × 2서류 = **2 슬롯**.
- 보험: `insurance_surrender_statement`, `insurance_loan_statement` → `insurance_policy_asset`.
- 확정일자: `lease_contract` 보강 `lease_contract::fixed_date` → `lease_housing`.
- 임대차: `operating_expenses`, `rental_income_contract`, `vehicle_lease_contract`, `lease_contract`, `deposit_rights`, `free_residence_confirmation`, `housing_expense_evidence` → `lease_housing`.
- 소송: `litigation_record`, `receivable_collectability` → `litigation_enforcement`.
- `required_source_anchor` **109/109** 및 `recordPolicy.noCrossRecordBorrowing=true` **109/109** 확인. 이 값들은 document/page/record/quote/bbox/source SHA의 **수집·분리 선언**으로 실제 문서별 관측과 DB 재독이 아닙니다.

## 정확 canonical ID별 증거/계산/법률/서식 소비처
- P/U는 원본 `feature-lineage-audit.ts`의 기간·단위 검사 참 슬롯 수(합계 **P24, U32 / 109**). 법원의 증거 필요기간 인증과는 별개.
- typed는 `canonical-field-binding.ts` 정확 변환 선언, material은 `material-calculation-source-gate.ts` 계약. 직접 18계산/91입력 정확 경로는 **0/20**이고 78개 고유 입력 중 이번 범위 정확 일치 없음. 0개를 증거 불필요/삭제로 판단하지 않음.
- 서식은 `OCR_DECLARED_FORM_TARGETS`와 실제 `template-token-catalog.json` 교집합. 법률 exact는 위험95 필수, 규칙50, 예외46의 정확 canonical ID 직접 연결 수이며 내부 `reviewScope` 일반 후보와 다름.

| # | canonical ID | 원천 | 타입·단위 | 주체 / 시간역할 | 기간P/단위U (슬롯) | 적용조건 | 직접 typed | material | 내부 서식 토큰 | 정확 법률 |
|---:|---|---|---|---|:---:|---|---|---|---|---:|
| 401 | `insurance_policy_asset::refund_net_basis` | 보험 I×2 | category / not_applicable | contract_holder / not_applicable | 0/0 | 등록(원천 조건) | source-only | — | — | 0 |
| 402 | `insurance_policy_asset::start_date` | 보험 I×2 | date / 원문 날짜→ISO | contract_holder / effective_date | 2/0 | 등록(원천 조건) | source-only | — | — | 0 |
| 403 | `insurance_policy_asset::surrender_value` | 보험 I×2 | money / 원통화·원단위 | contract_holder / not_applicable | 0/2 | 등록(원천 조건) | `asset.surrender_value` | `must_reconcile` → asset.grossValue | `D5101.asset.value`, `D5110.liquidation_value` | 0 |
| 404 | `insurance_policy_asset::total_premium` | 보험 I×2 | money / 원통화·원단위 | contract_holder / not_applicable | 0/2 | 등록(원천 조건) | source-only | — | — | 0 |
| 405 | `lease_contract::fixed_date` | 확정일자 L×1 | date / YYYY-MM-DD | document_subject / source_date_time_or_period | 1/0 | **미등록(0%)** | source-only | — | — | 0 |
| 406 | `lease_housing::applicant_relation` | 임대차 H×7 | category / not_applicable | tenant / not_applicable | 0/0 | 등록(원천 조건) | source-only | — | — | 0 |
| 407 | `lease_housing::arrears_deduction` | 임대차 H×7 | money / 원통화·원단위 | tenant / not_applicable | 0/7 | 등록(원천 조건) | source-only | — | — | 0 |
| 408 | `lease_housing::deposit` | 임대차 H×7 | money / 원통화·원단위 | tenant / not_applicable | 0/7 | 등록(원천 조건) | source-only | `context_only` → null | — | 0 |
| 409 | `lease_housing::issue_date` | 임대차 H×7 | date / 원문 날짜→ISO | tenant / document_issue_date | 7/0 | 등록(원천 조건) | source-only | — | — | 0 |
| 410 | `lease_housing::landlord` | 임대차 H×7 | party_role / not_applicable | tenant / not_applicable | 0/0 | 등록(원천 조건) | source-only | — | — | 0 |
| 411 | `lease_housing::monthly_rent` | 임대차 H×7 | money / 원통화·원단위 | tenant / not_applicable | 0/7 | 등록(원천 조건) | source-only | — | — | 0 |
| 412 | `lease_housing::period_end` | 임대차 H×7 | date / 원문 날짜→ISO | tenant / statement_period_end | 7/0 | 등록(원천 조건) | source-only | — | — | 0 |
| 413 | `lease_housing::period_start` | 임대차 H×7 | date / 원문 날짜→ISO | tenant / statement_period_start | 7/0 | 등록(원천 조건) | source-only | — | — | 0 |
| 414 | `lease_housing::property_id` | 임대차 H×7 | identifier / not_applicable | tenant / not_applicable | 0/0 | 등록(원천 조건) | source-only | — | — | 0 |
| 415 | `lease_housing::renewal_status` | 임대차 H×7 | category / not_applicable | tenant / not_applicable | 0/0 | 등록(원천 조건) | source-only | — | — | 0 |
| 416 | `lease_housing::secured_balance` | 임대차 H×7 | money / 원통화·원단위 | tenant / not_applicable | 0/7 | 등록(원천 조건) | source-only | — | — | 0 |
| 417 | `lease_housing::security_assignment` | 임대차 H×7 | category / not_applicable | tenant / not_applicable | 0/0 | 등록(원천 조건) | source-only | — | — | 0 |
| 418 | `lease_housing::tenant` | 임대차 H×7 | party_role / not_applicable | tenant / not_applicable | 0/0 | 등록(원천 조건) | source-only | — | — | 0 |
| 419 | `lease_housing::use` | 임대차 H×7 | category / not_applicable | tenant / not_applicable | 0/0 | 등록(원천 조건) | source-only | — | — | 0 |
| 420 | `litigation_enforcement::case_id` | 소송 T×2 | identifier / not_applicable | applicant_debtor / not_applicable | 0/0 | 등록(원천 조건) | source-only | — | — | 0 |

## 독립 입력·기대·관찰
| 입력/실행 | 독립 기대값 | 관찰 결과 | 검증 수준 |
|---|---|---|---|
| 693 canonical + base/확장/보강 + 85서류/48패밀리 | 중복·고아 0, 1808 슬롯 | **693 unique/85/48/1808** | 정적 계약 |
| #401~420 순차 source 조인 | 20 ID, **8+1+98+2=109** 슬롯, 고유 서류 11 | **20/109/11** | 실제 원본 선언 join |
| source locator, 복수행 차용금지 | 각 route에 anchor·noCrossRecordBorrowing | **109/109 · 109/109** | 선언·정적 |
| exact applicability | 본 20 중 #405 확정일자 보강 ID는 별도 등록 필요 | **19 등록/1 미등록** | 미등록 조건 **0%** |
| 실제 원본 hasPeriod/hasUnit | 시간역할 24, 단위역할 32 | **24/109, 32/109** (각 109회) | V8 원본 술어 |
| typed/18개 계산·91 입력 | #403 `asset.surrender_value` 1개, 직접 계산 일치 0 | **1/20, 0/20** | 구조, 계산 미실행 |
| material 29 정책 | #403 must_reconcile→asset.grossValue; #408 context_only | **2/20** | 정책 정적 |
| 내부 템플릿 토큰 | #403 D5101.asset.value, D5110.liquidation_value | **1 ID/2 토큰** | 내부 후보, 공식 양식 미인증 |
| 위험95/규칙50/예외46 | 95/50/46, 위험 미정의 88, 이 20 정확 legal ID 0 | **95/50/46, 88 미정의, exact 0/20** | 정적, 법률 승인 **0%** |
| 원본 reviewScope 호출 | 보험·임대차 D5101/D5110, 소송 D5100/D5105 | **3/3** | V8 후보; 실무상 필수 판단 아님 |
| 독립 조건단언 | 등록/원천/타입/토큰/법률의 충돌 없음 | **37/37 일치** | 정적·격리; CI 아님 |

## P2 공백 및 계산·법률의 별도 검토 대상
1. **P2 정확 적용조건 공백: #405 `lease_contract::fixed_date`.** `ocr-field-supplements.json` 원천 1슬롯은 존재하지만 `field-applicability-contracts.json`에 동일 ID가 등록되지 않음. 계약일 #413, 증명서 발행일 #409와 구분되는 확정일자이며 **권리 효력/우선변제·관할·시행일 판단은 사람 승인 전 0%**. 요구조건 자체를 임의 작성/확정하지 않으며 source-only 보존.
2. **P1 검토 후보: 보험 #401 `refund_net_basis`의 대출 차감 전/후/미상과 #403 `surrender_value`, 이전 #398 약관대출 잔액.** #403은 `asset.surrender_value` 후보지만 `calculation-input-audit.ts`에서 `asset.gross_value ← asset.surrender_value`를 **derived_from_ocr_review_required**로 명시, material은 **must_reconcile→asset.grossValue**. `extraction.ts`는 원문 해약환급액·unit/quote/bbox 불일치 차단 및 약관대출 자동 차감 금지를 설계; **실제 자산 청산가치/더블 차감 반례는 이번에 실행하지 않음**. 보장금액 #391·납입보험료 #404·환급금 #403·대출잔액 #398 자동 합산/이중차감 금지.
3. **P2 역할/기간/금액 검토 후보: 임대차 #406–419**의 `lease_housing` 동일 family가 7서류에 쓰이지만 임대인·임차인/임대수입·임차보증금/차량리스·무상거주는 법적으로 다름. #408 보증금은 **context_only**이므로 보증금·월차임 #411·체납공제 #407·담보 #416·질권/양도 #417을 사람·권리·기간·원통화·단위 검토 없이 산술 합산하거나 자동 자산/채무로 승인하지 않음.
4. **source-only와 법률 검토 구별:** #401/402/404~420 중 직접 typed 미선언 19개는 계약자/해지기준일/임차인/부동산/소송 사건번호·상태의 증거·검산/서류요구·역질문에 중요할 수 있음. 소비처 0≠무효·삭제·0·비해당. 정확 95/50/46 법률계약은 본 20에서 **0**, seed `LEGAL_EVIDENCE_POLICY_SEED.checks=[]`는 코드 기본값이지 운영 DB 승인계약이 없다는 증거가 아님.
5. **DB Fact/갈음/보정의 정확 상태:** `db/schema.ts`의 `extraction_records/extracted_features/extraction_field_coverage`, `case_requirement_field_plans`, `case_calculation_features`와 `case-requirement-field-plan.ts`의 `mappingStatus:review_required`, `case-substitution-watch.ts`, `preapproval-correction-item-store.ts`의 `requiredCanonicalFieldIds`를 읽음. 사건별 원본 문서·페이지·행·subject/기간/Fact/typed 저장재독, 갈음 B+C 승인, 법원 보정명령 인용/접수증·공식 출력·변호사 승인 **미관찰**. 미관찰/null/실제 0/비해당/상충/source-only/승인전 구별 유지.
6. 법률/계산 의미 변경 및 고위험 운영 실험 금지: **제품 로직 미수정**, 기존 Draft PR #51/#63/#56/#59/#131 미병합, 사람 검토 필요. 실고객 자료·키/.env·비공개 OCR 사실값·정답 공개 Git에 기록하지 않음.

## A3 중앙 보드 부분 인수 ID (5개 모두 `[ ]` 유지)
- `A3-AX-019`: 보험 환급금/납입액/약관대출, 임대보증금/차임/공제/담보의 금액 의미 분리. 모델 실제 판독 미인증.
- `A3-IT-017`: #401–420 원천 109개 locator·noCross 정책 및 DB 컬럼 정적 확인, D1/R2 원본/해시 재독 미인증.
- `A3-DOC-011`: #405 확정일자 1슬롯 + #406~419 임대차 98슬롯, 신청인 지위·사건별 서류·갈음/법원 보정 실증 미완. #405 적용조건 **0%**.
- `A3-CALC-008`: #403 must_reconcile/typed derived, #408 context-only, 91입력 직접 소비 0; 청산가치·공식 서식 수치 검산 미실행.
- `A3-LAW-015`: 법률 위험95/규칙50/예외46 기본 정의·정확 필드계약 0, 관할·법적 인정·공식 근거·변호사 승인 미인증.

## 다음 및 검증 경계
- 순차 심층 재감사 누적 **#001~420/693 (60.6%)**, 잔여 **273**. 다음 **#421 `litigation_enforcement::claim_type` → #440 `local_tax::collection_cost`**, 다음 회차 **데이터담당자부터**.
- A3 보드 **124개 체크 ID**, 최종 인수 완료 **0개**. **코드 존재 ≠ V8 정적 단언 ≠ Node CI ≠ staging D1/R2/Cron ≠ 법원 공식 서식·변호사 승인 ≠ 운영 사이트 배포**.
- 이번에 운영 배포·D1 운영 migration·실제 전자제출·법원 인가 확정 **수행하지 않음**.

## 본 회차 조회 GitHub 원본 blob SHA
- `lib/canonical-field-id-index.json` — `27ecdddd208de82a2f5c675e7482485e3a8838c2`
- `lib/document-agent-field-contracts.json` — `9884b3fecf44643fefcdc4a421ed66ffc5477b3a`
- `lib/shared-document-field-contracts.json` — `9decab974e0909ae24ad927bdfe241d75b71f3a9`
- `lib/ocr-field-supplements.json` — `63b2bf853acb2e9620a6fb72377dc278ff3cd2a5`
- `lib/field-applicability-contracts.json` — `6076b26f782c4643a21a7b2f1a8f6261bb588b68`
- `lib/reference-decision-tables.json` — `6924e3977caf748ce8a3d617fae15aff7d2fe2ce`
- `lib/risk-catalog.json` — `e96dd0926e3ae9be5a5573d4551538ba294c4d2e`
- `lib/legal-catalog.json` — `b0898d74f1df69b19ecf6e81cdff0ed09e8d885e`
- `lib/legal-exceptions.json` — `6e51197226bfd8320e1147d8df3f12c11e00927c`
- `lib/feature-lineage-audit.ts` — `de81bc3b8c460b8a4dde3fda9e13087e619e74ff`
- `lib/canonical-field-binding.ts` — `60ee5c7762d52b72a165b4f4f8214680eb98f148`
- `lib/ocr-chain-matrix.ts` — `977de86ba698bd805cc6b95d1384e3b49d0dbb4c`
- `lib/material-calculation-source-gate.ts` — `0286b44484913b63fa8ec3f7bf0ca59b034d0dab`
- `lib/template-token-catalog.json` — `899c4d564fcb1726861f89dcf04dbf1b7e372687`
- `lib/legal-evidence-criteria.ts` — `6c0b94535700d4fa4d356f8a91d5b9440b5ac52a`
- `db/schema.ts` — `933f8686845ac14669312dd21bf85e02c62ed5e6` (회차 중 선행 읽기; 이번 부분 정적 검사, Node 실행 아님)
- `lib/calculation-input-audit.ts` — `288edc397527842c96874ef3e713f23bb534a5f1` (회차 중 선행 읽기; 이번 부분 정적 검사, Node 실행 아님)
- `lib/case-requirement-field-plan.ts` — `004daf67086230d692a88d3e28c7c59292ee6c2e` (회차 중 선행 읽기; 이번 부분 정적 검사, Node 실행 아님)
- `lib/case-substitution-watch.ts` — `2b79695adc1a855aa70b6aad27deac758982b29e` (회차 중 선행 읽기; 이번 부분 정적 검사, Node 실행 아님)
- `lib/preapproval-correction-item-store.ts` — `6d11dcfb700909a9fcae7e40fad0713ad8cb05e0` (회차 중 선행 읽기; 이번 부분 정적 검사, Node 실행 아님)
- `lib/extraction.ts` — `75931aad3fc7871395e62276bb5533e24b15d1a5` (회차 중 선행 읽기; 이번 부분 정적 검사, Node 실행 아님)
- `tests/insurance-source-slots.test.ts` — `c48e468d09c69f52a8cac3da20815a51cdda6219` (회차 중 선행 읽기; 이번 부분 정적 검사, Node 실행 아님)
