# FirmEngine A3 r49 — canonical OCR #261–280 소비처 심층 재감사 (2026-11-01 KST)

## 범위·버전·역할
- **GitHub main 원본 SHA: `53f72ef841f4a7e9dbc77dbe3500698187e41cbe`**. 작업 경계 `prototypes/Daeseong Ray Yang/firmengine-proto/ax-site/`; 단일 인수 `docs/PRODUCT_RELEASE_INTEGRATION_BOARD.md`. r48(#241–260) 및 최초 r14(#261–280)를 이어 검증.
- 6역할 순환 중 이번 5역할: **IT담당자 → 사용자·서류담당자 → 계산사무장 → 변호사 → 데이터담당자**, 보드 ID **A3-IT-003 / A3-DOC-015 / A3-CALC-004 / A3-LAW-009 / A3-DATA-004**. 모두 **부분 검증 / [ ] 유지**. 다음 역할 AX담당자.
- 최신 원본 JSON/TS에서 **693 canonical ID(중복/고아 0) / 85 서류 / 48 OCR family / 141 route / 1,808 원천 슬롯** 조인 확인. 이번 **20 ID / 71 슬롯 / 15개 고유 서류**. 계산 18개·선언 입력 91개, 위험 95·규칙 50·예외 46 등록 조회. 원천 행은 동일 ID라도 문서·페이지·행·대상·기간별 구별되어야 한다.

## 독립 실행 입력/기대/관찰
- 실제 원본 `canonical-field-id-index.json`, base/shared/supplement, applicability, `canonical-field-binding.ts` 명시 투영 객체, `feature-lineage-audit.ts`의 `hasPeriod/hasUnit/reviewScope` **원본 본문을 격리 V8 실행**, `material-calculation-source-gate.ts`의 정확 등록 정의, `ocr-chain-matrix.ts`의 직접 서식 토큰 선언, 18개 계산/91 입력 목록, 95·50·46 법률 정적 카탈로그 교차조인.
- **실제 독립 단언 111/111 일치, 불일치 0**. 입력: 최신 canonical #261~280 및 71 등록 문서×family 필드, source metadata, 실제 원본 period/unit/review predicate. 기대: 693/85/48/1808, 20ID/71슬롯, 필드별 원천위치/복수행 보존, 등록·투영·후보 정확 조인. 관찰: 아래 표와 동일. 원본 기간술어 20회·단위술어 20회, 수정안 #51 표현식 20개 필드 비교는 **V8 격리·합성/정적 검증**이며 Node 테스트/실제 OCR 합격 아님.
- 정확 적용조건 **13/20 등록, 7/20 미등록**: #261–265(가상자산 거래 확장 5), #278 `debt_certificate::claim_cause`, #280 `debt_certificate::contract_interest_rate`. **각 미등록 검증 0%**; `compactFamilyFieldContract()`에서 대응 `sourceCondition=null`, 임의 자동 승인·비해당·삭제 불가. #278은 폼 토큰 선언이 있어도 적용조건 미등록과 독립.
- 명시적 typed **9개**, 18/91 입력 **동명 후보 4개**(#267,#271,#272,#273), 정확 `must_reconcile` **1개**(#273→`income.net`), `context_only` 0, 직접 공식 서식 토큰 **1개**(#278 `D5106.creditor.cause`; 공식 Word/PDF 바인딩 미인증), 위험95·규칙50·예외46의 **정확 canonical ID 정적 링크 0/20**(승인형 운영 관리 기준정보 실조회 없음).
- `hasPeriod` false-positive 후보 **6개**(#262,#263,#264,#272,#274,#276): `temporal_role=not_applicable`인 주소·txid·상태·종류·지급자·수령자는 **해당 필드 자체 기간검사 불필요**(문서/거래 기간 별도), 원본 함수 모두 true. 기존 **[Draft PR #51](https://github.com/firmengine/firmengine/pull/51)** 조건식으로는 6개 모두 false. **#265 거래단가**는 numeric이라 수정안에서도 true, 거래 전체 시각의 검증은 필요할 수 있으므로 **추가 정책검토 후보**이지 오류 확정 아님.
- `reviewScope("bank_transactions")`에서는 **SEOUL-408 없음**, `reviewScope("crypto_transactions")`에서는 **존재**(V8 직접 실행). 실제 #261~265의 OCR 라우트는 전자이므로 가상자산 전문검토 후보 누락 가능. [Draft PR #59](https://github.com/firmengine/firmengine/pull/59)와 [Draft PR #56](https://github.com/firmengine/firmengine/pull/56) 미병합·중복 파일 변경 주의. `SEOUL-408` 자체 관할·시행일·법률 근거·변호사 승인 미인증.

## ID별 실제 선언 소비처/공백표
**P/U=main `hasPeriod/hasUnit` 원본 실행값. typed / 18·91 입력 동명 / material / form / exact 법률: 등록·후보일 뿐 실제 인정·출력 아님. 문서해시·페이지·quote/bbox·복수 record_ordinal·field_ordinal·대상/기간의 보존은 source-only 정책 및 패밀리 필드 앵커의 선언만 확인; 실제 사건 원본과 D1 저장·재독 미관찰.**

| # | canonical ID | 서류 / OCR family (슬롯) | datatype / unit / 시간역할 / 대상 | 적용조건 | P/U | typed / 입력후보 / material / form / 정확법률 | 증거 검산·역질문 |
|---:|---|---|---|---|---|---|---|
| 261 | `crypto_transactions::requested_at` | crypto_transactions / `bank_transactions` (1) | datetime / not_applicable / source_date_time_or_period / document_subject | **미등록(0%)** | Y/N | — / 0 / — / — / 0 | 요청시각과 완료시각 구분 |
| 262 | `crypto_transactions::source_address` | crypto_transactions / `bank_transactions` (1) | identifier / not_applicable / not_applicable / document_subject | **미등록(0%)** | Y/N | — / 0 / — / — / 0 | 송신주소/지갑 소유·내부이체 검증 |
| 263 | `crypto_transactions::transfer_status` | crypto_transactions / `bank_transactions` (1) | category / not_applicable / not_applicable / document_subject | **미등록(0%)** | Y/N | — / 0 / — / — / 0 | 대기·성공·실패 상태 분리 |
| 264 | `crypto_transactions::txid` | crypto_transactions / `bank_transactions` (1) | identifier / not_applicable / not_applicable / document_subject | **미등록(0%)** | Y/N | — / 0 / — / — / 0 | txid/chain/복수행 연결 |
| 265 | `crypto_transactions::unit_price` | crypto_transactions / `bank_transactions` (1) | money / source quote currency/asset unit / not_applicable / document_subject | **미등록(0%)** | Y/Y | — / 0 / — / — / 0 | 수량×단가/견적통화·거래시점 검산 |
| 266 | `current_nonwage_income::income.other.contract_end` | dividend_statement, income_source_inventory, interest_income_statement, rental_income_contract / `current_nonwage_income` (4) | date / not_applicable / effective_date / applicant_debtor | 정확등록 | Y/N | — / 0 / — / — / 0 | 계약 종료/갱신·반복가능성 |
| 267 | `current_nonwage_income::income.other.deductions` | dividend_statement, income_source_inventory, interest_income_statement, rental_income_contract / `current_nonwage_income` (4) | money_or_itemized / KRW / period_scope / applicant_debtor | 정확등록 | Y/Y | income.expenses / 1 / — / — / 0 | 항목별 공제와 총공제 이중차감 방지 |
| 268 | `current_nonwage_income::income.other.earning_period_end` | dividend_statement, income_source_inventory, interest_income_statement, rental_income_contract / `current_nonwage_income` (4) | date / not_applicable / statement_period_end / applicant_debtor | 정확등록 | Y/N | income.period_end / 0 / — / — / 0 | 귀속기간 종료≠입금일 |
| 269 | `current_nonwage_income::income.other.earning_period_start` | dividend_statement, income_source_inventory, interest_income_statement, rental_income_contract / `current_nonwage_income` (4) | date / not_applicable / statement_period_start / applicant_debtor | 정확등록 | Y/N | income.period_start / 0 / — / — / 0 | 귀속기간 시작·부분월 |
| 270 | `current_nonwage_income::income.other.frequency` | dividend_statement, income_source_inventory, interest_income_statement, rental_income_contract / `current_nonwage_income` (4) | enum_or_text / not_applicable / period_scope / applicant_debtor | 정확등록 | Y/N | — / 0 / — / — / 0 | 반복주기 입증·단발 수령과 구별 |
| 271 | `current_nonwage_income::income.other.gross_amount` | dividend_statement, income_source_inventory, interest_income_statement, rental_income_contract / `current_nonwage_income` (4) | money / KRW / period_scope / applicant_debtor | 정확등록 | Y/Y | income.gross / 1 / — / — / 0 | 총액 vs 공제/실수령 이중계상 금지 |
| 272 | `current_nonwage_income::income.other.income_kind` | dividend_statement, income_source_inventory, interest_income_statement, rental_income_contract / `current_nonwage_income` (4) | enum / not_applicable / not_applicable / applicant_debtor | 정확등록 | Y/N | income.kind / 1 / — / — / 0 | 원천 소득종류≠법률상 지속성 |
| 273 | `current_nonwage_income::income.other.net_received` | dividend_statement, income_source_inventory, interest_income_statement, rental_income_contract / `current_nonwage_income` (4) | money / KRW / event_date / applicant_debtor | 정확등록 | Y/Y | income.net / 1 / must_reconcile→income.net / — / 0 | 실수령액 필수대조(승인전) |
| 274 | `current_nonwage_income::income.other.payer` | dividend_statement, income_source_inventory, interest_income_statement, rental_income_contract / `current_nonwage_income` (4) | party_role / not_applicable / not_applicable / payer | 정확등록 | Y/N | — / 0 / — / — / 0 | 지급자별 중복 소득 대조 |
| 275 | `current_nonwage_income::income.other.payment_date` | dividend_statement, income_source_inventory, interest_income_statement, rental_income_contract / `current_nonwage_income` (4) | date / not_applicable / event_date / applicant_debtor | 정확등록 | Y/N | — / 0 / — / — / 0 | 지급일/귀속기간 별개 |
| 276 | `current_nonwage_income::income.other.recipient` | dividend_statement, income_source_inventory, interest_income_statement, rental_income_contract / `current_nonwage_income` (4) | party_role / not_applicable / not_applicable / applicant_debtor | 정확등록 | Y/N | — / 0 / — / — / 0 | 본인 수령·제3자 수령 구분 |
| 277 | `debt_certificate::as_of_date` | card_statement, creditor_request_copy, debt_certificate, loan_contract, loan_use_of_funds, mortgage_balance, prior_creditor_list, private_adjustment_records, private_loan_transfer, vehicle_lease_contract / `debt_certificate` (10) | date / source date format normalized to ISO without loss / balance_as_of_date / debtor | 정확등록 | Y/N | debt.as_of / 0 / — / — / 0 | 채무 잔액 기준일·계약 동일성 |
| 278 | `debt_certificate::claim_cause` | debt_certificate / `debt_certificate` (1) | string / not_applicable / not_applicable / document_subject | **미등록(0%)** | N/N | debt.cause / 0 / — / D5106.creditor.cause / 0 | 발생원인/공식 D5106 토큰 검증전 |
| 279 | `debt_certificate::contract_id` | card_statement, creditor_request_copy, debt_certificate, loan_contract, loan_use_of_funds, mortgage_balance, prior_creditor_list, private_adjustment_records, private_loan_transfer, vehicle_lease_contract / `debt_certificate` (10) | identifier / not_applicable / not_applicable / debtor | 정확등록 | N/N | debt.contract_id / 0 / — / — / 0 | 계약번호 원천/가린 번호 중복금지 |
| 280 | `debt_certificate::contract_interest_rate` | debt_certificate / `debt_certificate` (1) | decimal_or_text / source rate unit / not_applicable / document_subject | **미등록(0%)** | N/Y | — / 0 / — / — / 0 | 약정이율 vs 실제 이자잔액/단위 |

## 코드 소비·법률 경계 및 후속
- 선언 파이프라인: `shared-document-catalog.ts` 문서·family→ `document-agent-registry.ts` 적용조건→ `canonical-field-binding.ts` typed → `feature-lineage-audit.ts` 계산·법률·서식 후보→ `material-calculation-source-gate.ts` 원천필수대조 → `ocr-chain-matrix.ts` 직접 토큰. `db/schema.ts`의 `extraction_records/extracted_features/extraction_field_coverage`와 원천 sourceHash·페이지·행·sourceState 등 **스키마 선언 확인**, 실제 고객 DB Fact/typed 재조회하지 않음.
- 비근로소득: #271 총액, #267 `money_or_itemized` 공제, #273 실수령, #274 지급자, #275 수령일, #268~269 귀속기간/계약종료 #266은 원천·기간·대상별 중복 검산. `income.expenses` 투영 선언이 세부내역 합산/법률상 인정 비용 확정 뜻하지 않음. 사례별 실제 계산 및 운영 데이터 영수증 없음.
- 채무: #277 기준일/#279 계약번호는 10개 문서 각각의 별도 원천슬롯, #278 발생원인과 #280 약정이율은 별도 단일 문서 확장. 후자는 **정확 적용조건 미등록 0%**. 약정 이율만으로 이자잔액을 산출하지 않음. #278 직접 토큰은 공식 서식·사람 승인 아님.
- #261~265 가상자산 거래 상태/txid/가격은 요청≠체결, 자체전송≠소득, 원단위 수량≠견적통화·원화. 자동 원화 합산·법률 인정/자동 삭제 금지.
- 0 직접 소비처인 필드도 증거/검산/역질문/법원 요구·갈음·보정 검토로 보존. 미관찰 / null / 실측0 / 비해당 / 상충 / source-only / 승인전 상태를 서로 분리. `legal-evidence-criteria.ts` 승인형 기준정보·공식 판본·변호사 확인 전 legal requiredness는 미승인 **0% 합격**. 서류 발급불가 갈음·법원 보정명령과 실제 전자제출은 실행하지 않음.
- 이번 5개 보드 ID 모두 **[ ]**: IT-003 18계산/91입력 사건별 실행·근거 필요; DOC-015 #278 발생원인/#279 계약번호 법적 서류보정 연결 필요; CALC-004 지급자·총/공제/순액 단일 기간 중복 검산 필요; LAW-009 지속소득 법률판본·관할/변호사 승인 필요; DATA-004 원본 문서·페이지·행/해시→Fact→typed→서식 출력 SQL 재독 필요.
- 기존 테스트 파일 `tests/ocr-calculation-db-contract.test.ts` 확인했으나 **프로젝트 Node 단위/전체 CI는 실행하지 않음**. staging D1/R2/Cron·실제 PDF/OCR·공식 Word/PDF·변호사 인가·사이트 배포 **미관찰/미인증**. 운영 배포/운영 마이그레이션/실제 전자제출/법원 인가 확정 **미실행**.
- 다음 시작 **#281 `debt_certificate::creditor` (#281–300)**, 역할 **AX담당자부터**. 누적 심층 재감사 **280/693**, 최초 순차 정적 열거 **693/693**, A3 전체 체크 **124개 중 최종 승인 완료 0개**.

## 조회한 주요 원본 blob SHA
- `lib/canonical-field-id-index.json`: `27ecdddd208de82a2f5c675e7482485e3a8838c2`
- `lib/document-agent-field-contracts.json`: `9884b3fecf44643fefcdc4a421ed66ffc5477b3a`
- `lib/shared-document-field-contracts.json`: `9decab974e0909ae24ad927bdfe241d75b71f3a9`
- `lib/ocr-field-supplements.json`: `63b2bf853acb2e9620a6fb72377dc278ff3cd2a5`
- `lib/field-applicability-contracts.json`: `6076b26f782c4643a21a7b2f1a8f6261bb588b68`
- `lib/canonical-field-binding.ts`: `60ee5c7762d52b72a165b4f4f8214680eb98f148`
- `lib/feature-lineage-audit.ts`: `de81bc3b8c460b8a4dde3fda9e13087e619e74ff`
- `lib/material-calculation-source-gate.ts`: `0286b44484913b63fa8ec3f7bf0ca59b034d0dab`
- `lib/ocr-chain-matrix.ts`: `977de86ba698bd805cc6b95d1384e3b49d0dbb4c`
- `lib/reference-decision-tables.json`: `6924e3977caf748ce8a3d617fae15aff7d2fe2ce`
- `lib/risk-catalog.json`: `e96dd0926e3ae9be5a5573d4551538ba294c4d2e`
- `lib/legal-catalog.json`: `b0898d74f1df69b19ecf6e81cdff0ed09e8d885e`
- `lib/legal-exceptions.json`: `6e51197226bfd8320e1147d8df3f12c11e00927c`
