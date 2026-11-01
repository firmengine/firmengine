# FirmEngine A3 r48 — canonical OCR #241–260 소비처 심층 재감사 (2026-11-01 KST)

## 기준과 담당자
- 작업 경계: `prototypes/Daeseong Ray Yang/firmengine-proto/ax-site/` 내부만. 단일 인수 문서 `docs/PRODUCT_RELEASE_INTEGRATION_BOARD.md` 기준.
- 원본 재조회 직전 main HEAD: `b2fef391a5fd631c7c6d5c50f1f349810a4cfe36`; 인수 보드 blob: `2d477eaa15f5acfbabda14a00ee66beb0acfd6c8`. 기존 r47(#221–240)과 2026-10-31 r13(#241–260)의 진행 항목을 이어서 검증.
- 보드에서 실제 추출한 A3 6담당자 124개 미완료 ID:
- IT: A3-IT-001, A3-IT-002, A3-IT-003, A3-IT-004, A3-IT-005, A3-IT-006, A3-IT-007, A3-IT-008, A3-IT-009, A3-IT-010, A3-IT-011, A3-IT-012, A3-IT-013, A3-IT-014, A3-IT-015, A3-IT-016, A3-IT-017, A3-IT-018, A3-IT-019, A3-IT-020
- DOC: A3-DOC-001, A3-DOC-002, A3-DOC-003, A3-DOC-004, A3-DOC-005, A3-DOC-006, A3-DOC-007, A3-DOC-008, A3-DOC-009, A3-DOC-010, A3-DOC-011, A3-DOC-012, A3-DOC-013, A3-DOC-014, A3-DOC-015, A3-DOC-016, A3-DOC-017, A3-DOC-018, A3-DOC-019, A3-DOC-020
- CALC: A3-CALC-001, A3-CALC-002, A3-CALC-003, A3-CALC-004, A3-CALC-005, A3-CALC-006, A3-CALC-007, A3-CALC-008, A3-CALC-009, A3-CALC-010, A3-CALC-011, A3-CALC-012, A3-CALC-013, A3-CALC-014, A3-CALC-015, A3-CALC-016, A3-CALC-017, A3-CALC-018, A3-CALC-019, A3-CALC-020
- LAW: A3-LAW-001, A3-LAW-002, A3-LAW-003, A3-LAW-004, A3-LAW-005, A3-LAW-006, A3-LAW-007, A3-LAW-008, A3-LAW-009, A3-LAW-010, A3-LAW-011, A3-LAW-012, A3-LAW-013, A3-LAW-014, A3-LAW-015, A3-LAW-016, A3-LAW-017, A3-LAW-018, A3-LAW-019, A3-LAW-020, A3-LAW-021, A3-LAW-022
- DATA: A3-DATA-001, A3-DATA-002, A3-DATA-003, A3-DATA-004, A3-DATA-005, A3-DATA-006, A3-DATA-007, A3-DATA-008, A3-DATA-009, A3-DATA-010, A3-DATA-011, A3-DATA-012, A3-DATA-013, A3-DATA-014, A3-DATA-015, A3-DATA-016, A3-DATA-017, A3-DATA-018, A3-DATA-019, A3-DATA-020, A3-DATA-021, A3-DATA-022
- AX: A3-AX-001, A3-AX-002, A3-AX-003, A3-AX-004, A3-AX-005, A3-AX-006, A3-AX-007, A3-AX-008, A3-AX-009, A3-AX-010, A3-AX-011, A3-AX-012, A3-AX-013, A3-AX-014, A3-AX-015, A3-AX-016, A3-AX-017, A3-AX-018, A3-AX-019, A3-AX-020
- 이번 5역할 순환: 사용자·서류담당자 → 계산사무장 → 변호사 → 데이터담당자 → AX담당자. 점검 ID: `A3-DOC-016`, `A3-CALC-015`, `A3-LAW-017`, `A3-DATA-014`, `A3-AX-012`. 모두 미완료 [ ] 유지. 다음은 IT담당자 시작.

## 실제 입력, 독립 기대값, 관찰 및 검증 한계
- GitHub 최신 JSON 전수 조인: canonical 693개 고유, 문서 85종, OCR family 48개, 기본+공유 확장+supplement 원천 슬롯 1808개. 이번 정확 #241–260 = 20ID / 20슬롯 / 2서류.
- 독립 정적/원본 함수 단언 **23/23 기대 일치**. 유형: 인덱스 순서/고유성, 두 문서·패밀리 경로, 원천 위치 앵커, 복수행 cross-borrow 금지, source-only, 적용조건 등록, 직접 typed·material 계산·form 토큰·법률, 18계산/91입력, 95위험/50규칙/46예외, 원본 기간·단위 술어와 전문 검토 후보.
- 원본 `feature-lineage-audit.ts`의 `hasPeriod` / `hasUnit` 실제 표현식을 TS 타입만 제거해 V8 격리 **각 20회** 호출. `reviewScope` 원본 함수 본문 격리 **4회**; family 기반 법률검토 후보의 양성·음성 대조. 합성·정적 검사이며 프로젝트 Node/CI 실행 아님.
- 적용조건 정확 등록 **0/20**: 확장 ID는 원천 계약에 있지만 `field-applicability-contracts.json`의 해당 base family 정확 ID에 없으며 `compactFamilyFieldContract`에서 `sourceCondition=null`로 처리되는 계약. 미등록 20건 각각 합격 0%, 증거 삭제/자동 비해당/법률 판정 금지.
- typed 직접 0/20, `MATERIAL_CALCULATION_SOURCES` 직접 0/20, `OCR_DECLARED_FORM_TARGETS` 직접 공식 서식 토큰 0/20, 정적 위험95/규칙50/예외46·seed 정확 법률 증거계약 0/20. 가족/문서 수준 후보나 원천 evidence-only 기능을 무용으로 판단하지 않는다.
- 원본 기간검사 `hasPeriod`는 #250, #252–260의 **10건**을 `temporal_role=not_applicable`임에도 `bank_transactions` 문자열로 true 반환. #247·#251의 실제 datetime은 true로 일치. 정확 불일치 번호: #250, #252, #253, #254, #255, #256, #257, #258, #259, #260.
- 미병합 Draft [PR #51](https://github.com/firmengine/firmengine/pull/51)의 실제 `hasPeriod(role,family,datatype)`식을 같은 20개 메타데이터에 V8 비교 실행한 결과 10→**3건 잔존**: #256 fee_quantity, #257 gross_trade_amount, #259 quantity. 원본 코드의 `REQUIRED_FIELD_PERIOD_UNSCOPED` 분기와 연계 가능하나, 실제 요구조건/검증 Fact를 넣은 E2E 불실행이므로 잠재 false-positive로만 분류.
- `reviewScope`는 일반 `cash_deposit_asset` 및 `bank_transactions` family 둘 다 전문 검토 후보 `SEOUL-408` 0/2, 반면 crypto_balance/crypto_transactions 이름 직접 입력은 2/2 존재. 확장 문서는 일반 family로 라우팅되므로 20개 원천 필드가 모두 전문 후보 누락 경로. 미병합 Draft [PR #56](https://github.com/firmengine/firmengine/pull/56)(잔고)·[PR #59](https://github.com/firmengine/firmengine/pull/59)(거래) 병합 전에 동일 파일 충돌 및 법률 근거/관할/시행일/변호사 확인 필요.
- `hasUnit`는 money·quantity 7건 #241, #243, #245, #248, #256, #257, #259에 true. 수량 단위/원금액/호가 단위와 통화를 섞어 원화 합산하지 않는다.

## 실제 canonical 인덱스 원본 순서의 개별 소비처/공백 20건
모든 행은 문서 hash/page/quote-bbox/record_ordinal/subject 식별 **선언 계약**만 확인. 사건별 실제 문서·페이지·복수행 원문·DB Fact/typed 행은 미관찰. P/U는 원본 `hasPeriod/hasUnit` 실행값; 마지막 네 값은 직접 typed/material/form/legal 증거계약 건수.

| # | canonical ID | 서류 / OCR family | datatype / 원단위 | 시간역할 / 대상 | 적용조건 | P/U | typed / material / form / legal |
|---:|---|---|---|---|---|---|---|
| 241 | `crypto_balance::displayed_valuation` | `crypto_balance` / `cash_deposit_asset` | `money` / source currency/unit | not_applicable / document_subject | 없음 (0%) | N/Y | 0 / 0 / 0 / 0 |
| 242 | `crypto_balance::exchange_or_wallet` | `crypto_balance` / `cash_deposit_asset` | `identifier` / not_applicable | not_applicable / document_subject | 없음 (0%) | N/N | 0 / 0 / 0 / 0 |
| 243 | `crypto_balance::locked_quantity` | `crypto_balance` / `cash_deposit_asset` | `quantity` / asset-native unit | not_applicable / document_subject | 없음 (0%) | N/Y | 0 / 0 / 0 / 0 |
| 244 | `crypto_balance::network` | `crypto_balance` / `cash_deposit_asset` | `string` / not_applicable | not_applicable / document_subject | 없음 (0%) | N/N | 0 / 0 / 0 / 0 |
| 245 | `crypto_balance::total_quantity` | `crypto_balance` / `cash_deposit_asset` | `quantity` / asset-native unit | not_applicable / document_subject | 없음 (0%) | N/Y | 0 / 0 / 0 / 0 |
| 246 | `crypto_balance::valuation_currency` | `crypto_balance` / `cash_deposit_asset` | `string` / not_applicable | not_applicable / document_subject | 없음 (0%) | N/N | 0 / 0 / 0 / 0 |
| 247 | `crypto_balance::valuation_datetime` | `crypto_balance` / `cash_deposit_asset` | `datetime` / not_applicable | source_date_time_or_period / document_subject | 없음 (0%) | Y/N | 0 / 0 / 0 / 0 |
| 248 | `crypto_balance::valuation_unit_price` | `crypto_balance` / `cash_deposit_asset` | `money` / source quote currency/asset unit | not_applicable / document_subject | 없음 (0%) | N/Y | 0 / 0 / 0 / 0 |
| 249 | `crypto_balance::wallet_address` | `crypto_balance` / `cash_deposit_asset` | `identifier` / not_applicable | not_applicable / document_subject | 없음 (0%) | N/N | 0 / 0 / 0 / 0 |
| 250 | `crypto_transactions::asset_symbol` | `crypto_transactions` / `bank_transactions` | `string` / not_applicable | not_applicable / document_subject | 없음 (0%) | Y/N | 0 / 0 / 0 / 0 |
| 251 | `crypto_transactions::completed_at` | `crypto_transactions` / `bank_transactions` | `datetime` / not_applicable | source_date_time_or_period / document_subject | 없음 (0%) | Y/N | 0 / 0 / 0 / 0 |
| 252 | `crypto_transactions::counterparty_account_identity` | `crypto_transactions` / `bank_transactions` | `party_role` / not_applicable | not_applicable / document_subject | 없음 (0%) | Y/N | 0 / 0 / 0 / 0 |
| 253 | `crypto_transactions::crypto_event_kind` | `crypto_transactions` / `bank_transactions` | `category` / not_applicable | not_applicable / document_subject | 없음 (0%) | Y/N | 0 / 0 / 0 / 0 |
| 254 | `crypto_transactions::destination_address` | `crypto_transactions` / `bank_transactions` | `identifier` / not_applicable | not_applicable / document_subject | 없음 (0%) | Y/N | 0 / 0 / 0 / 0 |
| 255 | `crypto_transactions::fee_asset` | `crypto_transactions` / `bank_transactions` | `string` / not_applicable | not_applicable / document_subject | 없음 (0%) | Y/N | 0 / 0 / 0 / 0 |
| 256 | `crypto_transactions::fee_quantity` | `crypto_transactions` / `bank_transactions` | `quantity` / source fee asset unit | not_applicable / document_subject | 없음 (0%) | Y/Y | 0 / 0 / 0 / 0 |
| 257 | `crypto_transactions::gross_trade_amount` | `crypto_transactions` / `bank_transactions` | `money` / source currency/unit | not_applicable / document_subject | 없음 (0%) | Y/Y | 0 / 0 / 0 / 0 |
| 258 | `crypto_transactions::network` | `crypto_transactions` / `bank_transactions` | `string` / not_applicable | not_applicable / document_subject | 없음 (0%) | Y/N | 0 / 0 / 0 / 0 |
| 259 | `crypto_transactions::quantity` | `crypto_transactions` / `bank_transactions` | `quantity` / asset-native unit | not_applicable / document_subject | 없음 (0%) | Y/Y | 0 / 0 / 0 / 0 |
| 260 | `crypto_transactions::quote_currency` | `crypto_transactions` / `bank_transactions` | `string` / not_applicable | not_applicable / document_subject | 없음 (0%) | Y/N | 0 / 0 / 0 / 0 |

## 소비 경로 및 역할별 판단
- DB 선언: `shared-document-catalog.ts`(확장 필드 결합) → `document-agent-registry.ts`(원천 적용조건) → `canonical-field-binding.ts`(정확 typed 변환) → `feature-lineage-audit.ts`(후보/gaps) → `ocr-chain-matrix.ts`(서식 후보), `material-calculation-source-gate.ts`(정확 계산 게이트). 물리 `db/schema.ts`의 `extraction_records`, `extracted_features`(raw_value_json, source_state, quote, bbox_json, canonical_field_id), `extraction_field_coverage`는 선언 확인만; 실제 D1/Fact/typed 저장·재조회 없음.
- `crypto_balance` 9피처: #241 표시 시가 vs #245 총수량×#248 원가격/견적통화, #243 잠김수량 vs 직전 #239 가용수량의 포함관계. #242 지갑/거래소, #244 네트워크, #249 지갑주소, #246 견적통화, #247 기준시각, 동일 자산 중복/타인 명의 여부를 확인해야 함. 자동 청산가치 인정 및 KRW 환산 금지.
- `crypto_transactions` 11피처: #251 완료시각, #253 유형, #252 상대 계정, #254 목적지 주소, #255 수수료 자산, #256 수수료 수량, #257 거래총액, #259 원자산수량, #260 결제통화/견적통화. 서로 다른 거래·계정·네트워크·단위·내부이체 여부를 확인하지 않고 월소득/자산/비용에 합산하지 않는다.
- 역할별 미완료: DOC-016 원천 보존·갈음·법원보정/역질문 사건별 실행 필요; CALC-015 부분합/총계·FX·수수료·잔고 중복 E2E 필요; LAW-017 95법률위험의 정확 증거와 해당 전문 후보의 판본/관할/변호사 승인 필요; DATA-014 원본 문서·페이지·subject·sourceVersion→typed→공식 form-token 교차 재조회 필요; AX-012 source-only도 유효한 검증 목적·추가 법적 질문 및 기간검사 불일치 3건 통합 테스트 필요.
- 상태 구별: 미관찰 / null / 실측 0 / 비해당 / 상충 / source-only / 승인 전은 서로 다르다. 미등록/미승인은 0% 합격으로 두고, 임의 삭제·무단 환산·법적 효력 승격을 금지.
- 법률 위험 95/규칙50/예외46 등록과 최종 법률 승인 증명은 다르다. `legal-evidence-criteria.ts` seed `checks:[]`는 운영 관리형 승인 증거계약의 존재/부재를 단정하지 못한다.

## 조회한 주요 Git blob SHA
- `lib/canonical-field-id-index.json` SHA `27ecdddd208de82a2f5c675e7482485e3a8838c2`
- `lib/document-agent-field-contracts.json` SHA `9884b3fecf44643fefcdc4a421ed66ffc5477b3a`
- `lib/shared-document-field-contracts.json` SHA `9decab974e0909ae24ad927bdfe241d75b71f3a9`
- `lib/ocr-field-supplements.json` SHA `63b2bf853acb2e9620a6fb72377dc278ff3cd2a5`
- `lib/field-applicability-contracts.json` SHA `6076b26f782c4643a21a7b2f1a8f6261bb588b68`
- `lib/feature-lineage-audit.ts` SHA `de81bc3b8c460b8a4dde3fda9e13087e619e74ff`
- `lib/canonical-field-binding.ts` SHA `60ee5c7762d52b72a165b4f4f8214680eb98f148`
- `lib/material-calculation-source-gate.ts` SHA `0286b44484913b63fa8ec3f7bf0ca59b034d0dab`
- `lib/ocr-chain-matrix.ts` SHA `977de86ba698bd805cc6b95d1384e3b49d0dbb4c`
- `lib/reference-decision-tables.json` SHA `6924e3977caf748ce8a3d617fae15aff7d2fe2ce`
- `lib/risk-catalog.json` SHA `e96dd0926e3ae9be5a5573d4551538ba294c4d2e`
- `lib/legal-catalog.json` SHA `b0898d74f1df69b19ecf6e81cdff0ed09e8d885e`
- `lib/legal-exceptions.json` SHA `6e51197226bfd8320e1147d8df3f12c11e00927c`
- `lib/legal-evidence-criteria.ts` SHA `6c0b94535700d4fa4d356f8a91d5b9440b5ac52a`
- `db/schema.ts` SHA `933f8686845ac14669312dd21bf85e02c62ed5e6`

## 정확한 검증 수준 및 인계
- **이번 실행**: 23/23 구조·원본 소스 V8 격리 단언 일치, 20개 기간·20개 단위 판별, 전문 후보 4개 경로 및 Draft PR #51 조건부 기간 비교. **미실행**: 프로젝트 Node 전체 테스트/CI, staging D1·R2/Cron, 실제 PDF OCR/DB Fact·typed read-back, 법원 공식 서식 출력, 법률 판본 검증/변호사 승인/사이트 배포.
- 작업 경계 내부의 신규 감사 영수증만 생성. 운영 배포/운영 DB migration/전자제출/법원 인가 확정/고객 문서·원본 OCR 값·키·.env·비공개 정답 공개 커밋 없음.
- **다음 시작: #261 `crypto_transactions::requested_at`**, #261–280. 심층 재감사 누적 **260/693**, 최초 정적 열거 **693/693**, A3 최종 인수 완료 **0/124**.
