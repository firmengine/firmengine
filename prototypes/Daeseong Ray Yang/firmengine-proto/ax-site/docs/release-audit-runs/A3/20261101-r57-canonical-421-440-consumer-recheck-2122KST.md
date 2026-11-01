# FirmEngine A3 r57 — canonical #421–440 피처 소비처 심층 재감사 (2026-11-01, KST)

## 범위·직전 이력·담당 순환
- `firmengine/firmengine` **main 시작 SHA `0998d1ca7d0f6293672ab9c41ed437812423d73b`**. 오직 `prototypes/Daeseong Ray Yang/firmengine-proto/ax-site/` 아래만 감사/수정. 직전 [r56 #401~420](20261101-r56-canonical-401-420-consumer-recheck-2025KST.md)과 이전 동일범위 [r22 #421~440](20261031-r22-canonical-421-440-1029KST.md) 검토 후 최신 인덱스를 다시 조인.
- 이번 순환 **데이터 → IT → 사용자·서류 → 계산사무장 → 변호사**. 중앙 보드 `A3-DATA-004`, `A3-IT-017`, `A3-DOC-008`, `A3-CALC-005`, `A3-LAW-005` **5개 모두 부분 검증 [ ] 유지**. 다음 회차 AX 먼저.
- 원본 JSON 조인과 **실제 V8 원본 `hasPeriod`·`hasUnit` 각각 40회(총 80호출)**, 원본 `reviewScope` 3개 family 실행. 이번 단언 **25/25 조건 일치**, 앞선 같은 회차 대표원본 술어 10개 입력의 독립 기대/관찰 **10/10 일치**. Node 전체 테스트·실제 OCR·D1/R2/Cron/공식서식/변호사 승인·배포가 아니다.

## 최신 693개 전체 인덱스/원천 출처 조인
- 693 고유 ID, 인덱스 중복/고아 0, **48개 family/85개 서류/1,808개 문서·패밀리·필드 연결**. #421–440 **20 ID/40 연결/5서류**, 모든 ID에 source route 두 개.
- **L** 소송 10 ID: `litigation_record`, `receivable_collectability` × `litigation_enforcement` → 20 슬롯. **N** 대출 약정 5 ID: `loan_contract` × `debt_certificate`·`bank_transactions` → 10 슬롯. **T** 지방세 5 ID: `tax_arrears`, `local_tax_assessment` × `local_tax` → 10 슬롯.
- **40/40 `required_source_anchor` 존재**(원문 문서 ID/SHA·페이지·복수행 식별·인용/bbox 요구 선언), **40/40 `recordPolicy.noCrossRecordBorrowing` 참**. 실제 PDF 각 페이지/행·원본/해시·D1 Fact 실제 저장 및 재독은 미관찰. 표의 P/U는 각 2 family-route의 실제 원본 기간/단위 술어 반환으로 **총 P20/40, U18/40**; 실제 기간/단위 법률요건 충족이 아님.
- 각 필드의 마지막 네 값은 정확 canonical **typed / 계산18·입력91 직접 경로 / 내부 OCR 선언 서식토큰 / 위험95·규칙50·예외46 정확 법률 증거계약**. 전부 0이고 material `must_reconcile/context_only` 직접 등록도 0. **0 사용≠삭제·0원·자동 비해당**. 필요 원문증거·검산·역질문·법률 검토는 별개.

| # | canonical ID | 등록 문서·family | 자료형·원단위 | 원천 대상·시간역할·금액소유자 | P(2)/U(2) | 적용조건 | typed/계산/서식/법률 |
|---:|---|---|---|---|:---:|---|:---:|
| 421 | `litigation_enforcement::claim_type` | L×2 | category / not_applicable | applicant_debtor · not_applicable · not_applicable | 0/0 ; 0/0 | 등록 | 0 / 0 / 0 / 0 |
| 422 | `litigation_enforcement::claimed_amount` | L×2 | money / currency and exact source unit if monetary | applicant_debtor · not_applicable · not_applicable | 0/0 ; 1/1 | 등록 | 0 / 0 / 0 / 0 |
| 423 | `litigation_enforcement::court_or_authority` | L×2 | party_role / not_applicable | applicant_debtor · not_applicable · not_applicable | 0/0 ; 0/0 | 등록 | 0 / 0 / 0 / 0 |
| 424 | `litigation_enforcement::enforced_amount` | L×2 | money / currency and exact source unit if monetary | applicant_debtor · not_applicable · not_applicable | 0/0 ; 1/1 | 등록 | 0 / 0 / 0 / 0 |
| 425 | `litigation_enforcement::event_date` | L×2 | date / source date format normalized to ISO without loss | applicant_debtor · event_date · not_applicable | 1/1 ; 0/0 | 등록 | 0 / 0 / 0 / 0 |
| 426 | `litigation_enforcement::issue_date` | L×2 | date / source date format normalized to ISO without loss | applicant_debtor · document_issue_date · not_applicable | 1/1 ; 0/0 | 등록 | 0 / 0 / 0 / 0 |
| 427 | `litigation_enforcement::judgment_amount` | L×2 | money / currency and exact source unit if monetary | applicant_debtor · not_applicable · not_applicable | 0/0 ; 1/1 | 등록 | 0 / 0 / 0 / 0 |
| 428 | `litigation_enforcement::parties` | L×2 | party_role / not_applicable | applicant_debtor · not_applicable · not_applicable | 0/0 ; 0/0 | 등록 | 0 / 0 / 0 / 0 |
| 429 | `litigation_enforcement::security_or_attachment` | L×2 | category / not_applicable | applicant_debtor · not_applicable · not_applicable | 0/0 ; 0/0 | 등록 | 0 / 0 / 0 / 0 |
| 430 | `litigation_enforcement::status` | L×2 | category / not_applicable | applicant_debtor · not_applicable · not_applicable | 0/0 ; 0/0 | 등록 | 0 / 0 / 0 / 0 |
| 431 | `loan_contract::contract_interest_rate` | N×2 | decimal_or_text / source rate unit | document_subject · not_applicable · not_applicable | 0/1 ; 1/1 | **미등록 0%** | 0 / 0 / 0 / 0 |
| 432 | `loan_contract::maturity_date` | N×2 | date / not_applicable | document_subject · source_date_time_or_period · not_applicable | 1/1 ; 0/0 | **미등록 0%** | 0 / 0 / 0 / 0 |
| 433 | `loan_contract::repayment_installments` | N×2 | integer / count | document_subject · not_applicable · not_applicable | 0/1 ; 1/1 | **미등록 0%** | 0 / 0 / 0 / 0 |
| 434 | `loan_contract::repayment_method` | N×2 | string / not_applicable | document_subject · not_applicable · not_applicable | 0/1 ; 0/0 | **미등록 0%** | 0 / 0 / 0 / 0 |
| 435 | `loan_contract::scheduled_payment` | N×2 | money / source currency/unit | document_subject · not_applicable · source_named_party_or_asset | 0/1 ; 1/1 | **미등록 0%** | 0 / 0 / 0 / 0 |
| 436 | `local_tax::arrears` | T×2 | money / currency and exact source unit if monetary | taxpayer · not_applicable · taxpayer | 1/1 ; 1/1 | 등록 | 0 / 0 / 0 / 0 |
| 437 | `local_tax::as_of_date` | T×2 | date / source date format normalized to ISO without loss | taxpayer · balance_as_of_date · not_applicable | 1/1 ; 0/0 | 등록 | 0 / 0 / 0 / 0 |
| 438 | `local_tax::assessed_amount` | T×2 | money / currency and exact source unit if monetary | taxpayer · not_applicable · taxpayer | 1/1 ; 1/1 | 등록 | 0 / 0 / 0 / 0 |
| 439 | `local_tax::authority` | T×2 | party_role / not_applicable | taxpayer · not_applicable · not_applicable | 1/1 ; 0/0 | 등록 | 0 / 0 / 0 / 0 |
| 440 | `local_tax::collection_cost` | T×2 | money / currency and exact source unit if monetary | taxpayer · not_applicable · taxpayer | 1/1 ; 1/1 | 등록 | 0 / 0 / 0 / 0 |

## 테스트 입력 / 독립 기대 / 관찰 영수증
| 실행한 입력/원본 | 독립 기대 | 실제 관찰 | 검증 수준 |
|---|---|---|---|
| 693 인덱스+48기본 패밀리+85서류+확장+보강 | 693/85/48/1808, 고아0 | **693/85/48/1808, 고아0** | 원본 정적 조인 |
| 인덱스 #421–440/문서 route | L20+N10+T10=40슬롯, 문서5 | **20 ID/40슬롯/5서류** | 개별 ID 출처 조회 |
| source locator / 복수행 차용 금지 | 40/40 | **40/40, 40/40** | 선언만; 실제 문서·DB 미실행 |
| exact applicability | L10+T5 등록, N5 미등록 | **15/20 등록, #431–435 미등록 5** | 미등록은 각각 0% |
| 원본 `hasPeriod/hasUnit` 각각40 실행 | P20/U18 | **P20/U18, 80 원본술어 실행** | V8 격리, Node CI 아님 |
| 25개 독립 등록/소비처 단언 | 오류0 | **25/25 일치** | 정적·V8 |
| 명시 typed/계산/서식 토큰/material | exact 0 | **0/20 각각** | 실제 DB/금액/서식 미검증 |
| 18 산식/91 선언입력, 위험95/규칙50/예외46 | 18/91; 95/50/46 | **18/91; 95/50/46**, 위험 88개 필수 피처 미정의 | 계약 집계, 사람승인 0% |
| 원본 `reviewScope` 지방세/공과금/소송 | 분기별 후보 다름 | `local_tax`→EVIDENCE_INDEX; `tax_public_arrear`→D5106, D5110; `litigation_enforcement`→D5100, D5105 | 검토 후보 함수, 법적 판정 아님 |

## P2 공백과 계산·법률/서식 소비처 후보
1. **P2: #431–435 대출약정 5개 적용조건 미등록.** `contract_interest_rate`, `maturity_date`, `repayment_installments`, `repayment_method`, `scheduled_payment`은 `loan_contract` 문서에서 2 family가 재사용하지만 정확 `field-applicability-contracts.json` ID가 없다. 각각 **0%**. 금리(decimal/rate)·회차(integer/count)·예정상환액(원통화)은 현 채무원금/최종 변제액이 아님; 원문 행·당사자·만기일·계약판본 별도 검증/서류역질문 필요.
2. **P2: 개별 시간역할 비해당인데 기간 true인 12 source route.** `loan_contract::contract_interest_rate`, `repayment_installments`, `repayment_method`, `scheduled_payment`의 **bank_transactions family 각 1슬롯(4)** 및 `local_tax::arrears`, `assessed_amount`, `authority`, `collection_cost`의 **2문서×4=8슬롯**. 세금 과세기간·기준일 자체는 필수일 수 있어 필드 단위 플래그를 맹목적 삭제 금지. 기존 Draft PR #51의 동일 소스 변경과 충돌 위험: 검토 후 처리.
3. **P2: 지방세 검토 후보 분류의 차이.** 원본 `reviewScope('local_tax')`는 `EVIDENCE_INDEX`만, `reviewScope('tax_public_arrear')`는 `D5106, D5110` 후보. 법률상 일반/우선/별제권 분류를 확정하지 않으며, 채권·세목·시행일·관할·공식근거/변호사 검토 필요. 이번 관찰은 **후보 UI 라우팅**이지 실제 법원서식 기재 오류 재현이 아니다.
4. **비합산/소유자/시점:** #422 청구액 / #427 판결액 / #424 집행액은 서로 다른 절차금액이고 실제 회수·주체/기준일 대조가 필요. #431 금리와 #433 회차는 금액이 아님. #436 체납·#438 부과·#440 징수비용은 세목/과세기간/납부상태·연체금과 총계가 다르므로 무단 원화 합산 금지.
5. **DB Fact·갈음·법원보정:** `db/schema.ts`의 `extraction_records/extracted_features/extraction_field_coverage`, `case-requirement-field-plan.ts`의 `mappingStatus:review_required`, `case-substitution-watch.ts`, `preapproval-correction-item-store.ts` 코드 경계를 조회했다. 문서/페이지/복수행·원문 해시·대상/기간/Fact/typed, 사건 B+C 대체 승인, 법원 보정명령 인용·접수증, 공식서식·직원/변호사 승인까지 이 20 ID가 **실제 사건에서 소비되는 E2E는 미관찰**. source-only는 증거·검산·역질문 후보로 보존한다.
6. **정책 고위험 경계:** 법률·산식 의미 변경은 main 즉시 수정 금지. 이 회차 제품 코드/실 고객/키/.env/원본 OCR 정답 변경·공개 반영 없음. 운영배포/D1운영 migration/전자제출/법원 인가확정 **미실행**.

## 5개 중앙 인수 체크 ID — 모두 [ ] 유지
- `A3-DATA-004`: 20 source ID/40슬롯·18계산/91입력 exact0, 실제 Fact/typed 재독 미검증.
- `A3-IT-017`: 원문 locator/복수행 차용금지 40/40 선언, 실제 D1/R2 SHA/페이지 재독 미인증.
- `A3-DOC-008`: 지방세 2서류/5 ID/10슬롯, 세목·기간·징수비용, 갈음/법원 보정 미검증.
- `A3-CALC-005`: 소송 청구·판결·집행/대출약정/지방세 원금·비용 비합산, 실제 계산 미실행.
- `A3-LAW-005`: 법률 위험95/규칙50/예외46 exact 0, 관할·시행일·변호사 승인 미검증.

## 다음 인수
- **다음 #441 `local_tax::issue_date`, 범위 #441~460**, **AX담당자 먼저**. 누적 심층 소비처 **440/693 (63.5%)**, 잔여 **253**, A3 체크 ID 124개 최종 인수 **0개**; 최초 693/693 정적 조사는 다른 층.
- 전체 Node/CI·staging D1/R2/Cron·실제 OCR/원문·공식 서식·변호사 승인·사이트 배포 **전부 별도 미인증**.

## 원본 파일/Blob SHA
- `lib/ocr-field-supplements.json` `63b2bf853acb2e9620a6fb72377dc278ff3cd2a5`
- `lib/canonical-field-id-index.json` `27ecdddd208de82a2f5c675e7482485e3a8838c2`
- `lib/field-applicability-contracts.json` `6076b26f782c4643a21a7b2f1a8f6261bb588b68`
- `lib/document-agent-field-contracts.json` `9884b3fecf44643fefcdc4a421ed66ffc5477b3a`
- `lib/risk-catalog.json` `e96dd0926e3ae9be5a5573d4551538ba294c4d2e`
- `lib/legal-exceptions.json` `6e51197226bfd8320e1147d8df3f12c11e00927c`
- `lib/shared-document-field-contracts.json` `9decab974e0909ae24ad927bdfe241d75b71f3a9`
- `lib/reference-decision-tables.json` `6924e3977caf748ce8a3d617fae15aff7d2fe2ce`
- `lib/legal-catalog.json` `b0898d74f1df69b19ecf6e81cdff0ed09e8d885e`
- `lib/canonical-field-binding.ts` `60ee5c7762d52b72a165b4f4f8214680eb98f148`
- `lib/ocr-chain-matrix.ts` `977de86ba698bd805cc6b95d1384e3b49d0dbb4c`
- `lib/feature-lineage-audit.ts` `de81bc3b8c460b8a4dde3fda9e13087e619e74ff`
- `lib/material-calculation-source-gate.ts` `0286b44484913b63fa8ec3f7bf0ca59b034d0dab`
