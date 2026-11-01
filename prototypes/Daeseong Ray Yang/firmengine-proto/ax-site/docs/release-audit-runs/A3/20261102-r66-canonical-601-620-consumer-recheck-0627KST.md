# FirmEngine A3 r66 — canonical #601–620 증거/계산/법률/서식 소비처 재감사 (2026-11-02 06:27 KST)

## 범위·시점·인증 분리
- 감사/작성 직전 GitHub main HEAD: `8ceb5b40c29e762c684fc58b08b25cc86ebc6db9`. 허용 수정범위: `prototypes/Daeseong Ray Yang/firmengine-proto/ax-site/` 아래만. r65 #581–600 영수증을 읽고 정확한 최신 canonical 순서 #601–620을 이어감. 이전 r65 다음 시작 #601과 일치.
- 6역할 순환: **IT → 사용자·서류 → 계산사무장 → 변호사 → 데이터**; 다음 AX부터. 관련 중앙 보드 체크 `A3-IT-002`/`A3-DOC-010`/`A3-CALC-006`/`A3-LAW-003`/`A3-DATA-008` 5개 모두 **부분검증 [ ]**, 인수 완료 0. A3 124개 체크(IT20/DOC20/CALC20/LAW22/DATA22/AX20).
- 최근 main r65 A3, r65 A4, r66 A1/A2 변경, 미병합 Draft PR #51(기간), #149(법원 보정 canonical), #155(부동산 대상 식별) 고려. 다른 에이전트 파일 수정/PR 병합 금지.
- 원본 blob SHA: `canonical-field-id-index.json`=`27ecdddd208de82a2f5c675e7482485e3a8838c2`; `document-agent-field-contracts.json`=`9884b3fecf44643fefcdc4a421ed66ffc5477b3a`; `shared-document-field-contracts.json`=`9decab974e0909ae24ad927bdfe241d75b71f3a9`; `ocr-field-supplements.json`=`63b2bf853acb2e9620a6fb72377dc278ff3cd2a5`; `field-applicability-contracts.json`=`6076b26f782c4643a21a7b2f1a8f6261bb588b68`; `feature-lineage-audit.ts`=`de81bc3b8c460b8a4dde3fda9e13087e619e74ff`; `canonical-field-binding.ts`=`60ee5c7762d52b72a165b4f4f8214680eb98f148`; `ocr-chain-matrix.ts`=`977de86ba698bd805cc6b95d1384e3b49d0dbb4c`; `material-calculation-source-gate.ts`=`0286b44484913b63fa8ec3f7bf0ca59b034d0dab`; `legal-evidence-criteria.ts`=`6c0b94535700d4fa4d356f8a91d5b9440b5ac52a`.
- 실제 열람: `lib/shared-document-catalog.ts`, `lib/asset-resolution.ts`, `lib/substitution-policy.ts`, `lib/document-substitution.ts`, `lib/feature-lineage-audit.ts`, `lib/canonical-field-binding.ts`, `lib/ocr-chain-matrix.ts`, `lib/material-calculation-source-gate.ts` 및 `tests/feature-lineage-audit.test.ts`, `tests/material-calculation-source-gate.test.ts`, `tests/ocr-chain-matrix.test.ts` (기존 코드/테스트 내용, 이번 실제 Node 실행 아님).

## 실제 입력 / 독립 기대값 / 관찰
- GitHub 원본 JSON 정적 join: canonical **693 고유/중복0**, 증빙서류 **85**, 추출 family **48**, document×family×field 슬롯 **1808/고아0/중복0**. reference-decision-tables: 계산 **18** / 입력 선언 **91**; 위험 **95**, 규칙 **50**, 예외 **46**. 위 구조 및 소비처·예외 불변식 **23/23 일치** (실제 원본 JSON·TS 정적 및 격리 확인만).
- 이번 정확 20 ID / **29 슬롯**, 관련 **3종 서류** (`security_register`, `mortgage_balance`, `securities_balance`) / **2 family** (`secured_claim_security`, `cash_deposit_asset`). required_source_anchor 29/29, recordPolicy.noCrossRecordBorrowing 29/29 선언. 실 OCR 페이지·원문 hash/bbox·D1 Fact의 실존은 미관찰.
- `feature-lineage-audit.ts` 원본 술어 `hasPeriod`, `hasUnit`을 TypeScript 인자 주석만 벗겨 **V8 29회씩 58회 실행**. 별도 기대: 날짜/시간역할 #603/#607/#620 기간검사, 금액/수량 #601/#606/#612/#613/#618 단위검사. 실제 **기간 true 5/29**, **단위 true 7/29**, **58/58 기대 일치**. 이 기대는 소스 필드 수준 검산 휴리스틱이고 법적 필수 기간기준 아님.
- `canonical-field-binding.ts` 원본 `projections` 객체를 V8 평가해 family+local_id+9 record categories 교차 확인: 직접 typed **0/20**. `ocr-chain-matrix.ts` 정확 form token 선언 **0/20**; `material-calculation-source-gate.ts`에는 #601만 `context_only` 선언, **must_reconcile 0/20**. 18 계산/91입력의 직접 원본 ID 선언 연결 **0/20**. 이름 유사함만으로 전용 typed 계산값으로 승격 금지.
- risk95/rules50/exception46 원본의 20개 정확 canonical ID 리터럴 계약 **0/20**; 승인형 `LEGAL_EVIDENCE_POLICY_SEED.checks=[]` (운영관리형 DB 승인 계약은 미조회). 정확 법률 증거 승인 **0%**. `reviewScope`의 D5106/D5110 또는 D5101/D5110 등 family 범주 후보는 토큰/공식 양식 승인과 다름.
- `field-applicability-contracts.json` 정확 ID 적용조건: 담보 #601–609 **9/9 등록**, 증권잔고 확장 #610–620 **11/11 미등록**; 전체 **9/20 등록, 11/20 미등록**. 미등록/미승인 11건은 승인검증 0% 합격, OCR 데이터/인덱스 누락 11건으로 오인 금지.

## 원본 #601–620 전수 증거/대상/기간/단위/소비처 표
- P/U는 각 행 원본 슬롯 중 hasPeriod/hasUnit true 수. 모두 raw source hash·document/page/record ordinal/quote/bbox 선언 기반이며, 실제 source unit/통화·법률 인정/양식 생성은 별도 미관찰.

| # | canonical OCR ID | 서류@family | datatype / 단위 | subject / temporal role | P/U | 적용조건 | 정확 소비 선언·보류 |
|---:|---|---|---|---|---:|---|---|
| 601 | `secured_claim_security::actual_payoff` | security_register@secured_claim_security; mortgage_balance@secured_claim_security | money / currency and exact source unit if monetary | debtor / not_applicable | 0/2 | 등록 | **context_only**, 지급액·등기액 분리 |
| 602 | `secured_claim_security::collateral_id` | security_register@secured_claim_security; mortgage_balance@secured_claim_security | identifier / not_applicable | debtor / not_applicable | 0/0 | 등록 | source-only |
| 603 | `secured_claim_security::discharge_date` | security_register@secured_claim_security; mortgage_balance@secured_claim_security | date / source date format normalized to ISO without loss | debtor / discharge_effective_date | 2/0 | 등록 | source-only |
| 604 | `secured_claim_security::grantor` | security_register@secured_claim_security; mortgage_balance@secured_claim_security | party_role / not_applicable | debtor / not_applicable | 0/0 | 등록 | source-only |
| 605 | `secured_claim_security::priority` | security_register@secured_claim_security; mortgage_balance@secured_claim_security | string / not_applicable | debtor / not_applicable | 0/0 | 등록 | source-only |
| 606 | `secured_claim_security::registered_maximum` | security_register@secured_claim_security; mortgage_balance@secured_claim_security | money / currency and exact source unit if monetary | debtor / not_applicable | 0/2 | 등록 | 등기 채권최고액 ≠ 실상환액 |
| 607 | `secured_claim_security::registration_date` | security_register@secured_claim_security; mortgage_balance@secured_claim_security | date / source date format normalized to ISO without loss | debtor / registration_effective_date | 2/0 | 등록 | source-only |
| 608 | `secured_claim_security::secured_party` | security_register@secured_claim_security; mortgage_balance@secured_claim_security | party_role / not_applicable | debtor / not_applicable | 0/0 | 등록 | source-only |
| 609 | `secured_claim_security::security_type` | security_register@secured_claim_security; mortgage_balance@secured_claim_security | category / not_applicable | debtor / not_applicable | 0/0 | 등록 | source-only |
| 610 | `securities_balance::account_coverage` | securities_balance@cash_deposit_asset | string / not_applicable | document_subject / not_applicable | 0/0 | **미등록(0%)** | source-only |
| 611 | `securities_balance::asset_class` | securities_balance@cash_deposit_asset | category / not_applicable | document_subject / not_applicable | 0/0 | **미등록(0%)** | source-only |
| 612 | `securities_balance::cash_balance` | securities_balance@cash_deposit_asset | money / source currency/unit | document_subject / not_applicable | 0/1 | **미등록(0%)** | 증권계좌 현금성 잔액 |
| 613 | `securities_balance::quantity` | securities_balance@cash_deposit_asset | quantity / source quantity unit | document_subject / not_applicable | 0/1 | **미등록(0%)** | 수량·단위 별도 |
| 614 | `securities_balance::quantity_unit` | securities_balance@cash_deposit_asset | string / not_applicable | document_subject / not_applicable | 0/0 | **미등록(0%)** | source-only |
| 615 | `securities_balance::security_id` | securities_balance@cash_deposit_asset | identifier / not_applicable | document_subject / not_applicable | 0/0 | **미등록(0%)** | source-only |
| 616 | `securities_balance::security_name` | securities_balance@cash_deposit_asset | string / not_applicable | document_subject / not_applicable | 0/0 | **미등록(0%)** | source-only |
| 617 | `securities_balance::settlement_basis` | securities_balance@cash_deposit_asset | string / not_applicable | document_subject / not_applicable | 0/0 | **미등록(0%)** | source-only |
| 618 | `securities_balance::unsettled_liability` | securities_balance@cash_deposit_asset | money / source currency/unit | document_subject / not_applicable | 0/1 | **미등록(0%)** | 미결제 채무의 귀속 검토 |
| 619 | `securities_balance::valuation_currency` | securities_balance@cash_deposit_asset | string / not_applicable | document_subject / not_applicable | 0/0 | **미등록(0%)** | source-only |
| 620 | `securities_balance::valuation_datetime` | securities_balance@cash_deposit_asset | datetime / not_applicable | document_subject / source_date_time_or_period | 1/0 | **미등록(0%)** | 평가 기준시각 보존 |

## P2 공백·반례/추가 실무 질문
1. **P2 — #610–620 적용조건 정확 ID 미등록(11건):** `securities_balance` 문서는 `cash_deposit_asset` family로 11개의 확장 원문 ID를 선언하지만 같은 family의 조건표 `fields[]`에는 11개가 없다. 기대 개별 증빙조건/대상/기간/비해당 심의 계약, 관찰 11/11 미등록. **통과 0%**. 원천 보존·추가자료 역질문/담당자 승인 대상으로 남김, 임의 계약 추가 및 법률 의미 변경 금지.
2. **P2 — 담보 등록최고액/실제 상환액 오인:** #601 현재 상환액은 정적 `context_only`, #606 등기 채권최고액은 실제 잔액/법률상 별제액이 아님. `security_register`와 `mortgage_balance` 2개 원천 route는 담보 2건을 뜻하지 않는다. #602 담보 식별, #604 제공자, #608 채권자, #603 말소일, #607 설정일, 별도 상환기준일/원문 채권잔액·소유자·지분·관할 확인. #601 temporal_role=not_applicable라서 기간 게이트 false인 점은 상환기준일을 불필요하다고 법적으로 승인한 것이 아님.
3. **P2 — 증권 계좌 소유자·통화·미결제 항목:** #612 현금잔고, #613 수량, #618 미결제 채무, #619 통화, #620 평가시각 각각 분리; #615 상품 식별자와 #610 계좌 커버리지로 동일성 대조. 다른 `cash_deposit_asset::gross_value` 기본 피처와 이름만으로 동일 자산·중복계상 처리 금지. 환율·소유권·미결제 결제일·평가시점 검토 전 자동 KRW 환산/차감·청산가치 합산 금지.
4. **법률/서식/갈음·보정:** source-only 20개는 미사용/삭제가 아니라 증거·검산·역질문·법률 근거 확인 대기. 정규식 `reviewScope` 법원서식 후보가 있다고 D5101/D5106/D5110 token 직접 사용/법원 제출 가능 판정 금지. 법률위험/예외의 정식 증거 계약·관할/시행일과 공식 양식, 변호사 실승인 없으면 미인증. 갈음·법원 보정의 행위 완료는 실제 수기/문서/접수증과 별도로 검증해야 함.

## 중앙 보드 A3 체크 연결: 전부 [ ] 유지
- `A3-IT-002`: 20 ID/29슬롯 source/typed/calc/legal/form 실제 정적 선언 소비처 조회; 실제 기능/운영 E2E 미인증.
- `A3-DOC-010`: 주식/증권 잔고 #610–620의 통화·상품·수량·계좌·평가일 증빙/갈음 검토 필요.
- `A3-CALC-006`: #601 실제 상환액과 #606 등록최고액 분리; 별제권/청산가치 산식 승인 없음.
- `A3-LAW-003`: 담보·우선순위/증권 실소유·면제 및 법률 인정은 변호사·공식 자료 확인 전 0% 승인.
- `A3-DATA-008`: 출처 29/29 locator + 다중행 분리 정책은 선언 확인, 실제 D1 복수주체·행·동일성 저장/조회 미실행.
- 실제 고객 원본 OCR/PDF, 개인정보, 정답, 키/.env를 공개 Git에 기록하지 않았다. 제품코드/운영 DB·D1마이그레이션/실제 전자제출/인가/배포 변경 없음. 정적 코드 존재 ≠ 단위시험 ≠ 전체 CI ≠ staging ≠ 공식 서식·변호사 승인.

**다음 시작:** #621 `securities_balance::valuation_method`, 범위 #621–640; AX담당자 우선 순환. 소비처 심층 누적 **620/693 (89.5%)**, 잔여 73개, A3 인수 완료 **0/124**. 전체 Node CI·staging D1/R2/Cron·공식 서식/변호사 승인·운영 배포 모두 미인증.
