# FirmEngine A3 r67 — canonical #621~640 소비처 심층 재감사 (2026-11-02 KST)

## 기준·역할·검증 경계
- 시작 시점 `main` HEAD `4ca514362d615ce6654734154385582d16953a9c`. 작업 경계는 `prototypes/Daeseong Ray Yang/firmengine-proto/ax-site/` 내부.
- 직전 r66 #601~620 영수증을 이었고 r32 #621~640 선행 정적 감사, 중앙 보드 A3 체크 124개 및 최신 원본 코드·3개 기존 회귀 테스트 파일을 조회. 역할 **AX→IT→사용자·서류→계산사무장→변호사**; 다음은 데이터담당자.
- 중앙보드 부분 검증 체크 **`A3-AX-009`, `A3-IT-002`, `A3-DOC-010`, `A3-CALC-015`, `A3-LAW-009`** 다섯 개 모두 `[ ]` 유지. 전체 A3 IT20/DOC20/CALC20/LAW22/DATA22/AX20 = 124개, **최종 인수 0개**.
- 최신 `canonical-field-id-index.json`의 693개 ID 전체를 실제 배열 순서대로 열거하고 유일성 검증. 문서 85 / OCR family 48, `shared-document-catalog.ts` 방식의 base+document-extension+supplement 병합 재검사: 총 **1,808 route 슬롯**, 중복0/고아0/미참조 canonical0. 18 계산/91 선언 입력, 위험95/규칙50/예외46 카탈로그 정적 개수 확인.
- 이번 정확 **20개 / 20개 원천 슬롯 / 3개 문서·3 family**: 증권잔고 2, 증권거래 12, 소득금액증명 6. 모든 필드는 `required_source_anchor`에서 원문 라벨·인용/좌표·문서 hash/page 및 동일 대상/행 식별을 요구하고, 문서 `recordPolicy.noCrossRecordBorrowing=true`, `sourceOnly=true`가 선언됨(20/20). **실제 OCR 인용·페이지·row·D1 저장/재독은 미관찰**.

## 정확 소비처/미등록·미승인
- **P2**: #621~634 14개는 canonical·source 라우트에는 존재하나 family `field-applicability-contracts.json`에 exact ID 적용조건 부재. 정확 등록 **6/20**, 미등록 **14/20**, 14개 적용조건 승인검증 **0%**. `compactFamilyFieldContract()`의 `conditions?.fields.find(...id===global_field_id)?.sourceCondition??null`상 null 전달 가능; 무단 조건추정·0원/비해당·폐기 금지.
- `canonical-field-binding.ts` 선언 direct typed는 **4/20**: #636 `income.gross`, #637 `income.net`, #638 `income.kind`, #640 `income.expenses`. `material-calculation-source-gate.ts`의 29개 계약 중 #637 `must_reconcile→income.net` **1/20**, 나머지 19개에는 해당 정확 계약 없음. 18계산/91입력의 정확 canonical ID 직접 호출 및 전체 계산 **미검증**. 특히 #635 과세자료 체납액을 채무원금으로 자동 투영하지 않음.
- `ocr-chain-matrix.ts`의 정확 form token **0/20**. `feature-lineage-audit.ts::reviewScope` 원본 실행 후보는 증권잔고 D5101/D5110, 증권거래 EVIDENCE_INDEX, 세무소득 D5103/D5110으로 세 부류. **후보 != 실제 공식 서식 token/법원 양식 승인.**
- 95위험/50규칙/46예외에서 이번 20개 정확 canonical ID 리터럴 근거계약 **0/20**; 정적 `LEGAL_EVIDENCE_POLICY_SEED.checks=[]`. 운영관리형 승인 reference는 미조회로 별개이며, 여기서 법률 합격 **0%**. 갈음·보정 기능 존재, 법원별 허용, 실제 접수·보정명령 및 사람이 승인한 Fact의 소비는 별도 미관찰.
- `hasPeriod`, `hasUnit`, `reviewScope` **원본 술어 총 60회 V8 격리 호출**: 기간 true 18/20, 단위 true 11/20, 그중 시간역할 `not_applicable`이나 family 정규식만으로 기간=true **16개**. 기간 실무규칙 확정 아님. 증권거래 #623~634는 `bank_transactions` 라우트이므로 원본 `reviewScope`의 증권 전문 `SEOUL-408` 후보 **0/12**. Draft PR #51/#56/#59와 함께 검토하며 임의 법률 후보 확정 또는 병합하지 않음.

## 개별 20개 원천·페이지·행·대상·기간·단위·소비처
P/U는 원본 기간/단위 술어 판정으로, 실제 데이터 원문 검증 여부와 다름. 각 ID의 출처서류/페이지/복수행/대상은 원본 anchor·recordPolicy **선언** 확인에 그치며 실자료 확인 안 됨.

| # | canonical OCR ID | 서류@추출패밀리 | datatype/원천 단위 | subject/temporal_role | P/U | 적용조건 | exact typed/material 또는 증거검토 |
|---:|---|---|---|---|---:|---|---|
| 621 | `securities_balance::valuation_method` | `securities_balance@cash_deposit_asset` | string / not_applicable | document_subject / not_applicable | 0/0 | **미등록(0%)** | source-only (증거·검산·역질문) |
| 622 | `securities_balance::valuation_unit_price` | `securities_balance@cash_deposit_asset` | money / source currency/source price-per-unit | document_subject / not_applicable | 0/1 | **미등록(0%)** | source-only (증거·검산·역질문) |
| 623 | `securities_transactions::counter_account` | `securities_transactions@bank_transactions` | identifier / not_applicable | document_subject / not_applicable | 1/0 | **미등록(0%)** | source-only (증거·검산·역질문) |
| 624 | `securities_transactions::fee` | `securities_transactions@bank_transactions` | money / source currency/unit | document_subject / not_applicable | 1/1 | **미등록(0%)** | source-only (증거·검산·역질문) |
| 625 | `securities_transactions::quantity` | `securities_transactions@bank_transactions` | quantity / source quantity unit | document_subject / not_applicable | 1/1 | **미등록(0%)** | source-only (증거·검산·역질문) |
| 626 | `securities_transactions::quantity_unit` | `securities_transactions@bank_transactions` | string / not_applicable | document_subject / not_applicable | 1/0 | **미등록(0%)** | source-only (증거·검산·역질문) |
| 627 | `securities_transactions::security_event_kind` | `securities_transactions@bank_transactions` | category / not_applicable | document_subject / not_applicable | 1/0 | **미등록(0%)** | source-only (증거·검산·역질문) |
| 628 | `securities_transactions::security_id` | `securities_transactions@bank_transactions` | identifier / not_applicable | document_subject / not_applicable | 1/0 | **미등록(0%)** | source-only (증거·검산·역질문) |
| 629 | `securities_transactions::security_name` | `securities_transactions@bank_transactions` | string / not_applicable | document_subject / not_applicable | 1/0 | **미등록(0%)** | source-only (증거·검산·역질문) |
| 630 | `securities_transactions::settled_amount` | `securities_transactions@bank_transactions` | money / source currency/unit | document_subject / not_applicable | 1/1 | **미등록(0%)** | source-only (증거·검산·역질문) |
| 631 | `securities_transactions::settlement_date` | `securities_transactions@bank_transactions` | date / not_applicable | document_subject / source_date_time_or_period | 1/0 | **미등록(0%)** | source-only (증거·검산·역질문) |
| 632 | `securities_transactions::tax` | `securities_transactions@bank_transactions` | money / source currency/unit | document_subject / not_applicable | 1/1 | **미등록(0%)** | source-only (증거·검산·역질문) |
| 633 | `securities_transactions::trade_gross` | `securities_transactions@bank_transactions` | money / source currency/unit | document_subject / not_applicable | 1/1 | **미등록(0%)** | source-only (증거·검산·역질문) |
| 634 | `securities_transactions::trade_unit_price` | `securities_transactions@bank_transactions` | money / source currency/source price-per-unit | document_subject / not_applicable | 1/1 | **미등록(0%)** | source-only (증거·검산·역질문) |
| 635 | `tax_income::arrears` | `income_amount_certificate@tax_income` | money / currency and exact source unit if monetary | taxpayer / not_applicable | 1/1 | 등록 | source-only (증거·검산·역질문) |
| 636 | `tax_income::gross_receipts` | `income_amount_certificate@tax_income` | money / currency and exact source unit if monetary | taxpayer / not_applicable | 1/1 | 등록 | income.gross |
| 637 | `tax_income::income_after_expenses` | `income_amount_certificate@tax_income` | money / currency and exact source unit if monetary | taxpayer / not_applicable | 1/1 | 등록 | income.net; must_reconcile→income.net |
| 638 | `tax_income::income_kind` | `income_amount_certificate@tax_income` | category / not_applicable | taxpayer / not_applicable | 1/0 | 등록 | income.kind |
| 639 | `tax_income::issue_date` | `income_amount_certificate@tax_income` | date / source date format normalized to ISO without loss | taxpayer / document_issue_date | 1/0 | 등록 | source-only (증거·검산·역질문) |
| 640 | `tax_income::necessary_expenses` | `income_amount_certificate@tax_income` | money / currency and exact source unit if monetary | taxpayer / not_applicable | 1/1 | 등록 | income.expenses |

## #637 원본 계산 연결 게이트 격리 합성시험 8/8
- 실제 `auditMaterialCalculatorSources()` 함수의 본문에서 TS 타입표시만 제거해 V8 실행. 외부 `currentFacts`, `validSourceRef`, `moneyValue`는 가상 stub이고 `domain.ts` 직접 import, 전체 Node 테스트, D1 readback, 18개 계산 모듈/91입력 E2E는 아님.
- 입력: 가상 `tax_income::income_after_expenses` Fact F1/연간 2025/금액 12,000,000, 원천 상태 present/ref 통과. 월간 typed `income.net`도 의도적으로 **동액이지만 2026-01**로 설정. 금액-링크 게이트 독립 기대와 관찰을 다음처럼 분리함.

| No | 가상 입력 변형 | 독립 기대 | 원본 관찰 | issueCount |
|---:|---|---|---|---:|
| 1 | 동일 금액·Fact 링크, 연간 원천 대 월간 typed 기간 불일치 | 문제 없음 | 문제 없음 | 0 |
| 2 | 원천 Fact 연결 typed 행 없음 | CALC_INPUT_UNCONNECTED_MATERIAL | CALC_INPUT_UNCONNECTED_MATERIAL | 1 |
| 3 | 연결 typed 금액 1,000,000원으로 불일치 | CALC_INPUT_AMOUNT_MISMATCH | CALC_INPUT_AMOUNT_MISMATCH | 1 |
| 4 | 한 Fact로 typed 행 두 개 연결 | CALC_INPUT_MULTIPLE_TYPED_MATCHES | CALC_INPUT_MULTIPLE_TYPED_MATCHES | 1 |
| 5 | 원천 ref 검증 실패 | CALC_INPUT_SOURCE_INVALID | CALC_INPUT_SOURCE_INVALID | 1 |
| 6 | sourceState=unknown | CALC_INPUT_AMOUNT_INVALID | CALC_INPUT_AMOUNT_INVALID | 1 |
| 7 | 실제 원문 0과 typed 0 | 문제 없음 | 문제 없음 | 0 |
| 8 | 명시적 없음 explicit_none | 문제 없음 | 문제 없음 | 0 |

- **P2 경계 공백**: 연간 `#637` 원천과 월간 typed 수치가 우연히 같으면 **`issueCount=0`**. 해당 함수는 정확 ID·링크·금액 일치만 점검하며 기간/지속성/세무소득 법률상 인정은 검증하지 않음. 이 함수의 8/8 테스트 통과를 현재 월 인정소득·법률 승인·전체 계산 적합성으로 승격 금지. 상위/하위의 기간 귀속·사람-사업자 ID·합산 중복방지·보정 증거 검증이 별도로 필요. 현재 E2E 오류 확정 아님.
- `#622` 증권 단가와 `#625` 보유수량, `#630` 결제액, `#632` 거래세, `#633` 거래총액, `#634` 거래 단가는 동일 행/통화/거래방향/결제시점 정합 전 단순 합계·원화 환산/청산가치 승격 금지. #631 결제일, #639 발급일 및 과세귀속기간을 구분해야 함.
- `not_observed`, `null`, 명시적 `0`, `not_applicable`, `conflicting`, `source-only`, `approval_pending`은 별도 상태. source-only **16/20**은 무용/삭제가 아니라 증거·검산·역질문/법적 근거 검토 대기.

## 중앙 보드 ID별 누적 판정 — 모두 부분[ ] 유지
- `A3-AX-009`: 증권 14 필드 원천 등록과 적용조건 null 사이의 간극, 프롬프트 실추출/실런타임 검증 미완.
- `A3-IT-002`: 20 ID/20 슬롯/4 typed/1 material/정확 법률·토큰 0, 실 E2E/D1 미인증.
- `A3-DOC-010`: 증권의 계좌·종목·거래 이벤트/수량/통화/일자·수수료/세금 원본 대조·갈음 및 법원보정 실증 미완.
- `A3-CALC-015`: 행별 `trade_gross`/`settled_amount`/fee/tax 중복계상 위험, #637 연간 세무소득과 월간 typed 동일 수치 대비 기간 게이트 공백 확인.
- `A3-LAW-009`: 세무신고/지속소득의 독립 법적 인정근거·관할·시행일·변호사 검수 없는 자동 승격 0% 유지.

## 증거/원본 코드 기준 SHA
- `lib/canonical-field-id-index.json` blob `27ecdddd208de82a2f5c675e7482485e3a8838c2`
- `lib/document-agent-field-contracts.json` blob `9884b3fecf44643fefcdc4a421ed66ffc5477b3a`
- `lib/shared-document-field-contracts.json` blob `9decab974e0909ae24ad927bdfe241d75b71f3a9`
- `lib/ocr-field-supplements.json` blob `63b2bf853acb2e9620a6fb72377dc278ff3cd2a5`
- `lib/field-applicability-contracts.json` blob `6076b26f782c4643a21a7b2f1a8f6261bb588b68`
- `lib/canonical-field-binding.ts` blob `60ee5c7762d52b72a165b4f4f8214680eb98f148`
- `lib/feature-lineage-audit.ts` blob `de81bc3b8c460b8a4dde3fda9e13087e619e74ff`
- `lib/material-calculation-source-gate.ts` blob `0286b44484913b63fa8ec3f7bf0ca59b034d0dab`
- `lib/reference-decision-tables.json` blob `6924e3977caf748ce8a3d617fae15aff7d2fe2ce`
- `lib/risk-catalog.json` blob `e96dd0926e3ae9be5a5573d4551538ba294c4d2e`
- `lib/legal-catalog.json` blob `b0898d74f1df69b19ecf6e81cdff0ed09e8d885e`
- `lib/legal-exceptions.json` blob `6e51197226bfd8320e1147d8df3f12c11e00927c`
- `lib/legal-evidence-criteria.ts` blob `6c0b94535700d4fa4d356f8a91d5b9440b5ac52a`
- `lib/ocr-chain-matrix.ts` blob `977de86ba698bd805cc6b95d1384e3b49d0dbb4c`

**다음**: canonical **#641 `tax_income::period_end`**, 범위 #641~660, **데이터담당자** 시작. 소비처 심층 누적 **640/693 (92.4%)**, 잔여 **53개**, A3 인수 완료 **0/124**. 코딩/법률/산식 의미 변경·운영 배포/D1 운영 migration/전자제출/법원인가 모두 미실행; 전체 Node CI, staging D1/R2/Cron, 실 OCR·공식 서식/변호사 승인은 미인증.
