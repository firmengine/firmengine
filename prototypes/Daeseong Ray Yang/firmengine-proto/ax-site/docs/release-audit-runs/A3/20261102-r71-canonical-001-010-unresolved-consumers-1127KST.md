# FirmEngine A3 r71 — #001~010 재감사 및 미해결 #675/#682/#683/#693 소비처·형식 게이트

**2026-11-02 KST**, 시작 최신 `main` HEAD `2d5df85bd0084be75cf9d9eac0cf03a3adac51ae`; 영수증 쓰기 직전 HEAD `2d5df85bd0084be75cf9d9eac0cf03a3adac51ae`. **수정 범위** `prototypes/Daeseong Ray Yang/firmengine-proto/ax-site/` 내부만. 이전 [r70 #681–693](20261102-r70-canonical-681-693-consumer-recheck-1023KST.md) 후속이며 #694는 생성하지 않는다. 회차 역할 순환 **AX → IT → 사용자·서류 → 계산사무장 → 변호사**; 다음 순환 **데이터**. 선택 체크 ID **`A3-AX-002`, `A3-IT-002`, `A3-DOC-005`, `A3-CALC-001`, `A3-LAW-005`**, 모두 **[ ]** (부분 검증만).

## 1. 고정 범위·전수 목록

실제 GitHub `main` 인덱스 `lib/canonical-field-id-index.json`을 열어 **693개 순번을 모두 아래에 직접 열거**했다. 문서 기준정보 `document-agent-field-contracts.json` 기본 family + `shared-document-field-contracts.json` 문서 확장 + `ocr-field-supplements.json` 추가를 실제 합성한 결과 **693 canonical 고유 ID / 85 서류 / 48 패밀리 / 1808 원천 슬롯**. 원천 고아 0, 동일 document-family 내 중복 0, 등록 ID 중 원천 없는 것 0. 적용조건은 `field-applicability-contracts.json` **정확 ID·sourceCondition 등록 여부**로만 판정하며 등록=법원/변호사 승인 아님.

이번 실제 정확 ID 조회 **14개 / 14개 선언 슬롯 / 3종 서류 / 3패밀리**: 순차 미해결 검토 #001–010 **10개** + r69/r70 상속 고위험 #675/#682/#683/#693 **4개**. 각 필드의 `source_locator_required` 또는 `required_source_anchor`, `recordPolicy.noCrossRecordBorrowing`, sourceCondition는 14/14 **등록 선언**. **실 PDF/페이지·bbox/복수행 재판독, D1 원문 read-back은 0건 관찰**이며 선언값을 실제 보존의 증명으로 오인하지 않는다. 서류 묶음: `litigation_record`의 압류 10개, `vehicle_valuation`의 차량 2개, `salary_withholding`의 원천징수 2개.

P/U/A/L/X = 원본 `hasPeriod` 대상 / `hasUnit` 대상 / 정확 적용조건 sourceCondition / 원문 locator 선언 / 원천 행 사이 값 차용 금지 선언. `0` 소비처 개수는 원문 미관찰·금액 0·승인 비해당와 **전혀 다르다**.

| # | canonical ID | 서류 / family (원천 슬롯) | 자료형; 원단위; 시간역할; 대상자 | P/U/A/L/X | 정확 사용처 (정적) | source-only 유지/추가 질문 |
|---:|---|---|---|:---:|---|---|
| 1 | `account_garnishment::account_holder` | `litigation_record` / `account_garnishment` (1) | `party_role`; `not_applicable`; `not_applicable`; `account_holder` | N/N/Y/Y/Y | typed=0; material=`none`; exact form=0; exact legal seed=0 | 원문 검산·대상/기간·역질문용 보존; 자동 계산/법률승격 금지 |
| 2 | `account_garnishment::account_id` | `litigation_record` / `account_garnishment` (1) | `identifier`; `not_applicable`; `not_applicable`; `account_holder` | N/N/Y/Y/Y | typed=0; material=`none`; exact form=0; exact legal seed=0 | 원문 검산·대상/기간·역질문용 보존; 자동 계산/법률승격 금지 |
| 3 | `account_garnishment::court_or_authority` | `litigation_record` / `account_garnishment` (1) | `party_role`; `not_applicable`; `not_applicable`; `account_holder` | N/N/Y/Y/Y | typed=0; material=`none`; exact form=0; exact legal seed=0 | 원문 검산·대상/기간·역질문용 보존; 자동 계산/법률승격 금지 |
| 4 | `account_garnishment::creditor` | `litigation_record` / `account_garnishment` (1) | `party_role`; `not_applicable`; `not_applicable`; `account_holder` | N/N/Y/Y/Y | typed=0; material=`none`; exact form=0; exact legal seed=0 | 원문 검산·대상/기간·역질문용 보존; 자동 계산/법률승격 금지 |
| 5 | `account_garnishment::effective_date` | `litigation_record` / `account_garnishment` (1) | `date`; `source date format normalized to ISO without loss`; `effective_date`; `account_holder` | Y/N/Y/Y/Y | typed=0; material=`none`; exact form=0; exact legal seed=0 | 원문 검산·대상/기간·역질문용 보존; 자동 계산/법률승격 금지 |
| 6 | `account_garnishment::garnishment_amount` | `litigation_record` / `account_garnishment` (1) | `money`; `currency and exact source unit if monetary`; `not_applicable`; `account_holder` | N/Y/Y/Y/Y | typed=0; material=`none`; exact form=0; exact legal seed=0 | 원문 검산·대상/기간·역질문용 보존; 자동 계산/법률승격 금지 |
| 7 | `account_garnishment::issue_date` | `litigation_record` / `account_garnishment` (1) | `date`; `source date format normalized to ISO without loss`; `document_issue_date`; `account_holder` | Y/N/Y/Y/Y | typed=0; material=`none`; exact form=0; exact legal seed=0 | 원문 검산·대상/기간·역질문용 보존; 자동 계산/법률승격 금지 |
| 8 | `account_garnishment::released_amount` | `litigation_record` / `account_garnishment` (1) | `money`; `currency and exact source unit if monetary`; `not_applicable`; `account_holder` | N/Y/Y/Y/Y | typed=0; material=`none`; exact form=0; exact legal seed=0 | 원문 검산·대상/기간·역질문용 보존; 자동 계산/법률승격 금지 |
| 9 | `account_garnishment::seized_amount` | `litigation_record` / `account_garnishment` (1) | `money`; `currency and exact source unit if monetary`; `not_applicable`; `account_holder` | N/Y/Y/Y/Y | typed=0; material=`none`; exact form=0; exact legal seed=0 | 원문 검산·대상/기간·역질문용 보존; 자동 계산/법률승격 금지 |
| 10 | `account_garnishment::status` | `litigation_record` / `account_garnishment` (1) | `category`; `not_applicable`; `not_applicable`; `account_holder` | N/N/Y/Y/Y | typed=0; material=`none`; exact form=0; exact legal seed=0 | 원문 검산·대상/기간·역질문용 보존; 자동 계산/법률승격 금지 |
| 675 | `vehicle_valuation::market_value` | `vehicle_valuation` / `vehicle_valuation` (1) | `money`; `currency and exact source unit if monetary`; `not_applicable`; `owner_legal` | N/Y/Y/Y/Y | typed=0; material=`must_reconcile`; exact form=0; exact legal seed=0 | 같은 차량·소유자·평가시점 확인 전 자산가치 법적 인정 금지 |
| 682 | `vehicle_valuation::vehicle_id` | `vehicle_valuation` / `vehicle_valuation` (1) | `identifier`; `not_applicable`; `not_applicable`; `owner_legal` | N/N/Y/Y/Y | typed=0; material=`none`; exact form=0; exact legal seed=0 | 원문 검산·대상/기간·역질문용 보존; 자동 계산/법률승격 금지 |
| 683 | `wage_withholding_tax::income.tax.employment_start_end` | `salary_withholding` / `wage_withholding_tax` (1) | `date_range`; `not_applicable`; `period_scope`; `applicant_debtor` | Y/N/Y/Y/Y | typed=0; material=`none`; exact form=0; exact legal seed=0 | 원문 검산·대상/기간·역질문용 보존; 자동 계산/법률승격 금지 |
| 693 | `wage_withholding_tax::income.tax.year_end_adjustment` | `salary_withholding` / `wage_withholding_tax` (1) | `money_or_status`; `KRW`; `tax_period_year`; `applicant_debtor` | Y/Y/Y/Y/Y | typed=0; material=`none`; exact form=0; exact legal seed=0 | 원문 검산·대상/기간·역질문용 보존; 자동 계산/법률승격 금지 |

원문 `document_id/page/record_ordinal/field_ordinal/source_sha256/quote/bbox`를 요구하는 정책과 SQL `extraction_records`, `extracted_features.raw_value_json/canonical_field_id/source_state`, `extraction_field_coverage` 구조는 **선언 및 코드 경로만 확인**했다. `lib/canonical-field-binding.ts`의 이 세 family 직접 typed 투영은 **0/14**; `material-calculation-source-gate.ts`는 #675 한 항목에 `must_reconcile → asset.grossValue`, 나머지는 정확 직접 material 계약 0. `OCR_DECLARED_FORM_TARGETS` 정확 토큰 0/14, 정적 법률 인정 계약 `LEGAL_EVIDENCE_POLICY_SEED.checks=[]`로 **승인 0/14**; 관리형 동적 정책 미조회. `formCandidates`, `reviewScope`, workflow/risk 후보는 공식 법원서식 값과 법률상 필수/인가 결론이 아니다.

18개 계산/91개 입력선언(78 고유), 95개 위험/50개 규칙/46개 예외 카탈로그를 실제 조회했으나 **실 typed→18산식→법률→서식 E2E 실행은 0건**. 정확 토큰 0개를 불필요 또는 삭제로 판단하지 않는다. `document-substitution.ts`, `preapproval-correction-audit.ts`는 관련 원본 정적 조회만 했으며 사건별 갈음 B+C/철회, 법원 보정명령 원문·기한·접수증, 공식 양식/변호사 승인 **미검증**.

## 2. 형식 게이트 실제 원본문 격리 시험 18건

`lib/ocr-calculation-input.ts` SHA `8f7f51bf41f7c944b76419d7cc894e49ac771473`에서 `validDate/validTime/calculationSourceCellIssues` **실제 함수본문**을 가져와 TS 타입주석만 제거한 V8 실행. `normalizeMoney`는 **합성 KRW 정수 stub**이며 실제 정상화/Node import/DB 기록/전체 제품 계산 실행이 아님. 표의 기존 동작 독립 예상값을 사전 기재하고 출력 비교. 모든 입력은 **가상 문자열/날짜/금액**이며 어떤 고객 원문도 포함하지 않는다.

| 시나리오 | type / value / unit / sourceState | 기존 함수 예상 | 관찰 | 업무상 안전 기대와 비교 |
|---|---|---|---|---|
| #683 invalid range | `date_range` / `not/a/range` / `null` / `present` | `[]` | `[]` | **업무상 독립 안전 기대 미충족** (`SOURCE_DATE_RANGE_INVALID`) |
| #683 valid ISO range | `date_range` / `2025-01-01/2025-12-31` / `null` / `present` | `[]` | `[]` | 안전 기대 일치 |
| #683 reversed dates | `date_range` / `2025-12-31/2025-01-01` / `null` / `present` | `[]` | `[]` | **업무상 독립 안전 기대 미충족** (`SOURCE_DATE_RANGE_INVALID`) |
| #683 invalid leap day | `date_range` / `2025-02-29/2025-03-30` / `null` / `present` | `[]` | `[]` | **업무상 독립 안전 기대 미충족** (`SOURCE_DATE_RANGE_INVALID`) |
| #693 numeric missing unit | `money_or_status` / `1234` / `null` / `present` | `[]` | `[]` | **업무상 독립 안전 기대 미충족** (`SOURCE_MONETARY_UNIT_MISSING`) |
| #693 numeric KRW | `money_or_status` / `1234` / `KRW` / `present` | `[]` | `[]` | 안전 기대 일치 |
| #693 text status | `money_or_status` / `pending` / `null` / `present` | `[]` | `[]` | 안전 기대 일치 |
| #693 numeric USD | `money_or_status` / `1234` / `USD` / `present` | `[]` | `[]` | **업무상 독립 안전 기대 미충족** (`SOURCE_MONEY_NOT_EXACT_KRW`) |
| #001 named party | `party_role` / `synthetic account holder` / `null` / `present` | `[]` | `[]` | 안전 기대 일치 |
| #006 money no unit | `money` / `12000` / `null` / `present` | `SOURCE_MONETARY_UNIT_MISSING` | `SOURCE_MONETARY_UNIT_MISSING` | 안전 기대 일치 |
| #006 money KRW | `money` / `12000` / `KRW` / `present` | `[]` | `[]` | 안전 기대 일치 |
| #007 impossible date | `date` / `2025-02-30` / `null` / `present` | `SOURCE_DATE_INVALID` | `SOURCE_DATE_INVALID` | 안전 기대 일치 |
| #010 source status | `category` / `active` / `null` / `present` | `[]` | `[]` | 안전 기대 일치 |
| #006 explicit none | `money` / `null` / `null` / `explicit_none` | `[]` | `[]` | 안전 기대 일치 |
| #006 not seen | `money` / `null` / `null` / `not_seen` | `[]` | `[]` | 안전 기대 일치 |
| #006 present zero | `money` / `0` / `KRW` / `present` | `[]` | `[]` | 안전 기대 일치 |
| #006 conflicting | `money` / `12000` / `KRW` / `conflicting` | `[]` | `[]` | 안전 기대 일치 |
| #006 missing quote | `money` / `12000` / `KRW` / `present` | `SOURCE_QUOTE_MISSING` | `SOURCE_QUOTE_MISSING` | 안전 기대 일치 |

**현재 함수 재현 18/18 일치** (코드 분기 확인). 별도의 **업무상 안전 기대 13/18 일치**, 불일치 **5건**: #683 부정확한 `date_range` 3종 무경고, #693 금액형 문자열의 단위 누락·USD 2종 무경고. 이는 **좁은 calculation source cell 형식검사 범위 공백(P2 후보)**이며 OCR 전체 파서/후속 gate/실제 원화 계산/법원 문서 오류 입증은 아니다. 본 검사는 `date_range`의 한글·비ISO·표 분할과 `money_or_status`의 환급/추징/진행상태 의미를 법률적으로 정의하지 못하므로 임의 런타임 변경하지 않았다. 올바른 고객 원문이 아닌 값으로 자동 0원·환급·변제 가용소득 승격 금지. `sourceState=not_seen`, 명시적 `null`, 관찰된 `0`, 승인된 `not_applicable`, `conflicting`, `source-only`, `승인 전`을 별도로 관리한다.

### P2 진단 PR 및 겹침 확인

- **[Draft PR #169](https://github.com/firmengine/firmengine/pull/169)**: 분리 브랜치 `audit/a3-r71-ocr-date-range-settlement-format-diagnostic-20261102`, `tests/a3-r71-ocr-format-diagnostics.test.ts` **합성 테스트 파일 1개만 작성**. 4개 Node 테스트 블록 중 2개는 **의도된 RED**. GitHub에 테스트를 등록한 사실은 실제 Node 실행이나 CI 통과를 뜻하지 않으며, 검토 전 병합 금지.
- 기존 **[Draft PR #51](https://github.com/firmengine/firmengine/pull/51)**: family에서 기간요구 과잉으로 선언되는 메타 87개 영향; 이번 r71 형식 데이터타입 검사와 **다른 책임 경계**. #688/#690/#692 기간·단위 분류 문제 중복 수정 금지.
- 기존 **[Draft PR #155](https://github.com/firmengine/firmengine/pull/155)**: 차량 #675 시가 Fact를 #682 차량 식별자 및 소유자·평가기준일 확인 없이 타 typed 자산에 금액만 결속하는 위험. 기존 PR은 부동산 원본문 격리 진단이며 차량 전체 계산 실증 아님. 사람 정의 없이 `fact.subjectId === asset.id` 같은 임의 동일 ID 룰 추가 금지.

압류 #006 청구/압류 관련 금액, #008 해제액, #009 실제 압류액은 경제·법률 의미가 다르며 계좌 명의/채권자/기관/효력일/해제 상태를 확인하지 않고 채무·청산가치 계산에 합산·차감 금지. #683 고용기간은 #684 연간 총급여 및 세액, #693 연말정산 처리방향과 별도; 환급과 추징을 같은 부호로 소득/세금에 중복 반영 금지. source-only 원문은 검산·역질문·법적 근거 확인을 위해 보존.

## 3. 담당별 보드 체크 ID 결과 (5건 모두 **[ ]**)

| 역할 / ID | 본 회차 실제 근거 | 남은 승인·시험 |
|---|---|---|
| AX `A3-AX-002` | #001–010 10 source-only 등록과 #683/#693 상태형 gate 18회 격리, 원본 보존/비승격 원칙 정적 확인 | 실 OCR·소스 상태변경·모델 재추출 E2E 및 공식 요구 검수 |
| IT `A3-IT-002` | 14 exact canonical source 슬롯·등록, typed0, material #675 1, exact form0, 승인법률0; 693/85/48/1808 전수 조인 | 관리 법률 승인, 18계산 실제 실행·연쇄 lineage read-back |
| 사용자·서류 `A3-DOC-005` | `litigation_record` #001–010의 계좌/법원/채권자·발급/효력일·압류/해제 상태 각각 분리 | 집행권원 원문, 대상계좌·사건번호, A←B+C 갈음, 실제 법원보정 제출/영수증 |
| 계산사무장 `A3-CALC-001` | #683 원천징수 기간과 #693 금액/상태 형식 5개 안전불일치 중 5개 재현, 18/91/78 선언 확인 | 실 소득·세액/월 인정금액 회귀, 연말정산 금액 부호/단위 승인·총계 일치 |
| 변호사 `A3-LAW-005` | 압류액/집행액·해제 상태와 채무원금/법적 효력 구분; 95/50/46 정적 카탈로그, 승인 seed 0 | 관할/시행일/채권 분류·법적 증거계약, 공식 서식/변호사 승인, 실 원문 |

**정확 검증 수준:** 원본 기준정보 정적 조회, 693 전수 join, 14 개별 필드·선언 슬롯 조회, 18회 원본문 **V8 격리 합성 실행**, Draft 테스트 코드 등록만. 최신 전체 Node 프로젝트 테스트/CI, staging D1/R2/Cron, 공식 법원 서식·법률 인정/변호사 승인, 운영 배포·마이그레이션·전자제출은 **미실행·미인증**. **A3 순차 정적 조사 693/693 유지, 최종 인수 0/124**. 미등록·미승인 법률 요건은 해당 승인 게이트 **0%**. 다음 세부조사 시작 canonical **#011 `accounting_source::account_name`**, #011–020 및 #683/#693 후속, 역할 **데이터 담당자**.

## 4. 원문 blob SHA (본 회차 재조회)

| 파일 | Git blob SHA |
|---|---|
| `lib/canonical-field-id-index.json` | `27ecdddd208de82a2f5c675e7482485e3a8838c2` |
| `lib/document-agent-field-contracts.json` | `9884b3fecf44643fefcdc4a421ed66ffc5477b3a` |
| `lib/shared-document-field-contracts.json` | `9decab974e0909ae24ad927bdfe241d75b71f3a9` |
| `lib/ocr-field-supplements.json` | `63b2bf853acb2e9620a6fb72377dc278ff3cd2a5` |
| `lib/field-applicability-contracts.json` | `6076b26f782c4643a21a7b2f1a8f6261bb588b68` |
| `lib/reference-decision-tables.json` | `6924e3977caf748ce8a3d617fae15aff7d2fe2ce` |
| `lib/risk-catalog.json` | `e96dd0926e3ae9be5a5573d4551538ba294c4d2e` |
| `lib/legal-catalog.json` | `b0898d74f1df69b19ecf6e81cdff0ed09e8d885e` |
| `lib/legal-exceptions.json` | `6e51197226bfd8320e1147d8df3f12c11e00927c` |
| `lib/ocr-calculation-input.ts` | `8f7f51bf41f7c944b76419d7cc894e49ac771473` |
| `lib/feature-lineage-audit.ts` | `de81bc3b8c460b8a4dde3fda9e13087e619e74ff` |
| `lib/canonical-field-binding.ts` | `60ee5c7762d52b72a165b4f4f8214680eb98f148` |
| `lib/material-calculation-source-gate.ts` | `0286b44484913b63fa8ec3f7bf0ca59b034d0dab` |
| `lib/ocr-chain-matrix.ts` | `977de86ba698bd805cc6b95d1384e3b49d0dbb4c` |
| `lib/legal-evidence-criteria.ts` | `6c0b94535700d4fa4d356f8a91d5b9440b5ac52a` |
| `docs/PRODUCT_RELEASE_INTEGRATION_BOARD.md` | `13b41257c1c99e655c71ad0b21897af29b26df75` |

<details><summary>실제 최신 인덱스 canonical ID 693개 전체 순번 (법률 인정 목록 아님)</summary>

1. `account_garnishment::account_holder`
2. `account_garnishment::account_id`
3. `account_garnishment::court_or_authority`
4. `account_garnishment::creditor`
5. `account_garnishment::effective_date`
6. `account_garnishment::garnishment_amount`
7. `account_garnishment::issue_date`
8. `account_garnishment::released_amount`
9. `account_garnishment::seized_amount`
10. `account_garnishment::status`
11. `accounting_source::account_name`
12. `accounting_source::closing_balance`
13. `accounting_source::credits`
14. `accounting_source::debits`
15. `accounting_source::entity`
16. `accounting_source::issue_date`
17. `accounting_source::opening_balance`
18. `accounting_source::period_end`
19. `accounting_source::period_start`
20. `accounting_source::source_total`
21. `applicant_narrative_statement::identity.statement.admission_or_correction`
22. `applicant_narrative_statement::identity.statement.author`
23. `applicant_narrative_statement::identity.statement.event_end`
24. `applicant_narrative_statement::identity.statement.event_start`
25. `applicant_narrative_statement::identity.statement.narrative_text`
26. `applicant_narrative_statement::identity.statement.signature_status`
27. `applicant_narrative_statement::identity.statement.signed_at`
28. `applicant_narrative_statement::identity.statement.source_references`
29. `applicant_narrative_statement::identity.statement.statement_version`
30. `applicant_narrative_statement::identity.statement.topic`
31. `application_identity_venue::procedure.application.accepted_at`
32. `application_identity_venue::procedure.application.address`
33. `application_identity_venue::procedure.application.applicant_name`
34. `application_identity_venue::procedure.application.case_number`
35. `application_identity_venue::procedure.application.court`
36. `application_identity_venue::procedure.application.jurisdiction_exception`
37. `application_identity_venue::procedure.application.ordinary_venue_basis`
38. `application_identity_venue::procedure.application.phone_home`
39. `application_identity_venue::procedure.application.phone_mobile`
40. `application_identity_venue::procedure.application.phone_work`
41. `application_identity_venue::procedure.application.resident_id`
42. `application_identity_venue::procedure.application.ruleset_id`
43. `application_identity_venue::procedure.application.submitted_at`
44. `application_identity_venue::procedure.application.transition_rule`
45. `application_identity_venue::procedure.application_date`
46. `application_identity_venue::procedure.venue`
47. `asset_transfer_disposition::asset_id`
48. `asset_transfer_disposition::consideration`
49. `asset_transfer_disposition::market_value`
50. `asset_transfer_disposition::proceeds_received`
51. `asset_transfer_disposition::registration_date`
52. `asset_transfer_disposition::relationship`
53. `asset_transfer_disposition::review_status`
54. `asset_transfer_disposition::transaction_date`
55. `asset_transfer_disposition::transferee`
56. `asset_transfer_disposition::transferor`
57. `asset_transfer_disposition::use_of_proceeds`
58. `bank_account_balance::account_holder`
59. `bank_account_balance::account_id`
60. `bank_account_balance::account_status`
61. `bank_account_balance::balance`
62. `bank_account_balance::balance_as_of`
63. `bank_account_balance::currency`
64. `bank_account_balance::institution`
65. `bank_account_balance::issue_date`
66. `bank_transactions::account_id`
67. `bank_transactions::amount`
68. `bank_transactions::counterparty`
69. `bank_transactions::direction`
70. `bank_transactions::issue_date`
71. `bank_transactions::memo`
72. `bank_transactions::period_end`
73. `bank_transactions::period_start`
74. `bank_transactions::post_balance`
75. `bank_transactions::transaction_datetime`
76. `bank_transactions::transaction_id`
77. `bank_transactions::transaction_nature`
78. `business_asset_inventory::acquisition_date`
79. `business_asset_inventory::book_value`
80. `business_asset_inventory::condition`
81. `business_asset_inventory::disposal_restriction`
82. `business_asset_inventory::goodwill_contract`
83. `business_asset_inventory::market_value`
84. `business_asset_inventory::quantity`
85. `business_asset_inventory::quantity_unit`
86. `business_assets_liabilities::as_of_date`
87. `business_assets_liabilities::asset_or_claim_id`
88. `business_assets_liabilities::business_entity`
89. `business_assets_liabilities::gross_value`
90. `business_assets_liabilities::item_kind`
91. `business_assets_liabilities::ownership_interest`
92. `business_assets_liabilities::payable_amount`
93. `business_assets_liabilities::period_end`
94. `business_assets_liabilities::period_start`
95. `business_assets_liabilities::receivable_amount`
96. `business_assets_liabilities::secured_payoff`
97. `business_costs_and_ledgers::income.business_cost.accounting_basis`
98. `business_costs_and_ledgers::income.business_cost.business_continuity_flag`
99. `business_costs_and_ledgers::income.business_cost.business_entity`
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

</details>
